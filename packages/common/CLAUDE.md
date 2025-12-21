# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**@toolbox/common** - Shared utilities for all toolbox packages.

## Usage

```typescript
import {
  // AWS utilities
  getAwsEnv,
  getAwsClientConfig,
  getCallerIdentity,
  fetchAndDisplayIdentity,

  // UI utilities
  runApp,
  withSpinner,
  selectFromList,
  copyWithFeedback,
  formatJson,
  divider,
  goodbye,

  // Re-exports
  prompts as p,
  colors as pc,
} from "@toolbox/common";
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime (native TypeScript) |
| @clack/prompts | Interactive TUI prompts |
| picocolors | Terminal colors |
| @aws-sdk/client-sts | Get caller identity |

## Architecture

```
src/
├── index.ts    # Re-exports all modules
├── aws.ts      # AWS utilities
└── ui.ts       # UI utilities
```

## API Reference

### AWS Utilities (`aws.ts`)

| Export | Description |
|--------|-------------|
| `getAwsEnv()` | Returns `{ profile, region }` from env vars |
| `getAwsClientConfig()` | Returns config object for AWS SDK clients |
| `getCallerIdentity(sts?)` | Fetches STS caller identity |
| `parseIdentityArn(arn)` | Extracts `{ name, type }` from ARN |
| `fetchAndDisplayIdentity()` | Fetches + displays account info with spinner |

### UI Utilities (`ui.ts`)

| Export | Description |
|--------|-------------|
| `runApp(config, main)` | App wrapper with intro + error handling |
| `withSpinner(fn, opts)` | Wrap async ops with spinner + success/error messages |
| `selectFromList(items, opts)` | Generic list selector with formatter |
| `copyToClipboard(text)` | Raw clipboard copy (pbcopy/xclip) |
| `copyWithFeedback(text, label)` | Copy with spinner + ✓ visual feedback |
| `formatJson(value)` | Pretty-print JSON string |
| `divider(width?)` | Returns dim horizontal line |
| `goodbye()` | Standard exit message |
| `prompts` | Re-export of @clack/prompts |
| `colors` | Re-export of picocolors |

## Adding New Utilities

1. Add to appropriate file (`aws.ts` or `ui.ts`)
2. Export from `index.ts`
3. Update this CLAUDE.md
