import React from "react";
import { Box, Text } from "ink";

export interface CardProps {
  title?: string;
  children: React.ReactNode;
  borderColor?: string;
}

export function Card({ title, children, borderColor = "gray" }: CardProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      marginBottom={1}
    >
      {title && (
        <Box marginTop={-1} marginLeft={1}>
          <Text dimColor> {title} </Text>
        </Box>
      )}
      <Box paddingY={0}>{children}</Box>
    </Box>
  );
}
