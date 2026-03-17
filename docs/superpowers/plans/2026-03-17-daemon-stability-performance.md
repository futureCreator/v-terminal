# Daemon Stability & Performance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 13 stability and performance issues in the v-terminal daemon — deadlock risk, race conditions, zombie processes, wasteful encoding, and more.

**Architecture:** The daemon (`src-tauri/src/bin/daemon.rs`) is a standalone TCP server managing PTY sessions. The Tauri app connects via `DaemonClient` (`src-tauri/src/daemon/client.rs`). The frontend (`src/lib/tauriIpc.ts`) dispatches events to terminal panes. Changes flow through all three layers but are grouped to produce compilable intermediate states.

**Tech Stack:** Rust (tokio, serde_json, portable-pty, base64), TypeScript (Tauri IPC)

**Spec:** `docs/superpowers/specs/2026-03-17-daemon-stability-performance-design.md`

---

### Task 1: Add `base64` dependency and optimize Scrollback

**Files:**
- Modify: `src-tauri/Cargo.toml:31` (add dependency)
- Modify: `src-tauri/src/bin/daemon.rs:25-44` (Scrollback struct)

- [ ] **Step 1: Add `base64` crate to Cargo.toml**

In `src-tauri/Cargo.toml`, add after the `uuid` line:

```toml
base64 = "0.22"
```

- [ ] **Step 2: Add `use base64::Engine` import to daemon.rs**

At the top of `src-tauri/src/bin/daemon.rs`, add:

```rust
use base64::Engine;
```

- [ ] **Step 3: Rewrite `Scrollback::push()` to use bulk drain**

Replace the entire `Scrollback` impl block (lines 26-44) with:

```rust
struct Scrollback {
    data: std::collections::VecDeque<u8>,
}
impl Scrollback {
    fn new() -> Self {
        Self { data: std::collections::VecDeque::new() }
    }
    fn push(&mut self, bytes: &[u8]) {
        let overflow = (self.data.len() + bytes.len()).saturating_sub(MAX_SCROLLBACK);
        if overflow > 0 {
            self.data.drain(..overflow);
        }
        self.data.extend(bytes);
    }
    fn snapshot(&self) -> Vec<u8> {
        self.data.iter().cloned().collect()
    }
    fn snapshot_b64(&self) -> String {
        let (a, b) = self.data.as_slices();
        let mut combined = Vec::with_capacity(a.len() + b.len());
        combined.extend_from_slice(a);
        combined.extend_from_slice(b);
        base64::engine::general_purpose::STANDARD.encode(&combined)
    }
}
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds (or warnings only)

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/bin/daemon.rs
git commit -m "perf: optimize scrollback to bulk drain and add base64 dep"
```

---

### Task 2: `AtomicU64` for `last_active` + unsafe safety comments

**Files:**
- Modify: `src-tauri/src/bin/daemon.rs:47-61` (Session struct)
- Modify: `src-tauri/src/bin/daemon.rs:184` (ListSessions last_active read)
- Modify: `src-tauri/src/bin/daemon.rs:290` (Write last_active update)
- Modify: `src-tauri/src/bin/daemon.rs:409` (create_session last_active init)

- [ ] **Step 1: Change Session struct**

Replace the Session struct and unsafe impls (lines 47-61) with:

```rust
struct Session {
    id: String,
    label: String,
    cwd: String,
    created_at: u64,
    last_active: AtomicU64,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    scrollback: Arc<Mutex<Scrollback>>,
    output_tx: broadcast::Sender<Vec<u8>>,
    exit_tx: broadcast::Sender<()>,
}

// SAFETY: All non-Send/Sync fields (writer, master) are wrapped in Arc<Mutex<>>,
// which serializes access. portable_pty types have no interior mutability outside
// the mutex. The MasterPty and writer are never accessed without holding the lock.
unsafe impl Send for Session {}
unsafe impl Sync for Session {}
```

Also add to imports at top of file:

```rust
use std::sync::atomic::AtomicU64;
```

- [ ] **Step 2: Update ListSessions `last_active` read**

In the `ListSessions` handler (around line 184), change:

```rust
last_active: *s.last_active.lock().unwrap(),
```

to:

```rust
last_active: s.last_active.load(Ordering::Relaxed),
```

- [ ] **Step 3: Update Write command `last_active` store**

In the `Write` handler (around line 290), change:

```rust
*session.last_active.lock().unwrap() = now_secs();
```

to:

```rust
session.last_active.store(now_secs(), Ordering::Relaxed);
```

- [ ] **Step 4: Update `create_session` initialization**

In `create_session` (around line 409), change:

```rust
last_active: Arc::new(Mutex::new(created_at)),
```

to:

```rust
last_active: AtomicU64::new(created_at),
```

Remove `Arc::new(Mutex::new(...))` wrapper — `AtomicU64` is directly embeddable.

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/bin/daemon.rs
git commit -m "refactor: use AtomicU64 for last_active and add SAFETY comments"
```

---

### Task 3: Single cleanup coordinator (eliminates `block_on` deadlock + race condition)

This is the most critical structural change. Both the reader task and child watcher task currently use `handle.block_on()` inside `spawn_blocking` and independently call `exit_tx.send()` + `registry.remove()`. We replace this with a single async coordinator task that both signal into.

**Files:**
- Modify: `src-tauri/src/bin/daemon.rs:335-466` (entire `create_session` function)

- [ ] **Step 1: Rewrite the task spawning section of `create_session`**

Replace everything from line 417 (`let registry_clone = registry.clone();`) through line 462 (end of child watcher `spawn_blocking`) with:

```rust
    // --- Session lifecycle tasks ---
    // Both reader and child watcher signal into one coordinator.
    // The coordinator performs cleanup exactly once — no block_on, no race.
    let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<()>(2);
    let alive = Arc::new(AtomicBool::new(true));

    // Cleanup coordinator (async task — no block_on needed)
    let coord_registry = registry.clone();
    let coord_id = id.clone();
    let coord_alive = alive.clone();
    tokio::spawn(async move {
        // Wait for first signal from either reader or child watcher
        done_rx.recv().await;
        coord_alive.store(false, Ordering::Relaxed);
        let _ = exit_tx.send(());
        coord_registry.write().await.remove(&coord_id);
    });

    // Reader task: forwards PTY output and detects EOF-based exit
    let reader_done = done_tx.clone();
    let reader_alive = alive.clone();
    let reader_scrollback = scrollback.clone();
    let reader_output_tx = output_tx.clone();
    tokio::task::spawn_blocking(move || {
        use std::io::Read;
        let mut reader = reader;
        let mut buf = vec![0u8; 8192];
        loop {
            if !reader_alive.load(Ordering::Relaxed) {
                break;
            }
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = buf[..n].to_vec();
                    reader_scrollback.lock().unwrap().push(&data);
                    let _ = reader_output_tx.send(data);
                }
            }
        }
        let _ = reader_done.send(());
    });

    // Child watcher task: detects process exit independently of PTY reader.
    // On Windows, the PTY reader may block even after the shell exits.
    let watcher_done = done_tx;
    tokio::task::spawn_blocking(move || {
        let _ = child.wait();
        let _ = watcher_done.send(());
    });
```

Also remove the now-unused variables that were previously between the session creation and the old task spawning code:
- Remove `let registry_clone = registry.clone();`
- Remove `let id_clone = id.clone();`
- Remove `let handle = tokio::runtime::Handle::current();`
- Remove `let alive_w = alive.clone();`
- Remove `let exit_tx_w = exit_tx.clone();`
- Remove `let registry_w = registry.clone();`
- Remove `let id_w = id.clone();`
- Remove `let handle_w = tokio::runtime::Handle::current();`

Note: The `alive` Arc is now created inside this new block, so also remove the old `let alive = Arc::new(AtomicBool::new(true));` at line 401 (it will be in the new code above).

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/bin/daemon.rs
git commit -m "fix: replace block_on with async cleanup coordinator to prevent deadlock"
```

---

### Task 4: KillSession child process termination

**Files:**
- Modify: `src-tauri/src/bin/daemon.rs` (Session struct, create_session, KillSession handler)

Store the child's process ID in Session. On `KillSession`, use platform-specific process tree kill. The coordinator task's `registry.remove()` will be a no-op when KillSession already removed the session — this is expected and safe.

- [ ] **Step 1: Add `child_pid` to Session struct**

Add to Session struct:

```rust
child_pid: Option<u32>,
```

- [ ] **Step 2: Store child PID in `create_session`**

After `pair.slave.spawn_command(cmd)`, get the process ID:

```rust
let child_pid = child.process_id();
```

Add to Session construction:

```rust
child_pid,
```

- [ ] **Step 3: Update KillSession handler to kill the child process**

Replace the `KillSession` handler (lines 309-331) with:

```rust
        Cmd::KillSession { request_id, session_id } => {
            let removed = {
                let mut reg = registry.write().await;
                reg.remove(session_id)
            };
            if let Some(session) = removed {
                if let Some(task) = sub_tasks.remove(session_id) {
                    task.abort();
                }
                // Kill the child process
                if let Some(pid) = session.child_pid {
                    kill_process_tree(pid);
                }
                // Notify any remaining subscribers
                let _ = session.exit_tx.send(());
                let mut resp = serde_json::json!({"event": "ok"});
                if let Some(rid) = request_id {
                    resp["request_id"] = rid.clone().into();
                }
                send_json(writer, resp).await;
            } else {
                let mut resp =
                    serde_json::json!({"event": "error", "message": "session not found"});
                if let Some(rid) = request_id {
                    resp["request_id"] = rid.clone().into();
                }
                send_json(writer, resp).await;
            }
        }
```

- [ ] **Step 4: Add `kill_process_tree` function**

Add this function to daemon.rs (before or after `now_secs`):

```rust
/// Kill a process and its children.
/// On Windows: uses `taskkill /F /T` for full process tree kill.
/// On Unix: kills only the immediate process (dev-only; tree kill not needed).
fn kill_process_tree(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
    }
    #[cfg(not(windows))]
    {
        // Note: this kills only the immediate process, not the full tree.
        // Acceptable for dev on macOS/Linux; production runs on Windows.
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/bin/daemon.rs
git commit -m "fix: KillSession now terminates child process tree"
```

---

### Task 5: TCP write backpressure per connection

Replace the shared `Arc<Mutex<writer>>` pattern with a bounded mpsc channel and dedicated writer task. This prevents slow clients from blocking the command dispatch loop.

**Files:**
- Modify: `src-tauri/src/bin/daemon.rs:124-166` (handle_conn, send_json)

- [ ] **Step 1: Rewrite `handle_conn` to use a write channel**

Replace `handle_conn` (lines 124-157) with:

```rust
async fn handle_conn(stream: TcpStream, registry: Registry) {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    // Bounded channel for outgoing messages — provides backpressure.
    // If the channel fills (client too slow), output events are dropped.
    let (out_tx, mut out_rx) = tokio::sync::mpsc::channel::<String>(1024);

    // Dedicated writer task: drains the channel and writes to TCP
    let writer_task = tokio::spawn(async move {
        while let Some(line) = out_rx.recv().await {
            if writer.write_all(line.as_bytes()).await.is_err() {
                break;
            }
        }
    });

    let mut sub_tasks: HashMap<String, tokio::task::JoinHandle<()>> = HashMap::new();

    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let cmd = match serde_json::from_str::<Cmd>(trimmed) {
                    Ok(c) => c,
                    Err(e) => {
                        let msg = format!("{{\"event\":\"error\",\"message\":\"{e}\"}}\n");
                        let _ = out_tx.send(msg).await;
                        continue;
                    }
                };
                dispatch(&cmd, &registry, &out_tx, &mut sub_tasks).await;
            }
        }
    }

    for (_, task) in sub_tasks {
        task.abort();
    }
    drop(out_tx); // close writer channel, writer task will exit
    let _ = writer_task.await;
}
```

- [ ] **Step 2: Update `send_json` to use the channel**

Replace `send_json` (lines 159-166) with:

```rust
async fn send_json(
    out_tx: &tokio::sync::mpsc::Sender<String>,
    val: serde_json::Value,
) {
    let mut line = serde_json::to_string(&val).unwrap_or_default();
    line.push('\n');
    // Use try_send for non-critical events (output) to drop if client is slow.
    // Use send().await for critical events (responses) to ensure delivery.
    let _ = out_tx.send(line).await;
}

fn try_send_json(
    out_tx: &tokio::sync::mpsc::Sender<String>,
    val: serde_json::Value,
) {
    let mut line = serde_json::to_string(&val).unwrap_or_default();
    line.push('\n');
    if out_tx.try_send(line).is_err() {
        eprintln!("daemon: output channel full, dropping event");
    }
}
```

- [ ] **Step 3: Update `dispatch` signature**

Change the `dispatch` function signature (line 168-173) from:

```rust
async fn dispatch(
    cmd: &Cmd,
    registry: &Registry,
    writer: &Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>,
    sub_tasks: &mut HashMap<String, tokio::task::JoinHandle<()>>,
) {
```

to:

```rust
async fn dispatch(
    cmd: &Cmd,
    registry: &Registry,
    out_tx: &tokio::sync::mpsc::Sender<String>,
    sub_tasks: &mut HashMap<String, tokio::task::JoinHandle<()>>,
) {
```

Update all `send_json(writer, ...)` calls inside `dispatch` to `send_json(out_tx, ...)`.

- [ ] **Step 4: Update the Attach subscriber task**

In the `Attach` handler, the subscriber task currently clones the writer Arc. Change it to clone the `out_tx` sender instead:

```rust
                let sid = session_id.clone();
                let sub_out_tx = out_tx.clone();
                let task = tokio::spawn(async move {
                    loop {
                        tokio::select! {
                            result = output_rx.recv() => {
                                match result {
                                    Ok(data) => {
                                        let val = serde_json::json!({
                                            "event": "output",
                                            "session_id": sid,
                                            "data": data,
                                        });
                                        try_send_json(&sub_out_tx, val);
                                    }
                                    Err(broadcast::error::RecvError::Closed) => break,
                                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                                }
                            }
                            _ = exit_rx.recv() => {
                                let val = serde_json::json!({
                                    "event": "session_exit",
                                    "session_id": sid,
                                });
                                // Exit events are critical — use send().await
                                let _ = sub_out_tx.send(
                                    serde_json::to_string(&val).unwrap_or_default() + "\n"
                                ).await;
                                break;
                            }
                        }
                    }
                });
```

Note: Use `try_send_json` for high-frequency output events (non-blocking, drops if full). Use direct `send().await` for critical one-time events like `session_exit`.

- [ ] **Step 5: Remove unused import**

The `tokio::sync::Mutex` import for the TCP writer is no longer needed in `handle_conn`. Remove if no other usages remain (but `Session` still uses `std::sync::Mutex`, so that stays).

- [ ] **Step 6: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/bin/daemon.rs
git commit -m "perf: add TCP write backpressure with bounded channel per connection"
```

---

### Task 6: Broadcast capacity increase + session limit

**Files:**
- Modify: `src-tauri/src/bin/daemon.rs:15-16` (constants)
- Modify: `src-tauri/src/bin/daemon.rs:397` (broadcast channel creation)
- Modify: `src-tauri/src/bin/daemon.rs:335-343` (create_session check)

- [ ] **Step 1: Add constants and increase broadcast capacity**

Add after `MAX_SCROLLBACK` constant:

```rust
const MAX_SESSIONS: usize = 64;
const BROADCAST_CAPACITY: usize = 4096;
```

Change the broadcast channel creation (around line 397) from:

```rust
let (output_tx, _) = broadcast::channel::<Vec<u8>>(512);
```

to:

```rust
let (output_tx, _) = broadcast::channel::<Vec<u8>>(BROADCAST_CAPACITY);
```

- [ ] **Step 2: Add session limit check at the start of `create_session`**

At the beginning of `create_session`, after the function signature, add:

```rust
    if registry.read().await.len() >= MAX_SESSIONS {
        return Err("max sessions reached (64)".to_string());
    }
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/bin/daemon.rs
git commit -m "feat: add session limit (64) and increase broadcast capacity to 4096"
```

---

### Task 7: Graceful shutdown

**Files:**
- Modify: `src-tauri/src/bin/daemon.rs:102-122` (main function)

- [ ] **Step 1: Refactor main loop into a function and add signal handling**

Replace the `main` function (lines 102-122) with:

```rust
#[tokio::main]
async fn main() {
    let registry: Registry = Arc::new(tokio::sync::RwLock::new(HashMap::new()));

    let listener = match TcpListener::bind(format!("127.0.0.1:{PORT}")).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("daemon: bind failed: {e}");
            std::process::exit(1);
        }
    };

    eprintln!("v-terminal daemon listening on 127.0.0.1:{PORT}");

    tokio::select! {
        _ = accept_loop(&listener, &registry) => {}
        _ = tokio::signal::ctrl_c() => {
            eprintln!("daemon: received shutdown signal");
        }
    }

    // Graceful shutdown: kill all child processes
    eprintln!("daemon: cleaning up sessions...");
    let reg = registry.write().await;
    for session in reg.values() {
        if let Some(pid) = session.child_pid {
            kill_process_tree(pid);
        }
        let _ = session.exit_tx.send(());
    }
    drop(reg);
    eprintln!("daemon: shutdown complete");
}

async fn accept_loop(listener: &TcpListener, registry: &Registry) {
    loop {
        if let Ok((stream, _)) = listener.accept().await {
            let registry = registry.clone();
            tokio::spawn(handle_conn(stream, registry));
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/bin/daemon.rs
git commit -m "feat: add graceful shutdown with signal handling"
```

---

### Task 8: Base64 protocol — daemon side

Switch all binary data encoding from JSON number arrays to base64 strings. This reduces wire size by ~75%.

**Files:**
- Modify: `src-tauri/src/bin/daemon.rs` (output events, attach scrollback, write command, protocol)

- [ ] **Step 1: Change Write command protocol to accept `data_b64`**

In the `Cmd` enum, change:

```rust
Write { session_id: String, data: Vec<u8> },
```

to:

```rust
Write { session_id: String, data_b64: String },
```

Update the `Write` handler to decode:

```rust
        Cmd::Write { session_id, data_b64 } => {
            let reg = registry.read().await;
            if let Some(session) = reg.get(session_id) {
                match base64::engine::general_purpose::STANDARD.decode(data_b64) {
                    Ok(data) => {
                        if let Ok(mut w) = session.writer.lock() {
                            let _ = w.write_all(&data);
                            session.last_active.store(now_secs(), Ordering::Relaxed);
                        }
                    }
                    Err(e) => {
                        eprintln!("daemon: base64 decode error in write: {e}");
                    }
                }
            }
        }
```

- [ ] **Step 2: Change output events to use base64**

In the Attach subscriber task (as rewritten by Task 5), find the output event inside the `try_send_json` call and change the JSON from `"data": data` to base64:

```rust
                                    Ok(data) => {
                                        let val = serde_json::json!({
                                            "event": "output",
                                            "session_id": sid,
                                            "data_b64": base64::engine::general_purpose::STANDARD.encode(&data),
                                        });
                                        try_send_json(&sub_out_tx, val);
                                    }
```

- [ ] **Step 3: Change attach scrollback to use base64**

In the `Attach` handler, change:

```rust
let scrollback = session.scrollback.lock().unwrap().snapshot();
```

to:

```rust
let scrollback_b64 = session.scrollback.lock().unwrap().snapshot_b64();
```

And change the response:

```rust
let mut resp = serde_json::json!({
    "event": "attached",
    "session_id": session_id,
    "scrollback_b64": scrollback_b64,
});
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/bin/daemon.rs
git commit -m "perf: switch daemon protocol to base64 encoding for binary data"
```

---

### Task 9: Broadcast lag resync

When a subscriber falls behind (broadcast channel lagged), send the current scrollback as a resync event instead of silently dropping data.

**Files:**
- Modify: `src-tauri/src/bin/daemon.rs` (Attach handler subscriber task)

- [ ] **Step 1: Pass scrollback reference into subscriber task**

In the `Attach` handler, clone the scrollback Arc before spawning the subscriber task:

```rust
let sub_scrollback = session.scrollback.clone();
```

- [ ] **Step 2: Handle Lagged with resync**

In the subscriber task's `tokio::select!`, replace:

```rust
Err(broadcast::error::RecvError::Lagged(_)) => continue,
```

with:

```rust
Err(broadcast::error::RecvError::Lagged(n)) => {
    eprintln!("subscriber lagged by {n} messages, resyncing");
    let snapshot_b64 = sub_scrollback.lock().unwrap().snapshot_b64();
    let val = serde_json::json!({
        "event": "resync",
        "session_id": sid,
        "scrollback_b64": snapshot_b64,
    });
    // Use try_send to avoid blocking the subscriber loop if the
    // output channel is also full — drop the resync if needed.
    try_send_json(&sub_out_tx, val);
    continue;
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check --bin v-terminal-daemon 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/bin/daemon.rs
git commit -m "fix: handle broadcast lag with scrollback resync instead of silent drop"
```

---

### Task 10: Client-side base64 + pending cleanup

**Files:**
- Modify: `src-tauri/src/daemon/client.rs:107-142` (route_event, reader task)
- Modify: `src-tauri/Cargo.toml` (base64 already added in Task 1)

- [ ] **Step 1: Add base64 import to client.rs**

At the top of `src-tauri/src/daemon/client.rs`, add:

```rust
use base64::Engine;
```

- [ ] **Step 2: Update `route_event` to decode base64 output**

Replace the `"output"` handler in `route_event` (lines 121-133) with:

```rust
        Some("output") => {
            if let (Some(session_id), Some(data_b64)) =
                (val["session_id"].as_str(), val["data_b64"].as_str())
            {
                if let Ok(data) = base64::engine::general_purpose::STANDARD.decode(data_b64) {
                    let _ = app.emit(
                        "pty-data",
                        serde_json::json!({"ptyId": session_id, "data": data}),
                    );
                }
            }
        }
```

- [ ] **Step 3: Add resync event handler**

In `route_event`, add a new match arm after `"session_exit"`:

```rust
        Some("resync") => {
            if let (Some(session_id), Some(scrollback_b64)) =
                (val["session_id"].as_str(), val["scrollback_b64"].as_str())
            {
                if let Ok(data) = base64::engine::general_purpose::STANDARD.decode(scrollback_b64) {
                    let _ = app.emit(
                        "pty-resync",
                        serde_json::json!({"ptyId": session_id, "data": data}),
                    );
                }
            }
        }
```

- [ ] **Step 4: Add pending request cleanup on disconnect**

In the reader task (inside the `tokio::spawn` at lines 43-59), add cleanup after the read loop breaks:

```rust
        tokio::spawn(async move {
            let mut reader = BufReader::new(reader);
            let mut line = String::new();
            loop {
                line.clear();
                match reader.read_line(&mut line).await {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        if let Ok(val) = serde_json::from_str::<Value>(line.trim()) {
                            route_event(val, &pending_clone, &app).await;
                        }
                    }
                }
            }
            // Clean up pending requests — waiters will get RecvError
            pending_clone.lock().await.clear();
            // Signal disconnect; lib.rs watchdog handles reconnection and event emission
            let _ = alive_tx.send(false);
        });
```

- [ ] **Step 5: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check 2>&1 | tail -5`

Note: Use `cargo check` (not `--bin v-terminal-daemon`) to also check the library crate which includes `client.rs`.

Expected: compilation succeeds

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/daemon/client.rs
git commit -m "perf: decode base64 in client, add resync handler, clean pending on disconnect"
```

---

### Task 11: Tauri command bridge — base64 for attach and write

**Files:**
- Modify: `src-tauri/src/commands/daemon_commands.rs:124-145` (daemon_attach)
- Modify: `src-tauri/src/commands/daemon_commands.rs:157-166` (daemon_write)

- [ ] **Step 1: Add base64 import**

At the top of `daemon_commands.rs`, add:

```rust
use base64::Engine;
```

- [ ] **Step 2: Update `daemon_attach` to decode base64 scrollback**

Replace the scrollback extraction in `daemon_attach` (lines 136-143) with:

```rust
    let scrollback = resp["scrollback_b64"]
        .as_str()
        .and_then(|s| base64::engine::general_purpose::STANDARD.decode(s).ok())
        .unwrap_or_default();
    Ok(scrollback)
```

- [ ] **Step 3: Update `daemon_write` to encode base64**

Replace the `daemon_write` function body (lines 162-165) with:

```rust
    let c = client(&state).await?;
    let data_b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    c.fire(serde_json::json!({"cmd": "write", "session_id": session_id, "data_b64": data_b64}));
    Ok(())
```

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check 2>&1 | tail -5`
Expected: compilation succeeds

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/daemon_commands.rs
git commit -m "perf: use base64 encoding in Tauri command bridge for attach and write"
```

---

### Task 12: Frontend — handle base64 and resync events

**Files:**
- Modify: `src/lib/tauriIpc.ts:1-114` (IPC layer)
- Modify: `src/components/TerminalPane/TerminalPane.tsx` (resync handler)

- [ ] **Step 1: Add resync event type and handler registration to tauriIpc.ts**

Add a new interface after `PtyExitPayload`:

```typescript
export interface PtyResyncPayload {
  ptyId: string;
  data: number[];
}
```

Add new maps and listener tracking after `ptyExitListenerPromise`:

```typescript
const ptyResyncHandlers = new Map<string, (data: Uint8Array) => void>();
let ptyResyncUnlisten: UnlistenFn | null = null;
let ptyResyncListenerPromise: Promise<void> | null = null;

async function ensurePtyResyncListener(): Promise<void> {
  if (ptyResyncUnlisten) return;
  if (!ptyResyncListenerPromise) {
    ptyResyncListenerPromise = listen<PtyResyncPayload>("pty-resync", (event) => {
      const { ptyId, data } = event.payload;
      ptyResyncHandlers.get(ptyId)?.(new Uint8Array(data));
    }).then((unlisten) => { ptyResyncUnlisten = unlisten; });
  }
  return ptyResyncListenerPromise;
}
```

Add a new method to the `ipc` object:

```typescript
  async onPtyResync(ptyId: string, handler: (data: Uint8Array) => void): Promise<() => void> {
    await ensurePtyResyncListener();
    ptyResyncHandlers.set(ptyId, handler);
    return () => { ptyResyncHandlers.delete(ptyId); };
  },
```

- [ ] **Step 2: Handle resync in TerminalPane.tsx**

In `TerminalPane.tsx`, where `ipc.onPtyData` is registered (around line 255), add a resync handler right after:

```typescript
unlistenResync = await ipc.onPtyResync(ptyId, (data) => {
  if (disposed) return;
  // Clear terminal and rewrite from scrollback to avoid corruption
  term.reset();
  term.write(data);
});
```

Add `unlistenResync` to the cleanup function and declare it alongside `unlistenData`:

```typescript
let unlistenResync: (() => void) | undefined;
```

In the cleanup/dispose function, add:

```typescript
unlistenResync?.();
```

- [ ] **Step 3: No change needed for `daemonWrite`**

The `Array.from(data)` in `daemonWrite` (line 76) stays as-is. The data flow is:
- Frontend sends `Array.from(data)` → JSON number array → Tauri IPC
- Tauri deserializes to `Vec<u8>` in `daemon_write` (Rust)
- `daemon_write` base64-encodes before sending to daemon (handled in Task 11)

No frontend write-path changes needed.

- [ ] **Step 4: Verify frontend builds**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit 2>&1 | tail -10`
Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauriIpc.ts src/components/TerminalPane/TerminalPane.tsx
git commit -m "feat: add resync event handling in frontend for broadcast lag recovery"
```

---

### Task 13: Final verification — full build check

**Files:** None (verification only)

- [ ] **Step 1: Full Rust compilation check**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal/src-tauri && cargo check 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 2: Full frontend type check**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npx tsc --noEmit 2>&1 | tail -20`
Expected: no errors

- [ ] **Step 3: Review all changes**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && git log --oneline -12`

Expected commits (newest first):
1. `feat: add resync event handling in frontend for broadcast lag recovery`
2. `perf: use base64 encoding in Tauri command bridge for attach and write`
3. `perf: decode base64 in client, add resync handler, clean pending on disconnect`
4. `fix: handle broadcast lag with scrollback resync instead of silent drop`
5. `perf: switch daemon protocol to base64 encoding for binary data`
6. `feat: add graceful shutdown with signal handling`
7. `feat: add session limit (64) and increase broadcast capacity to 4096`
8. `perf: add TCP write backpressure with bounded channel per connection`
9. `fix: KillSession now terminates child process tree`
10. `fix: replace block_on with async cleanup coordinator to prevent deadlock`
11. `refactor: use AtomicU64 for last_active and add SAFETY comments`
12. `perf: optimize scrollback to bulk drain and add base64 dep`
