import React from "react";
import { Box, Text } from "ink";

export interface HeaderProps {
  icon?: string;
  title: string;
  color?: string;
}

export function Header({ icon = "▲", title, color = "cyan" }: HeaderProps) {
  return (
    <Box marginBottom={1}>
      <Text color={color} bold>
        {icon} {title}
      </Text>
    </Box>
  );
}
