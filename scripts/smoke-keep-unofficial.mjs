#!/usr/bin/env node
import "dotenv/config";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const pythonPath = path.join(repoRoot, ".venv-keep", "bin", "python");
const helperPath = path.join(repoRoot, "scripts", "gkeep_unofficial_helper.py");

function fail(message) {
  console.error(`Smoke test failed: ${message}`);
  process.exit(1);
}

function runHelper(action, args) {
  return new Promise((resolve, reject) => {
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

    child.on("error", reject);
    child.on("close", (code) => {
      if (!stdout.trim()) {
        reject(new Error(stderr.trim() || `helper exited with code ${code}`));
        return;
      }

      try {
        const payload = JSON.parse(stdout);
        if (!payload.ok) {
          reject(new Error(payload.error || "helper returned an error"));
          return;
        }
        resolve(payload.result);
      } catch {
        reject(new Error(`invalid helper output: ${stdout.trim()}`));
      }
    });

    child.stdin.write(JSON.stringify({ action, args }));
    child.stdin.end();
  });
}

async function main() {
  if (!fs.existsSync(pythonPath)) {
    fail(`missing Python virtualenv at ${pythonPath}`);
  }

  if (!fs.existsSync(helperPath)) {
    fail(`missing helper script at ${helperPath}`);
  }

  if (!process.env.GOOGLE_EMAIL) {
    fail("GOOGLE_EMAIL is not set in .env or the environment");
  }

  if (!process.env.GOOGLE_MASTER_TOKEN) {
    fail("GOOGLE_MASTER_TOKEN is not set in .env or the environment");
  }

  console.log("Running unofficial Google Keep smoke test...");

  const labels = await runHelper("list_labels", { includeStats: true });

  console.log("Smoke test passed.");
  console.log(JSON.stringify({
    email: process.env.GOOGLE_EMAIL,
    labelCount: Array.isArray(labels) ? labels.length : 0,
    sampleLabels: Array.isArray(labels) ? labels.slice(0, 5) : [],
  }, null, 2));
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});