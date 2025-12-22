import React from "react";
import { Box, Text } from "ink";

export interface ActionItem {
  keys: string;
  label: string;
}

export interface ActionBarProps {
  actions: ActionItem[];
}

export function ActionBar({ actions }: ActionBarProps) {
  return (
    <Box>
      {actions.map((action, i) => (
        <Box key={`${action.label}-${i}`} marginRight={2}>
          <Text bold color="cyan">
            {action.keys}
          </Text>
          <Text dimColor> {action.label}</Text>
          {i < actions.length - 1 && <Text dimColor>   </Text>}
        </Box>
      ))}
    </Box>
  );
}

// Common action presets
export const ACTIONS = {
  navigate: { keys: "↑↓", label: "Navigate" },
  select: { keys: "⏎", label: "Select" },
  refresh: { keys: "r", label: "Refresh" },
  quit: { keys: "q", label: "Quit" },
  back: { keys: "b", label: "Back" },
  copy: { keys: "c", label: "Copy" },
  view: { keys: "v", label: "View" },
  filter: { keys: "/", label: "Filter" },
  help: { keys: "?", label: "Help" },
} as const;
