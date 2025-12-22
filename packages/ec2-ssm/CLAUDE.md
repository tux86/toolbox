# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**EC2 SSM Shell** - Interactive TUI for connecting to EC2 instances via AWS SSM Session Manager.

## Quick Start

```bash
AWS_PROFILE=my-profile bun run start
# or after build
AWS_PROFILE=my-profile ./dist/ec2-ssm
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime (native TypeScript) |
| React | Component framework |
| Ink | React renderer for CLI |
| @toolbox/common | Shared UI components and utilities |
| @aws-sdk/client-ec2 | List EC2 instances |
| @aws-sdk/client-ssm | Check SSM agent status |

## Features

- **Account info** - Shows account ID, profile, region, and role/user
- **Auto-discovery** - Lists all running EC2 instances in current region
- **SSM filtering** - Only shows instances with SSM agent online
- **Quick connect** - Select instance and drop directly into shell

## Prerequisites

- AWS CLI v2 installed with Session Manager plugin
- Valid AWS credentials (via profile or environment)
- EC2 instances with SSM agent installed and running

## Architecture

Single-file React/Ink application using shared components from `@toolbox/common`:

```
src/index.tsx
├── Types (EC2Instance)
├── AWS Operations (listInstances, getSSMStatus)
├── Hook: useInstances() - Instance discovery with SSM status
└── Main EC2SSM component
```

## Shared Components Used

```tsx
import {
  App,
  renderApp,
  List,
  Spinner,
  StatusMessage,
  IdentityCard,
  ACTIONS,
  useIdentity,
  getAwsClientConfig,
} from "@toolbox/common";
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AWS_PROFILE` | AWS profile to use |
| `AWS_REGION` | AWS region (or AWS_DEFAULT_REGION) |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate instances |
| `Enter` | Connect to instance |
| `r` | Refresh instance list |
| `q` | Quit |
