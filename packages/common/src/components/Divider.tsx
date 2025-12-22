import React from "react";
import { Box, Text } from "ink";

export interface DividerProps {
  width?: number;
}

export function Divider({ width = 65 }: DividerProps) {
  return (
    <Box marginY={1}>
      <Text dimColor>{"─".repeat(width)}</Text>
    </Box>
  );
}
