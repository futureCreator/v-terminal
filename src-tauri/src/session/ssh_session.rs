use std::sync::Arc;

use async_trait::async_trait;
use russh::ChannelMsg;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

use super::Session;

pub struct SshSession {
    channel: Arc<Mutex<russh::Channel<russh::client::Msg>>>,
    pub connection_id: String,
    _reader_task: JoinHandle<()>,
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
        let channel = handle
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

        let channel = Arc::new(Mutex::new(channel));
        let reader_channel = channel.clone();
        let task_app = app.clone();
        let task_session_id = session_id.clone();

        let reader_task = tokio::spawn(async move {
            let mut exit_code: Option<u32> = None;
            loop {
                let msg = { reader_channel.lock().await.wait().await };
                match msg {
                    Some(ChannelMsg::Data { ref data }) => {
                        let bytes: Vec<u8> = data.to_vec();
                        let _ = task_app.emit(
                            "session-data",
                            serde_json::json!({"sessionId": task_session_id, "data": bytes}),
                        );
                    }
                    Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                        let bytes: Vec<u8> = data.to_vec();
                        let _ = task_app.emit(
                            "session-data",
                            serde_json::json!({"sessionId": task_session_id, "data": bytes}),
                        );
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
        });

        Ok(Self {
            channel,
            connection_id,
            _reader_task: reader_task,
        })
    }
}

#[async_trait]
impl Session for SshSession {
    async fn write(&self, data: &[u8]) -> Result<(), String> {
        self.channel
            .lock()
            .await
            .data(&data[..])
            .await
            .map_err(|e| format!("ssh write failed: {e}"))
    }

    async fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.channel
            .lock()
            .await
            .window_change(cols as u32, rows as u32, 0, 0)
            .await
            .map_err(|e| format!("ssh resize failed: {e}"))
    }

    async fn kill(&self) -> Result<(), String> {
        let channel = self.channel.lock().await;
        let _ = channel.eof().await;
        let _ = channel.close().await;
        Ok(())
    }

    fn session_type(&self) -> super::SessionType {
        super::SessionType::Ssh
    }

    fn connection_id(&self) -> Option<String> {
        Some(self.connection_id.clone())
    }
}
