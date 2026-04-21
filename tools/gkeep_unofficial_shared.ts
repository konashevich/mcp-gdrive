import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { InternalToolResponse } from "./types.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../",
);

const pythonPath = path.join(repoRoot, ".venv-keep", "bin", "python");
const helperPath = path.join(repoRoot, "scripts", "gkeep_unofficial_helper.py");

export function okResponse(payload: unknown): InternalToolResponse {
  return {
    content: [
      {
        type: "text",
        text:
          typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
    isError: false,
  };
}

export function errorResponse(
  action: string,
  error: unknown,
): InternalToolResponse {
  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [
      {
        type: "text",
        text: `Error ${action}: ${message}`,
      },
    ],
    isError: true,
  };
}

export function normalizeUnofficialNoteId(noteId: string): string {
  const value = noteId.trim();
  if (!value) {
    throw new Error("noteId is required");
  }

  return value.startsWith("notes/") ? value.slice("notes/".length) : value;
}

async function runHelper(action: string, args: Record<string, unknown>) {
  return new Promise<unknown>((resolve, reject) => {
    const child = spawn(pythonPath, [helperPath], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      const trimmedStdout = stdout.trim();
      if (!trimmedStdout) {
        reject(
          new Error(
            stderr.trim() || `Unofficial Keep helper exited with code ${code}`,
          ),
        );
        return;
      }

      try {
        const payload = JSON.parse(trimmedStdout) as {
          ok: boolean;
          error?: string;
          result?: unknown;
        };

        if (!payload.ok) {
          reject(new Error(payload.error || "Unofficial Keep helper failed"));
          return;
        }

        resolve(payload.result);
      } catch {
        reject(
          new Error(
            `Failed to parse unofficial Keep helper response: ${trimmedStdout}`,
          ),
        );
      }
    });

    child.stdin.write(JSON.stringify({ action, args }));
    child.stdin.end();
  });
}

export async function callUnofficialKeepTool(
  action: string,
  args: Record<string, unknown>,
  label: string,
): Promise<InternalToolResponse> {
  try {
    const result = await runHelper(action, args);
    return okResponse(result);
  } catch (error) {
    return errorResponse(label, error);
  }
}