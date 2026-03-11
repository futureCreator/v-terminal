use std::collections::HashMap;
use std::io::Write;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use serde::{Deserialize, Serialize};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use uuid::Uuid;

const PORT: u16 = 57320;
const MAX_SCROLLBACK: usize = 4 * 1024 * 1024; // 4MB

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
        for &b in bytes {
            if self.data.len() >= MAX_SCROLLBACK {
                self.data.pop_front();
            }
            self.data.push_back(b);
        }
    }
    fn snapshot(&self) -> Vec<u8> {
        self.data.iter().cloned().collect()
    }
}

// ----------- Session -----------
struct Session {
    id: String,
    label: String,
    cwd: String,
    created_at: u64,
    last_active: Arc<Mutex<u64>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    scrollback: Arc<Mutex<Scrollback>>,
    output_tx: broadcast::Sender<Vec<u8>>,
    exit_tx: broadcast::Sender<()>,
}

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
    Write { session_id: String, data: Vec<u8> },
    Resize { session_id: String, cols: u16, rows: u16 },
    KillSession {
        request_id: Option<String>,
        session_id: String,
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

    loop {
        if let Ok((stream, _)) = listener.accept().await {
            let registry = registry.clone();
            tokio::spawn(handle_conn(stream, registry));
        }
    }
}

async fn handle_conn(stream: TcpStream, registry: Registry) {
    let (reader, writer) = stream.into_split();
    let writer = Arc::new(tokio::sync::Mutex::new(writer));
    let mut reader = BufReader::new(reader);

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
                        let _ = writer.lock().await.write_all(msg.as_bytes()).await;
                        continue;
                    }
                };
                dispatch(&cmd, &registry, &writer, &mut sub_tasks).await;
            }
        }
    }

    for (_, task) in sub_tasks {
        task.abort();
    }
}

async fn send_json(
    writer: &Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>,
    val: serde_json::Value,
) {
    let mut line = serde_json::to_string(&val).unwrap_or_default();
    line.push('\n');
    let _ = writer.lock().await.write_all(line.as_bytes()).await;
}

async fn dispatch(
    cmd: &Cmd,
    registry: &Registry,
    writer: &Arc<tokio::sync::Mutex<tokio::net::tcp::OwnedWriteHalf>>,
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
                    last_active: *s.last_active.lock().unwrap(),
                })
                .collect();
            let mut resp = serde_json::json!({"event": "sessions", "sessions": sessions});
            if let Some(rid) = request_id {
                resp["request_id"] = rid.clone().into();
            }
            send_json(writer, resp).await;
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
                    send_json(writer, resp).await;
                }
                Err(e) => {
                    let mut resp = serde_json::json!({"event": "error", "message": e});
                    if let Some(rid) = request_id {
                        resp["request_id"] = rid.clone().into();
                    }
                    send_json(writer, resp).await;
                }
            }
        }

        Cmd::Attach { request_id, session_id } => {
            let reg = registry.read().await;
            if let Some(session) = reg.get(session_id) {
                let scrollback = session.scrollback.lock().unwrap().snapshot();
                let mut output_rx = session.output_tx.subscribe();
                let mut exit_rx = session.exit_tx.subscribe();
                drop(reg);

                let mut resp = serde_json::json!({
                    "event": "attached",
                    "session_id": session_id,
                    "scrollback": scrollback,
                });
                if let Some(rid) = request_id {
                    resp["request_id"] = rid.clone().into();
                }
                send_json(writer, resp).await;

                let sid = session_id.clone();
                let writer_clone = writer.clone();
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
                                        send_json(&writer_clone, val).await;
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
                                send_json(&writer_clone, val).await;
                                break;
                            }
                        }
                    }
                });
                sub_tasks.insert(session_id.clone(), task);
            } else {
                drop(reg);
                let mut resp = serde_json::json!({
                    "event": "error",
                    "message": format!("session not found: {session_id}"),
                });
                if let Some(rid) = request_id {
                    resp["request_id"] = rid.clone().into();
                }
                send_json(writer, resp).await;
            }
        }

        Cmd::Detach { session_id } => {
            if let Some(task) = sub_tasks.remove(session_id) {
                task.abort();
            }
        }

        Cmd::Write { session_id, data } => {
            let reg = registry.read().await;
            if let Some(session) = reg.get(session_id) {
                if let Ok(mut w) = session.writer.lock() {
                    let _ = w.write_all(data);
                    *session.last_active.lock().unwrap() = now_secs();
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

        Cmd::KillSession { request_id, session_id } => {
            let removed = {
                let mut reg = registry.write().await;
                reg.remove(session_id).is_some()
            };
            if removed {
                if let Some(task) = sub_tasks.remove(session_id) {
                    task.abort();
                }
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
    let id = Uuid::new_v4().to_string();

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| format!("openpty: {e}"))?;

    let shell = shell_program.unwrap_or_else(|| {
        #[cfg(windows)]
        { std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string()) }
        #[cfg(not(windows))]
        { std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string()) }
    });
    let mut cmd = CommandBuilder::new(&shell);
    if let Some(args) = shell_args {
        for arg in args {
            cmd.arg(&arg);
        }
    }
    cmd.cwd(&cwd);

    let child = pair.slave.spawn_command(cmd).map_err(|e| format!("spawn: {e}"))?;

    let writer_box = pair.master.take_writer().map_err(|e| format!("take_writer: {e}"))?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("clone_reader: {e}"))?;

    let (output_tx, _) = broadcast::channel::<Vec<u8>>(512);
    let (exit_tx, _) = broadcast::channel::<()>(1);

    let scrollback = Arc::new(Mutex::new(Scrollback::new()));
    let alive = Arc::new(AtomicBool::new(true));
    let created_at = now_secs();

    let session = Arc::new(Session {
        id: id.clone(),
        label,
        cwd,
        created_at,
        last_active: Arc::new(Mutex::new(created_at)),
        writer: Arc::new(Mutex::new(writer_box)),
        master: Arc::new(Mutex::new(pair.master)),
        scrollback: scrollback.clone(),
        output_tx: output_tx.clone(),
        exit_tx: exit_tx.clone(),
    });

    let registry_clone = registry.clone();
    let id_clone = id.clone();
    let handle = tokio::runtime::Handle::current();

    // Clone for child watcher before reader task moves them
    let alive_w = alive.clone();
    let exit_tx_w = exit_tx.clone();

    // Reader task: forwards PTY output and detects EOF-based exit
    tokio::task::spawn_blocking(move || {
        use std::io::Read;
        let mut reader = reader;
        let mut buf = vec![0u8; 8192];
        loop {
            if !alive.load(Ordering::Relaxed) {
                break;
            }
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = buf[..n].to_vec();
                    scrollback.lock().unwrap().push(&data);
                    let _ = output_tx.send(data);
                }
            }
        }
        let _ = exit_tx.send(());
        handle.block_on(async {
            registry_clone.write().await.remove(&id_clone);
        });
    });

    // Child watcher task: detects process exit independently of PTY reader.
    // On Windows, the PTY reader may block even after the shell exits (e.g. after
    // typing `exit` in PowerShell), so we watch the child process directly.
    let registry_w = registry.clone();
    let id_w = id.clone();
    let handle_w = tokio::runtime::Handle::current();
    tokio::task::spawn_blocking(move || {
        let _ = child.wait();
        alive_w.store(false, Ordering::Relaxed);
        let _ = exit_tx_w.send(());
        handle_w.block_on(async {
            registry_w.write().await.remove(&id_w);
        });
    });

    registry.write().await.insert(id.clone(), session);
    Ok(id)
}
