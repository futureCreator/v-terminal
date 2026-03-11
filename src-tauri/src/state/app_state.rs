use crate::daemon::client::DaemonClient;

pub struct AppState {
    pub daemon_client: tokio::sync::Mutex<Option<DaemonClient>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            daemon_client: tokio::sync::Mutex::new(None),
        }
    }
}
