import React from "react";
import { Box } from "ink";
import { StatusMessage } from "./StatusMessage.js";

export interface CopyFeedbackProps {
  copied: boolean;
  error: string | null;
}

/**
 * Display copy feedback (success or error message).
 * Use with the useCopy hook for a complete copy solution.
 *
 * @example
 * ```tsx
 * const { copy, copied, error } = useCopy();
 *
 * <CopyFeedback copied={copied} error={error} />
 * ```
 */
export function CopyFeedback({ copied, error }: CopyFeedbackProps) {
  if (!copied && !error) return null;

  return (
    <Box marginTop={1}>
      {copied && (
        <StatusMessage type="success">Copied to clipboard!</StatusMessage>
      )}
      {error && (
        <StatusMessage type="error">{error}</StatusMessage>
      )}
    </Box>
  );
}
