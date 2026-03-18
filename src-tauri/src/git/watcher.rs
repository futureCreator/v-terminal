use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub struct GitWatcher {
    watcher: Option<RecommendedWatcher>,
    watched_git_dir: Option<PathBuf>,
}

impl GitWatcher {
    pub fn new() -> Self {
        Self {
            watcher: None,
            watched_git_dir: None,
        }
    }

    pub fn watch(&mut self, git_dir: PathBuf, app: AppHandle) {
        // Stop previous watcher
        self.stop();

        let cwd = git_dir.parent()
            .unwrap_or(&git_dir)
            .to_string_lossy()
            .to_string();

        let last_emit = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(1)));
        let last_emit_clone = Arc::clone(&last_emit);
        let app_clone = app.clone();
        let cwd_clone = cwd.clone();

        let mut watcher = match notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => {
                        let mut last = last_emit_clone.lock().unwrap();
                        if last.elapsed() >= Duration::from_millis(500) {
                            *last = Instant::now();
                            let _ = app_clone.emit(
                                "git-status-changed",
                                serde_json::json!({ "cwd": cwd_clone }),
                            );
                        }
                    }
                    _ => {}
                }
            }
        }) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("Failed to create git watcher: {e}");
                return;
            }
        };

        let index_path = git_dir.join("index");
        let head_path = git_dir.join("HEAD");

        // Watch .git/index and .git/HEAD (non-recursive)
        let _ = watcher.watch(&index_path, RecursiveMode::NonRecursive);
        let _ = watcher.watch(&head_path, RecursiveMode::NonRecursive);

        self.watcher = Some(watcher);
        self.watched_git_dir = Some(git_dir);
    }

    pub fn stop(&mut self) {
        self.watcher = None;
        self.watched_git_dir = None;
    }
}
