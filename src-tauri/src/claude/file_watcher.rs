use std::collections::HashMap;
use std::path::PathBuf;

use notify::{RecommendedWatcher, Watcher, RecursiveMode, EventKind};
use tauri::{AppHandle, Emitter};
use tokio::task::JoinHandle;

/// Manages file watchers for CLAUDE.md files.
pub struct ClaudeMdWatcher {
    app: AppHandle,
    local_watcher: Option<RecommendedWatcher>,
    local_paths: Vec<PathBuf>,
    ssh_poll_tasks: HashMap<String, JoinHandle<()>>,
}

impl ClaudeMdWatcher {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            local_watcher: None,
            local_paths: Vec::new(),
            ssh_poll_tasks: HashMap::new(),
        }
    }

    pub fn watch_local(&mut self, paths: Vec<String>) -> Result<(), String> {
        let app = self.app.clone();

        if self.local_watcher.is_none() {
            let app_clone = app.clone();
            let watcher = notify::recommended_watcher(move |res: Result<notify::Event, _>| {
                if let Ok(event) = res {
                    if matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                        for path in &event.paths {
                            let _ = app_clone.emit(
                                "claude-md-changed",
                                serde_json::json!({ "path": path.to_string_lossy() }),
                            );
                        }
                    }
                }
            })
            .map_err(|e| format!("failed to create watcher: {e}"))?;
            self.local_watcher = Some(watcher);
        }

        let watcher = self.local_watcher.as_mut().unwrap();
        for path_str in &paths {
            let path = PathBuf::from(path_str);
            if !self.local_paths.contains(&path) {
                watcher
                    .watch(&path, RecursiveMode::NonRecursive)
                    .map_err(|e| format!("watch failed for {path_str}: {e}"))?;
                self.local_paths.push(path);
            }
        }

        Ok(())
    }

    pub fn unwatch(&mut self, session_id: &str) {
        if let Some(task) = self.ssh_poll_tasks.remove(session_id) {
            task.abort();
        }
        if let Some(watcher) = &mut self.local_watcher {
            for path in self.local_paths.drain(..) {
                let _ = watcher.unwatch(&path);
            }
        }
    }

    pub fn unwatch_all(&mut self) {
        for (_, task) in self.ssh_poll_tasks.drain() {
            task.abort();
        }
        self.local_watcher = None;
        self.local_paths.clear();
    }
}
