import { tool } from "ai";
import { z } from "zod";
import { spawnSync } from "bun";
import { existsSync, mkdirSync, cpSync, renameSync, rmSync } from "fs";
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

// ── Move File ─────────────────────────────────────────────────────────────────

export const moveFile = tool({
    description: "Move or rename a file or directory on the local filesystem.",
    parameters: z.object({
        source: z.string().describe("Absolute or relative path to the existing file/directory"),
        destination: z.string().describe("Absolute or relative path to the new location"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ source, destination }: any) => {
        try {
            if (!existsSync(source)) return { error: `Source not found: ${source}` };

            const destDir = dirname(destination);
            if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

            renameSync(source, destination);
            return { success: true, source, destination };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Copy File ─────────────────────────────────────────────────────────────────

export const copyFile = tool({
    description: "Copy a file or directory on the local filesystem. Directories are copied recursively.",
    parameters: z.object({
        source: z.string().describe("Absolute or relative path to the existing file/directory"),
        destination: z.string().describe("Absolute or relative path to the new location"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ source, destination }: any) => {
        try {
            if (!existsSync(source)) return { error: `Source not found: ${source}` };

            const destDir = dirname(destination);
            if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

            cpSync(source, destination, { recursive: true });
            return { success: true, source, destination };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Delete File ───────────────────────────────────────────────────────────────

export const deleteFile = tool({
    description: "Delete a file or directory on the local filesystem. Directories are deleted recursively.",
    parameters: z.object({
        path: z.string().describe("Absolute or relative path to the file/directory to delete"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ path }: any) => {
        try {
            if (!existsSync(path)) return { error: `Path not found: ${path}` };

            rmSync(path, { recursive: true, force: true });
            return { success: true, path };
        } catch (err) {
            return { error: String(err) };
        }
    },
});

// ── Find Files ────────────────────────────────────────────────────────────────

export const findFiles = tool({
    description: "Search for files within a directory using a glob pattern.",
    parameters: z.object({
        directory: z.string().describe("Directory to start the search from"),
        pattern: z.string().describe("Glob pattern to match (e.g., '**/*.ts', '*.md')"),
    }),
    // @ts-expect-error: Vercel AI SDK Zod inference bug
    execute: async ({ directory, pattern }: any) => {
        try {
            if (!existsSync(directory)) return { error: `Directory not found: ${directory}` };

            const glob = new Bun.Glob(pattern);
            const matches = [];
            // Cap to 500 matches to prevent output flooding
            for await (const file of glob.scan({ cwd: directory })) {
                matches.push(file);
                if (matches.length >= 500) break;
            }

            return {
                baseDir: directory,
                pattern,
                matchesFound: matches.length,
                matches: matches.length === 500 ? [...matches, "...(truncated)"] : matches
            };
        } catch (err) {
            return { error: String(err) };
        }
    }
});

export const systemTools = {
    runBashCommand,
    readFile,
    writeFile,
    listDirectory,
    moveFile,
    copyFile,
    deleteFile,
    findFiles
};
