#!/usr/bin/env bun
/**
 * AWS Credentials Manager - Interactive TUI for managing AWS SSO credentials
 */

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { fromSSO } from "@aws-sdk/credential-providers";
import { parse as parseIni, stringify as stringifyIni } from "ini";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import {
  App,
  renderApp,
  List,
  Card,
  Spinner,
  StatusMessage,
  MultiSelectList,
  ACTIONS,
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
  accountId?: string;
  arn?: string;
  error?: string;
}

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  expiration?: Date;
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
  | "daemon"
  | "daemon-select"
  | "daemon-interval"
  | "daemon-running"
  | "settings"
  | "settings-notifications"
  | "settings-interval"
  | "settings-favorites";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AWS_DIR = join(homedir(), ".aws");
const CONFIG_PATH = join(AWS_DIR, "config");
const CREDENTIALS_PATH = join(AWS_DIR, "credentials");
const SSO_CACHE_DIR = join(AWS_DIR, "sso", "cache");
const SETTINGS_PATH = join(AWS_DIR, "credentials-manager.json");

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

async function parseAwsConfig(): Promise<ParsedConfig> {
  try {
    const content = await Bun.file(CONFIG_PATH).text();
    return parseIni(content);
  } catch {
    return {};
  }
}

async function parseCredentialsFile(): Promise<ParsedConfig> {
  try {
    const content = await Bun.file(CREDENTIALS_PATH).text();
    return parseIni(content);
  } catch {
    return {};
  }
}

async function writeCredentials(profileName: string, credentials: AWSCredentials): Promise<void> {
  const existing = await parseCredentialsFile();

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

async function findSSOTokenExpiry(startUrl: string): Promise<Date | null> {
  try {
    const glob = new Bun.Glob("*.json");
    let latestExpiry: Date | null = null;

    for await (const file of glob.scan(SSO_CACHE_DIR)) {
      try {
        const content = await Bun.file(join(SSO_CACHE_DIR, file)).json();
        if (content.startUrl === startUrl && content.expiresAt) {
          const expiresAt = new Date(content.expiresAt);
          if (!latestExpiry || expiresAt > latestExpiry) {
            latestExpiry = expiresAt;
          }
        }
      } catch {
        // Skip invalid cache files
      }
    }
    return latestExpiry;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS Operations
// ─────────────────────────────────────────────────────────────────────────────

async function discoverProfiles(): Promise<SSOProfile[]> {
  const config = await parseAwsConfig();
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
  try {
    const client = new STSClient({
      region: profile.region || profile.ssoRegion,
      credentials: fromSSO({ profile: profile.name }),
    });

    const response = await client.send(new GetCallerIdentityCommand({}));
    const expiresAt = await findSSOTokenExpiry(profile.ssoStartUrl);

    return {
      profile,
      status: "valid",
      accountId: response.Account,
      arn: response.Arn,
      expiresAt: expiresAt || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";

    if (
      errorMessage.includes("expired") ||
      errorMessage.includes("invalid") ||
      errorMessage.includes("token") ||
      errorMessage.includes("sso") ||
      errorMessage.includes("refresh") ||
      errorMessage.includes("unauthorized")
    ) {
      return { profile, status: "expired", error: "Token expired or invalid" };
    }

    return {
      profile,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function checkAllProfiles(profiles: SSOProfile[]): Promise<ProfileStatus[]> {
  return Promise.all(profiles.map((profile) => checkTokenStatus(profile)));
}

async function triggerSSOLogin(profile: SSOProfile): Promise<boolean> {
  try {
    const proc = Bun.spawn(["aws", "sso", "login", "--profile", profile.name], {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
    });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

async function getCredentials(profile: SSOProfile): Promise<AWSCredentials | null> {
  try {
    const credentialProvider = fromSSO({ profile: profile.name });
    const credentials = await credentialProvider();

    return {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      expiration: credentials.expiration,
    };
  } catch {
    return null;
  }
}

async function refreshProfile(
  profile: SSOProfile,
  settings: AppSettings
): Promise<{ success: boolean; error?: string; needsLogin?: boolean }> {
  const status = await checkTokenStatus(profile);

  if (status.status === "valid") {
    const credentials = await getCredentials(profile);
    if (credentials) {
      await writeCredentials(profile.name, credentials);
      return { success: true };
    }
    return { success: false, error: "Failed to retrieve credentials" };
  }

  // Needs SSO login
  return { success: false, needsLogin: true, error: "Token expired" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

async function sendNotification(title: string, message: string): Promise<void> {
  const os = platform();
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
  switch (status) {
    case "valid":
      return "green";
    case "expired":
      return "red";
    case "error":
      return "yellow";
    default:
      return "gray";
  }
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

  return { profiles, statuses, loading, error, fetchProfiles, fetchStatuses };
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
// Status Table Component
// ─────────────────────────────────────────────────────────────────────────────

interface StatusTableProps {
  statuses: ProfileStatus[];
  favorites: string[];
}

function StatusTable({ statuses, favorites }: StatusTableProps) {
  const sorted = [...statuses].sort((a, b) => {
    const aFav = favorites.includes(a.profile.name);
    const bFav = favorites.includes(b.profile.name);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.profile.name.localeCompare(b.profile.name);
  });

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
// Refresh Progress Component
// ─────────────────────────────────────────────────────────────────────────────

interface RefreshProgressProps {
  profiles: SSOProfile[];
  settings: AppSettings;
  onComplete: () => void;
  onBack: () => void;
}

function RefreshProgress({ profiles, settings, onComplete, onBack }: RefreshProgressProps) {
  const [results, setResults] = useState<{ name: string; success: boolean; error?: string; needsLogin?: boolean }[]>([]);
  const [current, setCurrent] = useState(0);
  const [pendingLogin, setPendingLogin] = useState<SSOProfile | null>(null);
  const { exit } = useApp();

  useInput((input, key) => {
    if (pendingLogin && key.return) {
      // Trigger SSO login
      triggerSSOLogin(pendingLogin).then(async (success) => {
        if (success) {
          const creds = await getCredentials(pendingLogin);
          if (creds) {
            await writeCredentials(pendingLogin.name, creds);
            setResults((prev) => [...prev, { name: pendingLogin.name, success: true }]);
          } else {
            setResults((prev) => [...prev, { name: pendingLogin.name, success: false, error: "Failed to get credentials" }]);
          }
        } else {
          setResults((prev) => [...prev, { name: pendingLogin.name, success: false, error: "Login cancelled" }]);
        }
        setPendingLogin(null);
        setCurrent((c) => c + 1);
      });
    }

    if (key.escape) {
      onBack();
    }
  });

  useEffect(() => {
    if (current >= profiles.length) {
      // All done
      return;
    }
    if (pendingLogin) return;

    const profile = profiles[current];
    refreshProfile(profile, settings).then((result) => {
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
          <Box marginTop={1}>
            <Text dimColor>Press b to go back</Text>
          </Box>
        </Box>
      )}

      {pendingLogin && (
        <Box marginTop={1} flexDirection="column">
          <Text color="yellow">SSO login required for {pendingLogin.name}</Text>
          <Text dimColor>Press Enter to open browser for authentication</Text>
        </Box>
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
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      onStop();
    }
  });

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    const newResults: { name: string; success: boolean }[] = [];

    for (const profile of profiles) {
      const result = await refreshProfile(profile, settings);
      if (result.needsLogin) {
        if (settings.notifications) {
          sendNotification("AWS SSO Login Required", `Token expired for profile '${profile.name}'`);
        }
        // Trigger login
        const loginSuccess = await triggerSSOLogin(profile);
        if (loginSuccess) {
          const creds = await getCredentials(profile);
          if (creds) {
            await writeCredentials(profile.name, creds);
            newResults.push({ name: profile.name, success: true });
          } else {
            newResults.push({ name: profile.name, success: false });
          }
        } else {
          newResults.push({ name: profile.name, success: false });
        }
      } else {
        newResults.push({ name: profile.name, success: result.success });
      }
    }

    setResults(newResults);
    setLastRefresh(new Date());
    setNextRefresh(new Date(Date.now() + intervalMinutes * 60 * 1000));
    setRefreshing(false);
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
        <Box flexDirection="column" gap={1}>
          <Text>
            <Text dimColor>Profiles:</Text> {profiles.length}
          </Text>
          <Text>
            <Text dimColor>Interval:</Text> {intervalMinutes} minutes
          </Text>
          {lastRefresh && (
            <Text>
              <Text dimColor>Last refresh:</Text> {lastRefresh.toLocaleTimeString()}
            </Text>
          )}
          {nextRefresh && !refreshing && (
            <Text>
              <Text dimColor>Next refresh:</Text> {nextRefresh.toLocaleTimeString()}
            </Text>
          )}
        </Box>
      </Card>

      {refreshing ? (
        <Spinner label="Refreshing credentials..." />
      ) : results.length > 0 && (
        <Box marginTop={1}>
          <StatusMessage type={errorCount > 0 ? "warning" : "success"}>
            {successCount} refreshed{errorCount > 0 ? `, ${errorCount} errors` : ""}
          </StatusMessage>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to stop daemon</Text>
      </Box>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function AWSCredsManager() {
  const { profiles, statuses, loading, error, fetchProfiles, fetchStatuses } = useProfiles();
  const { settings, updateSettings } = useSettings();
  const [view, setView] = useState<ViewState>("menu");
  const [selectedProfiles, setSelectedProfiles] = useState<SSOProfile[]>([]);
  const [daemonInterval, setDaemonInterval] = useState(30);
  const { exit } = useApp();

  // Handle keyboard for navigation
  useInput((input, key) => {
    if (input === "b" && view !== "menu" && view !== "daemon-running") {
      setView("menu");
    }
  });

  // Menu items
  const menuItems: ListItemData[] = [
    { id: "status", label: "Check credentials status", hint: "view all profiles", value: "status" },
    { id: "refresh", label: "Refresh credentials", hint: "select profiles", value: "refresh" },
    { id: "daemon", label: "Start auto-refresh daemon", hint: "continuous mode", value: "daemon" },
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
  const profileItems: MultiSelectItemData[] = profiles.map((profile) => {
    const status = statuses.find((s) => s.profile.name === profile.name);
    const statusSymbol = status ? (status.status === "valid" ? "●" : status.status === "expired" ? "○" : "◌") : "?";
    const statusColor = status ? getStatusColor(status.status) : "gray";
    const isFavorite = settings.favoriteProfiles.includes(profile.name);

    return {
      id: profile.name,
      label: `${profile.name}${isFavorite ? " ★" : ""}`,
      hint: status?.status || "unknown",
      value: profile,
    };
  }).sort((a, b) => {
    const aFav = settings.favoriteProfiles.includes(a.id);
    const bFav = settings.favoriteProfiles.includes(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return a.id.localeCompare(b.id);
  });

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
            onComplete={() => setView("menu")}
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
        return [{ keys: "^C", label: "Stop" }];
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
