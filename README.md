# 🧰 Toolbox

A collection of interactive CLI tools built with **Bun** + **TypeScript**, featuring beautiful TUI interfaces powered by [@clack/prompts](https://github.com/natemoo-re/clack).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## ✨ Features

- 🎨 **Beautiful TUI** - Interactive prompts with spinners, colors, and visual feedback
- ⚡ **Fast** - Built on Bun for lightning-fast startup and execution
- 📦 **Monorepo** - Organized workspace with shared utilities
- 🔧 **Extensible** - Easy to add new tools using the common framework

## 🛠️ Tools

| Tool | Description |
|------|-------------|
| 🔑 **[aws-creds](packages/aws-creds/)** | Manage AWS SSO credentials with auto-refresh daemon |
| 🖥️ **[ec2-ssm](packages/ec2-ssm/)** | Connect to EC2 instances via SSM Session Manager |
| 🔐 **[secrets-view](packages/secrets-view/)** | Browse and copy AWS Secrets Manager secrets |

## 📋 Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [AWS CLI v2](https://aws.amazon.com/cli/) with SSM Session Manager plugin (for AWS tools)
- Valid AWS credentials configured

## 🚀 Installation

```bash
# Clone the repository
git clone https://github.com/tux86/toolbox.git
cd toolbox

# Install dependencies
bun install
```

## 📖 Usage

### Run from repository root

```bash
# AWS Credentials Manager
bun run aws-creds

# EC2 SSM Shell
AWS_PROFILE=my-profile bun run ec2-ssm

# Secrets Manager Browser
AWS_PROFILE=my-profile bun run secrets-view
```

### Run directly

```bash
# Make executable (first time only)
chmod +x packages/*/$(ls packages/*/package.json | xargs -I{} dirname {} | xargs -I{} basename {})

# Run directly
./packages/aws-creds/aws-creds
./packages/ec2-ssm/ec2-ssm
./packages/secrets-view/secrets-view
```

### Global installation (optional)

```bash
# Link to your path
ln -s $(pwd)/packages/aws-creds/aws-creds ~/.local/bin/aws-creds
ln -s $(pwd)/packages/ec2-ssm/ec2-ssm ~/.local/bin/ec2-ssm
ln -s $(pwd)/packages/secrets-view/secrets-view ~/.local/bin/secrets-view
```

## 🎬 Demo

### AWS Credentials Manager
```
┌  🔑 AWS Credentials Manager
│
◇  Found 5 SSO profile(s)
│
◆  What would you like to do?
│  ● Check credentials status
│  ○ Refresh credentials
│  ○ Start auto-refresh daemon
│  ○ Settings
│  ○ Exit
```

### EC2 SSM Shell
```
┌  🖥️  EC2 SSM Shell
│
●  Account: 123456789012 | Profile: dev | Region: us-east-1
●  Role: AdminRole
│
◇  Found 3 instance(s) with SSM online
│
◆  Select an instance to connect:
│  ● web-server-01            i-0abc123... 10.0.1.10 t3.medium
│  ○ api-server-01            i-0def456... 10.0.2.20 t3.large
│  ○ worker-01                i-0ghi789... 10.0.3.30 t3.small
```

### Secrets View
```
┌  🔐 Secrets View
│
●  Account: 123456789012 | Profile: dev | Region: us-east-1
●  Role: AdminRole
│
◇  Found 7 secret(s)
│
◆  Select a secret:
│  ● prod/database - PostgreSQL credentials
│  ○ prod/api-keys - External API keys
│  ○ dev/database - Development DB
```

## 🏗️ Project Structure

```
toolbox/
├── packages/
│   ├── common/          # 📦 Shared utilities
│   │   └── src/
│   │       ├── aws.ts   # AWS helpers (identity, config)
│   │       └── ui.ts    # UI helpers (spinners, prompts)
│   ├── aws-creds/       # 🔑 AWS SSO credentials manager
│   ├── ec2-ssm/         # 🖥️ EC2 SSM shell connector
│   └── secrets-view/    # 🔐 Secrets Manager browser
├── package.json         # Workspace configuration
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Adding a New Tool

1. Create a new package:
   ```bash
   mkdir -p packages/my-tool
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@toolbox/my-tool",
     "version": "1.0.0",
     "type": "module",
     "dependencies": {
       "@toolbox/common": "workspace:*"
     }
   }
   ```

3. Create your tool using shared utilities:
   ```typescript
   #!/usr/bin/env bun
   import {
     runApp,
     withSpinner,
     selectFromList,
     colors as pc,
   } from "@toolbox/common";

   runApp({ name: "🎯 My Tool", color: pc.bgGreen }, async () => {
     // Your tool logic here
   });
   ```

4. Install dependencies:
   ```bash
   bun install
   ```

### Development Workflow

```bash
# Install dependencies
bun install

# Run a tool in development
bun run --cwd packages/my-tool start

# Format code (if prettier is configured)
bun run format

# Run tests (if configured)
bun test
```

### Pull Request Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-tool`)
3. Commit your changes (`git commit -m 'Add amazing tool'`)
4. Push to the branch (`git push origin feature/amazing-tool`)
5. Open a Pull Request

## 📦 Shared Components (`@toolbox/common`)

All tools use these shared utilities for consistency:

```typescript
import {
  // App wrapper
  runApp,              // App shell with intro + error handling
  goodbye,             // Standard exit message

  // Async operations
  withSpinner,         // Wrap async ops with spinner

  // Selection
  selectFromList,      // Generic list selector

  // AWS
  getAwsClientConfig,  // AWS SDK config from env
  fetchAndDisplayIdentity,  // Show account info

  // Clipboard
  copyWithFeedback,    // Copy with visual confirmation

  // Formatting
  formatJson,          // Pretty-print JSON
  divider,             // Horizontal line

  // Re-exports
  prompts as p,        // @clack/prompts
  colors as pc,        // picocolors
} from "@toolbox/common";
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [@clack/prompts](https://github.com/natemoo-re/clack) - Beautiful CLI prompts
- [picocolors](https://github.com/alexeyraspopov/picocolors) - Terminal colors
- [Bun](https://bun.sh) - Fast JavaScript runtime

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/tux86">tux86</a>
</p>
