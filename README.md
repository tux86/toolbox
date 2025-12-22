# Toolbox

A collection of interactive CLI tools built with **Bun** + **React** + **Ink**, featuring modern terminal UI interfaces.

[![CI](https://github.com/tux86/toolbox/actions/workflows/ci.yml/badge.svg)](https://github.com/tux86/toolbox/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Features

- **Modern TUI** - React-based terminal UI with Ink (like Claude Code, Gatsby CLI)
- **Fast** - Built on Bun for lightning-fast startup and execution
- **Standalone Binaries** - Compile to single executables (~60MB)
- **Monorepo** - Organized workspace with shared component library
- **Extensible** - Easy to add new tools using the common framework

## Tools

### aws-creds

**AWS Credentials Manager** - Interactive credential management for AWS SSO.

- **Auto-discovery** - Scans `~/.aws/config` for SSO profiles
- **Status dashboard** - View credential validity and expiry times
- **Multi-select refresh** - Refresh multiple profiles at once
- **Auto-refresh daemon** - Background process to keep credentials fresh
- **Notifications** - Desktop alerts when credentials expire (macOS/Linux)

```bash
./dist/aws-creds
# or
bun run aws-creds
```

---

### ec2-ssm

**EC2 SSM Shell** - Connect to EC2 instances via AWS Systems Manager.

- **Auto-discovery** - Lists all running instances in current region
- **SSM filtering** - Only shows instances with SSM agent online
- **Rich display** - Instance name, ID, private IP, and instance type
- **Quick connect** - Select and drop directly into a shell session
- **No SSH keys needed** - Uses SSM Session Manager (no port 22)

```bash
AWS_PROFILE=my-profile ./dist/ec2-ssm
# or
AWS_PROFILE=my-profile bun run ec2-ssm
```

---

### secrets-view

**Secrets Manager Browser** - Browse and copy AWS Secrets Manager secrets.

- **List secrets** - Browse all secrets in current region
- **View values** - Display secret content with JSON pretty-printing
- **Copy to clipboard** - Copy entire secret with visual feedback
- **Keyboard navigation** - Vim-style keys (j/k) and arrow keys

```bash
AWS_PROFILE=my-profile ./dist/secrets-view
# or
AWS_PROFILE=my-profile bun run secrets-view
```

---

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [AWS CLI v2](https://aws.amazon.com/cli/) with SSM Session Manager plugin (for AWS tools)
- Valid AWS credentials configured

## Installation

```bash
# Clone the repository
git clone https://github.com/tux86/toolbox.git
cd toolbox

# Install dependencies
bun install
```

## Usage

### Development (run from source)

```bash
bun run aws-creds
bun run ec2-ssm
bun run secrets-view
```

### Build standalone binaries

```bash
# Build all tools
bun run build

# Build individual tools
bun run build:aws-creds
bun run build:ec2-ssm
bun run build:secrets-view
```

Output binaries in `dist/`:
```
dist/
├── aws-creds      60MB
├── ec2-ssm        61MB
└── secrets-view   60MB
```

### Run binaries

```bash
./dist/aws-creds
./dist/ec2-ssm
./dist/secrets-view
```

### Global installation (optional)

```bash
# Link binaries to your path
ln -s $(pwd)/dist/aws-creds ~/.local/bin/aws-creds
ln -s $(pwd)/dist/ec2-ssm ~/.local/bin/ec2-ssm
ln -s $(pwd)/dist/secrets-view ~/.local/bin/secrets-view
```

## Project Structure

```
toolbox/
├── packages/
│   ├── common/              # Shared React/Ink component library
│   │   └── src/
│   │       ├── components/  # UI components (App, List, Card, etc.)
│   │       ├── hooks/       # React hooks (useIdentity, useCopy)
│   │       ├── aws.ts       # AWS utilities
│   │       └── utils.ts     # General utilities
│   ├── aws-creds/           # AWS SSO credentials manager
│   ├── ec2-ssm/             # EC2 SSM shell connector
│   └── secrets-view/        # Secrets Manager browser
├── dist/                    # Compiled binaries (after build)
├── package.json             # Workspace configuration
└── README.md
```

## Shared Components (@toolbox/common)

All tools use these shared React components:

```tsx
import {
  // Layout
  App,                 // Main app wrapper with header + action bar
  Card,                // Bordered card container
  Divider,             // Horizontal divider

  // Interactive
  List,                // Scrollable list with keyboard navigation
  MultiSelectList,     // Multi-select with checkboxes
  ActionBar,           // Keyboard shortcut hints
  ACTIONS,             // Common action presets

  // Feedback
  Spinner,             // Loading indicator
  StatusMessage,       // Success/error/warning messages
  CopyFeedback,        // Copy confirmation display

  // AWS
  IdentityCard,        // AWS identity display

  // Hooks
  useIdentity,         // AWS caller identity hook
  useCopy,             // Clipboard with feedback

  // Utilities
  getAwsClientConfig,  // AWS SDK config from env
  copyToClipboard,     // Copy to clipboard
  formatJson,          // Pretty-print JSON
} from "@toolbox/common";
```

## Keyboard Shortcuts

All tools support these common shortcuts:

| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate |
| `Enter` | Select |
| `r` | Refresh |
| `q` | Quit |
| `b` | Back |
| `c` | Copy |

Multi-select lists also support:
| Key | Action |
|-----|--------|
| `Space` | Toggle selection |
| `a` | Select all/none |

## Contributing

### Adding a New Tool

1. Create a new package:
   ```bash
   mkdir -p packages/my-tool/src
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@toolbox/my-tool",
     "version": "1.0.0",
     "type": "module",
     "bin": { "my-tool": "./src/index.tsx" },
     "scripts": {
       "start": "bun run ./src/index.tsx",
       "build": "bun build --compile ./src/index.tsx --outfile ../../dist/my-tool"
     },
     "dependencies": {
       "@toolbox/common": "workspace:*",
       "ink": "^6.0.0",
       "react": "^19.0.0"
     }
   }
   ```

3. Create your tool:
   ```tsx
   #!/usr/bin/env bun
   import React from "react";
   import { App, renderApp, List, ACTIONS } from "@toolbox/common";
   import { useApp } from "ink";

   function MyTool() {
     const { exit } = useApp();

     return (
       <App
         title="My Tool"
         icon="🎯"
         color="green"
         actions={[ACTIONS.navigate, ACTIONS.select, ACTIONS.quit]}
         onQuit={() => exit()}
       >
         {/* Your content */}
       </App>
     );
   }

   renderApp(<MyTool />);
   ```

4. Install and run:
   ```bash
   bun install
   bun run --cwd packages/my-tool start
   ```

### Commits & Releases

**Conventional Commits** (enforced by commitlint):
```bash
feat(ec2-ssm): add instance filtering
fix(common): handle empty clipboard
docs: update README
```

**Changesets** - After user-facing changes:
```bash
bun run changeset
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [Bun](https://bun.sh) - Fast JavaScript runtime

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/tux86">tux86</a>
</p>
