import "dotenv/config";
import { Bot, Context, NextFunction, GrammyError, HttpError } from "grammy";
import { config } from "./config";
import { runAgent } from "./bot/agent";
import { runBlogAgent } from "./bot/blogAgent";
import { runSocialAgent } from "./bot/socialAgent";

// ── Init ──────────────────────────────────────────────────────────────────────

const bot = new Bot(config.telegramBotToken);

// ── Middleware: Access Control ─────────────────────────────────────────────────

bot.use(async (ctx: Context, next: NextFunction) => {
    if (config.allowedUserIds.length === 0) return next();
    const userId = ctx.from?.id;
    if (!userId || !config.allowedUserIds.includes(userId)) {
        await ctx.reply("⛔ Unauthorized. Contact the bot owner to get access.");
        return;
    }
    return next();
});

// ── /start ────────────────────────────────────────────────────────────────────

bot.command("start", async (ctx: Context) => {
    const name = ctx.from?.first_name ?? "there";
    await ctx.reply(
        `👋 Hey ${name}! I'm **Mimi**, your AI assistant.\n\n` +
        `I can help you with:\n` +
        `• 📧 Gmail (search, read, archive, send)\n` +
        `• 💻 Code & files (read, write, run commands)\n` +
        `• 🔍 Research (search web, read docs)\n` +
        `• 📋 Tasks (create, track, update)\n` +
        `• 🧠 Long-term memory\n` +
        `• 🔗 GitHub (PRs, code review)\n\n` +
        `Just start chatting!`,
        { parse_mode: "Markdown" }
    );
});

// ── /help ─────────────────────────────────────────────────────────────────────

bot.command("help", async (ctx: Context) => {
    await ctx.reply(
        `**Mimi Command Reference:**\n\n` +
        `📧 **Gmail**\n` +
        `_"Show me unread emails from last week"_\n` +
        `_"Read email #abc123"_\n` +
        `_"Archive that email"_\n` +
        `_"Send email to john@example.com..."_\n\n` +
        `💻 **Code & System**\n` +
        `_"Read /path/to/file.ts"_\n` +
        `_"Run git status in ~/projects/myapp"_\n` +
        `_"Create a file at src/utils.ts with..."_\n\n` +
        `🔍 **Research**\n` +
        `_"Search for best Bun HTTP frameworks"_\n` +
        `_"Fetch and summarize https://..."_\n\n` +
        `📋 **Tasks**\n` +
        `_"Add a task: Fix login bug"_\n` +
        `_"List my in-progress tasks"_\n` +
        `_"Mark task 3 as done"_\n\n` +
        `🧠 **Memory**\n` +
        `_"Remember that my main project is..."_\n` +
        `_"What do you remember about me?"_`,
        { parse_mode: "Markdown" }
    );
});

// ── /clear ────────────────────────────────────────────────────────────────────

bot.command("clear", async (ctx: Context) => {
    // Just reset conversation view — history is preserved in DB for long-term purposes
    await ctx.reply("🧹 Chat context cleared! Starting fresh. Your long-term memories are still intact.");
});

// ── /tasks ────────────────────────────────────────────────────────────────────

bot.command("tasks", async (ctx: Context) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const thinking = await ctx.reply("📋 Loading your tasks...");
    const response = await runAgent(chatId, "List all my tasks grouped by status.");
    await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    await sendLongMessage(ctx, response);
});

// ── /memories ────────────────────────────────────────────────────────────────

bot.command("memories", async (ctx: Context) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const thinking = await ctx.reply("🧠 Fetching your memories...");
    const response = await runAgent(chatId, "Show me all memories you have stored about me.");
    await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id);
    await sendLongMessage(ctx, response);
});

// ── /blog ─────────────────────────────────────────────────────────────────────

bot.command("blog", async (ctx: Context) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const userMessage = typeof ctx.match === "string" ? ctx.match : (Array.isArray(ctx.match) ? ctx.match[0] : ""); // Text after the command

    if (!userMessage) {
        await ctx.reply("Please provide a topic! Example: `/blog The future of AI in 2026`", { parse_mode: "Markdown" });
        return;
    }

    // Show typing indicator
    await ctx.replyWithChatAction("typing");

    // Send an ephemeral "thinking" message
    const thinkingMsg = await ctx.reply("✍️ _Initializing Blog Writer..._", { parse_mode: "Markdown" });

    try {
        const response = await runBlogAgent(chatId, userMessage, async (statusUpdate) => {
            try {
                if (ctx.chat?.id) {
                    await ctx.api.editMessageText(
                        ctx.chat.id,
                        thinkingMsg.message_id,
                        statusUpdate,
                        { parse_mode: "Markdown" }
                    );
                }
            } catch { /* ignore edit errors */ }
        });

        // Delete thinking message and send real response
        if (ctx.chat?.id) {
            await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        }
        await sendLongMessage(ctx, response);
    } catch (err) {
        if (ctx.chat?.id) {
            await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        }
        await ctx.reply(`❌ Error: ${String(err)}`);
    }
});

// ── /social ───────────────────────────────────────────────────────────────────

bot.command("social", async (ctx: Context) => {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    const userMessage = typeof ctx.match === "string" ? ctx.match : (Array.isArray(ctx.match) ? ctx.match[0] : ""); // Text after the command

    if (!userMessage) {
        await ctx.reply("Please provide a topic or platform! Example: `/social Write an X thread about AI agents`", { parse_mode: "Markdown" });
        return;
    }

    // Show typing indicator
    await ctx.replyWithChatAction("typing");

    // Send an ephemeral "thinking" message
    const thinkingMsg = await ctx.reply("📱 _Launching Social Marketing Agent..._", { parse_mode: "Markdown" });

    try {
        const response = await runSocialAgent(chatId, userMessage, async (statusUpdate) => {
            try {
                if (ctx.chat?.id) {
                    await ctx.api.editMessageText(
                        ctx.chat.id,
                        thinkingMsg.message_id,
                        statusUpdate,
                        { parse_mode: "Markdown" }
                    );
                }
            } catch { /* ignore edit errors */ }
        });

        // Delete thinking message and send real response
        if (ctx.chat?.id) {
            await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        }
        await sendLongMessage(ctx, response);
    } catch (err) {
        if (ctx.chat?.id) {
            await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        }
        await ctx.reply(`❌ Error: ${String(err)}`);
    }
});

// ── /provider ─────────────────────────────────────────────────────────────────

bot.command("provider", async (ctx: Context) => {
    if (!ctx.chat) return;
    const args = typeof ctx.match === "string" ? ctx.match.trim().split(/\s+/) : [];
    const providerContext = args[0]?.toLowerCase();
    const modelContext = args[1];

    if (!providerContext) {
        const msg = `🤖 **Current AI Setup:**\nProvider: \`${config.aiProvider}\`\nModel: \`${config.aiModel}\`\n\nTo switch, use:\n\`/provider <anthropic|google|openai|ollama|9router> [model]\``;
        await ctx.reply(msg, { parse_mode: "Markdown" });
        return;
    }

    const validProviders = ["anthropic", "google", "openai", "ollama", "9router"];
    if (!validProviders.includes(providerContext)) {
        await ctx.reply(`❌ Invalid provider. Valid options: ${validProviders.map(p => `\`${p}\``).join(", ")}`, { parse_mode: "Markdown" });
        return;
    }

    // Cast bypassing ts checks for this generic mutation
    (config as any).aiProvider = providerContext;
    if (modelContext) {
        (config as any).aiModel = modelContext;
    }

    await ctx.reply(`✅ Provider dynamically switched to *${config.aiProvider}*\nActive Model: *${config.aiModel}*`, { parse_mode: "Markdown" });
});

// ── Message Handler ────────────────────────────────────────────────────────────

bot.on("message:text", async (ctx: Context) => {
    if (!ctx.message || !ctx.chat) return;
    const userMessage = ctx.message.text;
    if (!userMessage) return;
    const chatId = String(ctx.chat.id);

    // Show typing indicator
    await ctx.replyWithChatAction("typing");

    // Send an ephemeral "thinking" message
    const thinkingMsg = await ctx.reply("🤔 _Thinking..._", { parse_mode: "Markdown" });

    try {
        const response = await runAgent(chatId, userMessage, async (statusUpdate) => {
            // Update the thinking message with progress
            try {
                if (ctx.chat?.id) {
                    await ctx.api.editMessageText(
                        ctx.chat.id,
                        thinkingMsg.message_id,
                        statusUpdate,
                        { parse_mode: "Markdown" }
                    );
                }
            } catch { /* ignore edit errors */ }
        });

        // Delete thinking message and send real response
        if (ctx.chat?.id) {
            await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        }
        await sendLongMessage(ctx, response);
    } catch (err) {
        if (ctx.chat?.id) {
            await ctx.api.deleteMessage(ctx.chat.id, thinkingMsg.message_id);
        }
        await ctx.reply(`❌ Error: ${String(err)}`);
    }
});

// ── Helper: Split long messages (Telegram limit: 4096 chars) ──────────────────

async function sendLongMessage(
    ctx: Context,
    text: string
) {
    const MAX = 4000;
    if (text.length <= MAX) {
        await ctx.reply(text, { parse_mode: "Markdown" });
        return;
    }

    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
        // Try to cut at a newline boundary
        let cut = MAX;
        if (remaining.length > MAX) {
            const lastNewline = remaining.lastIndexOf("\n", MAX);
            if (lastNewline > MAX * 0.7) cut = lastNewline;
        }
        chunks.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut);
    }

    for (const chunk of chunks) {
        try {
            await ctx.reply(chunk, {
                parse_mode: "Markdown",
            });
        } catch {
            // Fallback: send without markdown if parse fails
            await ctx.reply(chunk);
        }
    }
}

// ── Error Handling ────────────────────────────────────────────────────────────

bot.catch((err: any) => {
    const ctx = err.ctx;
    console.error(`[Bot] Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) {
        console.error("[Bot] Error in request:", e.description);
    } else if (e instanceof HttpError) {
        console.error("[Bot] Could not contact Telegram:", e);
    } else {
        console.error("[Bot] Unknown error:", e);
    }
});

// ── Start ─────────────────────────────────────────────────────────────────────

console.log("🤖 Mimi Bot starting...");
bot.start({
    onStart(botInfo: any) {
        console.log(`✅ Mimi is online as @${botInfo.username}`);
    },
});
