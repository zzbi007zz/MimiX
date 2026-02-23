import fs from "fs";
import path from "path";
import type { ModelMessage } from "ai";

function getSocialIdentity(): string {
    const identityChunks: string[] = [];
    const skillDir = path.resolve(__dirname, "../../.agents/skills/social-writer");

    // 1. Load the core social-writer SKILL.md
    try {
        const skillPath = path.join(skillDir, "SKILL.md");
        if (fs.existsSync(skillPath)) {
            identityChunks.push(fs.readFileSync(skillPath, "utf-8"));
        }
    } catch (err) {
        console.error("Could not load social-writer SKILL.md", err);
    }

    // 2. Load all reference guides dynamically
    try {
        const refsDir = path.join(skillDir, "references");
        if (fs.existsSync(refsDir)) {
            const files = fs.readdirSync(refsDir).filter(f => f.endsWith(".md"));
            for (const file of files) {
                const content = fs.readFileSync(path.join(refsDir, file), "utf-8");
                identityChunks.push(`### Reference: ${file}\n\n${content}`);
            }
        }
    } catch (err) {
        console.error("Could not load social-writer references", err);
    }

    if (identityChunks.length === 0) {
        return "You are an expert Social Media Strategist and Writer.";
    }

    return identityChunks.join("\n\n---\n\n");
}

export function buildSocialPrompt(chatId: string): string {
    const now = new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "full",
        timeStyle: "short",
    });

    const identityContent = getSocialIdentity();

    return `${identityContent}

## Current Time
${now} (Asia/Ho_Chi_Minh)

## Context Reminder
- Your current Chat ID is: \`${chatId}\`
- You are operating within Telegram. 
- ALWAYS use your \`webSearch\` and \`fetchUrlContent\` tools to gather background research to ensure your posts are highly specific, accurate, and relevant. 
- STRICTLY follow the "Critical Prohibitions" such as NEVER using words like "delve", "unlock", or "game-changer".`;
}

// Reuse the formatter from system.ts
export { formatMessages } from "./system";
