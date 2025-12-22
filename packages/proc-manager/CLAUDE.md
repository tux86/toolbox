# @toolbox/proc-manager

Interactive TUI for managing system processes and ports.

## Features

- **Combined View**: Processes with CPU%, memory, user, and listening ports
- **Ports View**: Dedicated view for listening TCP ports
- **Detail View**: View process info and choose kill action
- **Kill Process**: SIGTERM (graceful) or SIGKILL (force)
- **Auto-Refresh**: Real-time updates every 2 seconds
- **Filter**: Search by name, PID, port, or user

## Usage

```bash
bun run proc-manager
```

## Keyboard Shortcuts

### List View
| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate list |
| `Enter` | Open detail view |
| `a` | Toggle auto-refresh (2s interval) |
| `p` | Switch between Processes/Ports view |
| `/` | Open filter input |
| `r` | Manual refresh |
| `q` | Quit |

### Detail View
| Key | Action |
|-----|--------|
| `↑/↓` | Navigate options |
| `Enter` | Execute selected action |
| `b` or `Escape` | Back to list |

## Views

### Combined View (default)
Shows top 100 processes sorted by CPU usage with:
- Process name (truncated to 20 chars)
- PID, CPU%, MEM%, user
- Listening ports (if any)

### Ports View
Shows all listening TCP ports with:
- Port number
- Process name and PID
- Protocol (TCP)

### Detail View
Shows process/port details with options:
- Kill (SIGTERM) - graceful termination
- Force Kill (SIGKILL) - immediate termination
- Back - return to list

## Architecture

Single-file React/Ink TUI using `@toolbox/common` components.

### System Commands Used

- `ps axo pid,pcpu,pmem,user,comm -r` - Get process list
- `lsof -i -P -n -sTCP:LISTEN` - Get listening ports
- `kill -TERM <pid>` - Graceful terminate
- `kill -KILL <pid>` - Force kill
