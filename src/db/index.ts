import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { join } from "path";
import { config } from "../config";

const dbDir = join(config.databasePath, "..");
mkdirSync(dbDir, { recursive: true });

export const db = new Database(config.databasePath, { create: true });

// Enable WAL mode for better concurrent performance
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id    TEXT NOT NULL,
    role       TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool')),
    content    TEXT NOT NULL,
    tool_calls TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'done', 'cancelled')),
    priority    TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
    due_date    TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get recent message history for a chat */
export function getMessages(chatId: string, limit = 50) {
    return db
        .query(
            `SELECT role, content, tool_calls FROM messages
       WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?`
        )
        .all(chatId, limit)
        .reverse() as { role: string; content: string; tool_calls: string | null }[];
}

/** Save a message to history */
export function saveMessage(
    chatId: string,
    role: string,
    content: string,
    toolCalls?: unknown
) {
    db.query(
        `INSERT INTO messages (chat_id, role, content, tool_calls) VALUES (?, ?, ?, ?)`
    ).run(chatId, role, content, toolCalls ? JSON.stringify(toolCalls) : null);
}

/** Trim old messages to keep history manageable */
export function trimMessages(chatId: string, keepLast = 100) {
    db.query(
        `DELETE FROM messages WHERE chat_id = ? AND id NOT IN (
      SELECT id FROM messages WHERE chat_id = ? ORDER BY created_at DESC LIMIT ?
    )`
    ).run(chatId, chatId, keepLast);
}


/** Get all tasks for a chat */
export function getTasks(chatId: string, status?: string) {
    const query = status
        ? `SELECT * FROM tasks WHERE chat_id = ? AND status = ? ORDER BY priority DESC, created_at DESC`
        : `SELECT * FROM tasks WHERE chat_id = ? ORDER BY priority DESC, created_at DESC`;
    return db.query(query).all(chatId, ...(status ? [status] : []));
}

/** Create a task */
export function createTask(
    chatId: string,
    title: string,
    description?: string,
    priority?: string,
    dueDate?: string
) {
    const result = db.query(
        `INSERT INTO tasks (chat_id, title, description, priority, due_date)
     VALUES (?, ?, ?, ?, ?) RETURNING id`
    ).get(chatId, title, description ?? null, priority ?? "medium", dueDate ?? null) as { id: number };
    return result.id;
}

/** Update a task */
export function updateTask(
    taskId: number,
    chatId: string,
    updates: Partial<{ title: string; description: string; status: string; priority: string; due_date: string }>
) {
    const fields = Object.entries(updates)
        .map(([k]) => `${k} = ?`)
        .join(", ");
    const values = Object.values(updates);
    db.query(
        `UPDATE tasks SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND chat_id = ?`
    ).run(...values, taskId, chatId);
}
