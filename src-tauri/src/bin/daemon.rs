use std::collections::HashMap;
use std::io::Write;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicU64, Ordering},
};
use base64::Engine;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use uuid::Uuid;

const PORT: u16 = 57320;
const MAX_SCROLLBACK: usize = 4 * 1024 * 1024; // 4MB
const MAX_SESSIONS: usize = 64;
const BROADCAST_CAPACITY: usize = 4096;

/// Kill a process and its children.
fn kill_process_tree(pid: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .creation_flags(0x08000000)
            .output();
    }
    #[cfg(not(windows))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

// ----------- Scrollback -----------
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
    fn snapshot_b64(&self) -> String {
        let (a, b) = self.data.as_slices();
        let mut combined = Vec::with_capacity(a.len() + b.len());
        combined.extend_from_slice(a);
        combined.extend_from_slice(b);
        base64::engine::general_purpose::STANDARD.encode(&combined)
    }
}

// ----------- Session -----------
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
    child_pid: Option<u32>,
}

// SAFETY: All non-Send/Sync fields (writer, master) are wrapped in Arc<Mutex<>>,
// which serializes access. portable_pty types have no interior mutability outside
// the mutex. The MasterPty and writer are never accessed without holding the lock.
unsafe impl Send for Session {}
unsafe impl Sync for Session {}

type Registry = Arc<tokio::sync::RwLock<HashMap<String, Arc<Session>>>>;

// ----------- Protocol -----------
#[derive(Deserialize, Debug)]
#[serde(tag = "cmd", rename_all = "snake_case")]
enum Cmd {
    ListSessions { request_id: Option<String> },
    CreateSession {
        request_id: Option<String>,
        cwd: String,
        cols: u16,
        rows: u16,
        label: Option<String>,
        shell_program: Option<String>,
        shell_args: Option<Vec<String>>,
    },
    Attach {
        request_id: Option<String>,
        session_id: String,
    },
    Detach { session_id: String },
    Write { session_id: String, data_b64: String },
    Resize { session_id: String, cols: u16, rows: u16 },
    KillSession {
        request_id: Option<String>,
        session_id: String,
    },
    Ping {
        request_id: Option<String>,
    },
}

#[derive(Serialize, Clone)]
struct SessionInfo {
    id: String,
    label: String,
    cwd: String,
    created_at: u64,
    last_active: u64,
}

// ----------- Main -----------
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

async fn handle_conn(stream: TcpStream, registry: Registry) {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);

    let (out_tx, mut out_rx) = tokio::sync::mpsc::channel::<String>(1024);

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
    drop(out_tx);
    let _ = writer_task.await;
}

async fn send_json(out_tx: &tokio::sync::mpsc::Sender<String>, val: serde_json::Value) {
    let mut line = serde_json::to_string(&val).unwrap_or_default();
    line.push('\n');
    let _ = out_tx.send(line).await;
}

fn try_send_json(out_tx: &tokio::sync::mpsc::Sender<String>, val: serde_json::Value) {
    let mut line = serde_json::to_string(&val).unwrap_or_default();
    line.push('\n');
    if out_tx.try_send(line).is_err() {
        eprintln!("daemon: output channel full, dropping event");
    }
}

async fn dispatch(
    cmd: &Cmd,
    registry: &Registry,
    out_tx: &tokio::sync::mpsc::Sender<String>,
    sub_tasks: &mut HashMap<String, tokio::task::JoinHandle<()>>,
) {
    match cmd {
        Cmd::ListSessions { request_id } => {
            let reg = registry.read().await;
            let sessions: Vec<SessionInfo> = reg
                .values()
                .map(|s| SessionInfo {
                    id: s.id.clone(),
                    label: s.label.clone(),
                    cwd: s.cwd.clone(),
                    created_at: s.created_at,
                    last_active: s.last_active.load(Ordering::Relaxed),
                })
                .collect();
            let mut resp = serde_json::json!({"event": "sessions", "sessions": sessions});
            if let Some(rid) = request_id {
                resp["request_id"] = rid.clone().into();
            }
            send_json(out_tx, resp).await;
        }

        Cmd::CreateSession { request_id, cwd, cols, rows, label, shell_program, shell_args } => {
            let label = label.clone().unwrap_or_else(|| "Terminal".to_string());
            match create_session(cwd.clone(), *cols, *rows, label, shell_program.clone(), shell_args.clone(), registry).await {
                Ok(session_id) => {
                    let mut resp =
                        serde_json::json!({"event": "session_created", "session_id": session_id});
                    if let Some(rid) = request_id {
                        resp["request_id"] = rid.clone().into();
                    }
                    send_json(out_tx, resp).await;
                }
                Err(e) => {
                    let mut resp = serde_json::json!({"event": "error", "message": e});
                    if let Some(rid) = request_id {
                        resp["request_id"] = rid.clone().into();
                    }
                    send_json(out_tx, resp).await;
                }
            }
        }

        Cmd::Attach { request_id, session_id } => {
            let reg = registry.read().await;
            if let Some(session) = reg.get(session_id) {
                let scrollback_b64 = session.scrollback.lock().unwrap().snapshot_b64();
                let sub_scrollback = session.scrollback.clone();
                let mut output_rx = session.output_tx.subscribe();
                let mut exit_rx = session.exit_tx.subscribe();
                drop(reg);

                let mut resp = serde_json::json!({
                    "event": "attached",
                    "session_id": session_id,
                    "scrollback_b64": scrollback_b64,
                });
                if let Some(rid) = request_id {
                    resp["request_id"] = rid.clone().into();
                }
                send_json(out_tx, resp).await;

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
                                            "data_b64": base64::engine::general_purpose::STANDARD.encode(&data),
                                        });
                                        try_send_json(&sub_out_tx, val);
                                    }
                                    Err(broadcast::error::RecvError::Closed) => break,
                                    Err(broadcast::error::RecvError::Lagged(n)) => {
                                        eprintln!("subscriber lagged by {n} messages, resyncing");
                                        let snapshot_b64 = sub_scrollback.lock().unwrap().snapshot_b64();
                                        let val = serde_json::json!({
                                            "event": "resync",
                                            "session_id": sid,
                                            "scrollback_b64": snapshot_b64,
                                        });
                                        try_send_json(&sub_out_tx, val);
                                        continue;
                                    }
                                }
                            }
                            _ = exit_rx.recv() => {
                                let val = serde_json::json!({
                                    "event": "session_exit",
                                    "session_id": sid,
                                });
                                let _ = sub_out_tx.send(
                                    serde_json::to_string(&val).unwrap_or_default() + "\n"
                                ).await;
                                break;
                            }
                        }
                    }
                });
                if let Some(old) = sub_tasks.insert(session_id.clone(), task) {
                    old.abort();
                }
            } else {
                drop(reg);
                let mut resp = serde_json::json!({
                    "event": "error",
                    "message": format!("session not found: {session_id}"),
                });
                if let Some(rid) = request_id {
                    resp["request_id"] = rid.clone().into();
                }
                send_json(out_tx, resp).await;
            }
        }

        Cmd::Detach { session_id } => {
            if let Some(task) = sub_tasks.remove(session_id) {
                task.abort();
            }
        }

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

        Cmd::Resize { session_id, cols, rows } => {
            let reg = registry.read().await;
            if let Some(session) = reg.get(session_id) {
                if let Ok(master) = session.master.lock() {
                    let _ = master.resize(PtySize {
                        rows: *rows,
                        cols: *cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    });
                }
            }
        }

        Cmd::Ping { request_id } => {
            let mut resp = serde_json::json!({"event": "pong"});
            if let Some(rid) = request_id {
                resp["request_id"] = rid.clone().into();
            }
            send_json(out_tx, resp).await;
        }

        Cmd::KillSession { request_id, session_id } => {
            let removed = {
                let mut reg = registry.write().await;
                reg.remove(session_id)
            };
            if let Some(session) = removed {
                if let Some(task) = sub_tasks.remove(session_id) {
                    task.abort();
                }
                if let Some(pid) = session.child_pid {
                    kill_process_tree(pid);
                }
                let _ = session.exit_tx.send(());
                let mut resp = serde_json::json!({"event": "ok"});
                if let Some(rid) = request_id {
                    resp["request_id"] = rid.clone().into();
                }
                send_json(out_tx, resp).await;
            } else {
                let mut resp = serde_json::json!({"event": "error", "message": "session not found"});
                if let Some(rid) = request_id {
                    resp["request_id"] = rid.clone().into();
                }
                send_json(out_tx, resp).await;
            }
        }
    }
}

async fn create_session(
    cwd: String,
    cols: u16,
    rows: u16,
    label: String,
    shell_program: Option<String>,
    shell_args: Option<Vec<String>>,
    registry: &Registry,
) -> Result<String, String> {
    if registry.read().await.len() >= MAX_SESSIONS {
        return Err("max sessions reached (64)".to_string());
    }

    let id = Uuid::new_v4().to_string();

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("openpty: {e}"))?;

    let shell = shell_program.unwrap_or_else(|| {
        #[cfg(windows)]
        {
            // Search PATH for an executable by name
            fn in_path(exe: &str) -> bool {
                std::env::var("PATH")
                    .unwrap_or_default()
                    .split(';')
                    .any(|dir| std::path::Path::new(dir).join(exe).exists())
            }

            // Prefer PowerShell 7 (pwsh.exe), fall back to Windows PowerShell 5.1, then cmd.exe
            if in_path("pwsh.exe") {
                "pwsh.exe".to_string()
            } else if in_path("powershell.exe")
                || std::path::Path::new(
                    r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
                )
                .exists()
            {
                "powershell.exe".to_string()
            } else {
                std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
            }
        }
        #[cfg(not(windows))]
        {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
        }
    });
    let mut cmd = CommandBuilder::new(&shell);
    if let Some(args) = shell_args {
        for arg in args {
            cmd.arg(&arg);
        }
    }
    cmd.cwd(&cwd);

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| format!("spawn: {e}"))?;
    let child_pid = child.process_id();

    let writer_box = pair.master.take_writer().map_err(|e| format!("take_writer: {e}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("clone_reader: {e}"))?;

    let (output_tx, _) = broadcast::channel::<Vec<u8>>(BROADCAST_CAPACITY);
    let (exit_tx, _) = broadcast::channel::<()>(1);

    let scrollback = Arc::new(Mutex::new(Scrollback::new()));
    let created_at = now_secs();

    let session = Arc::new(Session {
        id: id.clone(),
        label,
        cwd,
        created_at,
        last_active: AtomicU64::new(created_at),
        writer: Arc::new(Mutex::new(writer_box)),
        master: Arc::new(Mutex::new(pair.master)),
        scrollback: scrollback.clone(),
        output_tx: output_tx.clone(),
        exit_tx: exit_tx.clone(),
        child_pid,
    });

    // --- Session lifecycle tasks ---
    let (done_tx, mut done_rx) = tokio::sync::mpsc::channel::<()>(2);
    let alive = Arc::new(AtomicBool::new(true));

    // Cleanup coordinator (async task — no block_on needed)
    let coord_registry = registry.clone();
    let coord_id = id.clone();
    let coord_alive = alive.clone();
    tokio::spawn(async move {
        done_rx.recv().await;
        coord_alive.store(false, Ordering::Relaxed);
        let _ = exit_tx.send(());
        coord_registry.write().await.remove(&coord_id);
    });

    // Reader task
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

    // Child watcher task
    let watcher_done = done_tx;
    tokio::task::spawn_blocking(move || {
        let _ = child.wait();
        let _ = watcher_done.send(());
    });

    registry.write().await.insert(id.clone(), session);
    Ok(id)
}
