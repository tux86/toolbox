# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**AWS Credentials Manager** - Interactive TUI for managing AWS SSO credentials.

## Quick Start

```bash
./src/index.tsx
# or
bun run start
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime (native TypeScript) |
| React | Component framework |
| Ink | React renderer for CLI |
| @toolbox/common | Shared UI components and utilities |
| @aws-sdk/client-sts | Token validation |
| @aws-sdk/credential-providers | SSO credential provider |
| ini | Parse/write AWS credentials file |

## Features

- **Auto-discovery** - Scans `~/.aws/config` for SSO profiles
- **Status check** - Shows token validity with expiry countdown
- **Credential refresh** - Multi-select profiles, triggers SSO login if needed
- **Daemon mode** - Auto-refresh at configurable intervals
- **Settings** - Notifications, default interval, favorite profiles
- **Cross-platform notifications** - macOS (osascript), Linux (notify-send)

## Architecture

Single-file React/Ink application using shared components from `@toolbox/common`:

```
src/index.tsx
├── Types & Constants
├── File utilities (parseAwsConfig, writeCredentials, loadSettings, saveSettings)
├── SSO cache operations
├── AWS operations (discoverProfiles, checkTokenStatus, refreshProfile)
├── Notification system
├── Utility functions (formatExpiry, getStatusColor)
├── Hooks
│   ├── useProfiles() - Profile discovery and status checking
│   └── useSettings() - Settings management
├── Components
│   ├── StatusTable - Profile status display
│   ├── RefreshProgress - Refresh progress with SSO login
│   └── DaemonView - Auto-refresh daemon
└── Main AWSCredsManager component
```

## Views

| View | Description |
|------|-------------|
| menu | Main menu with actions |
| status | Profile status table |
| refresh-select | Multi-select profiles to refresh |
| refresh | Refresh progress display |
| daemon-select | Select profiles for daemon |
| daemon-interval | Select refresh interval |
| daemon-running | Running daemon with countdown |
| settings | Settings menu |
| settings-interval | Change default interval |
| settings-favorites | Select favorite profiles |

## Shared Components Used

```tsx
import {
  App,
  renderApp,
  List,
  MultiSelectList,
  Card,
  Spinner,
  StatusMessage,
  ACTIONS,
  type ListItemData,
  type MultiSelectItemData,
} from "@toolbox/common";
```

## AWS Files Used

| Path | Purpose |
|------|---------|
| `~/.aws/config` | Read SSO profile configurations |
| `~/.aws/credentials` | Write refreshed credentials |
| `~/.aws/sso/cache/*.json` | Read token expiry times |
| `~/.aws/credentials-manager.json` | App settings persistence |

## Settings Schema

```typescript
interface AppSettings {
  notifications: boolean;      // System notifications on/off
  defaultInterval: number;     // Default daemon refresh interval (minutes)
  favoriteProfiles: string[];  // Profiles shown first
  lastRefresh?: string;        // ISO timestamp of last refresh
}
```

## Keyboard Shortcuts

### Main Menu
- `↑/↓` - Navigate
- `Enter` - Select
- `q` - Quit

### Profile Selection
- `↑/↓` - Navigate
- `Space` - Toggle selection
- `a` - Select all/none
- `Enter` - Confirm
- `Esc/q` - Cancel

### Daemon Mode
- `Ctrl+C` - Stop daemon
