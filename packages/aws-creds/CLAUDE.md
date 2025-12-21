# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**🔑 AWS Credentials Manager** - Interactive TUI for managing AWS SSO credentials.

## Quick Start

```bash
./aws-creds
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime (native TypeScript) |
| @toolbox/common | Shared utilities (prompts, colors, spinners) |
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

Single-file executable using shared components from `@toolbox/common`:

```
1. Types & Constants
2. File utilities (parseAwsConfig, writeCredentials)
3. SSO cache operations
4. AWS operations (discoverProfiles, checkTokenStatus, refreshProfile)
5. Notification system
6. UI components (mainMenu, statusTable, selectProfiles)
7. Daemon mode
8. Main entry (runApp wrapper)
```

## Shared Components Used

```typescript
import {
  colors as pc,
  prompts as p,
  runApp,
  withSpinner,
  goodbye,
} from "@toolbox/common";
```

## AWS Files Used

| Path | Purpose |
|------|---------|
| `~/.aws/config` | Read SSO profile configurations |
| `~/.aws/credentials` | Write refreshed credentials |
| `~/.aws/sso/cache/*.json` | Read token expiry times |
| `~/.aws/credentials-manager.json` | App settings persistence |
