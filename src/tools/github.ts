import { tool } from "ai";
import { z } from "zod";
import { config } from "../config";

const GH_API = "https://api.github.com";

async function ghFetch(path: string, method = "GET", body?: unknown) {
    const res = await fetch(`${GH_API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${config.githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "Mimi-Bot/1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(`GitHub API error ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
}

// ── Create Pull Request ────────────────────────────────────────────────────────

export const createPullRequest = tool({
    description:
        "Create a GitHub pull request. Requires a GitHub token in environment.",
    parameters: z.object({
        owner: z.string().optional().describe("Repository owner (defaults to GITHUB_DEFAULT_OWNER env)"),
        repo: z.string().optional().describe("Repository name (defaults to GITHUB_DEFAULT_REPO env)"),
        title: z.string().describe("PR title"),
        body: z.string().optional().describe("PR description/body in Markdown"),
        head: z.string().describe("Branch name to merge FROM"),
        base: z.string().default("main").describe("Branch name to merge INTO (default: main)"),
        draft: z.boolean().optional().default(false).describe("Create as draft PR"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug 
    execute: async ({ owner, repo, title, body, head, base, draft }: any) => {
        if (!config.githubToken) return { error: "GITHUB_TOKEN not configured." };
        const o = owner ?? config.githubDefaultOwner;
        const r = repo ?? config.githubDefaultRepo;
        if (!o || !r) return { error: "GitHub owner/repo not specified or configured." };
        try {
            const pr = (await ghFetch(`/repos/${o}/${r}/pulls`, "POST", {
                title,
                body: body ?? "",
                head,
                base,
                draft,
            })) as { html_url: string; number: number; state: string };
            return { success: true, url: pr.html_url, number: pr.number, state: pr.state };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Get Pull Request Diff ─────────────────────────────────────────────────────

export const getPullRequestDiff = tool({
    description: "Get the diff of a GitHub pull request for code review.",
    parameters: z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        prNumber: z.number().describe("Pull request number"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug 
    execute: async ({ owner, repo, prNumber }: any) => {
        if (!config.githubToken) return { error: "GITHUB_TOKEN not configured." };
        const o = owner ?? config.githubDefaultOwner;
        const r = repo ?? config.githubDefaultRepo;
        try {
            const res = await fetch(`${GH_API}/repos/${o}/${r}/pulls/${prNumber}`, {
                headers: {
                    Authorization: `Bearer ${config.githubToken}`,
                    Accept: "application/vnd.github.diff",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "Mimi-Bot/1.0",
                },
            });
            const diff = await res.text();
            return { prNumber, diff: diff.slice(0, 20000), truncated: diff.length > 20000 };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── List Open PRs ─────────────────────────────────────────────────────────────

export const listPullRequests = tool({
    description: "List open pull requests in a GitHub repository.",
    parameters: z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        state: z.enum(["open", "closed", "all"]).optional().default("open"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug 
    execute: async ({ owner, repo, state }: any) => {
        if (!config.githubToken) return { error: "GITHUB_TOKEN not configured." };
        const o = owner ?? config.githubDefaultOwner;
        const r = repo ?? config.githubDefaultRepo;
        try {
            const prs = (await ghFetch(`/repos/${o}/${r}/pulls?state=${state}&per_page=20`)) as {
                number: number;
                title: string;
                user: { login: string };
                state: string;
                html_url: string;
                created_at: string;
            }[];
            return {
                prs: prs.map((p) => ({
                    number: p.number,
                    title: p.title,
                    author: p.user.login,
                    state: p.state,
                    url: p.html_url,
                    createdAt: p.created_at,
                })),
            };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Add PR Review Comment ─────────────────────────────────────────────────────

export const addPrReviewComment = tool({
    description: "Add a review comment to a GitHub pull request.",
    parameters: z.object({
        owner: z.string().optional(),
        repo: z.string().optional(),
        prNumber: z.number(),
        body: z.string().describe("Review comment body in markdown"),
        event: z.enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"]).default("COMMENT"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug 
    execute: async ({ owner, repo, prNumber, body, event }: any) => {
        if (!config.githubToken) return { error: "GITHUB_TOKEN not configured." };
        const o = owner ?? config.githubDefaultOwner;
        const r = repo ?? config.githubDefaultRepo;
        try {
            const review = (await ghFetch(`/repos/${o}/${r}/pulls/${prNumber}/reviews`, "POST", {
                body,
                event,
            })) as { id: number; state: string };
            return { success: true, reviewId: review.id, state: review.state };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

export const githubTools = {
    createPullRequest,
    getPullRequestDiff,
    listPullRequests,
    addPrReviewComment,
};
