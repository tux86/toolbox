# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**Secrets View** - Interactive TUI for browsing and copying AWS Secrets Manager secrets.

## Quick Start

```bash
AWS_PROFILE=my-profile bun run start
# or after build
AWS_PROFILE=my-profile ./dist/secrets-view
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime (native TypeScript) |
| React | Component framework |
| Ink | React renderer for CLI |
| @toolbox/common | Shared UI components and utilities |
| @aws-sdk/client-secrets-manager | List and fetch secrets |

## Features

- **Account info** - Shows account ID, profile, region, and role/user
- **List secrets** - Browse all secrets in current region
- **View secret** - Display secret value (pretty-prints JSON)
- **Copy to clipboard** - Copy secret value with visual feedback
- **Cross-platform** - macOS (pbcopy) and Linux (xclip)

## Architecture

Single-file React/Ink application using shared components from `@toolbox/common`:

```
src/index.tsx
├── Types (SecretInfo, ViewState)
├── AWS Operations (listSecrets, getSecretValue)
├── Hook: useSecrets() - Secret listing and fetching
├── SecretDetail component - Detail view with copy
└── Main SecretsView component - List view
```

## Views

| View | Description |
|------|-------------|
| list | Browse secrets, select to view details |
| detail | View secret value, copy to clipboard |

## Shared Components Used

```tsx
import {
  App,
  renderApp,
  List,
  Card,
  Spinner,
  StatusMessage,
  CopyFeedback,
  IdentityCard,
  ACTIONS,
  useIdentity,
  useCopy,
  getAwsClientConfig,
  formatJson,
} from "@toolbox/common";
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AWS_PROFILE` | AWS profile to use |
| `AWS_REGION` | AWS region (or AWS_DEFAULT_REGION) |

## Keyboard Shortcuts

### List View
| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate secrets |
| `Enter` | View secret details |
| `c` | Copy secret value |
| `r` | Refresh list |
| `q` | Quit |

### Detail View
| Key | Action |
|-----|--------|
| `c` | Copy secret value |
| `b` | Back to list |
| `q` | Quit |
