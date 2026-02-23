import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { config } from "../config";
import { getMessages, saveMessage, trimMessages } from "../db";
import { buildBlogPrompt, formatMessages } from "../prompts/blog";
import { researchTools } from "../tools/research";

// ── Model Selection ───────────────────────────────────────────────────────────

function getLanguageModel() {
    const ollama = createOpenAI({ baseURL: config.ollamaBaseUrl, apiKey: "ollama" });
    return ollama(config.ollamaModel);
}

// ── Agent Run ─────────────────────────────────────────────────────────────────

export async function runBlogAgent(
    chatId: string,
    userMessage: string,
    onUpdate?: (text: string) => void
): Promise<string> {
    // Save user message (prefixing so we know it was a blog command in history)
    saveMessage(chatId, "user", `[Blog] ${userMessage}`);

    // Retrieve short-term history
    const rawHistory = getMessages(chatId, config.maxHistoryMessages);
    const historyWithoutLast = rawHistory.slice(0, -1);
    const formattedHistory = formatMessages(
        historyWithoutLast.map((m) => ({
            ...m,
            tool_calls: m.tool_calls ?? null,
        }))
    );

    // Build messages array
    const messages: ModelMessage[] = [
        ...formattedHistory,
        { role: "user", content: [{ type: "text", text: userMessage }] },
    ];

    const model = getLanguageModel();

    try {
        const result = await generateText({
            model,
            system: buildBlogPrompt(chatId),
            messages,
            // The blog writer ONLY gets research tools to prevent it from messing with the system
            tools: researchTools,
            stopWhen: stepCountIs(10),
            temperature: 0.5, // Slightly higher temperature for creative writing
            onStepFinish({ text }: { text: string }) {
                if (onUpdate && text) {
                    onUpdate(`✍️ _Writing & Researching..._\n${text.slice(0, 200)}`);
                }
            },
        });

        const responseText = result.text || "(No content generated)";

        saveMessage(chatId, "assistant", `[Blog Output] ${responseText}`);
        trimMessages(chatId, 100);

        return responseText;
    } catch (err) {
        const errMsg = `❌ Blog Agent error: ${String(err)}`;
        console.error("[Blog Agent]", err);
        return errMsg;
    }
}
