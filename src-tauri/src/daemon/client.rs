use std::collections::HashMap;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::{Mutex, oneshot, watch};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

#[derive(Clone)]
pub struct DaemonClient {
    write_tx: tokio::sync::mpsc::UnboundedSender<String>,
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>,
    alive_rx: watch::Receiver<bool>,
}

impl DaemonClient {
    pub async fn connect(app: AppHandle) -> Result<Self, String> {
        let stream = TcpStream::connect("127.0.0.1:57320")
            .await
            .map_err(|e| format!("connect: {e}"))?;

        let (reader, writer_half) = stream.into_split();
        let writer_half = Arc::new(Mutex::new(writer_half));
        let pending: Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        let (write_tx, mut write_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
        let (alive_tx, alive_rx) = watch::channel(true);

        // Writer task
        let w = writer_half.clone();
        tokio::spawn(async move {
            while let Some(line) = write_rx.recv().await {
                if w.lock().await.write_all(line.as_bytes()).await.is_err() {
                    break;
                }
            }
        });

        // Reader task
        let pending_clone = pending.clone();
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
            // Signal disconnect; lib.rs watchdog handles reconnection and event emission
            let _ = alive_tx.send(false);
        });

        Ok(Self { write_tx, pending, alive_rx })
    }

    /// Resolves when the TCP connection to the daemon is lost.
    pub async fn wait_for_disconnect(&self) {
        let mut rx = self.alive_rx.clone();
        if !*rx.borrow() {
            return;
        }
        loop {
            match rx.changed().await {
                Ok(()) => {
                    if !*rx.borrow() {
                        return;
                    }
                }
                Err(_) => return,
            }
        }
    }

    pub async fn send(&self, mut cmd: Value) -> Result<Value, String> {
        let request_id = Uuid::new_v4().to_string();
        cmd["request_id"] = Value::String(request_id.clone());

        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(request_id, tx);

        let mut line = serde_json::to_string(&cmd).map_err(|e| e.to_string())?;
        line.push('\n');
        self.write_tx.send(line).map_err(|e| e.to_string())?;

        tokio::time::timeout(std::time::Duration::from_secs(10), rx)
            .await
            .map_err(|_| "request timed out".to_string())?
            .map_err(|e| format!("channel: {e}"))
    }

    pub fn fire(&self, cmd: Value) {
        if let Ok(mut line) = serde_json::to_string(&cmd) {
            line.push('\n');
            let _ = self.write_tx.send(line);
        }
    }
}

async fn route_event(
    val: Value,
    pending: &Arc<Mutex<HashMap<String, oneshot::Sender<Value>>>>,
    app: &AppHandle,
) {
    if let Some(rid) = val.get("request_id").and_then(|v| v.as_str()) {
        let mut lock = pending.lock().await;
        if let Some(tx) = lock.remove(rid) {
            let _ = tx.send(val);
            return;
        }
    }

    match val.get("event").and_then(|v| v.as_str()) {
        Some("output") => {
            if let (Some(session_id), Some(data)) =
                (val["session_id"].as_str(), val["data"].as_array())
            {
                let data: Vec<u8> = data
                    .iter()
                    .filter_map(|v| v.as_u64().map(|n| n as u8))
                    .collect();
                let _ = app.emit(
                    "pty-data",
                    serde_json::json!({"ptyId": session_id, "data": data}),
                );
            }
        }
        Some("session_exit") => {
            if let Some(session_id) = val["session_id"].as_str() {
                let _ = app.emit("pty-exit", serde_json::json!({"ptyId": session_id}));
            }
        }
        _ => {}
    }
}
