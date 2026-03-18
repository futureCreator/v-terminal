# WSL SSH-based Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace slow ConPTY+wsl.exe WSL connections with SSH-based connections to sshd inside WSL, reusing the existing russh infrastructure.

**Architecture:** New `wsl_ssh_setup.rs` module automates sshd provisioning inside WSL distros. The `session_commands.rs` WSL branch routes through `manager.create_wsl_ssh()` which calls setup, then reuses `ssh_pool` + `SshSession`. Frontend passes `wslDistro` field instead of `shellProgram`/`shellArgs`.

**Tech Stack:** Rust (Tauri backend), russh/russh-keys (SSH), React/TypeScript (frontend)

**Spec:** `docs/superpowers/specs/2026-03-19-wsl-ssh-connection-design.md`

---

## File Map

### New Files
- `src-tauri/src/session/wsl_ssh_setup.rs` — WSL sshd provisioning (key gen, sshd start, port management)

### Modified Files (Backend)
- `src-tauri/src/session/mod.rs` — add `pub mod wsl_ssh_setup;`
- `src-tauri/src/session/ssh_session.rs` — add `session_kind` field, accept `SessionType` param
- `src-tauri/src/session/ssh_pool.rs` — add `known_hosts_override` param to `connect_with_key()` and `do_ssh_connect()`
- `src-tauri/src/session/manager.rs` — add `wsl_ssh_cache` field, `create_wsl_ssh()` method, sshd cleanup in `kill_all()`
- `src-tauri/src/commands/session_commands.rs` — add `wsl_distro` param, new `session_create_wsl_with_sudo` command
- `src-tauri/src/lib.rs` — register new command in `generate_handler!`

### Modified Files (Frontend)
- `src/types/terminal.ts` — add `wslDistro` to `PanelConnection`
- `src/lib/tauriIpc.ts` — add `wslDistro` to `SessionCreateParams`, add `sessionCreateWslWithSudo()`
- `src/components/SessionPicker/SessionPicker.tsx` — WSL options use `wslDistro` instead of `shellProgram`/`shellArgs`
- `src/components/PanelContextMenu/PanelContextMenu.tsx` — WSL check/action use `wslDistro`
- `src/components/PanelGrid/PanelGrid.tsx` — pass `wslDistro` prop, update `connKey`
- `src/components/TerminalPane/TerminalPane.tsx` — accept `wslDistro` prop, handle `WSL_SUDO_REQUIRED`
- `src/App.tsx` — command palette WSL switch uses `wslDistro`

---

## Task 1: Parameterize SshSession with SessionType

**Files:**
- Modify: `src-tauri/src/session/ssh_session.rs:15-17` (struct fields), `:22-49` (create fn), `:135-137` (session_type impl)
- Modify: `src-tauri/src/session/manager.rs:99-101` (create_ssh call), `:149-151` (create_ssh_with_password call)

- [ ] **Step 1: Add `session_kind` field to `SshSession` struct**

In `src-tauri/src/session/ssh_session.rs`, add `session_kind: super::SessionType` field:

```rust
pub struct SshSession {
    cmd_tx: mpsc::UnboundedSender<ChannelCommand>,
    pub connection_id: String,
    _task: JoinHandle<()>,
    session_kind: super::SessionType,
}
```

- [ ] **Step 2: Update `SshSession::create()` signature to accept `session_type`**

Add `session_type: super::SessionType` parameter to `create()`:

```rust
pub async fn create(
    app: AppHandle,
    session_id: String,
    connection_id: String,
    handle: &russh::client::Handle<super::ssh_pool::SshClientHandler>,
    cols: u16,
    rows: u16,
    session_type: super::SessionType,
) -> Result<Self, String> {
```

And set the field in the return:

```rust
Ok(Self {
    cmd_tx,
    connection_id,
    _task: task,
    session_kind: session_type,
})
```

- [ ] **Step 3: Update `session_type()` to return dynamic value**

Change the hardcoded return in the `Session` impl:

```rust
fn session_type(&self) -> super::SessionType {
    self.session_kind
}
```

- [ ] **Step 4: Update existing callers in `manager.rs`**

In `create_ssh()` (line ~100):
```rust
SshSession::create(app, session_id.clone(), connection_id.clone(), &*handle, cols, rows, super::SessionType::Ssh)
```

In `create_ssh_with_password()` (line ~150):
```rust
SshSession::create(app, session_id.clone(), connection_id.clone(), &*handle, cols, rows, super::SessionType::Ssh)
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles successfully with no errors

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/session/ssh_session.rs src-tauri/src/session/manager.rs
git commit -m "refactor: parameterize SshSession with SessionType"
```

---

## Task 2: Add known_hosts override to ssh_pool

**Files:**
- Modify: `src-tauri/src/session/ssh_pool.rs:47-70` (connect_with_key), `:188-244` (do_ssh_connect), `:247-251` (SshClientHandler)

- [ ] **Step 1: Add `known_hosts_path` field to `SshClientHandler`**

Already exists at line 248-251. No change needed — the field is already configurable.

- [ ] **Step 2: Add `known_hosts_override` param to `do_ssh_connect()`**

In `ssh_pool.rs`, change the signature:

```rust
async fn do_ssh_connect(
    host: &str,
    port: u16,
    username: &str,
    identity_file: Option<&str>,
    password: Option<&str>,
    known_hosts_override: Option<&std::path::Path>,
) -> Result<client::Handle<SshClientHandler>, String> {
```

And use it when constructing the handler:

```rust
let handler = SshClientHandler {
    known_hosts_path: known_hosts_override
        .map(|p| p.to_path_buf())
        .unwrap_or_else(known_hosts_path),
    host: host.to_string(),
    port,
};
```

- [ ] **Step 3: Add `known_hosts_override` param to `connect_with_key()`**

```rust
pub async fn connect_with_key(
    &mut self,
    host: &str,
    port: u16,
    username: &str,
    identity_file: &str,
    known_hosts_override: Option<&std::path::Path>,
) -> Result<String, String> {
    if let Some(id) = self.find_connection(host, port, username) {
        return Ok(id.to_string());
    }
    let connection_id = Uuid::new_v4().to_string();
    let handle = do_ssh_connect(host, port, username, Some(identity_file), None, known_hosts_override).await?;
```

- [ ] **Step 4: Update all existing callers to pass `None`**

In `manager.rs` `create_ssh()` (line ~89):
```rust
pool.connect_with_key(&host, port, &username, &resolved_key, None).await?
```

In `do_ssh_connect` calls from `connect_with_password()`:
```rust
let handle = do_ssh_connect(host, port, username, None, Some(password), None).await?;
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles successfully

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/session/ssh_pool.rs src-tauri/src/session/manager.rs
git commit -m "refactor: add known_hosts override to SSH connection pool"
```

---

## Task 3: Create WSL SSH setup module

**Files:**
- Create: `src-tauri/src/session/wsl_ssh_setup.rs`
- Modify: `src-tauri/src/session/mod.rs` (add module declaration)

- [ ] **Step 1: Add module declaration**

In `src-tauri/src/session/mod.rs`, add after line 4:

```rust
pub mod wsl_ssh_setup;
```

- [ ] **Step 2: Create `wsl_ssh_setup.rs` with data structures and helper functions**

Create `src-tauri/src/session/wsl_ssh_setup.rs`:

```rust
use std::path::PathBuf;

/// Cached connection info for a WSL distro with sshd running.
#[derive(Debug, Clone)]
pub struct WslSshInfo {
    pub port: u16,
    pub username: String,
    pub key_path: String,
    pub sshd_pid: Option<u32>,
}

const WSL_SSH_BASE_PORT: u16 = 2222;
const WSL_SSH_MAX_PORT: u16 = 2242;

/// Directory for v-terminal WSL SSH files (keys, known_hosts).
fn vterminal_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    let dir = home.join(".vterminal");
    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("failed to create .vterminal dir: {e}"))?;
    }
    Ok(dir)
}

/// Path to the v-terminal dedicated SSH private key.
fn wsl_key_path() -> Result<PathBuf, String> {
    Ok(vterminal_dir()?.join("wsl_id_ed25519"))
}

/// Path to the WSL-specific known_hosts file.
pub fn wsl_known_hosts_path() -> Result<PathBuf, String> {
    Ok(vterminal_dir()?.join("wsl_known_hosts"))
}

/// Run a command inside a WSL distro and return (stdout, stderr, exit_code).
#[cfg(windows)]
fn wsl_exec(distro: &str, command: &str) -> Result<(String, String, i32), String> {
    use std::os::windows::process::CommandExt;
    let output = std::process::Command::new("wsl")
        .args(["-d", distro, "--", "bash", "-c", command])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("wsl exec failed: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let code = output.status.code().unwrap_or(-1);
    Ok((stdout, stderr, code))
}

#[cfg(not(windows))]
fn wsl_exec(_distro: &str, _command: &str) -> Result<(String, String, i32), String> {
    Err("WSL is only available on Windows".to_string())
}

/// Run a command with sudo, optionally providing a password via stdin.
#[cfg(windows)]
fn wsl_sudo_exec(
    distro: &str,
    command: &str,
    password: Option<&str>,
) -> Result<(String, String, i32), String> {
    use std::os::windows::process::CommandExt;
    use std::io::Write;

    let sudo_cmd = if password.is_some() {
        format!("sudo -S {command}")
    } else {
        format!("sudo -n {command}")
    };

    let mut child = std::process::Command::new("wsl")
        .args(["-d", distro, "--", "bash", "-c", &sudo_cmd])
        .creation_flags(0x08000000)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("wsl sudo exec failed: {e}"))?;

    if let Some(pw) = password {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = writeln!(stdin, "{pw}");
        }
    }

    let output = child.wait_with_output()
        .map_err(|e| format!("wsl sudo wait failed: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let code = output.status.code().unwrap_or(-1);
    Ok((stdout, stderr, code))
}

#[cfg(not(windows))]
fn wsl_sudo_exec(
    _distro: &str,
    _command: &str,
    _password: Option<&str>,
) -> Result<(String, String, i32), String> {
    Err("WSL is only available on Windows".to_string())
}
```

- [ ] **Step 3: Implement SSH key generation**

Add to `wsl_ssh_setup.rs`:

```rust
/// Ensure the v-terminal SSH key pair exists. Generate if missing.
fn ensure_key_pair() -> Result<String, String> {
    let key_path = wsl_key_path()?;
    if key_path.exists() {
        return Ok(key_path.to_string_lossy().into_owned());
    }

    // Generate ed25519 key pair using ssh-keygen (available on Windows 10+)
    let pub_path = key_path.with_extension("pub");
    let output = std::process::Command::new("ssh-keygen")
        .args([
            "-t", "ed25519",
            "-f", &key_path.to_string_lossy(),
            "-N", "", // empty passphrase
            "-C", "v-terminal-wsl",
        ])
        .output()
        .map_err(|e| format!("ssh-keygen failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ssh-keygen failed: {stderr}"));
    }

    if !key_path.exists() || !pub_path.exists() {
        return Err("ssh-keygen did not produce expected key files".to_string());
    }

    Ok(key_path.to_string_lossy().into_owned())
}

/// Read the public key content for authorized_keys registration.
fn read_public_key() -> Result<String, String> {
    let pub_path = wsl_key_path()?.with_extension("pub");
    std::fs::read_to_string(&pub_path)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("failed to read public key: {e}"))
}
```

- [ ] **Step 4: Implement sshd port discovery and startup**

Add to `wsl_ssh_setup.rs`:

```rust
/// Find a free port for sshd in the WSL distro, or reuse an existing v-terminal sshd.
fn find_sshd_port(distro: &str) -> Result<u16, String> {
    for port in WSL_SSH_BASE_PORT..=WSL_SSH_MAX_PORT {
        let (stdout, _, code) = wsl_exec(
            distro,
            &format!("ss -tln 2>/dev/null | grep -q ':{port} ' && echo used || echo free"),
        )?;
        if stdout.contains("free") {
            return Ok(port);
        }
        // Port is in use — check if it's our sshd
        let (proc_out, _, _) = wsl_exec(
            distro,
            &format!("ss -tlnp 2>/dev/null | grep ':{port} ' | grep -o 'pid=[0-9]*' | head -1"),
        )?;
        if proc_out.is_empty() {
            // Port used but can't identify process — skip
            continue;
        }
        let pid_str = proc_out.trim_start_matches("pid=");
        let (cmd_out, _, _) = wsl_exec(
            distro,
            &format!("cat /proc/{pid_str}/cmdline 2>/dev/null | tr '\\0' ' '"),
        )?;
        if cmd_out.contains("sshd") && cmd_out.contains("vterminal_sshd") {
            // It's our sshd — reuse this port
            return Ok(port);
        }
    }
    Err(format!("no free port found in range {WSL_SSH_BASE_PORT}-{WSL_SSH_MAX_PORT}"))
}

/// Start sshd inside the WSL distro with a v-terminal config.
fn start_sshd(
    distro: &str,
    port: u16,
    sudo_password: Option<&str>,
) -> Result<Option<u32>, String> {
    let config_path = format!("/tmp/vterminal_sshd_{port}.conf");
    let config_content = format!(
        "ListenAddress 127.0.0.1\nPort {port}\nPubkeyAuthentication yes\nPasswordAuthentication no\nAuthorizedKeysFile .ssh/authorized_keys\nHostKey /etc/ssh/ssh_host_ed25519_key\nHostKey /etc/ssh/ssh_host_rsa_key"
    );

    // Write config file
    let write_cmd = format!("cat > {config_path} << 'VTEOF'\n{config_content}\nVTEOF");
    let (_, _, code) = wsl_exec(distro, &write_cmd)?;
    if code != 0 {
        return Err(format!("failed to write sshd config to {config_path}"));
    }

    // Generate host keys if missing
    let (_, _, _) = wsl_sudo_exec(
        distro,
        "ssh-keygen -A 2>/dev/null",
        sudo_password,
    )?;

    // Start sshd
    let (_, stderr, code) = wsl_sudo_exec(
        distro,
        &format!("/usr/sbin/sshd -f {config_path}"),
        sudo_password,
    )?;

    if code != 0 {
        if stderr.contains("password is required") || stderr.contains("sudo:") {
            return Err(format!("{{\"code\":\"WSL_SUDO_REQUIRED\",\"distro\":\"{distro}\"}}"));
        }
        return Err(format!("failed to start sshd: {stderr}"));
    }

    // Get sshd PID
    let (pid_out, _, _) = wsl_exec(
        distro,
        &format!("ss -tlnp 2>/dev/null | grep ':{port} ' | grep -o 'pid=[0-9]*' | head -1"),
    )?;
    let pid = pid_out
        .trim_start_matches("pid=")
        .parse::<u32>()
        .ok();

    Ok(pid)
}
```

- [ ] **Step 5: Implement the main `ensure_sshd()` function**

Add to `wsl_ssh_setup.rs`:

```rust
/// Ensure sshd is running in the given WSL distro and return connection info.
///
/// This is the main entry point. It:
/// 1. Gets the WSL username
/// 2. Checks/installs openssh-server
/// 3. Generates SSH key pair (if needed)
/// 4. Registers public key in WSL authorized_keys
/// 5. Finds a port and starts sshd
pub fn ensure_sshd(
    distro: &str,
    sudo_password: Option<&str>,
) -> Result<WslSshInfo, String> {
    // 1. Get username
    let (username, _, code) = wsl_exec(distro, "whoami")?;
    if code != 0 || username.is_empty() {
        return Err(format!("failed to get WSL username for {distro}"));
    }

    // 2. Check if sshd is installed
    let (_, _, sshd_code) = wsl_exec(distro, "which sshd")?;
    if sshd_code != 0 {
        // Try to install openssh-server
        let (_, _, apt_check) = wsl_exec(distro, "which apt-get")?;
        if apt_check != 0 {
            return Err(format!(
                "openssh-server is not installed in {distro}. \
                 Please install it manually (e.g., `sudo apt-get install openssh-server` \
                 or equivalent for your distro)."
            ));
        }
        let (_, stderr, code) = wsl_sudo_exec(
            distro,
            "apt-get update -qq && apt-get install -y -qq openssh-server",
            sudo_password,
        )?;
        if code != 0 {
            if stderr.contains("password is required") || stderr.contains("sudo:") {
                return Err(format!("{{\"code\":\"WSL_SUDO_REQUIRED\",\"distro\":\"{distro}\"}}"));
            }
            return Err(format!("failed to install openssh-server: {stderr}"));
        }
    }

    // 3. Ensure SSH key pair
    let key_path = ensure_key_pair()?;

    // 4. Register public key
    let pubkey = read_public_key()?;
    let (_, _, grep_code) = wsl_exec(
        distro,
        &format!("grep -qF '{pubkey}' ~/.ssh/authorized_keys 2>/dev/null"),
    )?;
    if grep_code != 0 {
        // Key not yet registered
        let register_cmd = format!(
            "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys",
            pubkey
        );
        let (_, _, code) = wsl_exec(distro, &register_cmd)?;
        if code != 0 {
            return Err("failed to register public key in WSL authorized_keys".to_string());
        }
    }

    // 5. Find port and start sshd
    let port = find_sshd_port(distro)?;

    // Check if sshd is already running on this port (from previous session)
    let (probe, _, _) = wsl_exec(
        distro,
        &format!("ss -tln 2>/dev/null | grep -q ':{port} ' && echo running || echo stopped"),
    )?;

    let sshd_pid = if probe.contains("running") {
        // Already running — get PID
        let (pid_out, _, _) = wsl_exec(
            distro,
            &format!("ss -tlnp 2>/dev/null | grep ':{port} ' | grep -o 'pid=[0-9]*' | head -1"),
        )?;
        pid_out.trim_start_matches("pid=").parse::<u32>().ok()
    } else {
        start_sshd(distro, port, sudo_password)?
    };

    Ok(WslSshInfo {
        port,
        username,
        key_path,
        sshd_pid,
    })
}

/// Kill the sshd process for a distro (used during app shutdown).
pub fn kill_sshd(distro: &str, pid: u32) {
    let _ = wsl_exec(distro, &format!("kill {pid} 2>/dev/null"));
}
```

- [ ] **Step 6: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles (module declared, no callers yet)

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/session/wsl_ssh_setup.rs src-tauri/src/session/mod.rs
git commit -m "feat: add WSL SSH setup module for sshd provisioning"
```

---

## Task 4: Add `create_wsl_ssh()` to SessionManager

**Files:**
- Modify: `src-tauri/src/session/manager.rs:15-18` (struct fields), new method, `kill_all()`

- [ ] **Step 1: Add `wsl_ssh_cache` field to `SessionManager`**

In `manager.rs`, update the struct and constructor:

```rust
use super::wsl_ssh_setup::{self, WslSshInfo};

pub struct SessionManager {
    sessions: Mutex<HashMap<String, Box<dyn Session>>>,
    ssh_pool: Mutex<SshConnectionPool>,
    pub wsl_distros_cache: std::sync::OnceLock<Vec<String>>,
    wsl_ssh_cache: Mutex<HashMap<String, WslSshInfo>>,
}
```

In `new()`:
```rust
pub fn new() -> Self {
    Self {
        sessions: Mutex::new(HashMap::new()),
        ssh_pool: Mutex::new(SshConnectionPool::new()),
        wsl_distros_cache: std::sync::OnceLock::new(),
        wsl_ssh_cache: Mutex::new(HashMap::new()),
    }
}
```

- [ ] **Step 2: Add `create_wsl_ssh()` method**

Add after `create_ssh_with_password()`:

```rust
pub async fn create_wsl_ssh(
    &self,
    app: AppHandle,
    distro: String,
    cols: u16,
    rows: u16,
    sudo_password: Option<String>,
) -> Result<SessionCreateResult, String> {
    {
        let sessions = self.sessions.lock().await;
        if sessions.len() >= MAX_SESSIONS {
            return Err(format!("session limit reached ({MAX_SESSIONS})"));
        }
    }

    // Setup sshd — check cache first (fast path), then release lock for blocking setup
    let info = {
        // Fast path: check cache under lock
        let cached = {
            let cache = self.wsl_ssh_cache.lock().await;
            cache.get(&distro).cloned()
        };
        if let Some(info) = cached {
            info
        } else {
            // Slow path: release lock, do blocking setup, then re-acquire to insert
            let info = tokio::task::spawn_blocking({
                let distro = distro.clone();
                move || wsl_ssh_setup::ensure_sshd(&distro, sudo_password.as_deref())
            })
            .await
            .map_err(|e| format!("wsl setup task failed: {e}"))??;
            let mut cache = self.wsl_ssh_cache.lock().await;
            cache.insert(distro.clone(), info.clone());
            info
        }
    };

    let known_hosts = wsl_ssh_setup::wsl_known_hosts_path()?;
    let session_id = Uuid::new_v4().to_string();

    // Connect via SSH — retry once on connection refused (sshd may have died)
    let connection_id = {
        let mut pool = self.ssh_pool.lock().await;
        match pool.connect_with_key(
            "127.0.0.1", info.port, &info.username, &info.key_path,
            Some(known_hosts.as_path()),
        ).await {
            Ok(id) => id,
            Err(e) if e.contains("connection") || e.contains("refused") => {
                drop(pool);
                // Invalidate cache and retry setup
                self.wsl_ssh_cache.lock().await.remove(&distro);
                let retry_info = tokio::task::spawn_blocking({
                    let distro = distro.clone();
                    move || wsl_ssh_setup::ensure_sshd(&distro, None)
                })
                .await
                .map_err(|e| format!("wsl setup retry failed: {e}"))??;
                self.wsl_ssh_cache.lock().await.insert(distro.clone(), retry_info.clone());
                let mut pool = self.ssh_pool.lock().await;
                pool.connect_with_key(
                    "127.0.0.1", retry_info.port, &retry_info.username, &retry_info.key_path,
                    Some(known_hosts.as_path()),
                ).await?
            }
            Err(e) => return Err(e),
        }
    };

    let handle = {
        let pool = self.ssh_pool.lock().await;
        let conn = pool.get(&connection_id).ok_or("connection lost")?;
        Arc::clone(&conn.handle)
    };

    let session = SshSession::create(
        app,
        session_id.clone(),
        connection_id.clone(),
        &*handle,
        cols,
        rows,
        super::SessionType::Wsl,
    ).await?;

    {
        let mut pool = self.ssh_pool.lock().await;
        if let Some(conn) = pool.get_mut(&connection_id) {
            conn.session_ids.push(session_id.clone());
        }
    }
    self.sessions
        .lock()
        .await
        .insert(session_id.clone(), Box::new(session));

    Ok(SessionCreateResult {
        session_id,
        connection_id: Some(connection_id),
    })
}
```

- [ ] **Step 3: Add sshd cleanup to `kill_all()`**

In `kill_all()`, add before `pool.disconnect_all()`:

```rust
pub async fn kill_all(&self) {
    let mut sessions = self.sessions.lock().await;
    for (_, session) in sessions.drain() {
        let _ = session.kill().await;
    }
    // Clean up WSL sshd processes
    let mut wsl_cache = self.wsl_ssh_cache.lock().await;
    for (distro, info) in wsl_cache.drain() {
        if let Some(pid) = info.sshd_pid {
            wsl_ssh_setup::kill_sshd(&distro, pid);
        }
    }
    let mut pool = self.ssh_pool.lock().await;
    pool.disconnect_all().await;
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles successfully

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/session/manager.rs
git commit -m "feat: add create_wsl_ssh() to SessionManager with sshd lifecycle"
```

---

## Task 5: Update session commands and register

**Files:**
- Modify: `src-tauri/src/commands/session_commands.rs:16-37` (session_create), add new command
- Modify: `src-tauri/src/lib.rs:35-42` (generate_handler)

- [ ] **Step 1: Add `wsl_distro` param to `session_create` and route WSL**

In `session_commands.rs`, update `session_create`:

```rust
#[tauri::command]
pub async fn session_create(
    state: tauri::State<'_, SessionManager>,
    app: AppHandle,
    r#type: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    shell_program: Option<String>,
    shell_args: Option<Vec<String>>,
    ssh: Option<SshParams>,
    wsl_distro: Option<String>,
) -> Result<SessionCreateResult, String> {
    let cwd = cwd.unwrap_or_else(|| "~".to_string());
    match r#type.as_str() {
        "local" => state.create_local(app, cwd, cols, rows, shell_program, shell_args, SessionType::Local).await,
        "wsl" => {
            let distro = wsl_distro.ok_or("wsl_distro is required for type 'wsl'")?;
            state.create_wsl_ssh(app, distro, cols, rows, None).await
        }
        "ssh" => {
            let ssh = ssh.ok_or("ssh params required for type 'ssh'")?;
            state.create_ssh(app, ssh.host, ssh.port, ssh.username, ssh.identity_file, cols, rows).await
        }
        other => Err(format!("unknown session type: {other}")),
    }
}
```

- [ ] **Step 2: Add `session_create_wsl_with_sudo` command**

Add after `session_create_with_password`:

```rust
#[tauri::command]
pub async fn session_create_wsl_with_sudo(
    state: tauri::State<'_, SessionManager>,
    app: AppHandle,
    distro: String,
    password: String,
    cols: u16,
    rows: u16,
) -> Result<SessionCreateResult, String> {
    state.create_wsl_ssh(app, distro, cols, rows, Some(password)).await
}
```

- [ ] **Step 3: Register new command in `lib.rs`**

In `src-tauri/src/lib.rs`, add to `generate_handler!`:

```rust
.invoke_handler(tauri::generate_handler![
    session_commands::session_create,
    session_commands::session_create_with_password,
    session_commands::session_create_wsl_with_sudo,
    session_commands::session_write,
    session_commands::session_resize,
    session_commands::session_kill,
    wsl_commands::get_wsl_distros,
])
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles successfully

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/session_commands.rs src-tauri/src/lib.rs
git commit -m "feat: route WSL sessions through SSH, add sudo password command"
```

---

## Task 6: Update frontend types and IPC

**Files:**
- Modify: `src/types/terminal.ts:29-35`
- Modify: `src/lib/tauriIpc.ts:9-17`, `:67-85`

- [ ] **Step 1: Add `wslDistro` to `PanelConnection`**

In `src/types/terminal.ts`:

```typescript
export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl';
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
  label?: string;
}
```

- [ ] **Step 2: Add `wslDistro` to `SessionCreateParams`**

In `src/lib/tauriIpc.ts`:

```typescript
export interface SessionCreateParams {
  type: 'local' | 'ssh' | 'wsl';
  cwd?: string;
  cols: number;
  rows: number;
  shellProgram?: string;
  shellArgs?: string[];
  ssh?: { host: string; port: number; username: string; identityFile?: string; };
  wslDistro?: string;
}
```

- [ ] **Step 3: Add `sessionCreateWslWithSudo` function**

In `src/lib/tauriIpc.ts`, add to the `ipc` object after `sessionCreateWithPassword`:

```typescript
async sessionCreateWslWithSudo(distro: string, password: string, cols: number, rows: number): Promise<SessionCreateResult> {
  return invoke<SessionCreateResult>("session_create_wsl_with_sudo", { distro, password, cols, rows });
},
```

- [ ] **Step 4: Commit**

```bash
git add src/types/terminal.ts src/lib/tauriIpc.ts
git commit -m "feat: add wslDistro to frontend types and IPC"
```

---

## Task 7: Update SessionPicker and PanelContextMenu

**Files:**
- Modify: `src/components/SessionPicker/SessionPicker.tsx:300-312` (WSL options), `:31-39` (optionToConnection)
- Modify: `src/components/PanelContextMenu/PanelContextMenu.tsx:103-128` (WSL section)

- [ ] **Step 1: Update `ConnectionOption` and `optionToConnection` in SessionPicker**

In `SessionPicker.tsx`, add `wslDistro` to the internal `ConnectionOption` interface:

```typescript
interface ConnectionOption {
  id: string;
  type: "local" | "ssh" | "wsl";
  name: string;
  subtitle: string;
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
}
```

Update `optionToConnection`:

```typescript
function optionToConnection(opt: ConnectionOption): PanelConnection {
  return {
    type: opt.type,
    sshProfileId: opt.sshProfileId,
    shellProgram: opt.shellProgram,
    shellArgs: opt.shellArgs,
    wslDistro: opt.wslDistro,
    label: opt.type === "local" ? undefined : opt.name,
  };
}
```

- [ ] **Step 2: Update WSL option construction**

In `SessionPicker.tsx`, change the WSL loop (inside `connectionOptions` useMemo):

```typescript
for (const distro of wslDistros) {
  opts.push({
    id: `wsl:${distro}`,
    type: "wsl",
    name: distro,
    subtitle: "WSL",
    wslDistro: distro,
  });
}
```

- [ ] **Step 3: Update PanelContextMenu WSL section**

In `PanelContextMenu.tsx`, change the WSL active check and click handler (lines 103-128):

```typescript
{wslDistros.map((distro) => {
  const isActiveWsl = connType === "wsl"
    && currentConnection?.wslDistro === distro;
  return (
    <button
      key={`wsl:${distro}`}
      className={`panel-ctx-item${isActiveWsl ? " panel-ctx-item--active" : ""}`}
      onClick={() => !isActiveWsl && handleClick({
        type: "wsl",
        wslDistro: distro,
      })}
      role="menuitem"
    >
```

(Keep the rest of the button content — icon, label, meta, checkIcon — unchanged.)

- [ ] **Step 4: Commit**

```bash
git add src/components/SessionPicker/SessionPicker.tsx src/components/PanelContextMenu/PanelContextMenu.tsx
git commit -m "feat: update SessionPicker and PanelContextMenu to use wslDistro"
```

---

## Task 8: Update PanelGrid, TerminalPane, and App.tsx

**Files:**
- Modify: `src/components/PanelGrid/PanelGrid.tsx:151-153` (connKey), `:170-187` (TerminalPane props)
- Modify: `src/components/TerminalPane/TerminalPane.tsx:20-38` (props), `:196-260` (session creation + error handling)
- Modify: `src/App.tsx:719-745` (command palette WSL switch)

- [ ] **Step 1: Update PanelGrid to pass `wslDistro` and fix `connKey`**

In `PanelGrid.tsx`, update the `connKey` computation (line ~151):

```typescript
const connKey = panel.connection
  ? `${panel.connection.type}-${panel.connection.sshProfileId ?? ""}-${panel.connection.wslDistro ?? ""}-${panel.connection.shellProgram ?? ""}`
  : "local";
```

Add `wslDistro` prop to `TerminalPane` (line ~180, after `shellArgs`):

```typescript
shellArgs={panel.connection?.shellArgs}
wslDistro={panel.connection?.wslDistro}
```

- [ ] **Step 2: Add `wslDistro` prop to TerminalPane**

In `TerminalPane.tsx`, add to the props interface:

```typescript
interface TerminalPaneProps {
  style?: React.CSSProperties;
  cwd: string;
  isActive: boolean;
  broadcastEnabled: boolean;
  siblingSessionIds: string[];
  connectionType?: 'local' | 'ssh' | 'wsl';
  sshHost?: string;
  sshPort?: number;
  sshUsername?: string;
  sshIdentityFile?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
  onSessionCreated: (sessionId: string, connectionId?: string) => void;
  onSessionKilled: () => void;
  onFocus: () => void;
  onNextPanel?: () => void;
  onPrevPanel?: () => void;
}
```

And destructure it:

```typescript
export function TerminalPane({
  style,
  cwd,
  isActive,
  broadcastEnabled,
  siblingSessionIds,
  connectionType,
  sshHost,
  sshPort,
  sshUsername,
  sshIdentityFile,
  shellProgram,
  shellArgs,
  wslDistro,
  onSessionCreated,
  onSessionKilled,
  onFocus,
  onNextPanel,
  onPrevPanel,
}: TerminalPaneProps) {
```

- [ ] **Step 3: Pass `wslDistro` in `ipc.sessionCreate()` call**

In `TerminalPane.tsx`, update the session creation call (line ~202):

```typescript
const result = await ipc.sessionCreate({
  type: sessType,
  cwd,
  cols,
  rows,
  shellProgram,
  shellArgs,
  wslDistro,
  ...(sessType === 'ssh' && sshHost && sshUsername ? {
    ssh: {
      host: sshHost,
      port: sshPort ?? 22,
      username: sshUsername,
      identityFile: sshIdentityFile,
    },
  } : {}),
});
```

- [ ] **Step 4: Handle `WSL_SUDO_REQUIRED` error in TerminalPane**

First, add two new state variables near the other password dialog state (line ~90):

```typescript
const [passwordDialogTitle, setPasswordDialogTitle] = useState("SSH Authentication");
const [passwordDialogSubtitle, setPasswordDialogSubtitle] = useState("");
```

Then update the dialog JSX (line ~481-484) to use dynamic title/subtitle:

```tsx
<div className="terminal-password-title">{passwordDialogTitle}</div>
<div className="terminal-password-subtitle">
  {passwordDialogSubtitle || `${sshUsername ?? ""}@${sshHost ?? ""}${sshPort && sshPort !== 22 ? `:${sshPort}` : ""}`}
</div>
```

Then update the catch block (line ~220) to handle WSL sudo alongside SSH password:

```typescript
} catch (e) {
  const errStr = String(e);

  // Handle password-required flow for SSH
  if (errStr.includes("PASSWORD_REQUIRED") && sshHost && sshUsername) {
    setLoading(false);
    let authenticated = false;
    while (!authenticated) {
      const password = await promptPassword();
      if (password === null || disposed) return;
      try {
        const result = await ipc.sessionCreateWithPassword({
          host: sshHost,
          port: sshPort ?? 22,
          username: sshUsername,
          password,
          cols: term.cols,
          rows: term.rows,
        });
        sessionId = result.sessionId;
        connectionId = result.connectionId;
        setShowPasswordDialog(false);
        authenticated = true;
      } catch (retryErr) {
        if (String(retryErr).includes("AUTH_FAILED")) {
          setPasswordError("Authentication failed. Please try again.");
          continue;
        }
        setShowPasswordDialog(false);
        term.write(`\r\n\x1b[31mFailed to connect: ${retryErr}\x1b[0m\r\n`);
        setExited(true);
        return;
      }
    }
    setLoading(true);
  } else if (errStr.includes("WSL_SUDO_REQUIRED") && wslDistro) {
    // Handle WSL sudo password flow
    setPasswordDialogTitle("WSL Authentication");
    setPasswordDialogSubtitle(`sudo password for ${wslDistro}`);
    setLoading(false);
    let authenticated = false;
    while (!authenticated) {
      const password = await promptPassword();
      if (password === null || disposed) return;
      try {
        const result = await ipc.sessionCreateWslWithSudo(
          wslDistro, password, term.cols, term.rows
        );
        sessionId = result.sessionId;
        connectionId = result.connectionId;
        setShowPasswordDialog(false);
        authenticated = true;
      } catch (retryErr) {
        if (String(retryErr).includes("WSL_SUDO_REQUIRED") || String(retryErr).includes("AUTH_FAILED")) {
          setPasswordError("Authentication failed. Please try again.");
          continue;
        }
        setShowPasswordDialog(false);
        term.write(`\r\n\x1b[31mFailed to connect: ${retryErr}\x1b[0m\r\n`);
        setExited(true);
        return;
      }
    }
    setLoading(true);
  } else {
    term.write(`\r\n\x1b[31mFailed to start session: ${e}\x1b[0m\r\n`);
    setLoading(false);
    return;
  }
}
```

**Note:** The state variables and dialog JSX updates were already added at the beginning of this step. In the SSH `PASSWORD_REQUIRED` branch, also set the title/subtitle before prompting:

```typescript
if (errStr.includes("PASSWORD_REQUIRED") && sshHost && sshUsername) {
  setPasswordDialogTitle("SSH Authentication");
  setPasswordDialogSubtitle(`${sshUsername}@${sshHost}${sshPort && sshPort !== 22 ? `:${sshPort}` : ""}`);
  setLoading(false);
```

**Behavioral note:** WSL SSH sessions start in the WSL user's home directory (same as regular SSH sessions). The tab `cwd` is not passed to WSL SSH sessions — this is by design, as Windows paths are not directly usable inside WSL.

- [ ] **Step 5: Update App.tsx command palette WSL switch**

In `App.tsx` (lines ~719-745), update the WSL section:

```typescript
...wslDistros.map((distro) => {
  const isActiveWsl = connType === "wsl"
    && conn?.wslDistro === distro;
  return {
    id: `conn:wsl:${distro}`,
    label: distro,
    description: `Switch to WSL: ${distro}`,
    meta: "WSL",
    icon: (/* ... existing icon SVG ... */),
    isActive: isActiveWsl,
    action: () => {
      if (isActiveWsl) return;
      switchPanelConnection(activeTab.id, activePanelId, {
        type: "wsl",
        wslDistro: distro,
      });
    },
  };
}),
```

- [ ] **Step 6: Verify build**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run check` (or `npx tsc --noEmit`)
Expected: no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/components/PanelGrid/PanelGrid.tsx src/components/TerminalPane/TerminalPane.tsx src/App.tsx
git commit -m "feat: wire WSL SSH connection through frontend pipeline"
```

---

## Task 9: Final integration verification

**Files:** None (verification only)

- [ ] **Step 1: Full Rust compilation check**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: compiles with no errors

- [ ] **Step 2: Full TypeScript check**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 3: Full build test**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run tauri build` (or `npm run tauri dev` for dev mode)
Expected: builds successfully

- [ ] **Step 4: Commit any remaining fixes**

If any compilation issues were found and fixed in previous steps, commit them.

```bash
git add -A
git commit -m "fix: resolve compilation issues from WSL SSH integration"
```
