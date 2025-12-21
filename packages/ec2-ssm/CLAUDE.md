# CLAUDE.md

This file provides guidance to Claude Code when working with this package.

## Project Overview

**🖥️ EC2 SSM Shell** - Interactive TUI for connecting to EC2 instances via AWS SSM Session Manager.

## Quick Start

```bash
AWS_PROFILE=my-profile ./ec2-ssm
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| Bun | Runtime (native TypeScript) |
| @toolbox/common | Shared utilities (prompts, colors, spinners) |
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

Single-file executable using shared components from `@toolbox/common`:

```
1. Types (EC2Instance)
2. Instance discovery (EC2 + SSM status)
3. SSM session spawner
4. Formatters
5. Main entry (runApp wrapper)
```

## Shared Components Used

```typescript
import {
  colors as pc,
  prompts as p,
  getAwsEnv,
  getAwsClientConfig,
  fetchAndDisplayIdentity,
  withSpinner,
  selectFromList,
  runApp,
  goodbye,
} from "@toolbox/common";
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AWS_PROFILE` | AWS profile to use |
| `AWS_REGION` | AWS region (or AWS_DEFAULT_REGION) |
