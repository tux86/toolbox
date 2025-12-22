# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**@toolbox/common** - Shared React/Ink components and utilities for all toolbox CLI tools.

## Usage

```typescript
import {
  // Layout Components
  App,
  renderApp,
  Header,
  Card,
  Divider,

  // Interactive Components
  List,
  MultiSelectList,
  ActionBar,
  ACTIONS,

  // Feedback Components
  Spinner,
  StatusMessage,

  // AWS Components
  IdentityCard,

  // Hooks
  useIdentity,

  // AWS Utilities
  getAwsEnv,
  getAwsClientConfig,
  getCallerIdentity,
  parseIdentityArn,

  // Utilities
  copyToClipboard,
  formatJson,

  // Types
  type AppProps,
  type ListItemData,
  type MultiSelectItemData,
  type ActionItem,
  type AwsIdentity,
} from "@toolbox/common";
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime (native TypeScript) |
| React | Component framework |
| Ink | React renderer for CLI |
| ink-spinner | Loading spinners |
| @aws-sdk/client-sts | Get caller identity |

## Architecture

```
src/
├── index.ts              # Re-exports all modules
├── aws.ts                # AWS utilities
├── utils.ts              # General utilities
├── components/
│   ├── index.ts          # Component exports
│   ├── App.tsx           # Main app wrapper
│   ├── Header.tsx        # App header
│   ├── Card.tsx          # Bordered card container
│   ├── Divider.tsx       # Horizontal divider
│   ├── List.tsx          # Interactive list with scroll
│   ├── MultiSelectList.tsx # Multi-select list
│   ├── ActionBar.tsx     # Keyboard shortcut hints
│   ├── Spinner.tsx       # Loading indicator
│   ├── StatusMessage.tsx # Success/error/warning messages
│   └── IdentityCard.tsx  # AWS identity display
└── hooks/
    ├── index.ts          # Hook exports
    └── useIdentity.tsx   # AWS identity hook
```

## Component Reference

### App

Main application wrapper with header and action bar.

```tsx
<App
  title="My Tool"
  icon="🔧"
  color="cyan"
  actions={[ACTIONS.navigate, ACTIONS.select, ACTIONS.quit]}
  onQuit={() => cleanup()}
>
  {children}
</App>
```

### List

Interactive scrollable list with keyboard navigation.

```tsx
const items: ListItemData[] = [
  { id: "1", label: "Item 1", hint: "optional", value: data1 },
  { id: "2", label: "Item 2", description: "Details", value: data2 },
];

<List
  items={items}
  onSelect={(item) => handleSelect(item)}
  onRefresh={() => fetchData()}
  maxVisible={10}
/>
```

**Keyboard:**
- `↑/↓` or `j/k` - Navigate
- `Enter` - Select
- `r` - Refresh
- `PageUp/PageDown` - Page navigation

### MultiSelectList

Multi-select list with checkboxes.

```tsx
const items: MultiSelectItemData[] = [
  { id: "1", label: "Option 1", value: val1 },
  { id: "2", label: "Option 2", hint: "recommended", value: val2 },
];

<MultiSelectList
  items={items}
  onSubmit={(selected) => handleSubmit(selected)}
  onCancel={() => goBack()}
  initialSelected={["1"]}
  required
  maxVisible={10}
/>
```

**Keyboard:**
- `↑/↓` or `j/k` - Navigate
- `Space` - Toggle selection
- `a` - Select all/none
- `Enter` - Submit
- `Escape/q` - Cancel

### ActionBar & ACTIONS

Display keyboard shortcuts at the bottom.

```tsx
// Pre-defined actions
ACTIONS.navigate  // { keys: "↑↓", label: "Navigate" }
ACTIONS.select    // { keys: "⏎", label: "Select" }
ACTIONS.refresh   // { keys: "r", label: "Refresh" }
ACTIONS.quit      // { keys: "q", label: "Quit" }
ACTIONS.back      // { keys: "b", label: "Back" }
ACTIONS.copy      // { keys: "c", label: "Copy" }
ACTIONS.view      // { keys: "v", label: "View" }
ACTIONS.filter    // { keys: "/", label: "Filter" }
ACTIONS.help      // { keys: "?", label: "Help" }

// Custom action
const customAction = { keys: "x", label: "Export" };
```

### Card

Bordered container for content.

```tsx
<Card title="Details">
  <Text>Content here</Text>
</Card>
```

### Spinner

Loading indicator with label.

```tsx
<Spinner label="Loading data..." />
```

### StatusMessage

Success, error, warning, info messages.

```tsx
<StatusMessage type="success">Operation completed!</StatusMessage>
<StatusMessage type="error">Something went wrong</StatusMessage>
<StatusMessage type="warning">Proceed with caution</StatusMessage>
<StatusMessage type="info">FYI...</StatusMessage>
```

### IdentityCard

Display AWS caller identity.

```tsx
const { identity, loading, error } = useIdentity();

<IdentityCard
  identity={identity}
  loading={loading}
  error={error}
/>
```

## Hooks Reference

### useIdentity

Fetches and manages AWS caller identity.

```tsx
function MyComponent() {
  const { identity, loading, error, refresh } = useIdentity();

  // identity: { accountId, arn, name, type, profile, region }
  // loading: boolean
  // error: string | null
  // refresh: () => void
}
```

## AWS Utilities

| Export | Description |
|--------|-------------|
| `getAwsEnv()` | Returns `{ profile, region }` from env vars |
| `getAwsClientConfig()` | Returns config object for AWS SDK clients |
| `getCallerIdentity(sts?)` | Fetches STS caller identity |
| `parseIdentityArn(arn)` | Extracts `{ name, type }` from ARN |

## General Utilities

| Export | Description |
|--------|-------------|
| `copyToClipboard(text)` | Copy text to clipboard (pbcopy/xclip) |
| `formatJson(value)` | Pretty-print JSON string |

## Entry Point Pattern

All tools follow this pattern:

```tsx
#!/usr/bin/env bun

import React from "react";
import { App, renderApp, List, useIdentity, ACTIONS } from "@toolbox/common";

function MyTool() {
  const { exit } = useApp();
  const { identity, loading } = useIdentity();

  return (
    <App
      title="My Tool"
      icon="🔧"
      color="cyan"
      actions={[ACTIONS.navigate, ACTIONS.select, ACTIONS.quit]}
      onQuit={() => exit()}
    >
      {/* Your content */}
    </App>
  );
}

renderApp(<MyTool />);
```
