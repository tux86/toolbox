import React from "react";
import { Box, Text } from "ink";
import InkSpinner from "ink-spinner";

export interface SpinnerProps {
  label?: string;
  color?: string;
}

export function Spinner({ label = "Loading...", color = "cyan" }: SpinnerProps) {
  return (
    <Box>
      <Text color={color}>
        <InkSpinner type="dots" />
      </Text>
      <Text> {label}</Text>
    </Box>
  );
}
