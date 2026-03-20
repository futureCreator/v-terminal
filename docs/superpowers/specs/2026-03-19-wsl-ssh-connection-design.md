# WSL SSH-based Connection Design

## Problem

WSL connections in v-terminal are significantly slower than local shell and SSH connections. The current path goes through three layers of overhead:

```
ConPTY → wsl.exe (bridge process) → WSL2 VM boundary → Linux shell
```

ConPTY performs UTF-8/UTF-16 conversion and virtual terminal emulation, wsl.exe adds its own buffering as a relay process, and every I/O operation crosses the Hyper-V VM boundary.

## Solution

Replace the ConPTY + wsl.exe path with a direct SSH connection to sshd running inside the WSL distro. The existing SSH infrastructure (russh, ssh_pool, ssh_session) is reused entirely.

```
russh (TCP localhost) → sshd (WSL) → shell
```

This eliminates ConPTY overhead, the wsl.exe bridge, and the associated encoding conversions. The user already confirms that SSH connections are fast, so the same code path applied to WSL will yield comparable performance.

## Architecture

### Current Flow

```
Frontend: type="wsl", shellProgram="wsl.exe", shellArgs=["-d", distro]
  → session_commands.rs: "wsl" → manager.create_local()
  → LocalSession::create() with ConPTY
```

### New Flow

```
Frontend: type="wsl", wslDistro="Ubuntu"
  → session_commands.rs: "wsl" → manager.create_wsl_ssh(distro, cols, rows)
  → wsl_ssh_setup::ensure_sshd(distro)
  → ssh_pool.connect_with_key("127.0.0.1", port, username, key)
  → SshSession::create(app, id, conn_id, handle, cols, rows, SessionType::Wsl)
```

## Components

### 1. WSL SSH Setup Module

**New file:** `src-tauri/src/session/wsl_ssh_setup.rs`

Automates sshd provisioning inside a WSL distro. All commands execute via `wsl.exe -d <distro> -- <command>`.

#### Setup Flow (first connection only)

1. **Get WSL username**: `wsl.exe -d <distro> -- whoami`

2. **Check openssh-server**: `wsl.exe -d <distro> -- which sshd`
   - If missing: `sudo -n apt-get install -y openssh-server`
   - If sudo fails: return `WSL_SUDO_REQUIRED` error → frontend prompts for password → retry with password piped via stdin
   - Scope: Debian/Ubuntu-based distros only (apt-get). Non-apt distros will see an error message suggesting manual sshd installation.

3. **Generate v-terminal SSH key pair**: stored at `%USERPROFILE%\.vterminal\wsl_id_ed25519`
   - Dedicated key pair to avoid conflicts with user's existing SSH keys
   - Generated once using `russh_keys`, reused across all WSL distros
   - Private key stays on Windows side, read by `russh` via `load_secret_key()`

4. **Register public key in WSL**: pipe pubkey content via stdin to `wsl.exe -d <distro> -- bash -c 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'`
   - Idempotent: first check if pubkey already exists with `grep -qF <pubkey> ~/.ssh/authorized_keys`

5. **Start sshd with v-terminal config**: write a temporary sshd config and start with it
   ```
   wsl.exe -d <distro> -- bash -c 'cat > /tmp/vterminal_sshd_config << EOF
   ListenAddress 127.0.0.1
   Port <port>
   PubkeyAuthentication yes
   PasswordAuthentication no
   AuthorizedKeysFile .ssh/authorized_keys
   EOF
   sudo -n /usr/sbin/sshd -f /tmp/vterminal_sshd_config'
   ```
   - ListenAddress restricted to 127.0.0.1 for security (not exposed to network)
   - PasswordAuthentication disabled (only pubkey auth)
   - Default port: 2222, auto-increment on conflict (2223, 2224...)
   - Each distro gets its own port

6. **Cache connection info**: `(distro) → WslSshInfo` in memory

#### Data Structure

```rust
pub struct WslSshInfo {
    pub port: u16,
    pub username: String,
    pub key_path: String,  // Windows path to private key
    pub sshd_pid: Option<u32>,  // for cleanup on app exit
}
```

Cached in `SessionManager` as `HashMap<String, WslSshInfo>` (distro name → info).

#### sudo Handling

1. Try `sudo -n` (non-interactive) first
2. On failure, return structured error: `{"code":"WSL_SUDO_REQUIRED","distro":"Ubuntu"}`
3. Frontend shows password dialog (reuses existing password dialog with WSL-specific title/subtitle)
4. Backend receives password via dedicated Tauri command, pipes it to `sudo -S` via stdin (not via command-line argument, to avoid process list exposure)
5. Password is not stored — used once and discarded

#### known_hosts Handling

WSL SSH connections use a separate known_hosts file at `%USERPROFILE%\.vterminal\wsl_known_hosts` to avoid conflicts with the user's `~/.ssh/known_hosts`. Each distro's host key is stored under `127.0.0.1:<port>`, so multiple distros coexist without collision. If a distro is reset, the stale entry is automatically replaced (same behavior as the existing `SshClientHandler::check_server_key`).

**Plumbing**: Add `known_hosts_path: Option<PathBuf>` parameter to `do_ssh_connect()` in `ssh_pool.rs`. When `None`, uses the default `~/.ssh/known_hosts` (existing behavior). When `Some(path)`, uses the provided path. `connect_with_key()` gains a matching optional parameter. `create_wsl_ssh()` in `manager.rs` passes `Some(vterminal_dir.join("wsl_known_hosts"))`.

#### Concurrency

`ensure_sshd()` must be serialized per-distro to avoid duplicate sshd starts when multiple WSL panels for the same distro are opened simultaneously. The `wsl_ssh_cache: Mutex<HashMap<...>>` lock is held during the entire setup for a given distro. If the cache already has an entry for the distro, setup is skipped and the cached info is returned immediately.

#### sshd Config File

Each distro uses a unique config path: `/tmp/vterminal_sshd_<port>.conf` to avoid collisions when multiple distros are configured.

### 2. Backend Changes

#### `session_commands.rs`

- Add `wsl_distro: Option<String>` parameter to the `session_create` Tauri command
- `"wsl"` branch: extract distro from `wsl_distro.ok_or("wsl distro required")`, call `manager.create_wsl_ssh(distro, cols, rows, None)`
- New command: `session_create_wsl_with_sudo(distro: String, password: String, cols: u16, rows: u16)` for sudo password retry — calls `manager.create_wsl_ssh(distro, cols, rows, Some(password))`
- Register `session_create_wsl_with_sudo` in `main.rs` `invoke_handler(tauri::generate_handler![...])`

#### `manager.rs`

New method:

```rust
pub async fn create_wsl_ssh(
    &self,
    app: AppHandle,
    distro: String,
    cols: u16,
    rows: u16,
    sudo_password: Option<String>,
) -> Result<SessionCreateResult, String>
```

Internal flow:
1. `wsl_ssh_setup::ensure_sshd(&distro, sudo_password.as_deref())` — setup, optionally with sudo password
2. `ssh_pool.connect_with_key("127.0.0.1", info.port, &info.username, &info.key_path)`
3. `SshSession::create(app, session_id, connection_id, &handle, cols, rows, SessionType::Wsl)`
4. Return `SessionCreateResult` with `session_id` and `connection_id`

New field: `wsl_ssh_cache: Mutex<HashMap<String, WslSshInfo>>`

#### `ssh_pool.rs`

- Add `known_hosts_override: Option<PathBuf>` parameter to `connect_with_key()` and `do_ssh_connect()`
- When provided, `SshClientHandler` uses the override path instead of the default `~/.ssh/known_hosts`
- Existing SSH callers pass `None` (no change in behavior), WSL callers pass the vterminal wsl_known_hosts path

#### `ssh_session.rs`

- Add `session_kind: SessionType` field (same pattern as `LocalSession`)
- Modify `create()` signature to accept `session_type: SessionType` parameter
- `session_type()` returns `self.session_kind` instead of hardcoded `SessionType::Ssh`
- Existing SSH callers pass `SessionType::Ssh`, WSL callers pass `SessionType::Wsl`

#### `mod.rs`

No changes to `SessionType` enum — `Wsl` variant already exists.

#### sshd Lifecycle

- On `SessionManager::kill_all()` (app shutdown): iterate `wsl_ssh_cache`, kill each sshd process via `wsl.exe -d <distro> -- kill <sshd_pid>`
- If v-terminal crashes: sshd processes remain but are harmless (listening only on 127.0.0.1). On next launch, port check detects the running sshd and reuses it.

### 3. Frontend Changes

#### `terminal.ts` (PanelConnection type)

Add `wslDistro` field, remove WSL's use of `shellProgram`/`shellArgs`:

```typescript
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl';
  sshProfileId?: string;
  shellProgram?: string;  // local only
  shellArgs?: string[];   // local only
  wslDistro?: string;     // wsl only
  label?: string;
}
```

#### `tauriIpc.ts`

- Add `wslDistro?: string` to `SessionCreateParams`
- Add `sessionCreateWslWithSudo(distro: string, password: string, cols: number, rows: number)` function

#### `SessionPicker.tsx`

WSL connection options change from:

```typescript
{ id: `wsl:${distro}`, type: "wsl", shellProgram: "wsl.exe", shellArgs: ["-d", distro] }
```

To:

```typescript
{ id: `wsl:${distro}`, type: "wsl", name: distro, wslDistro: distro }
```

`optionToConnection()` updated to pass `wslDistro` through to `PanelConnection`.

#### `PanelContextMenu.tsx`

WSL active check changes from `currentConnection?.shellArgs?.[1] === distro` to `currentConnection?.wslDistro === distro`.

WSL click handler changes from `{ type: "wsl", shellProgram: "wsl.exe", shellArgs: ["-d", distro] }` to `{ type: "wsl", wslDistro: distro }`.

#### `TerminalPane.tsx`

1. Accept `wslDistro` prop (passed from `PanelConnection`)
2. Pass `wslDistro` in `ipc.sessionCreate()` call
3. Handle `WSL_SUDO_REQUIRED` error:
   - Show password dialog with WSL-specific text: title = "WSL Authentication", subtitle = `sudo password for ${distro}`
   - On submit: call `ipc.sessionCreateWslWithSudo(distro, password, cols, rows)`
   - On `AUTH_FAILED`: show error, prompt again
   - On success: proceed as normal

#### `PanelGrid.tsx`

Pass `wslDistro={panel.connection?.wslDistro}` prop to `TerminalPane`.

#### `App.tsx` (command palette WSL switch)

- WSL active check changes from `conn?.shellArgs?.[0] === "-d" && conn?.shellArgs?.[1] === distro` to `conn?.wslDistro === distro`
- WSL switch action changes from `{ type: "wsl", shellProgram: "wsl.exe", shellArgs: ["-d", distro] }` to `{ type: "wsl", wslDistro: distro }`

### 4. Behavioral Change: process_id()

WSL sessions via SSH will no longer have a Windows process ID (previously available via ConPTY's child process). `SshSession` returns `None` for `process_id()`. This only affects `SessionManager::get_process_id()` which is currently unused for WSL-specific logic, so no functional regression.

## Port Management

- Base port: 2222
- One port per distro, allocated sequentially
- Port check: `wsl.exe -d <distro> -- ss -tln | grep :<port>` before starting sshd
- If port is in use by a sshd from a previous v-terminal session (detected by checking process name via `ss -tlnp`), reuse it without restarting
- If port is in use by another process, try next port

## Error Handling

| Error | Handling |
|-------|----------|
| `openssh-server` not installed | Auto-install with sudo (apt-get only) |
| Non-apt distro, sshd missing | Error message: "Please install openssh-server manually" |
| sudo requires password | Return `WSL_SUDO_REQUIRED`, prompt user |
| sudo password wrong | Return auth error, prompt again |
| Port in use (not sshd) | Try next port |
| SSH connection refused | sshd may have died — restart and retry once |
| WSL distro not running | `wsl.exe -d <distro>` starts it automatically |
| WSL not installed | Existing behavior — no WSL distros shown |

## Testing

- Unit test: `wsl_ssh_setup` command generation (mock wsl.exe output parsing)
- Integration test: full WSL SSH session creation on a Windows machine with WSL2
- Manual verification: compare latency between old ConPTY path and new SSH path
