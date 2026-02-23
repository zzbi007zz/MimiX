import fs from "fs";
import path from "path";
import type { ModelMessage } from "ai";

function getBlogIdentity(): string {
    const identityChunks: string[] = [];

    // 1. Load the core blog-writer identity
    try {
        const writerPath = path.resolve(__dirname, "../../blog-writer.md");
        if (fs.existsSync(writerPath)) {
            identityChunks.push(fs.readFileSync(writerPath, "utf-8"));
        }
    } catch (err) {
        console.error("Could not load blog-writer.md", err);
    }

    // 2. Load the Composio content-research-writer skill instructions
    try {
        const skillPath = path.resolve(__dirname, "../../.agents/skills/content-research-writer/SKILL.md");
        if (fs.existsSync(skillPath)) {
            identityChunks.push(fs.readFileSync(skillPath, "utf-8"));
        }
    } catch (err) {
        console.error("Could not load content-research-writer SKILL.md", err);
    }

    if (identityChunks.length === 0) {
        return "You are an expert SEO Content Strategist and Elite Ghostwriter.";
    }

    return identityChunks.join("\n\n---\n\n");
}

export function buildBlogPrompt(chatId: string): string {
    const now = new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "full",
        timeStyle: "short",
    });

    const identityContent = getBlogIdentity();

    return `${identityContent}

## Current Time
${now} (Asia/Ho_Chi_Minh)

## Context Reminder
- Your current Chat ID is: \`${chatId}\`
- You are operating within Telegram. When generating long content (like full articles), feel free to stream it. The platform handles Markdown automatically.
- ALWAYS use your \`webSearch\` and \`fetchUrlContent\` tools to gather background research, extract real-time data, and build citations before writing.`;
}

// Reuse the formatter from system.ts
export { formatMessages } from "./system";
