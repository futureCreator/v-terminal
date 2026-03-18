use std::process::Command;
use crate::git::GitStatusResult;
use crate::git::parser;

pub fn status(cwd: &str) -> Result<GitStatusResult, String> {
    let output = Command::new("wsl")
        .args(["-e", "git", "-C", cwd, "status", "--porcelain"])
        .output()
        .map_err(|e| format!("Failed to run wsl git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("not a git repository") {
            return Ok(GitStatusResult {
                staged: vec![],
                unstaged: vec![],
                is_git_repo: false,
            });
        }
        return Err(format!("wsl git status failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parser::parse_status(&stdout))
}

pub fn diff(cwd: &str, file: &str, staged: bool) -> Result<String, String> {
    let mut args = vec!["-e", "git", "-C", cwd, "diff"];
    if staged {
        args.push("--cached");
    }
    args.push("--");
    args.push(file);

    let output = Command::new("wsl")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run wsl git diff: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // For untracked files, use /dev/null (available in WSL Linux environment)
    if stdout.is_empty() && !staged {
        let output = Command::new("wsl")
            .args(["-e", "git", "-C", cwd, "diff", "--no-index", "/dev/null", file])
            .output()
            .map_err(|e| format!("Failed to run wsl git diff --no-index: {e}"))?;
        return Ok(String::from_utf8_lossy(&output.stdout).to_string());
    }

    // Truncate large diffs (>10,000 lines)
    let line_count = stdout.lines().count();
    if line_count > 10_000 {
        let truncated: String = stdout.lines().take(10_000).collect::<Vec<_>>().join("\n");
        return Ok(format!("{}\n\n--- Diff too large to display ({} lines, showing first 10,000) ---", truncated, line_count));
    }

    Ok(stdout)
}
