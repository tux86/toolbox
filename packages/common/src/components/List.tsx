import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput, useFocus } from "ink";

export interface ListItemData {
  id: string;
  label: string;
  description?: string;
  hint?: string;
  value: any;
}

export interface ListAction {
  key: string;
  handler: (item: ListItemData) => void;
}

export interface ListProps {
  items: ListItemData[];
  onSelect?: (item: ListItemData) => void;
  onHighlight?: (item: ListItemData | null) => void;
  onRefresh?: () => void;
  actions?: ListAction[];
  loading?: boolean;
  emptyMessage?: string;
  maxVisible?: number;
  showIndex?: boolean;
}

export function List({
  items,
  onSelect,
  onHighlight,
  onRefresh,
  actions = [],
  loading = false,
  emptyMessage = "No items found",
  maxVisible = 10,
  showIndex = false,
}: ListProps) {
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const { isFocused } = useFocus({ autoFocus: true });

  // Clamp cursor when items change
  useEffect(() => {
    setCursor((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Notify on highlight
  useEffect(() => {
    onHighlight?.(items[cursor] ?? null);
  }, [cursor, items, onHighlight]);

  // Handle scrolling
  useEffect(() => {
    if (cursor < scrollOffset) {
      setScrollOffset(cursor);
    } else if (cursor >= scrollOffset + maxVisible) {
      setScrollOffset(cursor - maxVisible + 1);
    }
  }, [cursor, maxVisible, scrollOffset]);

  // Keyboard navigation
  useInput(
    (input, key) => {
      if (loading || !isFocused) return;

      // Navigation
      if (key.upArrow || input === "k") {
        setCursor((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === "j") {
        setCursor((prev) => Math.min(items.length - 1, prev + 1));
      }

      // Page up/down
      if (key.pageUp) {
        setCursor((prev) => Math.max(0, prev - maxVisible));
      }
      if (key.pageDown) {
        setCursor((prev) => Math.min(items.length - 1, prev + maxVisible));
      }

      // Home/End
      if (key.meta && key.upArrow) {
        setCursor(0);
      }
      if (key.meta && key.downArrow) {
        setCursor(items.length - 1);
      }

      // Select
      if (key.return && items[cursor]) {
        onSelect?.(items[cursor]);
      }

      // Refresh
      if (input === "r") {
        onRefresh?.();
      }

      // Custom actions
      for (const action of actions) {
        if (input === action.key && items[cursor]) {
          action.handler(items[cursor]);
        }
      }
    },
    { isActive: isFocused }
  );

  if (loading) {
    return null;
  }

  if (items.length === 0) {
    return (
      <Box marginY={1}>
        <Text dimColor>{emptyMessage}</Text>
      </Box>
    );
  }

  const visibleItems = items.slice(scrollOffset, scrollOffset + maxVisible);
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + maxVisible < items.length;

  return (
    <Box flexDirection="column">
      {/* Scroll indicator up */}
      {showScrollUp && (
        <Box marginLeft={2}>
          <Text dimColor>↑ {scrollOffset} more</Text>
        </Box>
      )}

      {/* Items */}
      {visibleItems.map((item, index) => {
        const actualIndex = scrollOffset + index;
        const isSelected = actualIndex === cursor;

        return (
          <Box key={item.id} flexDirection="column" marginY={0}>
            <Box>
              {/* Selection indicator */}
              <Text color={isSelected ? "cyan" : "gray"}>
                {isSelected ? "❯" : " "}
              </Text>

              {/* Index */}
              {showIndex && (
                <Text dimColor> {String(actualIndex + 1).padStart(2)} </Text>
              )}

              {/* Label */}
              <Text bold={isSelected} color={isSelected ? "white" : undefined}>
                {" "}{item.label}
              </Text>

              {/* Hint */}
              {item.hint && (
                <Text dimColor> ({item.hint})</Text>
              )}
            </Box>

            {/* Description */}
            {item.description && (
              <Box marginLeft={3}>
                <Text dimColor>{item.description}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Scroll indicator down */}
      {showScrollDown && (
        <Box marginLeft={2}>
          <Text dimColor>↓ {items.length - scrollOffset - maxVisible} more</Text>
        </Box>
      )}
    </Box>
  );
}
