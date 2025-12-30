/**
 * General utilities
 */

import { spawn } from "child_process";

/**
 * Copy text to clipboard (cross-platform)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = process.platform === "darwin" ? "pbcopy" : "xclip -selection clipboard";
    // Use printf instead of echo -n for better portability
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%/g, "%%");
    const proc = spawn("sh", ["-c", `printf '%s' "${escaped}" | ${cmd}`], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

/**
 * Format JSON string with pretty printing
 */
export function formatJson(value: string): string {
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}
