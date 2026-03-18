use std::process::Command;
use crate::git::GitStatusResult;
use crate::git::parser;

pub fn status(cwd: &str) -> Result<GitStatusResult, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not a git repository") {
            return Ok(GitStatusResult {
                staged: vec![],
                unstaged: vec![],
                is_git_repo: false,
            });
        }
        return Err(format!("git status failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parser::parse_status(&stdout))
}

pub fn diff(cwd: &str, file: &str, staged: bool) -> Result<String, String> {
    let mut args = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(file);

    let output = Command::new("git")
        .args(&args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // For untracked files, git diff returns empty. Read file and format as all-added.
    if stdout.is_empty() && !staged {
        let file_path = std::path::Path::new(cwd).join(file);
        if let Ok(content) = std::fs::read_to_string(&file_path) {
            let mut result = format!("--- /dev/null\n+++ b/{}\n", file);
            let lines: Vec<&str> = content.lines().collect();
            result.push_str(&format!("@@ -0,0 +1,{} @@\n", lines.len()));
            for line in &lines {
                result.push('+');
                result.push_str(line);
                result.push('\n');
            }
            return Ok(result);
        }
    }

    // Truncate large diffs (>10,000 lines)
    let line_count = stdout.lines().count();
    if line_count > 10_000 {
        let truncated: String = stdout.lines().take(10_000).collect::<Vec<_>>().join("\n");
        return Ok(format!("{}\n\n--- Diff too large to display ({} lines, showing first 10,000) ---", truncated, line_count));
    }

    Ok(stdout)
}
