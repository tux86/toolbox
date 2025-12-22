/**
 * @toolbox/common - Shared React/Ink components for CLI tools
 */

// ─────────────────────────────────────────────────────────────────────────────
// React/Ink Components
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Layout
  App,
  renderApp,
  Header,
  Card,
  Divider,
  // Interactive
  List,
  MultiSelectList,
  ActionBar,
  ACTIONS,
  // Feedback
  Spinner,
  StatusMessage,
  CopyFeedback,
  // AWS
  IdentityCard,
  // Types
  type AppProps,
  type HeaderProps,
  type CardProps,
  type DividerProps,
  type ListProps,
  type ListItemData,
  type ListAction,
  type MultiSelectListProps,
  type MultiSelectItemData,
  type ActionBarProps,
  type ActionItem,
  type SpinnerProps,
  type StatusMessageProps,
  type StatusType,
  type CopyFeedbackProps,
  type IdentityCardProps,
} from "./components/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// React Hooks
// ─────────────────────────────────────────────────────────────────────────────

export {
  useIdentity,
  useCopy,
  type AwsIdentity,
  type UseIdentityResult,
  type UseCopyResult,
} from "./hooks/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// AWS Utilities
// ─────────────────────────────────────────────────────────────────────────────

export {
  getAwsEnv,
  getAwsClientConfig,
  getCallerIdentity,
  parseIdentityArn,
  type CallerIdentity,
  type AwsEnv,
} from "./aws.js";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export { copyToClipboard, formatJson } from "./utils.js";
