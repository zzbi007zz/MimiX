import { tool } from "ai";
import { z } from "zod";
import { config } from "../config";

const DDGS_BASE = "https://api.duckduckgo.com/";

// ── Web Search ────────────────────────────────────────────────────────────────

export const webSearch = tool({
    description:
        "Search the web for current information. Returns a list of results with title, URL, and snippet. Use this to research topics, find documentation, compare libraries, or look up recent events.",
    parameters: z.object({
        query: z.string().describe("The search query"),
        maxResults: z
            .number()
            .optional()
            .default(8)
            .describe("Maximum number of results to return"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ query, maxResults }: any) => {
        // Try Tavily first (richer results) if key is configured
        if (config.tavilyApiKey) {
            try {
                const res = await fetch("https://api.tavily.com/search", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${config.tavilyApiKey}`,
                    },
                    body: JSON.stringify({
                        query,
                        max_results: maxResults,
                        include_answer: true,
                    }),
                });
                const data = (await res.json()) as {
                    answer?: string;
                    results: { title: string; url: string; content: string }[];
                };
                return {
                    source: "tavily",
                    answer: data.answer,
                    results: data.results.map((r) => ({
                        title: r.title,
                        url: r.url,
                        snippet: r.content?.slice(0, 400),
                    })),
                };
            } catch {
                // Fall through to DuckDuckGo
            }
        }

        // DuckDuckGo JSON API (no key required)
        try {
            const url = `${DDGS_BASE}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            const res = await fetch(url, {
                headers: { "User-Agent": "Mimi-Bot/1.0" },
            });
            const data = (await res.json()) as {
                AbstractText?: string;
                AbstractURL?: string;
                RelatedTopics?: { Text?: string; FirstURL?: string; Topics?: unknown[] }[];
            };

            const results: { title: string; url: string; snippet: string }[] = [];

            if (data.AbstractText) {
                results.push({
                    title: "Summary",
                    url: data.AbstractURL ?? "",
                    snippet: data.AbstractText,
                });
            }

            for (const topic of data.RelatedTopics ?? []) {
                if (results.length >= maxResults) break;
                if (topic.Text && topic.FirstURL) {
                    results.push({
                        title: topic.Text.split(" - ")[0] ?? topic.Text,
                        url: topic.FirstURL,
                        snippet: topic.Text,
                    });
                }
            }

            return { source: "duckduckgo", results };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Fetch URL Content ─────────────────────────────────────────────────────────

export const fetchUrl = tool({
    description:
        "Fetch and read the content of a webpage using the Camoufox headless browser to bypass bot protection. Returns the accessibility snapshot (cleaned text). Great for reading docs, articles, GitHub READMEs, etc.",
    parameters: z.object({
        url: z.string().url().describe("The URL to browse"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ url }: any) => {
        try {
            const camofoxUrl = "http://localhost:9377";

            // 1. Create a new headless tab
            const tabRes = await fetch(`${camofoxUrl}/tabs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: "system", sessionKey: crypto.randomUUID(), url })
            });

            if (!tabRes.ok) throw new Error(`Camofox failed to open tab: ${tabRes.status}`);
            const { tabId } = await tabRes.json() as { tabId: string };

            // 2. Extract the accessibility snapshot
            const snapRes = await fetch(`${camofoxUrl}/tabs/${tabId}/snapshot?userId=system`);
            if (!snapRes.ok) throw new Error(`Camofox failed to extract snapshot: ${snapRes.status}`);

            const data = await snapRes.json() as { snapshot: string };
            const text = data.snapshot;

            // 3. Clean up the tab immediately
            await fetch(`${camofoxUrl}/tabs/${tabId}`, { method: "DELETE" }).catch(() => { });

            return {
                url,
                method: "camofox_snapshot",
                content: text.slice(0, 15000),
                truncated: text.length > 15000,
            };
        } catch (err) {
            return { error: `Camofox fetch failed: ${String(err)}` };
        }
    },
});

export const researchTools = { webSearch, fetchUrl };
