/**
 * UI common utilities
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { spawn } from "child_process";

// ─────────────────────────────────────────────────────────────────────────────
// Clipboard
// ─────────────────────────────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cmd = process.platform === "darwin" ? "pbcopy" : "xclip -selection clipboard";
    const proc = spawn("sh", ["-c", `echo -n "${text.replace(/"/g, '\\"')}" | ${cmd}`], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.on("close", (code) => resolve(code === 0));
    proc.on("error", () => resolve(false));
  });
}

export async function copyWithFeedback(text: string, label?: string): Promise<boolean> {
  const displayLabel = label || "content";
  const spinner = p.spinner();
  spinner.start(`Copying ${displayLabel}...`);

  const success = await copyToClipboard(text);
  await Bun.sleep(300);

  if (success) {
    spinner.stop(pc.green("✓") + pc.bold(` Copied ${displayLabel}!`));
  } else {
    spinner.stop(pc.red("✗") + " Failed to copy to clipboard");
  }

  await Bun.sleep(500);
  return success;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

export function formatJson(value: string): string {
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

export function divider(width = 60): string {
  return pc.dim("─".repeat(width));
}

// ─────────────────────────────────────────────────────────────────────────────
// Spinner Utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface SpinnerOptions {
  start: string;
  success: (result: any) => string;
  error?: string;
}

export async function withSpinner<T>(
  fn: () => Promise<T>,
  options: SpinnerOptions
): Promise<T> {
  const spinner = p.spinner();
  spinner.start(options.start);

  try {
    const result = await fn();
    spinner.stop(options.success(result));
    return result;
  } catch (err: any) {
    spinner.stop(options.error || "Operation failed");
    p.log.error(err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection Utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface SelectOption<T> {
  value: T;
  label: string;
}

export async function selectFromList<T>(
  items: T[],
  options: {
    message: string;
    formatLabel: (item: T) => string;
    emptyMessage?: string;
  }
): Promise<T | null> {
  if (items.length === 0) {
    p.log.warn(options.emptyMessage || "No items found.");
    return null;
  }

  const selectOptions: SelectOption<T>[] = items.map((item) => ({
    value: item,
    label: options.formatLabel(item),
  }));

  const selected = await p.select({
    message: options.message,
    options: selectOptions,
  });

  if (p.isCancel(selected)) {
    return null;
  }

  return selected as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// App Utilities
// ─────────────────────────────────────────────────────────────────────────────

export interface AppConfig {
  name: string;
  color: (text: string) => string;
}

export async function runApp(
  config: AppConfig,
  main: () => Promise<void>
): Promise<void> {
  console.clear();
  p.intro(config.color(pc.black(` ${config.name} `)));

  try {
    await main();
  } catch (err: any) {
    console.error(pc.red("Fatal error:"), err);
    process.exit(1);
  }
}

export function goodbye(): void {
  p.outro("Goodbye!");
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────────

export { p as prompts, pc as colors };
