use crate::daemon::client::DaemonClient;

pub struct AppState {
    pub daemon_client: tokio::sync::Mutex<Option<DaemonClient>>,
    pub wsl_distros_cache: std::sync::OnceLock<Vec<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            daemon_client: tokio::sync::Mutex::new(None),
            wsl_distros_cache: std::sync::OnceLock::new(),
        }
    }
}
