use std::collections::HashMap;

use serde::Deserialize;

use super::{ModelUsage, UsageData};

/// Raw stats-cache.json structure from Claude Code.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatsCache {
    #[serde(default)]
    model_usage: HashMap<String, RawModelUsage>,
    #[serde(default)]
    total_sessions: Option<u64>,
    #[serde(default)]
    total_messages: Option<u64>,
    #[serde(default)]
    daily_model_tokens: Vec<DailyModelTokens>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawModelUsage {
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default)]
    cache_read_input_tokens: u64,
    #[serde(default)]
    cost_usd: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DailyModelTokens {
    date: String,
    #[serde(default)]
    tokens_by_model: HashMap<String, u64>,
}

fn parse_stats_cache(json_str: &str) -> Result<UsageData, String> {
    let cache: StatsCache =
        serde_json::from_str(json_str).map_err(|e| format!("failed to parse stats-cache.json: {e}"))?;

    let mut total_cost = 0.0;
    let mut total_input = 0u64;
    let mut total_output = 0u64;
    let mut models = Vec::new();

    for (model_name, usage) in &cache.model_usage {
        total_cost += usage.cost_usd;
        total_input += usage.input_tokens;
        total_output += usage.output_tokens;
        models.push(ModelUsage {
            model: model_name.clone(),
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cache_read_tokens: usage.cache_read_input_tokens,
            cost_usd: usage.cost_usd,
        });
    }

    // Sort models by cost descending
    models.sort_by(|a, b| b.cost_usd.partial_cmp(&a.cost_usd).unwrap_or(std::cmp::Ordering::Equal));

    // Get today's token usage
    let today = chrono_today();
    let mut today_input = 0u64;
    let today_output = 0u64;
    let mut today_cost = 0.0;

    if let Some(daily) = cache.daily_model_tokens.iter().find(|d| d.date == today) {
        for (model_name, tokens) in &daily.tokens_by_model {
            today_input += tokens;
            // Estimate today's cost from model_usage proportions
            if let Some(model) = cache.model_usage.get(model_name) {
                let total_model_tokens = model.input_tokens + model.output_tokens;
                if total_model_tokens > 0 {
                    today_cost += model.cost_usd * (*tokens as f64 / total_model_tokens as f64);
                }
            }
        }
    }

    Ok(UsageData {
        total_cost_usd: total_cost,
        total_input_tokens: total_input,
        total_output_tokens: total_output,
        today_cost_usd: today_cost,
        today_input_tokens: today_input,
        today_output_tokens: today_output,
        total_sessions: cache.total_sessions.unwrap_or(0),
        total_messages: cache.total_messages.unwrap_or(0),
        models,
    })
}

/// Get today's date in YYYY-MM-DD format without chrono dependency.
pub fn chrono_today() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    // Simple date calculation (UTC)
    let days = secs / 86400;
    let mut y = 1970i64;
    let mut remaining_days = days as i64;

    loop {
        let year_days = if is_leap(y) { 366 } else { 365 };
        if remaining_days < year_days {
            break;
        }
        remaining_days -= year_days;
        y += 1;
    }

    let month_days = if is_leap(y) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut m = 0;
    for (i, &md) in month_days.iter().enumerate() {
        if remaining_days < md as i64 {
            m = i;
            break;
        }
        remaining_days -= md as i64;
    }

    format!("{:04}-{:02}-{:02}", y, m + 1, remaining_days + 1)
}

pub fn is_leap(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// Read Claude Code usage data from the local filesystem.
pub fn read_local_usage() -> Result<UsageData, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    let stats_path = home.join(".claude").join("stats-cache.json");

    if !stats_path.exists() {
        return Err("Claude Code stats not found (~/.claude/stats-cache.json missing)".to_string());
    }

    let json_str = std::fs::read_to_string(&stats_path)
        .map_err(|e| format!("failed to read stats-cache.json: {e}"))?;

    parse_stats_cache(&json_str)
}

/// Read Claude Code usage data from a remote host via SFTP.
pub async fn read_sftp_usage(
    sftp: &russh_sftp::client::SftpSession,
    home_dir: &str,
) -> Result<UsageData, String> {
    let stats_path = format!("{home_dir}/.claude/stats-cache.json");

    let data = sftp.read(&stats_path).await
        .map_err(|e| format!("failed to read remote stats-cache.json: {e}"))?;

    let json_str = String::from_utf8(data)
        .map_err(|e| format!("invalid utf8 in stats-cache.json: {e}"))?;

    parse_stats_cache(&json_str)
}
