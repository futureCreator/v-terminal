use async_trait::async_trait;
use russh::ChannelMsg;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use super::Session;

enum ChannelCommand {
    Data(Vec<u8>),
    Resize(u32, u32),
    Kill,
}

pub struct SshSession {
    cmd_tx: mpsc::UnboundedSender<ChannelCommand>,
    pub connection_id: String,
    _task: JoinHandle<()>,
}

impl SshSession {
    pub async fn create(
        app: AppHandle,
        session_id: String,
        connection_id: String,
        handle: &russh::client::Handle<super::ssh_pool::SshClientHandler>,
        cols: u16,
        rows: u16,
    ) -> Result<Self, String> {
        let mut channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("channel open failed: {e}"))?;
        channel
            .request_pty(
                true,
                "xterm-256color",
                cols as u32,
                rows as u32,
                0,
                0,
                &[],
            )
            .await
            .map_err(|e| format!("request_pty failed: {e}"))?;
        channel
            .request_shell(true)
            .await
            .map_err(|e| format!("request_shell failed: {e}"))?;

        let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<ChannelCommand>();
        let task_app = app.clone();
        let task_session_id = session_id.clone();

        let task = tokio::spawn(async move {
            let mut exit_code: Option<u32> = None;
            loop {
                tokio::select! {
                    msg = channel.wait() => {
                        match msg {
                            Some(ChannelMsg::Data { ref data }) => {
                                let bytes: Vec<u8> = data.to_vec();
                                let (filtered, cwd) = crate::claude::extract_osc_cwd(&bytes);
                                if let Some(cwd_path) = cwd {
                                    let _ = task_app.emit(
                                        "session-cwd",
                                        serde_json::json!({"sessionId": task_session_id, "cwd": cwd_path}),
                                    );
                                }
                                if !filtered.is_empty() {
                                    let _ = task_app.emit(
                                        "session-data",
                                        serde_json::json!({"sessionId": task_session_id, "data": filtered}),
                                    );
                                }
                            }
                            Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                                let bytes: Vec<u8> = data.to_vec();
                                let (filtered, cwd) = crate::claude::extract_osc_cwd(&bytes);
                                if let Some(cwd_path) = cwd {
                                    let _ = task_app.emit(
                                        "session-cwd",
                                        serde_json::json!({"sessionId": task_session_id, "cwd": cwd_path}),
                                    );
                                }
                                if !filtered.is_empty() {
                                    let _ = task_app.emit(
                                        "session-data",
                                        serde_json::json!({"sessionId": task_session_id, "data": filtered}),
                                    );
                                }
                            }
                            Some(ChannelMsg::ExitStatus { exit_status }) => {
                                exit_code = Some(exit_status);
                            }
                            Some(ChannelMsg::Eof) | None => {
                                let _ = task_app.emit(
                                    "session-exit",
                                    serde_json::json!({"sessionId": task_session_id, "code": exit_code}),
                                );
                                break;
                            }
                            _ => {}
                        }
                    }
                    cmd = cmd_rx.recv() => {
                        match cmd {
                            Some(ChannelCommand::Data(data)) => {
                                let _ = channel.data(&data[..]).await;
                            }
                            Some(ChannelCommand::Resize(cols, rows)) => {
                                let _ = channel.window_change(cols, rows, 0, 0).await;
                            }
                            Some(ChannelCommand::Kill) => {
                                let _ = channel.eof().await;
                                let _ = channel.close().await;
                                break;
                            }
                            None => break,
                        }
                    }
                }
            }
        });

        Ok(Self {
            cmd_tx,
            connection_id,
            _task: task,
        })
    }
}

#[async_trait]
impl Session for SshSession {
    async fn write(&self, data: &[u8]) -> Result<(), String> {
        self.cmd_tx
            .send(ChannelCommand::Data(data.to_vec()))
            .map_err(|_| "ssh session closed".to_string())
    }

    async fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.cmd_tx
            .send(ChannelCommand::Resize(cols as u32, rows as u32))
            .map_err(|_| "ssh session closed".to_string())
    }

    async fn kill(&self) -> Result<(), String> {
        let _ = self.cmd_tx.send(ChannelCommand::Kill);
        Ok(())
    }

    fn session_type(&self) -> super::SessionType {
        super::SessionType::Ssh
    }

    fn connection_id(&self) -> Option<String> {
        Some(self.connection_id.clone())
    }
}
