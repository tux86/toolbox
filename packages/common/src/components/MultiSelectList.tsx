import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useFocus } from "ink";

export interface MultiSelectItemData {
  id: string;
  label: string;
  hint?: string;
  value: any;
}

export interface MultiSelectListProps {
  items: MultiSelectItemData[];
  onSubmit?: (selected: MultiSelectItemData[]) => void;
  onCancel?: () => void;
  initialSelected?: string[];
  required?: boolean;
  maxVisible?: number;
}

export function MultiSelectList({
  items,
  onSubmit,
  onCancel,
  initialSelected = [],
  required = false,
  maxVisible = 10,
}: MultiSelectListProps) {
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [scrollOffset, setScrollOffset] = useState(0);
  const { isFocused } = useFocus({ autoFocus: true });

  // Handle scrolling
  useEffect(() => {
    if (cursor < scrollOffset) {
      setScrollOffset(cursor);
    } else if (cursor >= scrollOffset + maxVisible) {
      setScrollOffset(cursor - maxVisible + 1);
    }
  }, [cursor, maxVisible, scrollOffset]);

  useInput(
    (input, key) => {
      if (!isFocused) return;

      // Navigation
      if (key.upArrow || input === "k") {
        setCursor((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow || input === "j") {
        setCursor((prev) => Math.min(items.length - 1, prev + 1));
      }

      // Toggle selection
      if (input === " " && items[cursor]) {
        setSelected((prev) => {
          const next = new Set(prev);
          const id = items[cursor].id;
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          return next;
        });
      }

      // Select all / none
      if (input === "a") {
        if (selected.size === items.length) {
          setSelected(new Set());
        } else {
          setSelected(new Set(items.map((i) => i.id)));
        }
      }

      // Submit
      if (key.return) {
        const selectedItems = items.filter((i) => selected.has(i.id));
        if (required && selectedItems.length === 0) {
          return; // Don't submit if required and nothing selected
        }
        onSubmit?.(selectedItems);
      }

      // Cancel
      if (key.escape || (input === "q" && !key.ctrl)) {
        onCancel?.();
      }
    },
    { isActive: isFocused }
  );

  if (items.length === 0) {
    return (
      <Box marginY={1}>
        <Text dimColor>No items</Text>
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
        const isHighlighted = actualIndex === cursor;
        const isSelected = selected.has(item.id);

        return (
          <Box key={item.id}>
            {/* Cursor */}
            <Text color={isHighlighted ? "cyan" : undefined}>
              {isHighlighted ? "❯" : " "}
            </Text>

            {/* Checkbox */}
            <Text color={isSelected ? "green" : "gray"}>
              {isSelected ? " ◉" : " ○"}
            </Text>

            {/* Label */}
            <Text bold={isHighlighted} color={isHighlighted ? "white" : undefined}>
              {" "}{item.label}
            </Text>

            {/* Hint */}
            {item.hint && (
              <Text dimColor> ({item.hint})</Text>
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

      {/* Instructions */}
      <Box marginTop={1}>
        <Text dimColor>
          space toggle · a all/none · enter submit · {selected.size} selected
        </Text>
      </Box>
    </Box>
  );
}
