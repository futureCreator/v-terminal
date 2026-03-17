use std::collections::HashMap;
use std::io::Write;
use std::sync::Mutex;

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::session::PtySession;

const MAX_SESSIONS: usize = 64;

pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
    pub wsl_distros_cache: std::sync::OnceLock<Vec<String>>,
}

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
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            wsl_distros_cache: std::sync::OnceLock::new(),
        }
    }

    pub fn create(
        &self,
        app: AppHandle,
        cwd: String,
        cols: u16,
        rows: u16,
        shell_program: Option<String>,
        shell_args: Option<Vec<String>>,
    ) -> Result<String, String> {
        {
            let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
            if sessions.len() >= MAX_SESSIONS {
                return Err(format!("session limit reached ({MAX_SESSIONS})"));
            }
        }

        let pty_id = Uuid::new_v4().to_string();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("openpty failed: {e}"))?;

        let shell = shell_program.unwrap_or_else(|| {
            #[cfg(target_os = "windows")]
            {
                std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
            }
            #[cfg(not(target_os = "windows"))]
            {
                std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
            }
        });

        let mut cmd = CommandBuilder::new(&shell);
        if let Some(args) = &shell_args {
            for arg in args {
                cmd.arg(arg);
            }
        }
        cmd.cwd(&cwd);

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("spawn failed: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("take_writer failed: {e}"))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("clone reader failed: {e}"))?;

        let task_app = app.clone();
        let task_id = pty_id.clone();
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
            child,
            _reader_task: reader_task,
        };

        self.sessions
            .lock()
            .map_err(|e| e.to_string())?
            .insert(pty_id.clone(), session);

        Ok(pty_id)
    }

    pub fn write(&self, pty_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get_mut(pty_id) {
            session
                .writer
                .write_all(data)
                .map_err(|e| format!("write failed: {e}"))?;
            Ok(())
        } else {
            Err(format!("PTY session not found: {pty_id}"))
        }
    }

    pub fn resize(&self, pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get(pty_id) {
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

    pub fn kill(&self, pty_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(mut session) = sessions.remove(pty_id) {
            if let Some(pid) = session.child.process_id() {
                kill_process_tree(pid);
            }
            let _ = session.child.kill();
            Ok(())
        } else {
            Err(format!("PTY session not found: {pty_id}"))
        }
    }

    pub fn kill_all(&self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            for (_, mut session) in sessions.drain() {
                if let Some(pid) = session.child.process_id() {
                    kill_process_tree(pid);
                }
                let _ = session.child.kill();
            }
        }
    }
}
