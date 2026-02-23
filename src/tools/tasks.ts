import { tool } from "ai";
import { z } from "zod";
import {
    getTasks,
    createTask,
    updateTask,
} from "../db";
import { openMemory } from "../db/memory";

// ── Task Tools ────────────────────────────────────────────────────────────────

export const listTasks = tool({
    description: "List the user's tasks. Can filter by status.",
    parameters: z.object({
        chatId: z.string().describe("The chat ID to scope tasks to (use the current chat ID)"),
        status: z
            .enum(["todo", "in_progress", "done", "cancelled"])
            .optional()
            .describe("Filter by status. Omit to see all tasks."),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ chatId, status }: any) => {
        const tasks = getTasks(chatId, status) as {
            id: number;
            title: string;
            description: string | null;
            status: string;
            priority: string;
            due_date: string | null;
            created_at: string;
        }[];
        if (tasks.length === 0) return { message: "No tasks found.", tasks: [] };
        return { tasks };
    },
});

export const addTask = tool({
    description: "Create a new task for the user.",
    parameters: z.object({
        chatId: z.string().describe("The current chat ID"),
        title: z.string().describe("Short task title"),
        description: z.string().optional().describe("Detailed description"),
        priority: z
            .enum(["low", "medium", "high"])
            .optional()
            .default("medium")
            .describe("Task priority"),
        dueDate: z
            .string()
            .optional()
            .describe("Due date in ISO 8601 format e.g. 2024-12-31"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ chatId, title, description, priority, dueDate }: any) => {
        const id = createTask(chatId, title, description, priority, dueDate);
        return { success: true, taskId: id, message: `Task #${id} created: "${title}"` };
    },
});

export const updateTaskStatus = tool({
    description: "Update the status, priority, or details of an existing task.",
    parameters: z.object({
        chatId: z.string().describe("The current chat ID"),
        taskId: z.number().describe("Task ID to update"),
        status: z
            .enum(["todo", "in_progress", "done", "cancelled"])
            .optional()
            .describe("New status"),
        priority: z
            .enum(["low", "medium", "high"])
            .optional()
            .describe("New priority"),
        title: z.string().optional().describe("New title"),
        description: z.string().optional().describe("New description"),
        dueDate: z.string().optional().describe("New due date"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ chatId, taskId, status, priority, title, description, dueDate }: any) => {
        const mapped: Record<string, string> = {};
        if (status) mapped["status"] = status;
        if (priority) mapped["priority"] = priority;
        if (title) mapped["title"] = title;
        if (description) mapped["description"] = description;
        if (dueDate) mapped["due_date"] = dueDate;
        updateTask(taskId, chatId, mapped);
        return { success: true, message: `Task #${taskId} updated.` };
    },
});

// ── Memory Tools ──────────────────────────────────────────────────────────────

export const rememberFact = tool({
    description:
        "Save an important fact or piece of information to long-term memory. Use this when the user shares personal preferences, project details, important context, or anything that should persist across conversations.",
    parameters: z.object({
        chatId: z.string().describe("The current chat ID"),
        key: z
            .string()
            .describe(
                "A concise, descriptive key for the memory e.g. 'preferred_language', 'project_name', 'user_timezone'"
            ),
        value: z.string().describe("The information to remember"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ chatId, key, value }: any) => {
        const content = `${key}: ${value}`;
        await openMemory.add(content, { user_id: chatId, original_key: key });
        return { success: true, message: `Remembered: "${content}"` };
    },
});

export const recallMemories = tool({
    description:
        "Retrieve all long-term memories stored for this user. Call this when context from previous conversations is needed.",
    parameters: z.object({
        chatId: z.string().describe("The current chat ID"),
        query: z.string().optional().describe("Search query to filter memories. Omit to fetch all recent context."),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ chatId, query }: any) => {
        const results = await openMemory.search(query || "*", { user_id: chatId });
        const memories = results.map((m: any) => ({ id: m.id, content: m.content }));
        if (memories.length === 0) return { message: "No matching memories found.", memories: [] };
        return { memories };
    },
});

export const forgetMemory = tool({
    description: "Remove a specific memory by its unique OpenMemory ID.",
    parameters: z.object({
        chatId: z.string().describe("The current chat ID"),
        id: z.string().describe("The memory UUID to forget (found via recallMemories)"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ chatId, id }: any) => {
        await openMemory.delete(id);
        return { success: true, message: `Forgot memory with ID: "${id}"` };
    },
});

export const taskAndMemoryTools = {
    listTasks,
    addTask,
    updateTaskStatus,
    rememberFact,
    recallMemories,
    forgetMemory,
};
