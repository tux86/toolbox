import React, { useEffect } from "react";
import { Box, Text, useApp, useInput, render as inkRender } from "ink";
import { ActionBar, ActionItem } from "./ActionBar.js";

export interface AppProps {
  title: string;
  icon?: string;
  color?: string;
  actions?: ActionItem[];
  children: React.ReactNode;
  onQuit?: () => void;
}

export function App({
  title,
  icon = "▲",
  color = "cyan",
  actions,
  children,
  onQuit,
}: AppProps) {
  const { exit } = useApp();

  // Global keyboard handler
  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      onQuit?.();
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color={color} bold>
          {icon} {title}
        </Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column">
        {children}
      </Box>

      {/* Action Bar */}
      {actions && actions.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" />
          <ActionBar actions={actions} />
        </Box>
      )}
    </Box>
  );
}

// Render helper
export function renderApp(element: React.ReactElement) {
  return inkRender(element);
}
