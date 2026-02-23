import type { ModelMessage } from "ai";
import fs from "fs";
import path from "path";

function getIdentity(): string {
    try {
        const idPath = path.resolve(__dirname, "../../IDENTIFY.md");
        return fs.readFileSync(idPath, "utf-8");
    } catch {
        return "You are Mimi, an elite personal AI assistant.";
    }
}

export function buildSystemPrompt(
    memories: string[],
    chatId: string
): string {
    const memorySection =
        memories.length > 0
            ? `\n## Long-Term Memory\nThe following facts were remembered from previous conversations:\n${memories
                .map((m) => `- ${m}`)
                .join("\n")}`
            : "";

    const now = new Date().toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "full",
        timeStyle: "short",
    });

    const identityContent = getIdentity();

    return `${identityContent}

## Current Time
${now} (Asia/Ho_Chi_Minh)

## Tool Context
- Your current Chat ID is: \`${chatId}\`
- **Always pass this exact chatId** when calling task or memory tools (\`listTasks\`, \`addTask\`, \`updateTaskStatus\`, \`rememberFact\`, \`recallMemories\`, \`forgetMemory\`).
${memorySection}`;
}

export function formatMessages(
    rawMessages: { role: string; content: string; tool_calls: string | null }[]
): ModelMessage[] {
    const messages: ModelMessage[] = [];

    for (const msg of rawMessages) {
        if (msg.role === "user") {
            messages.push({ role: "user", content: [{ type: "text", text: msg.content }] });
        } else if (msg.role === "assistant") {
            if (msg.tool_calls) {
                try {
                    const toolCalls = JSON.parse(msg.tool_calls);
                    messages.push({
                        role: "assistant",
                        content: [
                            ...(msg.content ? [{ type: "text" as const, text: msg.content }] : []),
                            ...toolCalls,
                        ],
                    });
                } catch {
                    messages.push({ role: "assistant", content: [{ type: "text", text: msg.content }] });
                }
            } else {
                messages.push({ role: "assistant", content: [{ type: "text", text: msg.content }] });
            }
        }
    }

    return messages;
}
