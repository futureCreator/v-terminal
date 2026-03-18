use super::UsageData;

/// Read Claude Code usage data from the local filesystem.
pub fn read_local_usage() -> Result<UsageData, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    let claude_dir = home.join(".claude");

    if !claude_dir.exists() {
        return Err("Claude Code not installed (~/.claude/ not found)".to_string());
    }

    // TODO: Investigate actual usage data format at implementation time.
    // Claude Code may store usage in ~/.claude/usage.json or similar.
    // For now, return a placeholder error.
    Err("usage data format investigation required".to_string())
}

/// Read Claude Code usage data from a remote host via SFTP.
pub async fn read_sftp_usage(
    _sftp: &russh_sftp::client::SftpSession,
    home_dir: &str,
) -> Result<UsageData, String> {
    let _usage_dir = format!("{home_dir}/.claude");
    Err("SFTP usage data reading not yet implemented".to_string())
}
