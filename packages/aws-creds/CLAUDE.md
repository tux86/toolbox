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
| @aws-sdk/client-sso-oidc | Device authorization flow |
| @aws-sdk/client-sso | Get role credentials |
| ini | Parse/write AWS config files |

## Features

- **Auto-discovery** - Scans `~/.aws/config` for SSO profiles (both legacy and sso_session)
- **Status check** - Shows token validity with expiry countdown
- **One-time refresh** - Multi-select profiles, triggers SSO login if needed
- **Auto-refresh daemon** - Continuous refresh at configurable intervals
- **Device auth flow** - Shows URL + code, press Enter to open browser or copy URL
- **Settings** - Notifications, default interval, favorite profiles
- **Cross-platform** - macOS/Linux notifications, clipboard support

## Architecture

Single-file React/Ink application:

```
src/index.tsx
├── Types & Constants
├── File Utilities
│   ├── parseIniFile() - Parse AWS config/credentials
│   ├── writeCredentials() - Save credentials to file
│   ├── loadSettings() / saveSettings()
├── SSO Cache
│   └── findCachedToken() - Read SSO token from cache
├── AWS Operations
│   ├── discoverProfiles() - Find SSO profiles in config
│   ├── checkTokenStatus() - Check if token is valid
│   └── refreshProfile() - Refresh credentials
├── SSO OIDC Device Auth Flow
│   ├── startDeviceAuthorization() - Get device code + URL
│   ├── pollForToken() - Wait for browser auth
│   ├── saveSSOTokenToCache() - Save token for AWS CLI
│   ├── getCredentialsWithToken() - Get role credentials
│   └── performSSOLoginFlow() - Complete login flow
├── Utility Functions
│   ├── formatExpiry() - Format time remaining
│   ├── getStatusColor() - Status to color mapping
│   └── sortByFavorites() - Sort with favorites first
├── Hooks
│   ├── useProfiles() - Profile discovery and status
│   ├── useSettings() - Settings management
│   └── useDeviceAuth() - Device auth flow state
├── Components
│   ├── StatusTable - Profile status display
│   ├── LoginPrompt - SSO login UI with URL/code
│   ├── RefreshProgress - One-time refresh progress
│   └── DaemonView - Auto-refresh daemon
└── Main AWSCredsManager component
```

## Views

| View | Description |
|------|-------------|
| menu | Main menu (Check status, Refresh now, Auto-refresh, Settings) |
| status | Profile status table |
| refresh-select | Multi-select profiles to refresh |
| refresh | Refresh progress with SSO login prompts |
| daemon-select | Select profiles for daemon |
| daemon-interval | Select refresh interval |
| daemon-running | Running daemon with countdown |
| settings | Settings menu |
| settings-interval | Change default interval |
| settings-favorites | Select favorite profiles |

## Shared Components Used

```tsx
import {
  App, renderApp,
  List, MultiSelectList,
  Card, Spinner, StatusMessage,
  ACTIONS, useCopy,
  type ListItemData,
  type MultiSelectItemData,
} from "@toolbox/common";
```

## AWS Files

| Path | Purpose |
|------|---------|
| `~/.aws/config` | Read SSO profile configurations |
| `~/.aws/credentials` | Write refreshed static credentials |
| `~/.aws/sso/cache/*.json` | Read/write SSO tokens (AWS CLI compatible) |
| `~/.aws/credentials-manager.json` | App settings |

## SSO Login Flow

1. Check if cached SSO token exists and is valid
2. If expired, start device authorization (RegisterClient + StartDeviceAuthorization)
3. Show URL + user code to user
4. User can press Enter to open browser, or 'c' to copy URL
5. Poll for token (CreateToken) until user authorizes
6. Save token to SSO cache (for AWS CLI compatibility)
7. Get role credentials (GetRoleCredentials)
8. Write credentials to ~/.aws/credentials

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

### SSO Login Prompt
- `Enter` - Open browser
- `c` - Copy URL to clipboard

### Daemon Mode
- `q` or `Ctrl+C` - Stop daemon
