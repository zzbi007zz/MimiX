import { tool } from "ai";
import { z } from "zod";

// ── Helper to execute gogcli ──────────────────────────────────────────────────

async function runGog(args: string[]): Promise<any> {
    const proc = Bun.spawn(["gog", "gmail", ...args], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
        throw new Error(`gogcli failed: ${stderr.trim() || stdout.trim()}`);
    }

    if (!stdout.trim()) return { success: true };

    try {
        return JSON.parse(stdout);
    } catch {
        return stdout.trim();
    }
}

// ── Search Emails ─────────────────────────────────────────────────────────────

export const searchEmails = tool({
    description:
        "Search Gmail for emails. Supports Gmail search syntax e.g. 'is:unread from:boss@corp.com', 'subject:invoice after:2024/01/01'. Returns a list of emails with body content.",
    parameters: z.object({
        query: z.string().describe("Gmail search query"),
        maxResults: z.number().optional().default(10).describe("Maximum emails to return"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ query, maxResults }: any) => {
        try {
            const data = await runGog([
                "messages",
                "search",
                query,
                "--max",
                String(maxResults),
                "--include-body",
                "--json",
            ]);

            if (!data.messages) return { message: "No emails found.", emails: [] };

            return {
                query,
                count: data.messages.length,
                emails: data.messages.map((m: any) => ({
                    id: m.id,
                    threadId: m.threadId,
                    subject: m.subject,
                    from: m.from,
                    date: m.date,
                    body: m.body?.slice(0, 2000), // Trim body for summary list
                })),
            };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Read Email ────────────────────────────────────────────────────────────────

export const readEmail = tool({
    description: "Read the full content of a specific email by its ID.",
    parameters: z.object({
        messageId: z.string().describe("Gmail message ID (from searchEmails results)"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ messageId }: any) => {
        try {
            const m = await runGog(["get", messageId, "--json"]);
            return {
                id: m.id,
                threadId: m.threadId,
                subject: m.subject,
                from: m.from,
                to: m.to,
                date: m.date,
                body: m.body?.slice(0, 8000),
                truncated: (m.body?.length || 0) > 8000,
            };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Archive Email ─────────────────────────────────────────────────────────────

export const archiveEmail = tool({
    description: "Archive an email (remove it from Inbox) by its message ID.",
    parameters: z.object({
        messageId: z.string().describe("Gmail message ID to archive"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ messageId }: any) => {
        try {
            await runGog(["batch", "modify", messageId, "--remove", "INBOX"]);
            return { success: true, message: `Email ${messageId} archived.` };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Send Email ────────────────────────────────────────────────────────────────

export const sendEmail = tool({
    description: "Send an email via Gmail.",
    parameters: z.object({
        to: z.string().describe("Recipient email address(es). Comma-separated for multiple."),
        subject: z.string().describe("Email subject"),
        body: z.string().describe("Email body (plain text)"),
        cc: z.string().optional().describe("CC email address(es)"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ to, subject, body, cc }: any) => {
        try {
            const args = ["send", "--to", to, "--subject", subject, "--body", body, "--json"];
            if (cc) {
                args.push("--cc", cc);
            }
            const res = await runGog(args);
            return { success: true, messageId: res.id, threadId: res.threadId };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

export const gmailTools = { searchEmails, readEmail, archiveEmail, sendEmail };
