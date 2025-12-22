import React from "react";
import { Box, Text } from "ink";

export type StatusType = "info" | "success" | "warning" | "error" | "question";

export interface StatusMessageProps {
  type?: StatusType;
  children: React.ReactNode;
}

const STATUS_CONFIG: Record<StatusType, { icon: string; color: string }> = {
  info: { icon: "ℹ", color: "blue" },
  success: { icon: "✓", color: "green" },
  warning: { icon: "⚠", color: "yellow" },
  error: { icon: "✗", color: "red" },
  question: { icon: "?", color: "cyan" },
};

export function StatusMessage({ type = "info", children }: StatusMessageProps) {
  const config = STATUS_CONFIG[type];

  return (
    <Box marginY={1}>
      <Text color={config.color} bold>
        {config.icon}
      </Text>
      <Text> {children}</Text>
    </Box>
  );
}
