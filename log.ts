export function debugLog(...args: unknown[]) {
  if (process.env.MCP_GDRIVE_DEBUG === "1") {
    console.error(...args);
  }
}