# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**🔐 Secrets View** - Interactive TUI for browsing and copying AWS Secrets Manager secrets.

## Quick Start

```bash
AWS_PROFILE=my-profile ./secrets-view
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime (native TypeScript) |
| @toolbox/common | Shared utilities (prompts, colors, spinners, clipboard) |
| @aws-sdk/client-secrets-manager | List and fetch secrets |

## Features

- **Account info** - Shows account ID, profile, region, and role/user
- **List secrets** - Browse all secrets in current region
- **View secret** - Display secret value (pretty-prints JSON)
- **Copy to clipboard** - Copy entire secret or specific JSON field with visual feedback
- **Cross-platform** - macOS (pbcopy) and Linux (xclip)

## Architecture

Single-file executable using shared components from `@toolbox/common`:

```
1. Types (SecretInfo)
2. Secrets operations (list, get value)
3. Formatters
4. Secret actions (view, copy)
5. Main entry (runApp wrapper)
```

## Shared Components Used

```typescript
import {
  colors as pc,
  prompts as p,
  getAwsClientConfig,
  fetchAndDisplayIdentity,
  withSpinner,
  selectFromList,
  copyWithFeedback,
  formatJson,
  divider,
  runApp,
  goodbye,
} from "@toolbox/common";
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AWS_PROFILE` | AWS profile to use |
| `AWS_REGION` | AWS region (or AWS_DEFAULT_REGION) |
