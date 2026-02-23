# Mimi — AI Telegram Assistant

A powerful personal AI assistant running on Telegram, built with **Bun + TypeScript**.

## ✨ Features

| Feature | Details |
|---------|---------|
| 🤖 **Multi-Agent Runtime** | Runs three distinct agents: Core Coding Agent (`Mimi`), SEO Blog Writer (`/blog`), and Social Media Strategist (`/social`). |
| 🔀 **Universal AI Routing** | Dynamically switch between Claude, Gemini, OpenAI, Ollama (local), and 9router mid-conversation using `/provider`. |
| 📧 **Gmail (Native)** | Uses `gogcli` to securely search, read, archive, and send emails via headless subprocesses. |
| 💻 **System Control** | Read files, write code, and run interactive bash commands directly on the host machine. |
| 🕵️ **Stealth Research** | Uses `camofox` to bypass Cloudflare/bot-protection for deep web scraping and real-time DuckDuckGo searches. |
| 🧠 **Dual Memory** | Local SQLite for conversational context + **OpenMemory** for semantic long-term vector extraction. |
| 🔗 **GitHub** | Create PRs, review code diffs, and list pull requests natively via PAT. |
| 📋 **Task Tracker** | Create, update, and monitor your personal TO-DO list inside Telegram. |

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd Mimi
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Gmail Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable Gmail API
3. Create OAuth 2.0 credentials → Download `credentials.json`
4. Place `credentials.json` in the project root
5. Run the auth flow:

```bash
bun run gmail-auth
```

### 4. Run the Bot

```bash
# Development (auto-restart on changes)
bun run dev

# Production with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 🛠 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | From [@BotFather](https://t.me/BotFather) |
| `ANTHROPIC_API_KEY` | ✅* | Claude API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅* | Gemini API key |
| `OPENAI_API_KEY` | ✅* | OpenAI API key |
| `NINEROUTER_API_KEY` | ✅* | 9router Universal AI Proxy Key |
| `OLLAMA_BASE_URL` | ❌ | Default: `http://localhost:11434/v1` |
| `AI_MODEL` | ❌ | Default: `claude-3-5-sonnet-20241022` |
| `AI_PROVIDER` | ❌ | `anthropic` / `google` / `openai` / `ollama` / `9router` |
| `GITHUB_TOKEN` | ❌ | For GitHub tools |
| `TAVILY_API_KEY` | ❌ | For richer web search |
| `ALLOWED_USER_IDS` | ❌ | Comma-separated Telegram user IDs |

*At least one AI provider key is required.

## 📋 Commands

| Command | Description |
|---------|-------------|
| `/blog <topic>` | Instantiates the SEO Blog Writer Agent (Defaults to Ollama local) |
| `/social <topic>` | Instantiates the Social Media Writer Agent (Defaults to Ollama local) |
| `/provider <name> [model]`| Dynamically swap the main AI provider (e.g. `/provider 9router cc/claude-opus-4-6`) |
| `/tasks` | List all active tasks |
| `/memories` | View long-term vectorized memories |
| `/clear` | Reset conversation context |
| `/help` | Usage examples |
| `<text>` | Talk to the core Mimi Coding & System Agent |

## 📁 Project Structure

```
src/
├── index.ts              # Bot entry point (Grammy)
├── config.ts             # Environment config
├── bot/
│   └── agent.ts          # Core AI agent (Vercel AI SDK)
├── db/
│   └── index.ts          # SQLite helpers (messages, memories, tasks)
├── prompts/
│   └── system.ts         # System prompt builder
└── tools/
    ├── system.ts          # runBashCommand, readFile, writeFile, listDirectory
    ├── research.ts        # webSearch, fetchUrl
    ├── tasks.ts           # task + memory tools
    ├── github.ts          # createPR, listPRs, reviewPR
    ├── gmail.ts           # searchEmails, readEmail, archiveEmail, sendEmail
    └── gmail-auth.ts      # One-time OAuth setup
```

## 🔒 Security

- Set `ALLOWED_USER_IDS` to restrict bot access to specific Telegram users
- The bot can run shell commands — only run in a trusted environment
- Store `.env`, `credentials.json`, and `token.json` securely (never commit them)
