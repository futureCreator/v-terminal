use std::collections::HashMap;
use std::io::Write;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::session::PtySession;

pub struct PtyManager {
    sessions: HashMap<String, PtySession>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn create(
        &mut self,
        app: AppHandle,
        cwd: String,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        let pty_id = Uuid::new_v4().to_string();
        let pty_id_clone = pty_id.clone();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("openpty failed: {e}"))?;

        // Determine shell binary
        #[cfg(target_os = "windows")]
        let shell = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string());
        #[cfg(not(target_os = "windows"))]
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&cwd);

        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("spawn failed: {e}"))?;

        // Take writer before cloning reader (portable-pty requires this order on some platforms)
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("take_writer failed: {e}"))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("clone reader failed: {e}"))?;

        // Spawn blocking reader task: PTY output is a blocking Read
        let task_app = app.clone();
        let task_id = pty_id_clone.clone();
        let reader_task = tokio::task::spawn_blocking(move || {
            use std::io::Read;
            let mut buf = vec![0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data: Vec<u8> = buf[..n].to_vec();
                        let _ = task_app.emit(
                            "pty-data",
                            serde_json::json!({
                                "ptyId": task_id,
                                "data": data,
                            }),
                        );
                    }
                    Err(_) => break,
                }
            }
            let _ = task_app.emit("pty-exit", serde_json::json!({ "ptyId": task_id }));
        });

        let session = PtySession {
            master: pair.master,
            writer,
            _reader_task: reader_task,
        };

        self.sessions.insert(pty_id.clone(), session);
        Ok(pty_id)
    }

    pub fn write(&mut self, pty_id: &str, data: &[u8]) -> Result<(), String> {
        if let Some(session) = self.sessions.get_mut(pty_id) {
            session
                .writer
                .write_all(data)
                .map_err(|e| format!("write failed: {e}"))?;
            Ok(())
        } else {
            Err(format!("PTY session not found: {pty_id}"))
        }
    }

    pub fn resize(&mut self, pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        if let Some(session) = self.sessions.get_mut(pty_id) {
            session
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("resize failed: {e}"))?;
            Ok(())
        } else {
            Err(format!("PTY session not found: {pty_id}"))
        }
    }

    pub fn kill(&mut self, pty_id: &str) {
        self.sessions.remove(pty_id);
    }
}
