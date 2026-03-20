# Daemon Stability & Performance Improvements

## Overview

Comprehensive audit and fix of the v-terminal background daemon (`src-tauri/src/bin/daemon.rs`) and its client bridge (`src-tauri/src/daemon/client.rs`). Addresses deadlock risks, race conditions, memory inefficiency, and protocol overhead.

## Problem Statement

The daemon has several stability and performance issues that become critical as session count grows:

1. **Deadlock risk**: `block_on()` inside `spawn_blocking` can exhaust the blocking thread pool
2. **Race condition**: Dual cleanup from reader + child watcher tasks
3. **Zombie processes**: `KillSession` doesn't kill the actual child process
4. **`unsafe impl Send/Sync`**: Manual unsafe Send+Sync impls for Session without soundness proof
5. **O(n) per-byte scrollback**: Byte-by-byte push with individual `pop_front()` calls
6. **Wasteful binary encoding**: PTY output as JSON number arrays (4x size inflation) — affects both daemon-to-client and client-to-daemon directions
7. **Full-buffer snapshot copy**: Attach sends entire scrollback as JSON number array
8. **No graceful shutdown**: No signal handling, no session cleanup on exit
9. **Silent data loss**: `broadcast::Lagged` errors silently dropped
10. **No session limit**: Unbounded session creation risks OOM
11. **Pending request leak**: Client HashMap not cleaned on disconnect
12. **No TCP write backpressure**: Slow clients can freeze entire connection
13. **Broadcast channel capacity (512) may be too small** for high-throughput commands

## Design

### 1. Eliminate `block_on()` deadlock risk + Single cleanup coordinator (combines original #1 and #2)

**Current**: Reader and child watcher tasks use `handle.block_on(async { registry.write().await })` inside `spawn_blocking`. Both independently call `exit_tx.send()` and `registry.remove()`, causing duplicate exit events.

**Fix**: Both tasks signal "done" to a single async coordinator via `mpsc` channel. The coordinator performs cleanup exactly once — no `block_on()`, no race.

```rust
let (done_tx, mut done_rx) = tokio::sync::mpsc::channel(2);

// Reader task: on EOF, sends to done_tx
// Child watcher task: on child exit, sends to done_tx

// Single coordinator — spawned as async task, no block_on needed
tokio::spawn(async move {
    done_rx.recv().await; // first signal from either task
    alive.store(false, Ordering::Relaxed);
    let _ = exit_tx.send(());
    registry.write().await.remove(&session_id);
});
```

### 2. KillSession actually kills the child process

**Current**: `KillSession` only removes session from registry. Child process keeps running.

**Fix**: Store a `kill_tx: Arc<Mutex<Option<oneshot::Sender<()>>>>` in `Session`. The child watcher task listens on the receiver and calls `child.kill()` when signaled. On `KillSession`, take and send the kill signal before removing from registry.

**Windows caveat**: `child.kill()` may not kill the entire process tree. On Windows, use `taskkill /F /T /PID` for tree killing when the child spawns subprocesses.

### 3. Remove `unsafe impl Send/Sync` for Session

**Current**: Lines 60-61 have manual `unsafe impl Send for Session` and `unsafe impl Sync for Session` because `portable_pty::MasterPty` may not satisfy `Sync`.

**Fix**: Restructure so that `MasterPty` and writer are accessed only via message-passing from a single owning task, eliminating the need for `Send/Sync` on those types. Alternatively, if `portable_pty` types are proven thread-safe (they're already wrapped in `Arc<Mutex<>>`), keep the unsafe but add `// SAFETY:` comments documenting why it's sound.

Pragmatic approach: Keep `Arc<Mutex<>>` wrappers (which make the interior access serialized), add `// SAFETY:` comments explaining that all access is serialized through the mutex, and audit `portable_pty` source to verify no interior mutability outside the mutex.

### 4. Use `AtomicU64` for `last_active`

**Current**: `last_active: Arc<Mutex<u64>>` — a mutex just for a timestamp counter.

**Fix**: `last_active: Arc<AtomicU64>` with `Ordering::Relaxed` loads/stores. Eliminates mutex contention on every write command.

### 5. Bulk scrollback push

**Current**: Byte-by-byte iteration with individual `pop_front()`.

**Fix**:
```rust
fn push(&mut self, bytes: &[u8]) {
    let overflow = (self.data.len() + bytes.len()).saturating_sub(MAX_SCROLLBACK);
    if overflow > 0 {
        self.data.drain(..overflow);
    }
    self.data.extend(bytes);
}
```

Complexity: O(overflow + bytes.len()) amortized, vs. current O(bytes.len()) with per-byte overhead.

### 6. Base64 encoding for binary data (bidirectional)

**Current**: `Vec<u8>` serialized as JSON number array in both directions.

**Fix**: Use base64 encoding for all binary data:
- **Daemon → Client**: Output events and scrollback use `data_b64` field
- **Client → Daemon**: Write commands use `data_b64` field
- **Frontend**: `tauriIpc.ts` encodes/decodes base64 instead of `Array.from(data)`

Wire format: `"data": [72,101,...]` → `"data_b64": "SGVsbG8="`
Size reduction: ~75% for daemon→client, ~75% for client→daemon.

### 7. Optimize scrollback snapshot for attach

**Current**: Copy entire VecDeque to Vec, then serialize as JSON number array.

**Fix**:
```rust
let scrollback_b64 = {
    let mut sb = session.scrollback.lock().unwrap();
    let slice = sb.data.make_contiguous();
    base64::encode(slice)
};
// Registry read lock already dropped at this point (line 221)
```

Also add `snapshot_b64()` method to Scrollback for reuse in lag resync.

### 8. Graceful shutdown

**Fix**: Wrap the accept loop in `tokio::select!` with signal handling:

```rust
tokio::select! {
    _ = accept_loop(&listener, &registry) => {},
    _ = tokio::signal::ctrl_c() => {
        eprintln!("daemon: shutting down...");
        cleanup_all_sessions(&registry).await;
    }
}
```

On shutdown: kill all child processes, notify connected clients with `{"event": "shutdown"}`, exit cleanly.

### 9. Handle broadcast lag with resync

**Current**: `Err(broadcast::error::RecvError::Lagged(_)) => continue` silently drops output.

**Fix**: The subscriber task needs an `Arc<Mutex<Scrollback>>` reference. On lag, send a resync event with the current scrollback snapshot:

```rust
Err(broadcast::error::RecvError::Lagged(n)) => {
    eprintln!("subscriber lagged by {n} messages, resyncing");
    let snapshot = scrollback_ref.lock().unwrap().snapshot_b64();
    send_json(&writer, json!({
        "event": "resync",
        "session_id": sid,
        "scrollback_b64": snapshot
    })).await;
    continue;
}
```

**Frontend handling**: On `resync` event, clear the terminal and rewrite from scrollback. This avoids partial/corrupted display.

### 10. Session limit

**Fix**: `const MAX_SESSIONS: usize = 64;`

```rust
if registry.read().await.len() >= MAX_SESSIONS {
    return Err("max sessions reached".to_string());
}
```

### 11. Pending request cleanup on disconnect

**Fix**: After the reader loop breaks in `client.rs`, clear the pending HashMap:

```rust
// After read loop breaks:
let mut lock = pending_clone.lock().await;
lock.clear(); // drops all oneshot senders → RecvError for waiters
```

### 12. TCP write backpressure

**Current**: `send_json` holds a mutex on the writer. If a client is slow, the TCP buffer fills and `write_all` blocks, freezing the entire connection.

**Fix**: Add a bounded `mpsc` channel per connection for outgoing messages. A dedicated writer task drains the channel. If the channel is full (client too slow), drop output events (or disconnect the client).

```rust
let (out_tx, mut out_rx) = tokio::sync::mpsc::channel::<String>(1024);

// Writer task
tokio::spawn(async move {
    while let Some(line) = out_rx.recv().await {
        if writer.write_all(line.as_bytes()).await.is_err() {
            break;
        }
    }
});

// Replace send_json with try_send to out_tx
// On channel full: log warning and drop message (or disconnect)
```

### 13. Increase broadcast channel capacity

**Current**: `broadcast::channel::<Vec<u8>>(512)` — at 8KB per message, 512 slots can be consumed in well under a second by high-throughput commands.

**Fix**: Increase to `broadcast::channel::<Vec<u8>>(4096)`. Combined with the lag resync mechanism (#9), this provides much more headroom before resyncs are triggered.

## Files Changed

- `src-tauri/src/bin/daemon.rs` — Main daemon (all fixes)
- `src-tauri/src/daemon/client.rs` — Client bridge (base64 decode, pending cleanup)
- `src-tauri/src/commands/daemon_commands.rs` — Update attach response handling for base64
- `src-tauri/Cargo.toml` — Add `base64` dependency
- `src/lib/tauriIpc.ts` — Base64 encode/decode, handle resync event

## Migration / Compatibility

This is a breaking protocol change (base64 encoding). Both daemon and client must be updated together. Since the daemon is bundled with the app, this is not an issue — they always update together.

## Testing

- Manual: Create multiple sessions, kill sessions, verify no zombie processes remain
- Manual: High-output commands (`yes`, `cat /dev/urandom | xxd`) to test scrollback performance and lag resync
- Manual: Disconnect/reconnect daemon to verify client recovery and pending request cleanup
- Manual: Create 64+ sessions to verify limit enforcement
- Manual: Rapid output test — verify no duplicate exit events
- Manual: Close app during active sessions — verify graceful shutdown kills child processes
