import { generateText, stepCountIs, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { config } from "../config";
import { getMessages, saveMessage, trimMessages } from "../db";
import { buildSocialPrompt, formatMessages } from "../prompts/social";
import { researchTools } from "../tools/research";

// ── Model Selection ───────────────────────────────────────────────────────────

function getLanguageModel() {
    const ollama = createOpenAI({ baseURL: config.ollamaBaseUrl, apiKey: "ollama" });
    return ollama(config.ollamaModel);
}

// ── Agent Run ─────────────────────────────────────────────────────────────────

export async function runSocialAgent(
    chatId: string,
    userMessage: string,
    onUpdate?: (text: string) => void
): Promise<string> {
    // Save user message (prefixing so we know it was a social command in history)
    saveMessage(chatId, "user", `[Social] ${userMessage}`);

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
            system: buildSocialPrompt(chatId),
            messages,
            // The social writer ONLY gets research tools to gather specific numbers/metrics for posts
            tools: researchTools,
            stopWhen: stepCountIs(10),
            temperature: 0.6, // Slightly higher temperature to encourage compelling hooks and conversational tone
            onStepFinish({ text }: { text: string }) {
                if (onUpdate && text) {
                    onUpdate(`📱 _Drafting Social Post..._\n${text.slice(0, 200)}`);
                }
            },
        });

        const responseText = result.text || "(No content generated)";

        saveMessage(chatId, "assistant", `[Social Output] ${responseText}`);
        trimMessages(chatId, 100);

        return responseText;
    } catch (err) {
        const errMsg = `❌ Social Agent error: ${String(err)}`;
        console.error("[Social Agent]", err);
        return errMsg;
    }
}
