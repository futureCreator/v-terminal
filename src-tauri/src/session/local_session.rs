use std::io::Write;
use std::sync::Mutex as StdMutex;

use async_trait::async_trait;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;

use super::Session;

pub struct LocalSession {
    writer: StdMutex<Box<dyn Write + Send>>,
    master: Box<dyn MasterPty + Send>,
    child: StdMutex<Box<dyn Child + Send + Sync>>,
    _reader_task: JoinHandle<()>,
    session_kind: super::SessionType,
}

// Safety: all mutable fields (writer, child) are wrapped in std::sync::Mutex.
// portable-pty types are not Send on all platforms, but exclusive Mutex access
// guarantees no concurrent use.
unsafe impl Send for LocalSession {}
unsafe impl Sync for LocalSession {}

impl LocalSession {
    pub fn create(
        app: AppHandle,
        session_id: String,
        cwd: &str,
        cols: u16,
        rows: u16,
        shell_program: Option<String>,
        shell_args: Option<Vec<String>>,
        session_type: super::SessionType,
    ) -> Result<Self, String> {
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
        cmd.cwd(cwd);

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
        let task_id = session_id.clone();
        let reader_task = tokio::task::spawn_blocking(move || {
            use std::io::Read;
            let mut buf = vec![0u8; 8192];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data: Vec<u8> = buf[..n].to_vec();
                        let _ = task_app.emit(
                            "session-data",
                            serde_json::json!({
                                "sessionId": task_id,
                                "data": data,
                            }),
                        );
                    }
                    Err(_) => break,
                }
            }
            let _ = task_app.emit(
                "session-exit",
                serde_json::json!({ "sessionId": task_id }),
            );
        });

        Ok(Self {
            master: pair.master,
            writer: StdMutex::new(writer),
            child: StdMutex::new(child),
            _reader_task: reader_task,
            session_kind: session_type,
        })
    }

    pub fn kill_process(&self) {
        if let Ok(mut child) = self.child.lock() {
            if let Some(pid) = child.process_id() {
                kill_process_tree(pid);
            }
            let _ = child.kill();
        }
    }
}

#[async_trait]
impl Session for LocalSession {
    async fn write(&self, data: &[u8]) -> Result<(), String> {
        self.writer
            .lock()
            .map_err(|e| e.to_string())?
            .write_all(data)
            .map_err(|e| format!("write failed: {e}"))
    }

    async fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("resize failed: {e}"))
    }

    async fn kill(&self) -> Result<(), String> {
        self.kill_process();
        Ok(())
    }

    fn session_type(&self) -> super::SessionType {
        self.session_kind
    }

    fn process_id(&self) -> Option<u32> {
        self.child.lock().ok()?.process_id()
    }
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
