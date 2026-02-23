import { tool } from "ai";
import { z } from "zod";
import { spawnSync } from "bun";
import { existsSync, mkdirSync } from "fs";
import { dirname } from "path";

// ── Bash Command Execution ────────────────────────────────────────────────────

export const runBashCommand = tool({
    description:
        "Run a shell command on the local system. Use for file operations, git commands, build scripts, etc. Working directory is the user's home by default unless specified. Output is truncated at 10000 chars.",
    parameters: z.object({
        command: z.string().describe("The full shell command to execute"),
        cwd: z
            .string()
            .optional()
            .describe("Working directory for the command. Defaults to process.cwd()"),
        timeout: z
            .number()
            .optional()
            .default(30000)
            .describe("Timeout in milliseconds, default 30s"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ command, cwd, timeout }: any) => {
        try {
            const proc = spawnSync(["bash", "-c", command], {
                cwd: cwd ?? process.cwd(),
                stdout: "pipe",
                stderr: "pipe",
            });

            const stdout = proc.stdout?.toString() ?? "";
            const stderr = proc.stderr?.toString() ?? "";
            const exitCode = proc.exitCode ?? -1;

            const combined = [
                stdout && `[stdout]\n${stdout}`,
                stderr && `[stderr]\n${stderr}`,
            ]
                .filter(Boolean)
                .join("\n");

            return {
                exitCode,
                output: combined.slice(0, 10000) || "(no output)",
                success: exitCode === 0,
            };
        } catch (err) {
            return { exitCode: -1, output: String(err), success: false };
        }
    },
});

// ── Read File ─────────────────────────────────────────────────────────────────

export const readFile = tool({
    description: "Read the contents of a file from the local filesystem.",
    parameters: z.object({
        path: z.string().describe("Absolute or relative path to the file"),
        startLine: z
            .number()
            .optional()
            .describe("Start line (1-indexed). Reads from beginning if not set"),
        endLine: z
            .number()
            .optional()
            .describe("End line (inclusive). Reads to end if not set"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ path, startLine, endLine }: any) => {
        try {
            const file = Bun.file(path);
            if (!(await file.exists())) {
                return { error: `File not found: ${path}` };
            }

            const text = await file.text();
            const lines = text.split("\n");
            const total = lines.length;

            const start = Math.max(0, (startLine ?? 1) - 1);
            const end = Math.min(total, endLine ?? total);
            const slice = lines.slice(start, end).join("\n");

            return {
                path,
                totalLines: total,
                shownLines: `${start + 1}-${end}`,
                content: slice.slice(0, 20000),
            };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Write File ────────────────────────────────────────────────────────────────

export const writeFile = tool({
    description:
        "Write or overwrite a file on the local filesystem. Creates parent directories automatically.",
    parameters: z.object({
        path: z.string().describe("Absolute or relative path to the file"),
        content: z.string().describe("The content to write"),
        append: z
            .boolean()
            .optional()
            .default(false)
            .describe("If true, appends to existing content instead of overwriting"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ path, content, append }: any) => {
        try {
            const dir = dirname(path);
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

            if (append) {
                const existing = existsSync(path)
                    ? await Bun.file(path).text()
                    : "";
                await Bun.write(path, existing + content);
            } else {
                await Bun.write(path, content);
            }

            return { success: true, path, bytesWritten: content.length };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── List Directory ────────────────────────────────────────────────────────────

export const listDirectory = tool({
    description: "List contents of a directory. Returns files and subdirectories.",
    parameters: z.object({
        path: z.string().describe("Path to the directory to list"),
        showHidden: z
            .boolean()
            .optional()
            .default(false)
            .describe("Include hidden files/directories (starting with '.')"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ path, showHidden }: any) => {
        try {
            const { stdout, exitCode } = spawnSync(
                ["ls", "-la", "--color=never", path],
                { stdout: "pipe", stderr: "pipe" }
            );
            if (exitCode !== 0) {
                // fallback to Bun.readdir
                const glob = new Bun.Glob(showHidden ? "*" : "[!.]*");
                const entries = [...glob.scanSync(path)];
                return { path, entries };
            }
            const lines = stdout.toString().split("\n").filter(Boolean);
            const filtered = showHidden
                ? lines
                : lines.filter((l) => !/ \./.test(l.split(" ").pop() ?? ""));
            return { path, listing: filtered.join("\n") };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

export const systemTools = { runBashCommand, readFile, writeFile, listDirectory };
