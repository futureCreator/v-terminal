pub mod cwd_resolver;
pub mod claude_md;
pub mod dashboard;
pub mod file_watcher;
pub mod usage;

use serde::Serialize;

/// Level classification for discovered CLAUDE.md files.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ClaudeMdLevel {
    User,
    Project,
    Directory,
    Parent,
}

/// A discovered CLAUDE.md file with metadata.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMdFile {
    pub path: String,
    pub level: ClaudeMdLevel,
    pub content: String,
    pub last_modified: u64,
    pub readonly: bool,
}

/// Claude Code usage data parsed from stats-cache.json.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageData {
    pub total_cost_usd: f64,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub today_cost_usd: f64,
    pub today_input_tokens: u64,
    pub today_output_tokens: u64,
    pub total_sessions: u64,
    pub total_messages: u64,
    pub models: Vec<ModelUsage>,
}

/// Per-model usage breakdown.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cost_usd: f64,
}

/// Scan a byte buffer for the OSC 7337 CWD marker sequence.
/// Returns (filtered_data, Option<cwd_string>).
/// The marker format is: \x1b]7337;cwd;<path>\x07
pub fn extract_osc_cwd(data: &[u8]) -> (Vec<u8>, Option<String>) {
    let marker_start = b"\x1b]7337;cwd;";
    let marker_end = b"\x07";

    if let Some(start_pos) = find_subsequence(data, marker_start) {
        let cwd_start = start_pos + marker_start.len();
        if let Some(end_offset) = find_subsequence(&data[cwd_start..], marker_end) {
            let cwd_bytes = &data[cwd_start..cwd_start + end_offset];
            let cwd = String::from_utf8_lossy(cwd_bytes).to_string();

            let mut filtered = Vec::with_capacity(data.len());
            filtered.extend_from_slice(&data[..start_pos]);
            filtered.extend_from_slice(&data[cwd_start + end_offset + marker_end.len()..]);

            return (filtered, Some(cwd));
        }
    }

    (data.to_vec(), None)
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}
