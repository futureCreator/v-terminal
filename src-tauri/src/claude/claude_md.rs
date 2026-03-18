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

/// Validate that a path points to a CLAUDE.md file (security: prevent arbitrary file writes).
fn validate_claude_md_path(path: &str) -> Result<(), String> {
    let p = Path::new(path);
    let filename = p.file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("");
    if filename != "CLAUDE.md" {
        return Err(format!("write denied: path must end with CLAUDE.md, got: {path}"));
    }
    Ok(())
}

/// Write content to a CLAUDE.md file (local).
pub fn write_local(path: &str, content: &str, expected_mtime: Option<u64>) -> Result<(), String> {
    validate_claude_md_path(path)?;
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

// ── SFTP operations ──

/// Discover CLAUDE.md files on a remote host via SFTP.
pub async fn discover_sftp(
    sftp: &russh_sftp::client::SftpSession,
    cwd: &str,
    home_dir: &str,
) -> Result<Vec<ClaudeMdFile>, String> {
    let mut files = Vec::new();

    // 1. User-level: ~/.claude/CLAUDE.md
    let user_path = format!("{home_dir}/.claude/CLAUDE.md");
    if let Some(f) = read_sftp_claude_md(sftp, &user_path, ClaudeMdLevel::User).await {
        files.push(f);
    }

    // 2. Walk from CWD up to root
    let mut project_root: Option<String> = None;
    let mut current = cwd.to_string();
    let mut parent_files: Vec<(String, ClaudeMdFile)> = Vec::new();
    loop {
        // Check for .git
        if project_root.is_none() {
            let git_path = format!("{current}/.git");
            if sftp.try_exists(&git_path).await.unwrap_or(false) {
                project_root = Some(current.clone());
            }
        }

        let claude_md = format!("{current}/CLAUDE.md");
        if let Some(f) = read_sftp_claude_md(sftp, &claude_md, ClaudeMdLevel::Parent).await {
            parent_files.push((current.clone(), f));
        }

        // Pop to parent
        match current.rfind('/') {
            Some(0) if current.len() > 1 => {
                current = "/".to_string();
            }
            Some(pos) if pos > 0 => {
                current.truncate(pos);
            }
            _ => break,
        }
    }

    // Assign correct levels
    let root = project_root.clone().unwrap_or_else(|| cwd.to_string());
    for (dir, file) in &mut parent_files {
        if *dir == root {
            file.level = ClaudeMdLevel::Project;
        }
    }

    parent_files.reverse();
    files.extend(parent_files.into_iter().map(|(_, f)| f));

    // 3. <project-root>/.claude/CLAUDE.md
    let dir_path = format!("{root}/.claude/CLAUDE.md");
    if let Some(f) = read_sftp_claude_md(sftp, &dir_path, ClaudeMdLevel::Directory).await {
        if !files.iter().any(|existing| existing.path == f.path) {
            files.push(f);
        }
    }

    Ok(files)
}

/// Read a single CLAUDE.md file via SFTP.
async fn read_sftp_claude_md(
    sftp: &russh_sftp::client::SftpSession,
    path: &str,
    level: ClaudeMdLevel,
) -> Option<ClaudeMdFile> {
    let data = sftp.read(path).await.ok()?;
    let content = String::from_utf8(data).ok()?;
    let attrs = sftp.metadata(path).await.ok()?;
    let mtime = attrs.mtime.unwrap_or(0) as u64;

    Some(ClaudeMdFile {
        path: path.to_string(),
        level,
        content,
        last_modified: mtime,
        readonly: false,
    })
}

/// Write content to a remote file via SFTP with optional mtime check.
pub async fn write_sftp(
    sftp: &russh_sftp::client::SftpSession,
    path: &str,
    content: &str,
    expected_mtime: Option<u64>,
) -> Result<(), String> {
    validate_claude_md_path(path)?;

    // Optimistic concurrency check
    if let Some(expected) = expected_mtime {
        if let Ok(attrs) = sftp.metadata(path).await {
            let current_mtime = attrs.mtime.unwrap_or(0) as u64;
            if current_mtime != expected {
                return Err("{\"code\":\"CONFLICT\",\"message\":\"file modified externally\"}".to_string());
            }
        }
    }

    sftp.write(path, content.as_bytes())
        .await
        .map_err(|e| format!("sftp write failed: {e}"))
}
