import { useState, useCallback, useEffect } from "react";
import { copyToClipboard } from "../utils.js";

export interface UseCopyResult {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
  error: string | null;
}

/**
 * Hook for copying text to clipboard with automatic feedback state management.
 *
 * @param feedbackDuration - How long to show "copied" state (ms), default 2000
 * @returns { copy, copied, error }
 *
 * @example
 * ```tsx
 * const { copy, copied, error } = useCopy();
 *
 * <Button onPress={() => copy(secretValue)}>Copy</Button>
 * {copied && <StatusMessage type="success">Copied!</StatusMessage>}
 * {error && <StatusMessage type="error">{error}</StatusMessage>}
 * ```
 */
export function useCopy(feedbackDuration = 2000): UseCopyResult {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-reset copied state after duration
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), feedbackDuration);
      return () => clearTimeout(timer);
    }
  }, [copied, feedbackDuration]);

  // Auto-reset error state after duration
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), feedbackDuration);
      return () => clearTimeout(timer);
    }
  }, [error, feedbackDuration]);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await copyToClipboard(text);
      if (success) {
        setCopied(true);
        return true;
      } else {
        setError("Failed to copy");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy failed");
      return false;
    }
  }, []);

  return { copy, copied, error };
}
