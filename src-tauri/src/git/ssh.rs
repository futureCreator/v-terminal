use crate::git::GitStatusResult;
use crate::git::parser;
use crate::session::manager::SessionManager;

pub async fn status(
    state: &SessionManager,
    connection_id: &str,
    cwd: &str,
) -> Result<GitStatusResult, String> {
    let command = format!("cd {} && git status --porcelain", shell_escape(cwd));
    let (stdout, stderr, exit_code) = state.exec_command(connection_id, &command).await?;

    if exit_code != 0 {
        if stderr.contains("not a git repository") {
            return Ok(GitStatusResult {
                staged: vec![],
                unstaged: vec![],
                is_git_repo: false,
            });
        }
        return Err(format!("git status failed: {stderr}"));
    }

    Ok(parser::parse_status(&stdout))
}

pub async fn diff(
    state: &SessionManager,
    connection_id: &str,
    cwd: &str,
    file: &str,
    staged: bool,
) -> Result<String, String> {
    let staged_flag = if staged { " --cached" } else { "" };
    let command = format!(
        "cd {} && git diff{} -- {}",
        shell_escape(cwd),
        staged_flag,
        shell_escape(file)
    );
    let (stdout, stderr, exit_code) = state.exec_command(connection_id, &command).await?;

    if exit_code != 0 && !stderr.is_empty() {
        return Err(format!("git diff failed: {stderr}"));
    }

    // For untracked files
    if stdout.is_empty() && !staged {
        let command = format!(
            "cd {} && git diff --no-index /dev/null {}",
            shell_escape(cwd),
            shell_escape(file)
        );
        let (stdout, _, _) = state.exec_command(connection_id, &command).await?;
        return Ok(stdout);
    }

    // Truncate large diffs (>10,000 lines)
    let line_count = stdout.lines().count();
    if line_count > 10_000 {
        let truncated: String = stdout.lines().take(10_000).collect::<Vec<_>>().join("\n");
        return Ok(format!("{}\n\n--- Diff too large to display ({} lines, showing first 10,000) ---", truncated, line_count));
    }

    Ok(stdout)
}

fn shell_escape(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}
