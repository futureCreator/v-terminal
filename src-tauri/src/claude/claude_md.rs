use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::{ClaudeMdFile, ClaudeMdLevel};

/// Discover all CLAUDE.md files for a given CWD on the local filesystem.
pub fn discover_local(cwd: &str) -> Result<Vec<ClaudeMdFile>, String> {
    let mut files = Vec::new();
    let cwd_path = PathBuf::from(cwd);

    // 1. User-level: ~/.claude/CLAUDE.md
    if let Some(home) = dirs::home_dir() {
        let user_path = home.join(".claude").join("CLAUDE.md");
        if let Some(f) = read_local_claude_md(&user_path, ClaudeMdLevel::User) {
            files.push(f);
        }
    }

    // 2. Walk from CWD up to root, collecting CLAUDE.md files
    let mut project_root: Option<PathBuf> = None;
    let mut current = cwd_path.clone();
    let mut parent_files: Vec<(PathBuf, ClaudeMdFile)> = Vec::new();
    loop {
        if project_root.is_none() && current.join(".git").exists() {
            project_root = Some(current.clone());
        }

        let claude_md = current.join("CLAUDE.md");
        if claude_md.exists() {
            if let Some(f) = read_local_claude_md(&claude_md, ClaudeMdLevel::Parent) {
                parent_files.push((current.clone(), f));
            }
        }

        if !current.pop() {
            break;
        }
    }

    // Assign correct levels now that project root is known
    let root = project_root.clone().unwrap_or(cwd_path.clone());
    for (dir, file) in &mut parent_files {
        if *dir == root {
            file.level = ClaudeMdLevel::Project;
        }
    }

    parent_files.reverse();
    files.extend(parent_files.into_iter().map(|(_, f)| f));

    // 3. <project-root>/.claude/CLAUDE.md
    let dir_level_path = root.join(".claude").join("CLAUDE.md");
    if dir_level_path.exists() {
        if let Some(f) = read_local_claude_md(&dir_level_path, ClaudeMdLevel::Directory) {
            if !files.iter().any(|existing| existing.path == f.path) {
                files.push(f);
            }
        }
    }

    Ok(files)
}

fn read_local_claude_md(path: &Path, level: ClaudeMdLevel) -> Option<ClaudeMdFile> {
    let content = std::fs::read_to_string(path).ok()?;
    let metadata = std::fs::metadata(path).ok()?;
    let mtime = metadata
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_secs();
    let readonly = metadata.permissions().readonly();

    Some(ClaudeMdFile {
        path: path.to_string_lossy().to_string(),
        level,
        content,
        last_modified: mtime,
        readonly,
    })
}

/// Read a single CLAUDE.md file by path (local).
pub fn read_local(path: &str) -> Result<ClaudeMdFile, String> {
    let p = Path::new(path);
    read_local_claude_md(p, ClaudeMdLevel::Project)
        .ok_or_else(|| format!("failed to read: {path}"))
}

/// Write content to a CLAUDE.md file (local).
pub fn write_local(path: &str, content: &str, expected_mtime: Option<u64>) -> Result<(), String> {
    let p = Path::new(path);

    if let Some(expected) = expected_mtime {
        if let Ok(metadata) = std::fs::metadata(p) {
            if let Ok(modified) = metadata.modified() {
                if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
                    let current_mtime = duration.as_secs();
                    if current_mtime != expected {
                        return Err("{\"code\":\"CONFLICT\",\"message\":\"file modified externally\"}".to_string());
                    }
                }
            }
        }
    }

    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create directory: {e}"))?;
    }

    std::fs::write(p, content).map_err(|e| format!("write failed: {e}"))
}

// ── SFTP operations (stubbed — exact russh-sftp 2.0 API needs verification) ──

/// Discover CLAUDE.md files on a remote host via SFTP.
pub async fn discover_sftp(
    _sftp: &russh_sftp::client::SftpSession,
    cwd: &str,
    _home_dir: &str,
) -> Result<Vec<ClaudeMdFile>, String> {
    // TODO: Implement SFTP discovery once russh-sftp 2.0 API is verified.
    // The logic mirrors discover_local but uses SFTP operations:
    // 1. Check ~/.claude/CLAUDE.md via SFTP
    // 2. Walk from CWD up to root
    // 3. Check <project-root>/.claude/CLAUDE.md
    Err(format!("SFTP CLAUDE.md discovery not yet implemented for CWD: {cwd}"))
}

/// Write content to a remote file via SFTP.
pub async fn write_sftp(
    _sftp: &russh_sftp::client::SftpSession,
    path: &str,
    _content: &str,
    _expected_mtime: Option<u64>,
) -> Result<(), String> {
    // TODO: Implement SFTP write once russh-sftp 2.0 API is verified.
    Err(format!("SFTP write not yet implemented for: {path}"))
}
