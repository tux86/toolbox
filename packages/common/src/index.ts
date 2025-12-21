/**
 * @toolbox/common - Shared utilities for toolbox packages
 */

// AWS utilities
export {
  type CallerIdentity,
  type AwsEnv,
  getAwsEnv,
  getAwsClientConfig,
  getCallerIdentity,
  parseIdentityArn,
  fetchAndDisplayIdentity,
} from "./aws";

// UI utilities
export {
  copyToClipboard,
  copyWithFeedback,
  formatJson,
  divider,
  withSpinner,
  selectFromList,
  runApp,
  goodbye,
  prompts,
  colors,
  type SpinnerOptions,
  type SelectOption,
  type AppConfig,
} from "./ui";
