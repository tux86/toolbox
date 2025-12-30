#!/usr/bin/env bun
/**
 * AWS Credentials Manager - Interactive TUI for managing AWS SSO credentials
 */

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import {
  SSOOIDCClient,
  RegisterClientCommand,
  StartDeviceAuthorizationCommand,
  CreateTokenCommand,
} from "@aws-sdk/client-sso-oidc";
import { SSOClient, GetRoleCredentialsCommand } from "@aws-sdk/client-sso";
import { parse as parseIni, stringify as stringifyIni } from "ini";
import {
  App,
  renderApp,
  List,
  Card,
  Spinner,
  StatusMessage,
  MultiSelectList,
  ACTIONS,
  useCopy,
  type ListItemData,
  type MultiSelectItemData,
} from "@toolbox/common";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SSOProfile {
  name: string;
  ssoStartUrl: string;
  ssoAccountId: string;
  ssoRoleName: string;
  ssoRegion: string;
  region?: string;
  ssoSession?: string;
}

type CredentialStatus = "valid" | "expired" | "error" | "unknown";

interface ProfileStatus {
  profile: SSOProfile;
  status: CredentialStatus;
  expiresAt?: Date;
}

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
}

interface DeviceAuthInfo {
  verificationUri: string;
  userCode: string;
  deviceCode: string;
  clientId: string;
  clientSecret: string;
  expiresAt: Date;
  interval: number;
}

interface AppSettings {
  notifications: boolean;
  defaultInterval: number;
  favoriteProfiles: string[];
  lastRefresh?: string;
}

interface ConfigSection {
  [key: string]: string | undefined;
}

interface ParsedConfig {
  [section: string]: ConfigSection;
}

type ViewState =
  | "menu"
  | "status"
  | "refresh"
  | "refresh-select"
  | "daemon-select"
  | "daemon-interval"
  | "daemon-running"
  | "settings"
  | "settings-interval"
  | "settings-favorites";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const AWS_DIR = `${HOME}/.aws`;
const CONFIG_PATH = `${AWS_DIR}/config`;
const CREDENTIALS_PATH = `${AWS_DIR}/credentials`;
const SSO_CACHE_DIR = `${AWS_DIR}/sso/cache`;
const SETTINGS_PATH = `${AWS_DIR}/credentials-manager.json`;

const DEFAULT_SETTINGS: AppSettings = {
  notifications: true,
  defaultInterval: 30,
  favoriteProfiles: [],
};

const REFRESH_INTERVALS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes", hint: "recommended" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
];

// ─────────────────────────────────────────────────────────────────────────────
// File Utilities
// ─────────────────────────────────────────────────────────────────────────────

async function parseIniFile(path: string): Promise<ParsedConfig> {
  try {
    const content = await Bun.file(path).text();
    return parseIni(content);
  } catch {
    return {};
  }
}

async function writeCredentials(profileName: string, credentials: AWSCredentials): Promise<void> {
  const existing = await parseIniFile(CREDENTIALS_PATH);

  existing[profileName] = {
    aws_access_key_id: credentials.accessKeyId,
    aws_secret_access_key: credentials.secretAccessKey,
    ...(credentials.sessionToken && { aws_session_token: credentials.sessionToken }),
  };

  await Bun.write(CREDENTIALS_PATH, stringifyIni(existing));
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const content = await Bun.file(SETTINGS_PATH).text();
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(settings: AppSettings): Promise<void> {
  await Bun.write(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// SSO Cache
// ─────────────────────────────────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt: Date;
}

async function findCachedToken(profile: SSOProfile): Promise<CachedToken | null> {
  try {
    const crypto = await import("crypto");
    const cacheKey = profile.ssoSession ?? profile.ssoStartUrl;
    const hash = crypto.createHash("sha1").update(cacheKey).digest("hex");
    const cacheFile = `${SSO_CACHE_DIR}/${hash}.json`;

    const content = await Bun.file(cacheFile).json();
    if (content.accessToken && content.expiresAt) {
      return {
        accessToken: content.accessToken,
        expiresAt: new Date(content.expiresAt),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS Operations
// ─────────────────────────────────────────────────────────────────────────────

async function discoverProfiles(): Promise<SSOProfile[]> {
  const config = await parseIniFile(CONFIG_PATH);
  const profiles: SSOProfile[] = [];
  const ssoSessions: Map<string, ConfigSection> = new Map();

  for (const [section, values] of Object.entries(config)) {
    if (section.startsWith("sso-session ")) {
      ssoSessions.set(section.replace("sso-session ", ""), values);
    }
  }

  for (const [section, values] of Object.entries(config)) {
    if (!section.startsWith("profile ") && section !== "default") continue;

    const profileName = section === "default" ? "default" : section.replace("profile ", "");

    if (values.sso_session) {
      const session = ssoSessions.get(values.sso_session);
      if (session && values.sso_account_id && values.sso_role_name) {
        profiles.push({
          name: profileName,
          ssoStartUrl: session.sso_start_url || "",
          ssoAccountId: values.sso_account_id,
          ssoRoleName: values.sso_role_name,
          ssoRegion: session.sso_region || "us-east-1",
          region: values.region,
          ssoSession: values.sso_session,
        });
      }
    } else if (values.sso_start_url && values.sso_account_id && values.sso_role_name) {
      profiles.push({
        name: profileName,
        ssoStartUrl: values.sso_start_url,
        ssoAccountId: values.sso_account_id,
        ssoRoleName: values.sso_role_name,
        ssoRegion: values.sso_region || "us-east-1",
        region: values.region,
      });
    }
  }

  return profiles;
}

async function checkTokenStatus(profile: SSOProfile): Promise<ProfileStatus> {
  const cachedToken = await findCachedToken(profile);

  if (!cachedToken || cachedToken.expiresAt <= new Date()) {
    return { profile, status: "expired" };
  }

  return { profile, status: "valid", expiresAt: cachedToken.expiresAt };
}

async function checkAllProfiles(profiles: SSOProfile[]): Promise<ProfileStatus[]> {
  return Promise.all(profiles.map((profile) => checkTokenStatus(profile)));
}

// ─────────────────────────────────────────────────────────────────────────────
// SSO OIDC Device Authorization Flow
// ─────────────────────────────────────────────────────────────────────────────

async function startDeviceAuthorization(profile: SSOProfile): Promise<DeviceAuthInfo | null> {
  try {
    const client = new SSOOIDCClient({ region: profile.ssoRegion });

    // Register client
    const registerResponse = await client.send(
      new RegisterClientCommand({
        clientName: "aws-creds-toolbox",
        clientType: "public",
      })
    );

    if (!registerResponse.clientId || !registerResponse.clientSecret) {
      return null;
    }

    // Start device authorization
    const authResponse = await client.send(
      new StartDeviceAuthorizationCommand({
        clientId: registerResponse.clientId,
        clientSecret: registerResponse.clientSecret,
        startUrl: profile.ssoStartUrl,
      })
    );

    if (!authResponse.verificationUriComplete || !authResponse.deviceCode || !authResponse.userCode) {
      return null;
    }

    return {
      verificationUri: authResponse.verificationUriComplete,
      userCode: authResponse.userCode,
      deviceCode: authResponse.deviceCode,
      clientId: registerResponse.clientId,
      clientSecret: registerResponse.clientSecret,
      expiresAt: new Date(Date.now() + (authResponse.expiresIn || 600) * 1000),
      interval: authResponse.interval || 5,
    };
  } catch {
    return null;
  }
}

interface TokenInfo {
  accessToken: string;
  expiresAt: Date;
}

async function saveSSOTokenToCache(profile: SSOProfile, tokenInfo: TokenInfo): Promise<void> {
  try {
    // Create cache directory if it doesn't exist
    const { mkdir, chmod } = await import("fs/promises");
    await mkdir(SSO_CACHE_DIR, { recursive: true });

    const crypto = await import("crypto");

    // For sso_session profiles, cache file is named after the session name
    // For legacy profiles, cache file is named after the startUrl hash
    const cacheKey = profile.ssoSession ?? profile.ssoStartUrl;
    const hash = crypto.createHash("sha1").update(cacheKey).digest("hex");
    const cacheFile = `${SSO_CACHE_DIR}/${hash}.json`;

    // Write token in AWS CLI compatible format
    const cacheData = {
      startUrl: profile.ssoStartUrl,
      region: profile.ssoRegion,
      accessToken: tokenInfo.accessToken,
      expiresAt: tokenInfo.expiresAt.toISOString(),
    };

    await Bun.write(cacheFile, JSON.stringify(cacheData, null, 2));
    // Set secure permissions (600) like AWS CLI does
    await chmod(cacheFile, 0o600);
  } catch {
    // Silently fail - credentials will still work via credentials file
  }
}

async function pollForToken(
  profile: SSOProfile,
  deviceAuth: DeviceAuthInfo
): Promise<TokenInfo | null> {
  const client = new SSOOIDCClient({ region: profile.ssoRegion });
  const startTime = Date.now();
  const maxWaitMs = (deviceAuth.expiresAt.getTime() - Date.now());

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const tokenResponse = await client.send(
        new CreateTokenCommand({
          clientId: deviceAuth.clientId,
          clientSecret: deviceAuth.clientSecret,
          grantType: "urn:ietf:params:oauth:grant-type:device_code",
          deviceCode: deviceAuth.deviceCode,
        })
      );

      if (tokenResponse.accessToken) {
        const expiresAt = new Date(Date.now() + (tokenResponse.expiresIn || 28800) * 1000);
        return {
          accessToken: tokenResponse.accessToken,
          expiresAt,
        };
      }
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === "AuthorizationPendingException") {
        // User hasn't authorized yet, keep polling
        await new Promise((resolve) => setTimeout(resolve, deviceAuth.interval * 1000));
        continue;
      }
      if (err.name === "SlowDownException") {
        // Need to slow down polling
        await new Promise((resolve) => setTimeout(resolve, (deviceAuth.interval + 5) * 1000));
        continue;
      }
      if (err.name === "ExpiredTokenException" || err.name === "AccessDeniedException") {
        return null;
      }
      // Unknown error, stop polling
      return null;
    }
  }
  return null;
}

async function getCredentialsWithToken(
  profile: SSOProfile,
  accessToken: string
): Promise<AWSCredentials | null> {
  try {
    const client = new SSOClient({ region: profile.ssoRegion });
    const response = await client.send(
      new GetRoleCredentialsCommand({
        accountId: profile.ssoAccountId,
        roleName: profile.ssoRoleName,
        accessToken,
      })
    );

    if (!response.roleCredentials) {
      return null;
    }

    return {
      accessKeyId: response.roleCredentials.accessKeyId!,
      secretAccessKey: response.roleCredentials.secretAccessKey!,
      sessionToken: response.roleCredentials.sessionToken,
      expiration: response.roleCredentials.expiration
        ? new Date(response.roleCredentials.expiration)
        : undefined,
    };
  } catch {
    return null;
  }
}

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
}

async function performSSOLoginFlow(
  profile: SSOProfile,
  deviceAuth: DeviceAuthInfo
): Promise<{ success: boolean; error?: string }> {
  const tokenInfo = await pollForToken(profile, deviceAuth);
  if (!tokenInfo) {
    return { success: false, error: "Authorization failed or timed out" };
  }

  // Save token to SSO cache (for AWS CLI compatibility)
  await saveSSOTokenToCache(profile, tokenInfo);

  // Also get and save static credentials to credentials file
  const creds = await getCredentialsWithToken(profile, tokenInfo.accessToken);
  if (!creds) {
    return { success: false, error: "Failed to get credentials" };
  }
  await writeCredentials(profile.name, creds);
  return { success: true };
}

async function refreshProfile(
  profile: SSOProfile
): Promise<{ success: boolean; error?: string; needsLogin?: boolean }> {
  // Check if we have a valid cached token
  const cachedToken = await findCachedToken(profile);
  if (!cachedToken || cachedToken.expiresAt <= new Date()) {
    return { success: false, needsLogin: true };
  }

  // Use cached token to get credentials
  const credentials = await getCredentialsWithToken(profile, cachedToken.accessToken);
  if (!credentials) {
    return { success: false, needsLogin: true };
  }

  await writeCredentials(profile.name, credentials);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

async function sendNotification(title: string, message: string): Promise<void> {
  const os = process.platform;
  try {
    if (os === "darwin") {
      await Bun.spawn([
        "osascript",
        "-e",
        `display notification "${message}" with title "${title}"`,
      ]).exited;
    } else if (os === "linux") {
      await Bun.spawn(["notify-send", title, message]).exited;
    }
  } catch {
    // Silently fail
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function formatExpiry(date?: Date): string {
  if (!date) return "Unknown";

  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return "Expired";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function getStatusColor(status: CredentialStatus): string {
  const colors: Record<CredentialStatus, string> = {
    valid: "green",
    expired: "red",
    error: "yellow",
    unknown: "gray",
  };
  return colors[status];
}

function sortByFavorites<T>(items: T[], favorites: string[], getName: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const aFav = favorites.includes(getName(a));
    const bFav = favorites.includes(getName(b));
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return getName(a).localeCompare(getName(b));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useProfiles
// ─────────────────────────────────────────────────────────────────────────────

function useProfiles() {
  const [profiles, setProfiles] = useState<SSOProfile[]>([]);
  const [statuses, setStatuses] = useState<ProfileStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoverProfiles();
      setProfiles(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discover profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatuses = useCallback(async () => {
    if (profiles.length === 0) return;
    setLoading(true);
    try {
      const result = await checkAllProfiles(profiles);
      setStatuses(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check statuses");
    } finally {
      setLoading(false);
    }
  }, [profiles]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { profiles, statuses, loading, error, fetchStatuses };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useSettings
// ─────────────────────────────────────────────────────────────────────────────

function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveSettings(updated);
  }, [settings]);

  return { settings, updateSettings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useDeviceAuth
// ─────────────────────────────────────────────────────────────────────────────

interface UseDeviceAuthOptions {
  pendingLogin: SSOProfile | null;
  onLoginComplete: (profile: SSOProfile, result: { success: boolean; error?: string }) => void;
  onCopyUrl?: () => void;
}

function useDeviceAuth({ pendingLogin, onLoginComplete, onCopyUrl }: UseDeviceAuthOptions) {
  const [deviceAuth, setDeviceAuth] = useState<DeviceAuthInfo | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const { copy, copied } = useCopy();
  const currentProfileRef = React.useRef<string | null>(null);

  // Reset and start new device authorization when profile changes
  useEffect(() => {
    const profileName = pendingLogin?.name ?? null;

    // If profile changed, reset state
    if (profileName !== currentProfileRef.current) {
      currentProfileRef.current = profileName;
      setDeviceAuth(null);
      setAuthorizing(false);

      // Start new device authorization if we have a profile
      if (pendingLogin) {
        startDeviceAuthorization(pendingLogin).then(setDeviceAuth);
      }
    }
  }, [pendingLogin]);

  // Start polling automatically when deviceAuth is ready
  useEffect(() => {
    if (!pendingLogin || !deviceAuth || authorizing) return;

    setAuthorizing(true);
    performSSOLoginFlow(pendingLogin, deviceAuth).then((result) => {
      onLoginComplete(pendingLogin, result);
    });
  }, [pendingLogin, deviceAuth, authorizing, onLoginComplete]);

  const handleEnter = useCallback(() => {
    if (!deviceAuth) return;
    openBrowser(deviceAuth.verificationUri);
  }, [deviceAuth]);

  const handleCopy = useCallback(() => {
    if (!deviceAuth) return;
    copy(deviceAuth.verificationUri);
    onCopyUrl?.();
  }, [deviceAuth, copy, onCopyUrl]);

  return {
    deviceAuth,
    authorizing,
    copied,
    handleEnter,
    handleCopy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Table Component
// ─────────────────────────────────────────────────────────────────────────────

interface StatusTableProps {
  statuses: ProfileStatus[];
  favorites: string[];
}

function StatusTable({ statuses, favorites }: StatusTableProps) {
  const sorted = sortByFavorites(statuses, favorites, (s) => s.profile.name);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Profile Status</Text>
        <Text dimColor> ({statuses.length} profiles)</Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        paddingX={1}
      >
        {sorted.map((status) => {
          const isFavorite = favorites.includes(status.profile.name);
          return (
            <Box key={status.profile.name} gap={1}>
              <Text color={getStatusColor(status.status)}>●</Text>
              <Text bold>{status.profile.name.padEnd(25)}</Text>
              <Text color={getStatusColor(status.status)}>
                {status.status === "valid" ? "Valid" : status.status === "expired" ? "Expired" : "Error"}
              </Text>
              {status.expiresAt && status.status === "valid" && (
                <Text dimColor> ({formatExpiry(status.expiresAt)})</Text>
              )}
              {isFavorite && <Text color="yellow">★</Text>}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Login Prompt Component
// ─────────────────────────────────────────────────────────────────────────────

interface LoginPromptProps {
  profile: SSOProfile;
  deviceAuth: DeviceAuthInfo | null;
  pendingCount?: number;
  copied?: boolean;
  authorizing?: boolean;
}

function LoginPrompt({ profile, deviceAuth, pendingCount = 0, copied = false, authorizing = false }: LoginPromptProps) {
  if (!deviceAuth) {
    return (
      <Box marginTop={1} flexDirection="column">
        <Text color="yellow">SSO login required for {profile.name}</Text>
        <Spinner label="Initializing device authorization..." />
      </Box>
    );
  }

  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="yellow">SSO login required for {profile.name}</Text>
      {pendingCount > 0 && (
        <Text dimColor>({pendingCount} more profile{pendingCount > 1 ? 's' : ''} pending)</Text>
      )}
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>URL: </Text>
          <Text color="cyan">{deviceAuth.verificationUri}</Text>
          {copied && <Text color="green"> (copied!)</Text>}
        </Box>
        <Box>
          <Text dimColor>Code: </Text>
          <Text color="magenta" bold>{deviceAuth.userCode}</Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {authorizing && <Spinner label="Waiting for browser authorization..." />}
        <Text dimColor>Press Enter to open browser, c to copy URL</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Progress Component
// ─────────────────────────────────────────────────────────────────────────────

interface RefreshProgressProps {
  profiles: SSOProfile[];
  settings: AppSettings;
  onBack: () => void;
}

function RefreshProgress({ profiles, settings, onBack }: RefreshProgressProps) {
  const [results, setResults] = useState<{ name: string; success: boolean; error?: string }[]>([]);
  const [current, setCurrent] = useState(0);
  const [pendingLogin, setPendingLogin] = useState<SSOProfile | null>(null);

  const handleLoginComplete = useCallback((profile: SSOProfile, result: { success: boolean; error?: string }) => {
    setResults((prev) => [...prev, { name: profile.name, success: result.success, error: result.error }]);
    setPendingLogin(null);
    setCurrent((c) => c + 1);
  }, []);

  const { deviceAuth, authorizing, copied, handleEnter, handleCopy } = useDeviceAuth({
    pendingLogin,
    onLoginComplete: handleLoginComplete,
  });

  useInput((input, key) => {
    if (key.return) handleEnter();
    if (input === "c") handleCopy();
    if (key.escape && !authorizing) onBack();
  });

  useEffect(() => {
    if (current >= profiles.length) {
      // All done
      return;
    }
    if (pendingLogin) return;

    const profile = profiles[current];
    refreshProfile(profile).then((result) => {
      if (result.needsLogin) {
        if (settings.notifications) {
          sendNotification("AWS SSO Login Required", `Token expired for profile '${profile.name}'`);
        }
        setPendingLogin(profile);
      } else {
        setResults((prev) => [...prev, { name: profile.name, success: result.success, error: result.error }]);
        setCurrent((c) => c + 1);
      }
    });
  }, [current, profiles, settings, pendingLogin]);

  const done = current >= profiles.length && !pendingLogin;
  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  return (
    <Box flexDirection="column">
      <Card title="Refreshing Credentials">
        {profiles.map((profile, idx) => {
          const result = results.find((r) => r.name === profile.name);
          const isPending = pendingLogin?.name === profile.name;
          const isCurrent = idx === current && !pendingLogin && !done;

          return (
            <Box key={profile.name} gap={1}>
              {result ? (
                <Text color={result.success ? "green" : "red"}>{result.success ? "✓" : "✗"}</Text>
              ) : isPending ? (
                <Text color="yellow">⚠</Text>
              ) : isCurrent ? (
                <Text color="cyan">◌</Text>
              ) : (
                <Text dimColor>○</Text>
              )}
              <Text bold={isCurrent || isPending}>{profile.name}</Text>
              {result && !result.success && result.error && (
                <Text color="red"> - {result.error}</Text>
              )}
              {isPending && (
                <Text color="yellow"> - Press Enter to login</Text>
              )}
            </Box>
          );
        })}
      </Card>

      {done && (
        <Box flexDirection="column" marginTop={1}>
          <StatusMessage type={errorCount > 0 ? "warning" : "success"}>
            Refreshed {successCount} profile(s){errorCount > 0 ? `, ${errorCount} error(s)` : ""}
          </StatusMessage>
          {successCount > 0 && (
            <Box marginTop={1}>
              <Text dimColor>Profiles: </Text>
              <Text>{results.filter(r => r.success).map(r => r.name).join(", ")}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text dimColor>Press b to go back</Text>
          </Box>
        </Box>
      )}

      {pendingLogin && (
        <LoginPrompt
          profile={pendingLogin}
          deviceAuth={deviceAuth}
          copied={copied}
          authorizing={authorizing}
        />
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Daemon Component
// ─────────────────────────────────────────────────────────────────────────────

interface DaemonViewProps {
  profiles: SSOProfile[];
  intervalMinutes: number;
  settings: AppSettings;
  onStop: () => void;
}

function DaemonView({ profiles, intervalMinutes, settings, onStop }: DaemonViewProps) {
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [results, setResults] = useState<{ name: string; success: boolean }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<SSOProfile | null>(null);
  const [pendingQueue, setPendingQueue] = useState<SSOProfile[]>([]);

  const processNextLogin = useCallback(() => {
    if (pendingQueue.length > 0) {
      const [next, ...rest] = pendingQueue;
      setPendingQueue(rest);
      setPendingLogin(next);
    } else {
      setPendingLogin(null);
      setLastRefresh(new Date());
      setNextRefresh(new Date(Date.now() + intervalMinutes * 60 * 1000));
      setRefreshing(false);
    }
  }, [pendingQueue, intervalMinutes]);

  const handleLoginComplete = useCallback((profile: SSOProfile, result: { success: boolean }) => {
    setResults((prev) => [...prev, { name: profile.name, success: result.success }]);
    processNextLogin();
  }, [processNextLogin]);

  const { deviceAuth, authorizing, copied, handleEnter, handleCopy } = useDeviceAuth({
    pendingLogin,
    onLoginComplete: handleLoginComplete,
  });

  useInput((input, key) => {
    if ((key.ctrl && input === "c") || input === "q") {
      onStop();
    }
    if (key.return) handleEnter();
    if (input === "c" && !key.ctrl) handleCopy();
  });

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    setResults([]);
    const profilesNeedingLogin: SSOProfile[] = [];

    for (const profile of profiles) {
      const result = await refreshProfile(profile);
      if (result.needsLogin) {
        if (settings.notifications) {
          sendNotification("AWS SSO Login Required", `Token expired for profile '${profile.name}'`);
        }
        profilesNeedingLogin.push(profile);
      } else {
        setResults((prev) => [...prev, { name: profile.name, success: result.success }]);
      }
    }

    if (profilesNeedingLogin.length > 0) {
      const [first, ...rest] = profilesNeedingLogin;
      setPendingQueue(rest);
      setPendingLogin(first);
    } else {
      setLastRefresh(new Date());
      setNextRefresh(new Date(Date.now() + intervalMinutes * 60 * 1000));
      setRefreshing(false);
    }
  }, [profiles, settings, intervalMinutes]);

  useEffect(() => {
    doRefresh();
    const interval = setInterval(doRefresh, intervalMinutes * 60 * 1000);
    return () => clearInterval(interval);
  }, [doRefresh, intervalMinutes]);

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;

  return (
    <Box flexDirection="column">
      <Card title="Auto-Refresh Daemon">
        <Box flexDirection="column">
          <Text><Text dimColor>Profiles:</Text> {profiles.map(p => p.name).join(", ")}</Text>
          <Text><Text dimColor>Interval:</Text> {intervalMinutes} min</Text>
          {lastRefresh && <Text><Text dimColor>Last:</Text> {lastRefresh.toLocaleTimeString()}</Text>}
          {nextRefresh && !refreshing && !pendingLogin && <Text><Text dimColor>Next:</Text> {nextRefresh.toLocaleTimeString()}</Text>}
          {refreshing && !pendingLogin ? (
            <Spinner label="Refreshing..." />
          ) : results.length > 0 && !pendingLogin && (
            <Text color={errorCount > 0 ? "yellow" : "green"}>✓ {successCount} refreshed{errorCount > 0 ? `, ${errorCount} errors` : ""}</Text>
          )}
        </Box>
      </Card>

      {pendingLogin && (
        <LoginPrompt
          profile={pendingLogin}
          deviceAuth={deviceAuth}
          pendingCount={pendingQueue.length}
          copied={copied}
          authorizing={authorizing}
        />
      )}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function AWSCredsManager() {
  const { profiles, statuses, loading, error, fetchStatuses } = useProfiles();
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<ViewState>("menu");
  const [selectedProfiles, setSelectedProfiles] = useState<SSOProfile[]>([]);
  const [daemonInterval, setDaemonInterval] = useState(30);
  const { exit } = useApp();

  // Handle keyboard for navigation
  useInput((input) => {
    if (input === "b" && view !== "menu" && view !== "daemon-running") {
      setView("menu");
    }
  });

  // Menu items
  const menuItems: ListItemData[] = [
    { id: "status", label: "Check status", hint: "view all profiles", value: "status" },
    { id: "refresh", label: "Refresh now", hint: "one-time", value: "refresh" },
    { id: "daemon", label: "Auto-refresh", hint: "runs continuously", value: "daemon" },
    { id: "settings", label: "Settings", hint: "notifications & defaults", value: "settings" },
    { id: "exit", label: "Exit", value: "exit" },
  ];

  // Settings menu items
  const settingsItems: ListItemData[] = [
    {
      id: "notifications",
      label: `Notifications: ${settings.notifications ? "On" : "Off"}`,
      value: "notifications",
    },
    {
      id: "interval",
      label: `Default refresh interval: ${settings.defaultInterval} minutes`,
      value: "interval",
    },
    {
      id: "favorites",
      label: `Favorite profiles (${settings.favoriteProfiles.length})`,
      value: "favorites",
    },
    { id: "back", label: "Back to main menu", value: "back" },
  ];

  // Interval items
  const intervalItems: ListItemData[] = REFRESH_INTERVALS.map((i) => ({
    id: String(i.value),
    label: i.label,
    hint: i.hint,
    value: i.value,
  }));

  // Profile items for multi-select
  const profileItems: MultiSelectItemData[] = sortByFavorites(
    profiles.map((profile) => {
      const status = statuses.find((s) => s.profile.name === profile.name);
      const isFavorite = settings.favoriteProfiles.includes(profile.name);
      return {
        id: profile.name,
        label: `${profile.name}${isFavorite ? " ★" : ""}`,
        hint: status?.status || "unknown",
        value: profile,
      };
    }),
    settings.favoriteProfiles,
    (item) => item.id
  );

  // Handlers
  const handleMenuSelect = (item: ListItemData) => {
    const action = item.value as string;
    switch (action) {
      case "status":
        fetchStatuses();
        setView("status");
        break;
      case "refresh":
        fetchStatuses();
        setView("refresh-select");
        break;
      case "daemon":
        fetchStatuses();
        setView("daemon-select");
        break;
      case "settings":
        setView("settings");
        break;
      case "exit":
        exit();
        break;
    }
  };

  const handleSettingsSelect = async (item: ListItemData) => {
    const action = item.value as string;
    switch (action) {
      case "notifications":
        await updateSettings({ notifications: !settings.notifications });
        break;
      case "interval":
        setView("settings-interval");
        break;
      case "favorites":
        setView("settings-favorites");
        break;
      case "back":
        setView("menu");
        break;
    }
  };

  const handleIntervalSelect = async (item: ListItemData) => {
    await updateSettings({ defaultInterval: item.value as number });
    setView("settings");
  };

  const handleDaemonIntervalSelect = (item: ListItemData) => {
    setDaemonInterval(item.value as number);
    setView("daemon-running");
  };

  const handleFavoritesSubmit = async (selected: MultiSelectItemData[]) => {
    await updateSettings({ favoriteProfiles: selected.map((s) => s.id) });
    setView("settings");
  };

  const handleProfilesSubmit = (selected: MultiSelectItemData[]) => {
    setSelectedProfiles(selected.map((s) => s.value as SSOProfile));
    if (view === "refresh-select") {
      setView("refresh");
    } else if (view === "daemon-select") {
      setView("daemon-interval");
    }
  };

  // Loading state
  if (loading && profiles.length === 0) {
    return (
      <App
        title="AWS Credentials"
        icon="🔑"
        color="cyan"
        actions={[ACTIONS.quit]}
        onQuit={() => exit()}
      >
        <Spinner label="Discovering SSO profiles..." />
      </App>
    );
  }

  // No profiles
  if (profiles.length === 0 && !loading) {
    return (
      <App
        title="AWS Credentials"
        icon="🔑"
        color="cyan"
        actions={[ACTIONS.quit]}
        onQuit={() => exit()}
      >
        <StatusMessage type="error">
          No SSO profiles found in ~/.aws/config
        </StatusMessage>
        <Card title="Required Configuration">
          <Text dimColor>
            Make sure your config has profiles with:{"\n"}
            - sso_start_url{"\n"}
            - sso_account_id{"\n"}
            - sso_role_name{"\n"}
            - sso_region
          </Text>
        </Card>
      </App>
    );
  }

  // Render based on view
  const renderView = () => {
    switch (view) {
      case "menu":
        return (
          <>
            <Box marginBottom={1}>
              <Text color="cyan">?</Text>
              <Text> What would you like to do?</Text>
            </Box>
            <List
              items={menuItems}
              onSelect={handleMenuSelect}
              maxVisible={5}
            />
          </>
        );

      case "status":
        return (
          <>
            {loading ? (
              <Spinner label="Checking credentials status..." />
            ) : (
              <>
                <StatusTable statuses={statuses} favorites={settings.favoriteProfiles} />
                <Box marginTop={1}>
                  <Text dimColor>Press b to go back</Text>
                </Box>
              </>
            )}
          </>
        );

      case "refresh-select":
      case "daemon-select":
        return (
          <>
            {loading ? (
              <Spinner label="Checking credentials status..." />
            ) : (
              <>
                <Box marginBottom={1}>
                  <Text color="cyan">?</Text>
                  <Text> Select profiles to {view === "refresh-select" ? "refresh" : "monitor"}</Text>
                </Box>
                <MultiSelectList
                  items={profileItems}
                  onSubmit={handleProfilesSubmit}
                  onCancel={() => setView("menu")}
                  initialSelected={settings.favoriteProfiles}
                  required
                  maxVisible={10}
                />
              </>
            )}
          </>
        );

      case "refresh":
        return (
          <RefreshProgress
            profiles={selectedProfiles}
            settings={settings}
            onBack={() => setView("menu")}
          />
        );

      case "daemon-interval":
        return (
          <>
            <Box marginBottom={1}>
              <Text color="cyan">?</Text>
              <Text> Select refresh interval</Text>
            </Box>
            <List
              items={intervalItems}
              onSelect={handleDaemonIntervalSelect}
              maxVisible={5}
            />
          </>
        );

      case "daemon-running":
        return (
          <DaemonView
            profiles={selectedProfiles}
            intervalMinutes={daemonInterval}
            settings={settings}
            onStop={() => setView("menu")}
          />
        );

      case "settings":
        return (
          <>
            <Box marginBottom={1}>
              <Text color="cyan">?</Text>
              <Text> Settings</Text>
            </Box>
            <List
              items={settingsItems}
              onSelect={handleSettingsSelect}
              maxVisible={5}
            />
          </>
        );

      case "settings-interval":
        return (
          <>
            <Box marginBottom={1}>
              <Text color="cyan">?</Text>
              <Text> Select default refresh interval</Text>
            </Box>
            <List
              items={intervalItems}
              onSelect={handleIntervalSelect}
              maxVisible={5}
            />
          </>
        );

      case "settings-favorites":
        return (
          <>
            <Box marginBottom={1}>
              <Text color="cyan">?</Text>
              <Text> Select favorite profiles (shown first)</Text>
            </Box>
            <MultiSelectList
              items={profileItems}
              onSubmit={handleFavoritesSubmit}
              onCancel={() => setView("settings")}
              initialSelected={settings.favoriteProfiles}
              maxVisible={10}
            />
          </>
        );

      default:
        return null;
    }
  };

  const getActions = () => {
    switch (view) {
      case "menu":
        return [ACTIONS.navigate, ACTIONS.select, ACTIONS.quit];
      case "status":
        return [ACTIONS.back, ACTIONS.quit];
      case "refresh-select":
      case "daemon-select":
      case "settings-favorites":
        return [
          { keys: "space", label: "Toggle" },
          { keys: "a", label: "All/None" },
          ACTIONS.select,
          ACTIONS.back,
        ];
      case "daemon-running":
        return [{ keys: "^C", label: "Stop" }, ACTIONS.quit];
      default:
        return [ACTIONS.navigate, ACTIONS.select, ACTIONS.back];
    }
  };

  return (
    <App
      title="AWS Credentials"
      icon="🔑"
      color="cyan"
      actions={getActions()}
      onQuit={() => exit()}
    >
      {/* Profile count banner */}
      <Box marginBottom={1}>
        <Text dimColor>
          {profiles.length} SSO profile{profiles.length !== 1 ? "s" : ""} discovered
        </Text>
      </Box>

      {error && (
        <StatusMessage type="error">{error}</StatusMessage>
      )}

      {renderView()}
    </App>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────

renderApp(<AWSCredsManager />);
