# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**Toolbox** - A Bun workspace monorepo containing AWS utility tools with modern React/Ink terminal UI.

## Structure

```
toolbox/
├── packages/
│   ├── common/          # Shared React/Ink component library
│   ├── aws-creds/       # AWS SSO credentials manager
│   ├── ec2-ssm/         # EC2 SSM shell connector
│   └── secrets-view/    # Secrets Manager browser
├── dist/                # Compiled binaries (after build)
└── package.json         # Workspace root
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime & package manager |
| TypeScript | Language (native Bun support) |
| React | Component framework |
| Ink | React renderer for CLI |
| @toolbox/common | Shared UI components and utilities |

## Commands

```bash
# Development
bun install              # Install dependencies
bun run aws-creds        # Run aws-creds
bun run ec2-ssm          # Run ec2-ssm
bun run secrets-view     # Run secrets-view

# Build standalone binaries
bun run build            # Build all to dist/
bun run build:aws-creds  # Build aws-creds
bun run build:ec2-ssm    # Build ec2-ssm
bun run build:secrets-view # Build secrets-view
```

## Adding a New Package

1. Create directory: `packages/<package-name>/src/`
2. Add `package.json`:
   ```json
   {
     "name": "@toolbox/<package-name>",
     "version": "1.0.0",
     "type": "module",
     "bin": { "<package-name>": "./src/index.tsx" },
     "scripts": {
       "start": "bun run ./src/index.tsx",
       "build": "bun build --compile ./src/index.tsx --outfile ../../dist/<package-name>"
     },
     "dependencies": {
       "@toolbox/common": "workspace:*",
       "ink": "^6.0.0",
       "react": "^19.0.0"
     }
   }
   ```
3. Create `src/index.tsx`:
   ```tsx
   #!/usr/bin/env bun
   import React from "react";
   import { App, renderApp, ACTIONS } from "@toolbox/common";
   import { useApp } from "ink";

   function MyTool() {
     const { exit } = useApp();
     return (
       <App
         title="My Tool"
         icon="🎯"
         color="cyan"
         actions={[ACTIONS.quit]}
         onQuit={() => exit()}
       >
         {/* Content */}
       </App>
     );
   }

   renderApp(<MyTool />);
   ```
4. Add `CLAUDE.md` with tool-specific instructions
5. Run `bun install` to link workspace

## Packages

| Package | Description |
|---------|-------------|
| [@toolbox/common](packages/common/) | Shared React/Ink components and hooks |
| [@toolbox/aws-creds](packages/aws-creds/) | AWS SSO credentials manager |
| [@toolbox/ec2-ssm](packages/ec2-ssm/) | EC2 SSM shell connector |
| [@toolbox/secrets-view](packages/secrets-view/) | Secrets Manager browser |

## Shared Components (@toolbox/common)

```tsx
import {
  // Layout
  App, renderApp, Card, Divider,

  // Interactive
  List, MultiSelectList, ActionBar, ACTIONS,

  // Feedback
  Spinner, StatusMessage, CopyFeedback,

  // AWS
  IdentityCard,

  // Hooks
  useIdentity, useCopy,

  // Utilities
  getAwsClientConfig, copyToClipboard, formatJson,
} from "@toolbox/common";
```

## Commits & Releases

### Conventional Commits (enforced by commitlint)

```bash
feat(ec2-ssm): add instance filtering    # New feature
fix(common): handle empty clipboard      # Bug fix
docs: update README                      # Documentation
build(deps): upgrade aws-sdk             # Dependencies
chore: cleanup                           # Maintenance
```

**Allowed scopes:** `aws-creds`, `ec2-ssm`, `secrets-view`, `common`, `deps`

### Changesets (IMPORTANT)

**After making any user-facing changes, ALWAYS add a changeset:**

```bash
bun run changeset
```

Or create manually in `.changeset/<name>.md`:

```markdown
---
"@toolbox/ec2-ssm": patch
---

Fix instance selection when no Name tag exists
```

**Bump types:**
- `patch` - Bug fixes, minor tweaks
- `minor` - New features, enhancements
- `major` - Breaking changes

**Workflow:**
1. Make changes with conventional commits
2. Add changeset describing the change
3. Push to main → GitHub Action creates Release PR
4. Merge Release PR → GitHub Release created automatically
