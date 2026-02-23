import { join } from "path";

function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required environment variable: ${key}`);
    return val;
}

export const config = {
    // Telegram
    telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),

    // Allowed users (empty = allow all)
    allowedUserIds: process.env.ALLOWED_USER_IDS
        ? process.env.ALLOWED_USER_IDS.split(",").map((id) => parseInt(id.trim(), 10)).filter(Boolean)
        : [],

    // AI
    aiModel: process.env.AI_MODEL ?? "claude-3-5-sonnet-20241022",
    aiProvider: (process.env.AI_PROVIDER ?? "anthropic") as "anthropic" | "google" | "openai" | "ollama" | "9router",
    ollamaModel: process.env.OLLAMA_MODEL ?? "qwen3.5:cloud",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
    nineRouterBaseUrl: process.env.NINEROUTER_BASE_URL ?? "http://localhost:20128/v1",
    nineRouterApiKey: process.env.NINEROUTER_API_KEY ?? "dummy",

    // API Keys
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,

    // GitHub
    githubToken: process.env.GITHUB_TOKEN,
    githubDefaultOwner: process.env.GITHUB_DEFAULT_OWNER ?? "",
    githubDefaultRepo: process.env.GITHUB_DEFAULT_REPO ?? "",

    // Gmail
    gmailCredentialsPath: process.env.GMAIL_CREDENTIALS_PATH ?? "./credentials.json",
    gmailTokenPath: process.env.GMAIL_TOKEN_PATH ?? "./token.json",

    // Database
    databasePath: process.env.DATABASE_PATH ?? join(process.cwd(), "data", "mimi.db"),

    // Search
    tavilyApiKey: process.env.TAVILY_API_KEY,

    // Max history tokens to send to AI
    maxHistoryMessages: 40,
};
