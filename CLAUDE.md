# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Toolbox** - A Bun workspace monorepo containing AWS utility tools with interactive TUI.

## Structure

```
toolbox/
├── packages/
│   ├── common/          # Shared utilities (AWS, UI helpers)
│   ├── aws-creds/       # 🔑 AWS SSO credentials manager
│   ├── ec2-ssm/         # 🖥️ EC2 SSM shell connector
│   └── secrets-view/    # 🔐 Secrets Manager browser
└── package.json         # Workspace root
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime & package manager |
| TypeScript | Language (native Bun support) |
| @toolbox/common | Shared utilities across all tools |
| @clack/prompts | Interactive TUI prompts |
| picocolors | Terminal colors |

## Development Commands

```bash
bun install                    # Install all workspace dependencies
bun run aws-creds              # Run 🔑 aws-creds
bun run ec2-ssm                # Run 🖥️ ec2-ssm
bun run secrets-view           # Run 🔐 secrets-view
```

## Adding a New Package

1. Create directory: `packages/<package-name>/`
2. Add `package.json` with:
   ```json
   {
     "name": "@toolbox/<package-name>",
     "dependencies": {
       "@toolbox/common": "workspace:*"
     }
   }
   ```
3. Add `CLAUDE.md` with project-specific instructions
4. Use shared utilities:
   ```typescript
   import { runApp, withSpinner, colors as pc } from "@toolbox/common";

   runApp({ name: "🎯 My Tool", color: pc.bgGreen }, async () => {
     // tool logic
   });
   ```
5. Run `bun install` to link the workspace

## Packages

| Package | Icon | Description |
|---------|------|-------------|
| [@toolbox/common](packages/common/) | 📦 | Shared utilities (AWS identity, UI helpers, clipboard) |
| [@toolbox/aws-creds](packages/aws-creds/) | 🔑 | Manage AWS SSO credentials |
| [@toolbox/ec2-ssm](packages/ec2-ssm/) | 🖥️ | Connect to EC2 instances via SSM |
| [@toolbox/secrets-view](packages/secrets-view/) | 🔐 | Browse AWS Secrets Manager |

## Shared Components (@toolbox/common)

All tools use these shared utilities:

```typescript
import {
  runApp,              // App wrapper with intro + error handling
  withSpinner,         // Async operations with spinner
  selectFromList,      // Generic list selector
  copyWithFeedback,    // Copy with visual feedback
  fetchAndDisplayIdentity,  // Show AWS account info
  goodbye,             // Standard exit message
  prompts as p,        // @clack/prompts
  colors as pc,        // picocolors
} from "@toolbox/common";
```
