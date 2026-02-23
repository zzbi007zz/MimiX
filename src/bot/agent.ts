import { generateText, stepCountIs, type ModelMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { config } from "../config";
import { getMessages, saveMessage, trimMessages } from "../db";
import { openMemory } from "../db/memory";
import { buildSystemPrompt, formatMessages } from "../prompts/system";
import { systemTools } from "../tools/system";
import { researchTools } from "../tools/research";
import { taskAndMemoryTools } from "../tools/tasks";
import { githubTools } from "../tools/github";
import { gmailTools } from "../tools/gmail";

// ── Model Selection ───────────────────────────────────────────────────────────

function getLanguageModel() {
    switch (config.aiProvider) {
        case "google":
            return google(config.aiModel);
        case "openai":
            return openai(config.aiModel);
        case "9router":
            const nineRouter = createOpenAI({ baseURL: config.nineRouterBaseUrl, apiKey: config.nineRouterApiKey });
            return nineRouter(config.aiModel);
        case "anthropic":
        default:
            return anthropic(config.aiModel);
    }
}

// ── All Tools ─────────────────────────────────────────────────────────────────

const allTools = {
    ...systemTools,
    ...researchTools,
    ...taskAndMemoryTools,
    ...githubTools,
    ...gmailTools,
};

// ── Agent Run ─────────────────────────────────────────────────────────────────

export async function runAgent(
    chatId: string,
    userMessage: string,
    onUpdate?: (text: string) => void
): Promise<string> {
    // Save user message
    saveMessage(chatId, "user", userMessage);

    // Retrieve short-term history
    const rawHistory = getMessages(chatId, config.maxHistoryMessages);
    // Remove the last user message we just added (the AI SDK will get it via messages array)
    // so we don't duplicate — skip last element
    const historyWithoutLast = rawHistory.slice(0, -1);
    const formattedHistory = formatMessages(
        historyWithoutLast.map((m) => ({
            ...m,
            tool_calls: m.tool_calls ?? null,
        }))
    );

    // Retrieve long-term memories for system prompt
    const memoryResults = await openMemory.search("*", { user_id: chatId });
    const memories = memoryResults.map((m: any) => m.content);

    // Build messages array
    const messages: ModelMessage[] = [
        ...formattedHistory,
        { role: "user", content: [{ type: "text", text: userMessage }] },
    ];

    const model = getLanguageModel();

    try {
        const result = await generateText({
            model,
            system: buildSystemPrompt(memories, chatId),
            messages,
            tools: allTools,
            stopWhen: stepCountIs(10), // Allow up to 10 tool-use rounds (agentic loop)
            temperature: 0.3,
            onStepFinish({ text }: { text: string }) {
                if (onUpdate && text) {
                    onUpdate(`⏳ _Working..._\n${text.slice(0, 200)}`);
                }
            },
        });

        const responseText = result.text || "(No response generated)";

        // Save assistant response
        saveMessage(chatId, "assistant", responseText);

        // Trim old messages
        trimMessages(chatId, 100);

        return responseText;
    } catch (err) {
        const errMsg = `❌ Agent error: ${String(err)}`;
        console.error("[Agent]", err);
        return errMsg;
    }
}
