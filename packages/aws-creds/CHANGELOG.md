# @toolbox/aws-creds

## 3.1.0

### Minor Changes

- [`3c27a52`](https://github.com/tux86/toolbox/commit/3c27a529aaeb695d31040c1d1872a85ee46ea1c2) Thanks [@tux86](https://github.com/tux86)! - Add SSO device authorization flow with manual URL option

  - Implement full SSO OIDC device authorization flow (RegisterClient, StartDeviceAuthorization, CreateToken)
  - Show device auth URL and code, press Enter to open browser or 'c' to copy URL
  - Poll for token automatically after showing URL
  - Save SSO token to cache (AWS CLI compatible format with correct permissions)
  - Get role credentials directly with access token
  - Remove dependency on @aws-sdk/client-sts and @aws-sdk/credential-providers
  - Simplify checkTokenStatus to just check cache expiry (faster, no STS calls)
  - Add sortByFavorites helper for DRY code
  - Fix clipboard copy adding "-n" prefix (use printf instead of echo)
  - Fix same URL shown for multiple profiles
  - Update menu wording for clarity (Refresh now, Auto-refresh)
  - Code cleanup: remove unused functions, simplify imports, use template strings

## 3.0.0

### Major Changes

- [`6f3893b`](https://github.com/tux86/toolbox/commit/6f3893ba4fe3f8f057e5b2e86ad94bd02733b4ea) Thanks [@tux86](https://github.com/tux86)! - Rewrite UI with React/Ink framework

  BREAKING CHANGE: Complete rewrite from @clack/prompts to React/Ink

  - Replace @clack/prompts with React + Ink (React for CLI)
  - Add shared component library with reusable UI components
  - Add build system for standalone binaries
  - Add keyboard shortcuts (vim-style j/k navigation)

### Patch Changes

- Updated dependencies [[`6f3893b`](https://github.com/tux86/toolbox/commit/6f3893ba4fe3f8f057e5b2e86ad94bd02733b4ea)]:
  - @toolbox/common@3.0.0

## 1.1.1

### Patch Changes

- Updated dependencies [[`2c88337`](https://github.com/tux86/toolbox/commit/2c883370d704bb5a1d4eac1e49c8c4041062783d)]:
  - @toolbox/common@1.1.1

## 1.1.0

### Minor Changes

- [`55cdd65`](https://github.com/tux86/toolbox/commit/55cdd65e8d684b1e92f7a852add9a42dc67fa01c) Thanks [@tux86](https://github.com/tux86)! - Initial release of toolbox CLI tools

  - aws-creds: AWS SSO credentials manager with auto-refresh daemon
  - ec2-ssm: Interactive EC2 SSM shell connector
  - secrets-view: AWS Secrets Manager browser with clipboard support
  - common: Shared utilities for consistent TUI experience

### Patch Changes

- Updated dependencies [[`55cdd65`](https://github.com/tux86/toolbox/commit/55cdd65e8d684b1e92f7a852add9a42dc67fa01c)]:
  - @toolbox/common@1.1.0
