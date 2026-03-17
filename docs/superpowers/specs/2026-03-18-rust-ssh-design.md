# Rust-Native SSH Architecture Design

## Overview

Replace the current "local PTY + ssh command" approach with Rust-native SSH using `russh`. This enables programmatic SSH connection management, multi-channel support (shell + SFTP on a single connection), and connection state detection — laying the foundation for future SFTP-based features (remote file tree, remote CLAUDE.md reading, remote Git status).

## Scope

### In scope (this iteration)

- Rust-level SSH connection management using `russh`
- SSH shell channel → terminal session (replaces PTY + ssh command)
- SFTP channel foundation code (Rust method only, no IPC/UI)
- Key file and password authentication
- Connection state detection + disconnect notification
- Frontend integration (SessionPicker, TerminalPane, IPC)

### Out of scope (future)

- SFTP file browser UI
- Remote CLAUDE.md read/edit
- Remote Git diff/status
- Port forwarding
- Auto-reconnect
- ssh-agent / keyboard-interactive authentication

## Architecture: Unified SessionManager (Approach B)

### Design rationale

The frontend should not care whether a session is local or SSH. A single set of IPC commands (`session_create`, `session_write`, `session_resize`, `session_kill`) works for all session types. Internally, a `Session` trait abstracts over `LocalSession` (portable-pty) and `SshSession` (russh shell channel).

## Rust Backend

### Module structure

```
src-tauri/src/
  ├─ session/
  │    ├─ mod.rs              (Session trait definition)
  │    ├─ manager.rs          (SessionManager)
  │    ├─ local_session.rs    (LocalSession — portable-pty wrapper)
  │    ├─ ssh_session.rs      (SshSession — russh shell channel wrapper)
  │    └─ ssh_pool.rs         (SshConnectionPool + SshConnection)
  ├─ commands/
  │    ├─ session_commands.rs  (replaces pty_commands.rs)
  │    └─ wsl_commands.rs     (unchanged)
  ├─ lib.rs
  └─ main.rs
```

The existing `src-tauri/src/pty/` directory is removed entirely. `pty_commands.rs` is replaced by `session_commands.rs`.

### Session Trait

```rust
#[async_trait]
pub trait Session: Send + Sync {
    async fn write(&self, data: &[u8]) -> Result<()>;
    async fn resize(&self, cols: u16, rows: u16) -> Result<()>;
    async fn kill(&self) -> Result<()>;
}
```

All session types implement this trait. IPC commands delegate to trait methods.

### LocalSession

Renamed from existing `PtySession`. Wraps `portable-pty`:

```
LocalSession
  ├─ writer: Box<dyn Write + Send>
  ├─ master: Box<dyn MasterPty + Send>
  ├─ child: Box<dyn Child + Send + Sync>
  └─ reader_task: JoinHandle<()>  → emits "session-data" event
```

Handles both local shell and WSL sessions (WSL uses `shellProgram = "wsl.exe"`).

The existing `unsafe impl Send for PtySession` carries forward as `unsafe impl Send for LocalSession`, with the same safety invariant: all fields are accessed exclusively through a `Mutex` guard in `SessionManager`.

### SshSession

Wraps a `russh` shell channel:

```
SshSession
  ├─ channel: russh::Channel        (SSH shell channel)
  ├─ connection_id: String           (which SSH connection this belongs to)
  └─ reader_task: JoinHandle<()>     → emits "session-data" event
```

#### SSH shell channel initialization sequence

When creating an SshSession, the following steps execute in order:

1. `client.channel_open_session()` — open a new channel on the SSH connection
2. `channel.request_pty("xterm-256color", cols, rows, 0, 0, &[])` — request a PTY on the remote side
3. `channel.request_shell(true)` — start the remote shell
4. Spawn reader_task that processes `channel.wait()` messages

Each step can fail. On failure at any step, previous resources are cleaned up and an error is returned to the frontend.

#### Reader task message handling

The reader_task processes `ChannelMsg` variants from `channel.wait()`:

```
match msg {
    ChannelMsg::Data { data } => emit "session-data" (stdout)
    ChannelMsg::ExtendedData { data, ext } => emit "session-data" (stderr — forwarded to same terminal)
    ChannelMsg::ExitStatus { exit_status } => capture exit code
    ChannelMsg::Eof => {
        update SshConnectionPool status
        emit "session-exit" with captured exit code
        break
    }
}
```

### SshConnectionPool

Manages SSH connections. Lives inside SessionManager:

```
SshConnectionPool
  ├─ connections: HashMap<String, SshConnection>
  │
  └─ SshConnection
       ├─ client: russh::client::Handle   (russh connection handle)
       ├─ profile_key: (host, port, username)  (connection identity)
       ├─ status: Connecting | Connected | Disconnected(reason)
       └─ session_ids: Vec<String>        (sessions spawned on this connection)
```

#### Connection reuse key

Connections are identified by the tuple `(host, port, username)`. Two profiles pointing to the same host/port/username with different identity files will share the same connection (the first successful auth establishes the connection).

#### Connection timeout

Initial TCP + SSH handshake has a 10-second timeout. Configurable in the future, hardcoded for now.

#### Host key verification

TOFU (Trust On First Use) strategy:
- First connection to a host: accept and store the host key in an app-managed known_hosts file (`~/.vterminal/known_hosts`)
- Subsequent connections: verify against stored key. On mismatch, reject the connection and emit an error event to the frontend
- This follows standard SSH behavior without requiring user prompts on every connection

#### Behavior:
- Same `(host, port, username)` → reuse existing connection
- New tuple → create new connection + authenticate
- Connection drop → all sessions on that connection receive EOF

### SshConnectionPool SFTP method (foundation only)

```rust
impl SshConnectionPool {
    pub async fn open_sftp(&self, connection_id: &str) -> Result<SftpSession> {
        // 1. Find existing SshConnection by connection_id
        // 2. client.channel_open_session() → request "sftp" subsystem
        // 3. Return SftpSession (from russh-sftp)
    }
}
```

No IPC commands exposed for SFTP yet. This method is available for future use from Rust code.

### SessionManager (replaces PtyManager)

```
SessionManager
  ├─ sessions: tokio::sync::Mutex<HashMap<String, Box<dyn Session>>>
  ├─ ssh_pool: tokio::sync::Mutex<SshConnectionPool>
  ├─ wsl_distros_cache: std::sync::OnceLock<Vec<String>>   (carried from PtyManager)
  └─ max_sessions: 64
```

Uses `tokio::sync::Mutex` (not `std::sync::Mutex`) because `Session` trait methods are async. Holding a `std::sync::Mutex` guard across `.await` points would panic.

`wsl_distros_cache` remains on `SessionManager`. The `get_wsl_distros` command changes its `State` parameter from `PtyManager` to `SessionManager`.

#### Graceful shutdown (kill_all)

`SessionManager::kill_all()` is called on window close (from `lib.rs`). It handles both session types:

- **LocalSession**: kills the process tree (existing behavior — `taskkill /F /T` on Windows, `kill -9` on Unix)
- **SshSession**: sends EOF on the channel, then closes the channel. After all sessions on a connection are closed, disconnects the SSH connection gracefully.

All kills are best-effort during shutdown — errors are logged but do not block app exit.

## IPC Commands

### Removed

```
pty_create, pty_write, pty_resize, pty_kill
```

### Added

| Command | Parameters | Behavior |
|---------|-----------|----------|
| `session_create` | `{ type, cwd?, cols, rows, shellProgram?, shellArgs?, ssh?: { host, port, username, identityFile? } }` | Creates LocalSession or SshSession based on type. Returns `{ sessionId, connectionId? }`. |
| `session_create_with_password` | `{ host, port, username, password, cols, rows }` | Creates SshSession with password auth. Returns `{ sessionId, connectionId }`. |
| `session_write` | `{ sessionId, data }` | Calls Session::write() |
| `session_resize` | `{ sessionId, cols, rows }` | Calls Session::resize() |
| `session_kill` | `{ sessionId }` | Calls Session::kill() |

#### SSH profile data flow

SSH profiles are stored in the frontend (localStorage via sshStore). The Rust backend does not store or resolve profiles by ID. Instead, the frontend resolves `sshProfileId` to connection details and passes them directly:

```typescript
// Frontend resolves profile before IPC call
const profile = sshStore.getProfile(connection.sshProfileId);
ipc.sessionCreate({
  type: 'ssh',
  cols, rows,
  ssh: {
    host: profile.host,
    port: profile.port,
    username: profile.username,
    identityFile: profile.identityFile,
  }
});
```

This avoids duplicating profile storage between frontend and backend.

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `session-data` | `{ sessionId, data }` | Session output (replaces `pty-data`) |
| `session-exit` | `{ sessionId, code? }` | Session terminated (replaces `pty-exit`) |
| `ssh-connection-status` | `{ connectionId, status, error? }` | SSH connection state change (new) |

#### connectionId mapping

`session_create` returns `{ sessionId, connectionId? }` (connectionId is present for SSH sessions, absent for local/WSL). The frontend stores `connectionId` alongside `sessionId` in the Panel data. TerminalPane receives `connectionId` as a prop and uses it to listen for `ssh-connection-status` events.

### Password Authentication Flow

```
session_create({ type: "ssh", ssh: { host, port, username } })
  → no identityFile → return structured error { code: "PASSWORD_REQUIRED" }
  → frontend shows password dialog
  → session_create_with_password({ host, port, username, password, cols, rows })
  → password auth → success → { sessionId, connectionId }

session_create({ type: "ssh", ssh: { host, port, username, identityFile: "/path" } })
  → key auth attempt → success → { sessionId, connectionId }
  → key auth fails → return structured error { code: "AUTH_FAILED", message: "..." }
```

Errors use structured objects (`{ code, message? }`) instead of raw strings to avoid ambiguity.

## Frontend Changes

### types/terminal.ts

```typescript
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl';
  sshProfileId?: string;      // replaces sshCommand
  shellProgram?: string;
  shellArgs?: string[];
  label?: string;
}

export interface Panel {
  id: string;
  ptyId: string | null;         // renamed conceptually to sessionId (or alias)
  connectionId?: string | null;  // SSH connection ID (new, for connection status tracking)
  connection?: PanelConnection;
}
```

### tauriIpc.ts

Replace all `pty*` functions with `session*` functions:

```typescript
ipc.sessionCreate(params: {
  type: 'local' | 'ssh' | 'wsl',
  cwd?: string,
  cols: number, rows: number,
  shellProgram?: string, shellArgs?: string[],
  ssh?: { host: string, port: number, username: string, identityFile?: string }
}): Promise<{ sessionId: string, connectionId?: string }>

ipc.sessionCreateWithPassword(params: {
  host: string, port: number, username: string, password: string,
  cols: number, rows: number
}): Promise<{ sessionId: string, connectionId: string }>

ipc.sessionWrite(sessionId: string, data: Uint8Array): Promise<void>
ipc.sessionResize(sessionId: string, cols: number, rows: number): Promise<void>
ipc.sessionKill(sessionId: string): Promise<void>
ipc.onSessionData(sessionId: string, handler): UnlistenFn
ipc.onSessionExit(sessionId: string, handler): UnlistenFn
ipc.onSshConnectionStatus(connectionId: string, handler): UnlistenFn
```

### TerminalPane.tsx

Key change: remove the "create PTY then type ssh command" pattern.

```
Before: ptyCreate() → ptyWrite("ssh user@host\r")
After:  sessionCreate({ type: "ssh", ssh: { host, port, username, identityFile } }) → done
```

On `PASSWORD_REQUIRED` error: show dialog → call `sessionCreateWithPassword()`.

TerminalPane receives `connectionId` as a prop. When `ssh-connection-status` fires with status `"disconnected"`:
- Show overlay banner: "Connection lost"
- Show restart button (triggers `sessionCreate` for reconnection)

### Removed files

- `src/lib/sshUtils.ts` — `buildSshCommand()` no longer needed

## Dependencies

### Cargo.toml additions

```toml
russh = "0.48"
russh-keys = "0.48"
russh-sftp = "2.0"
async-trait = "0.1"
dirs = "5"
```

### Existing dependencies retained

- `portable-pty` — still used for LocalSession
- `tokio` (full) — async runtime
- `uuid` — session IDs
