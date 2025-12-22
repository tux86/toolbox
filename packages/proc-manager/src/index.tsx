#!/usr/bin/env bun
/**
 * Process Manager - Interactive TUI for managing system processes and ports
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useApp, useInput } from "ink";
import {
  App,
  renderApp,
  List,
  StatusMessage,
  ACTIONS,
  type ListItemData,
} from "@toolbox/common";
import { spawn } from "child_process";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: string;
  mem: string;
  user: string;
  command: string;
  ports: number[];
}

interface PortInfo {
  pid: number;
  name: string;
  port: number;
  protocol: string;
  state: string;
}

type ViewState = "combined" | "ports" | "detail";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NAME_WIDTH = 20;
const MAX_PROCESSES = 100;

// ─────────────────────────────────────────────────────────────────────────────
// System Operations
// ─────────────────────────────────────────────────────────────────────────────

async function execCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });
  });
}

function getBasename(path: string): string {
  // Extract just the executable name from full path
  const parts = path.split("/");
  let name = parts[parts.length - 1] || path;

  // Handle .app bundles - get the app name
  const appMatch = path.match(/\/([^/]+)\.app\//);
  if (appMatch) {
    name = appMatch[1];
  }

  return name;
}

async function getProcesses(): Promise<ProcessInfo[]> {
  const output = await execCommand("ps", [
    "axo",
    "pid,pcpu,pmem,user,comm",
    "-r",
  ]);

  const lines = output.trim().split("\n").slice(1);
  const processes: ProcessInfo[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 5) {
      const pid = parseInt(parts[0], 10);
      const cpu = parts[1];
      const mem = parts[2];
      const user = parts[3];
      const fullPath = parts.slice(4).join(" ");
      const name = getBasename(fullPath);

      if (!isNaN(pid)) {
        processes.push({
          pid,
          name,
          cpu: `${cpu}%`,
          mem: `${mem}%`,
          user,
          command: fullPath,
          ports: [],
        });
      }
    }
  }

  return processes.slice(0, MAX_PROCESSES);
}

async function getPorts(): Promise<PortInfo[]> {
  try {
    const output = await execCommand("lsof", ["-i", "-P", "-n", "-sTCP:LISTEN"]);

    const lines = output.trim().split("\n").slice(1);
    const ports: PortInfo[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 9) {
        const name = parts[0];
        const pid = parseInt(parts[1], 10);
        const nameCol = parts[8];

        const portMatch = nameCol.match(/:(\d+)$/);
        if (portMatch && !isNaN(pid)) {
          const port = parseInt(portMatch[1], 10);
          const key = `${pid}:${port}`;

          if (!seen.has(key)) {
            seen.add(key);
            ports.push({
              pid,
              name,
              port,
              protocol: "TCP",
              state: "LISTEN",
            });
          }
        }
      }
    }

    return ports.sort((a, b) => a.port - b.port);
  } catch {
    return [];
  }
}

async function getProcessesWithPorts(): Promise<ProcessInfo[]> {
  const [processes, ports] = await Promise.all([getProcesses(), getPorts()]);

  const portsByPid = new Map<number, number[]>();
  for (const port of ports) {
    const existing = portsByPid.get(port.pid) || [];
    existing.push(port.port);
    portsByPid.set(port.pid, existing);
  }

  return processes.map((proc) => ({
    ...proc,
    ports: portsByPid.get(proc.pid) || [],
  }));
}

async function killProcess(
  pid: number,
  signal: "TERM" | "KILL" = "TERM"
): Promise<boolean> {
  try {
    await execCommand("kill", [`-${signal}`, pid.toString()]);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useCombinedData(autoRefresh: boolean, refreshInterval: number = 2000) {
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const procs = await getProcessesWithPorts();
      setProcesses(procs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get processes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => refresh(false), refreshInterval);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, refresh]);

  return { processes, loading, error, refresh: () => refresh(true) };
}

function usePorts(autoRefresh: boolean, refreshInterval: number = 2000) {
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const portList = await getPorts();
      setPorts(portList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get ports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => refresh(false), refreshInterval);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, refresh]);

  return { ports, loading, error, refresh: () => refresh(true) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function ProcessDetailView({
  process,
  onBack,
  onRefresh,
}: {
  process: ProcessInfo;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleKill = async (force: boolean) => {
    const signal = force ? "KILL" : "TERM";
    const success = await killProcess(process.pid, signal);
    const message = success
      ? `${force ? "Force killed" : "Killed"} ${process.name} (${process.pid})`
      : `Failed to kill ${process.name}`;

    setStatus({ type: success ? "success" : "error", message });

    if (success) {
      setTimeout(() => {
        onRefresh();
        onBack();
      }, 800);
    } else {
      setTimeout(() => setStatus(null), 2000);
    }
  };

  const menuItems: ListItemData[] = [
    {
      id: "kill",
      label: "Kill (SIGTERM)",
      value: "term",
    },
    {
      id: "force",
      label: "Force Kill (SIGKILL)",
      value: "kill",
    },
    {
      id: "back",
      label: "Back",
      value: "back",
    },
  ];

  const handleSelect = (item: ListItemData) => {
    if (item.value === "term") {
      handleKill(false);
    } else if (item.value === "kill") {
      handleKill(true);
    } else {
      onBack();
    }
  };

  useInput((input, key) => {
    if (input === "b" || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
        <Text bold color="magenta">{process.name}</Text>
        <Text>PID: <Text color="cyan">{process.pid}</Text></Text>
        <Text>CPU: <Text color="yellow">{process.cpu}</Text>  MEM: <Text color="yellow">{process.mem}</Text></Text>
        <Text>User: <Text color="gray">{process.user}</Text></Text>
        {process.ports.length > 0 && (
          <Text>Ports: <Text color="green">:{process.ports.join(", :")}</Text></Text>
        )}
        <Text dimColor>Path: {process.command}</Text>
      </Box>
      {status && (
        <StatusMessage type={status.type}>{status.message}</StatusMessage>
      )}
      <List
        items={menuItems}
        onSelect={handleSelect}
        maxVisible={3}
      />
    </Box>
  );
}

function PortDetailView({
  port,
  onBack,
  onRefresh,
}: {
  port: PortInfo;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleKill = async (force: boolean) => {
    const signal = force ? "KILL" : "TERM";
    const success = await killProcess(port.pid, signal);
    const message = success
      ? `${force ? "Force killed" : "Killed"} :${port.port} (${port.name})`
      : `Failed to kill process on port ${port.port}`;

    setStatus({ type: success ? "success" : "error", message });

    if (success) {
      setTimeout(() => {
        onRefresh();
        onBack();
      }, 800);
    } else {
      setTimeout(() => setStatus(null), 2000);
    }
  };

  const menuItems: ListItemData[] = [
    {
      id: "kill",
      label: "Kill (SIGTERM)",
      value: "term",
    },
    {
      id: "force",
      label: "Force Kill (SIGKILL)",
      value: "kill",
    },
    {
      id: "back",
      label: "Back",
      value: "back",
    },
  ];

  const handleSelect = (item: ListItemData) => {
    if (item.value === "term") {
      handleKill(false);
    } else if (item.value === "kill") {
      handleKill(true);
    } else {
      onBack();
    }
  };

  useInput((input, key) => {
    if (input === "b" || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
        <Text bold color="green">:{port.port}</Text>
        <Text>Process: <Text color="magenta">{port.name}</Text></Text>
        <Text>PID: <Text color="cyan">{port.pid}</Text></Text>
        <Text>Protocol: <Text color="gray">{port.protocol}</Text></Text>
        <Text>State: <Text color="yellow">{port.state}</Text></Text>
      </Box>
      {status && (
        <StatusMessage type={status.type}>{status.message}</StatusMessage>
      )}
      <List
        items={menuItems}
        onSelect={handleSelect}
        maxVisible={3}
      />
    </Box>
  );
}

function CombinedView({
  filter,
  autoRefresh,
  onToggleAutoRefresh,
  onSwitchView,
  onSelectProcess,
}: {
  filter: string;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onSwitchView: () => void;
  onSelectProcess: (proc: ProcessInfo) => void;
}) {
  const { processes, loading, error, refresh } = useCombinedData(autoRefresh);

  const filtered = filter
    ? processes.filter(
        (p) =>
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.pid.toString().includes(filter) ||
          p.user.toLowerCase().includes(filter.toLowerCase()) ||
          p.ports.some((port) => port.toString().includes(filter))
      )
    : processes;

  const items: ListItemData[] = filtered.map((proc) => {
    const portsStr = proc.ports.length > 0 ? `:${proc.ports.join(",")}` : "-";
    const name = proc.name.length > NAME_WIDTH
      ? proc.name.slice(0, NAME_WIDTH - 1) + "…"
      : proc.name.padEnd(NAME_WIDTH);
    const pid = proc.pid.toString().padStart(6);
    const cpu = proc.cpu.padStart(6);
    const mem = proc.mem.padStart(6);
    const user = proc.user.slice(0, 8).padEnd(8);
    return {
      id: proc.pid.toString(),
      label: `${pid}  ${name}  ${cpu}  ${mem}  ${user}  ${portsStr}`,
      value: proc,
    };
  });

  useInput((input) => {
    if (input === "a") {
      onToggleAutoRefresh();
    } else if (input === "p") {
      onSwitchView();
    }
  });

  if (error) {
    return <StatusMessage type="error">{error}</StatusMessage>;
  }

  const header = "   PID  NAME                    CPU%    MEM%  USER      PORTS";

  return (
    <Box flexDirection="column">
      <Box marginBottom={0} gap={2}>
        {filter && (
          <Text>
            <Text dimColor>Filter: </Text>
            <Text color="yellow">{filter}</Text>
            <Text dimColor> ({filtered.length})</Text>
          </Text>
        )}
        {autoRefresh && (
          <Text color="green">● Auto-refresh ON</Text>
        )}
      </Box>
      <Text dimColor>{header}</Text>
      <List
        items={items}
        onSelect={(item) => onSelectProcess(item.value as ProcessInfo)}
        onRefresh={refresh}
        loading={loading}
        emptyMessage={filter ? "No processes match filter" : "No processes"}
        maxVisible={15}
      />
    </Box>
  );
}

function PortsView({
  filter,
  autoRefresh,
  onToggleAutoRefresh,
  onSwitchView,
  onSelectPort,
}: {
  filter: string;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onSwitchView: () => void;
  onSelectPort: (port: PortInfo) => void;
}) {
  const { ports, loading, error, refresh } = usePorts(autoRefresh);

  const filtered = filter
    ? ports.filter(
        (p) =>
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.port.toString().includes(filter) ||
          p.pid.toString().includes(filter)
      )
    : ports;

  const items: ListItemData[] = filtered.map((port) => {
    const portStr = `:${port.port}`.padEnd(8);
    const pid = port.pid.toString().padStart(6);
    const name = port.name.length > NAME_WIDTH
      ? port.name.slice(0, NAME_WIDTH - 1) + "…"
      : port.name.padEnd(NAME_WIDTH);
    return {
      id: `${port.pid}:${port.port}`,
      label: `${portStr}  ${pid}  ${name}  ${port.protocol}`,
      value: port,
    };
  });

  useInput((input) => {
    if (input === "a") {
      onToggleAutoRefresh();
    } else if (input === "p") {
      onSwitchView();
    }
  });

  if (error) {
    return <StatusMessage type="error">{error}</StatusMessage>;
  }

  const header = "   PORT      PID  NAME                  PROTO";

  return (
    <Box flexDirection="column">
      <Box marginBottom={0} gap={2}>
        {filter && (
          <Text>
            <Text dimColor>Filter: </Text>
            <Text color="yellow">{filter}</Text>
            <Text dimColor> ({filtered.length})</Text>
          </Text>
        )}
        {autoRefresh && (
          <Text color="green">● Auto-refresh ON</Text>
        )}
      </Box>
      <Text dimColor>{header}</Text>
      <List
        items={items}
        onSelect={(item) => onSelectPort(item.value as PortInfo)}
        onRefresh={refresh}
        loading={loading}
        emptyMessage={filter ? "No ports match filter" : "No listening ports"}
        maxVisible={15}
      />
    </Box>
  );
}

function FilterInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  useInput((input, key) => {
    if (key.return) {
      onSubmit();
    } else if (key.escape) {
      onCancel();
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      onChange(value + input);
    }
  });

  return (
    <Box>
      <Text color="cyan">Filter: </Text>
      <Text>{value}</Text>
      <Text color="gray">▌</Text>
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

function ProcManager() {
  const { exit } = useApp();
  const [view, setView] = useState<ViewState>("combined");
  const [prevView, setPrevView] = useState<ViewState>("combined");
  const [filter, setFilter] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<ProcessInfo | null>(null);
  const [selectedPort, setSelectedPort] = useState<PortInfo | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
  }, []);

  const toggleView = useCallback(() => {
    setView((v) => {
      if (v === "detail") return v; // Don't toggle from detail view
      return v === "combined" ? "ports" : "combined";
    });
  }, []);

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefresh((v) => !v);
  }, []);

  const handleSelectProcess = useCallback((proc: ProcessInfo) => {
    setSelectedProcess(proc);
    setPrevView("combined");
    setView("detail");
  }, []);

  const handleSelectPort = useCallback((port: PortInfo) => {
    setSelectedPort(port);
    setPrevView("ports");
    setView("detail");
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedProcess(null);
    setSelectedPort(null);
    setView(prevView);
  }, [prevView]);

  const getActions = () => {
    if (view === "detail") {
      return [ACTIONS.navigate, ACTIONS.select, ACTIONS.back, ACTIONS.quit];
    }
    return [
      ACTIONS.navigate,
      ACTIONS.select,
      { keys: "a", label: autoRefresh ? "Auto OFF" : "Auto ON" },
      { keys: "p", label: view === "combined" ? "Ports" : "Procs" },
      ACTIONS.filter,
      ACTIONS.refresh,
      ACTIONS.quit,
    ];
  };

  useInput((input) => {
    if (isFiltering || view === "detail") return;

    if (input === "/") {
      setIsFiltering(true);
    }
  });

  if (isFiltering) {
    return (
      <App title="Proc Manager" icon="⚙️" color="magenta" actions={[]}>
        <Box flexDirection="column">
          <FilterInput
            value={filter}
            onChange={setFilter}
            onSubmit={() => setIsFiltering(false)}
            onCancel={() => {
              setIsFiltering(false);
              setFilter("");
            }}
          />
          <Box marginTop={1}>
            <Text dimColor>Enter to apply · Escape to clear & close</Text>
          </Box>
        </Box>
      </App>
    );
  }

  const getTitle = () => {
    if (view === "detail" && selectedProcess) {
      return `Proc Manager · ${selectedProcess.name}`;
    }
    if (view === "detail" && selectedPort) {
      return `Proc Manager · :${selectedPort.port}`;
    }
    if (view === "ports") {
      return "Proc Manager · Ports";
    }
    return "Proc Manager";
  };

  return (
    <App
      title={getTitle()}
      icon="⚙️"
      color="magenta"
      actions={getActions()}
      onQuit={() => exit()}
    >
      {view === "combined" && (
        <CombinedView
          key={refreshTrigger}
          filter={filter}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={toggleAutoRefresh}
          onSwitchView={toggleView}
          onSelectProcess={handleSelectProcess}
        />
      )}
      {view === "ports" && (
        <PortsView
          key={refreshTrigger}
          filter={filter}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={toggleAutoRefresh}
          onSwitchView={toggleView}
          onSelectPort={handleSelectPort}
        />
      )}
      {view === "detail" && selectedProcess && (
        <ProcessDetailView
          process={selectedProcess}
          onBack={handleBackFromDetail}
          onRefresh={triggerRefresh}
        />
      )}
      {view === "detail" && selectedPort && (
        <PortDetailView
          port={selectedPort}
          onBack={handleBackFromDetail}
          onRefresh={triggerRefresh}
        />
      )}
    </App>
  );
}

renderApp(<ProcManager />);
