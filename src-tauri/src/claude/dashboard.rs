use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Output types (sent to frontend via IPC) ──

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub today: DaySummary,
    pub yesterday: DaySummary,
    pub model_usage: Vec<ModelUsageEntry>,
    pub cache_hit_rate: f64,
    pub daily_tokens: Vec<DailyTokenEntry>,
    pub total_sessions: u64,
    pub total_messages: u64,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DaySummary {
    pub date: String,
    pub session_count: u64,
    pub message_count: u64,
    pub total_tokens: u64,
    pub tool_call_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsageEntry {
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_creation_tokens: u64,
    pub total_tokens: u64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyTokenEntry {
    pub date: String,
    pub day_label: String,
    pub total_tokens: u64,
    pub is_today: bool,
}

// ── Input types (deserialized from stats-cache.json) ──

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct StatsCache {
    #[serde(default)]
    model_usage: HashMap<String, RawModelUsage>,
    #[serde(default)]
    total_sessions: Option<u64>,
    #[serde(default)]
    total_messages: Option<u64>,
    #[serde(default)]
    daily_model_tokens: Vec<RawDailyModelTokens>,
    #[serde(default)]
    daily_activity: Vec<RawDailyActivity>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RawModelUsage {
    #[serde(default)]
    input_tokens: u64,
    #[serde(default)]
    output_tokens: u64,
    #[serde(default)]
    cache_read_input_tokens: u64,
    #[serde(default)]
    cache_creation_input_tokens: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawDailyModelTokens {
    date: String,
    #[serde(default)]
    tokens_by_model: HashMap<String, u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawDailyActivity {
    date: String,
    #[serde(default)]
    message_count: u64,
    #[serde(default)]
    session_count: u64,
    #[serde(default)]
    tool_call_count: u64,
}

// ── Parsing ──

pub fn parse_dashboard_stats(json_str: &str) -> Result<DashboardStats, String> {
    let cache: StatsCache =
        serde_json::from_str(json_str).map_err(|e| format!("parse error: {e}"))?;

    let today_str = super::usage::chrono_today();
    let yesterday_str = yesterday_date(&today_str);

    // Build DaySummary for today and yesterday
    let today = build_day_summary(&today_str, &cache);
    let yesterday = build_day_summary(&yesterday_str, &cache);

    // Model usage
    let mut grand_total: u64 = 0;
    let mut model_entries: Vec<ModelUsageEntry> = cache
        .model_usage
        .iter()
        .map(|(name, raw)| {
            let total = raw.input_tokens + raw.output_tokens
                + raw.cache_read_input_tokens + raw.cache_creation_input_tokens;
            grand_total += total;
            ModelUsageEntry {
                model: name.clone(),
                input_tokens: raw.input_tokens,
                output_tokens: raw.output_tokens,
                cache_read_tokens: raw.cache_read_input_tokens,
                cache_creation_tokens: raw.cache_creation_input_tokens,
                total_tokens: total,
                percentage: 0.0, // filled below
            }
        })
        .collect();

    // Calculate percentages and sort descending
    for entry in &mut model_entries {
        entry.percentage = if grand_total > 0 {
            (entry.total_tokens as f64 / grand_total as f64) * 100.0
        } else {
            0.0
        };
    }
    model_entries.sort_by(|a, b| b.total_tokens.cmp(&a.total_tokens));

    // Cache hit rate
    let total_cache_read: u64 = cache.model_usage.values().map(|m| m.cache_read_input_tokens).sum();
    let total_input: u64 = cache.model_usage.values().map(|m| m.input_tokens).sum();
    let total_cache_create: u64 = cache.model_usage.values().map(|m| m.cache_creation_input_tokens).sum();
    let cache_denom = total_input + total_cache_read + total_cache_create;
    let cache_hit_rate = if cache_denom > 0 {
        (total_cache_read as f64 / cache_denom as f64) * 100.0
    } else {
        0.0
    };

    // Last 7 days of token data
    let daily_tokens = build_weekly_tokens(&today_str, &cache.daily_model_tokens);

    Ok(DashboardStats {
        today,
        yesterday,
        model_usage: model_entries,
        cache_hit_rate,
        daily_tokens,
        total_sessions: cache.total_sessions.unwrap_or(0),
        total_messages: cache.total_messages.unwrap_or(0),
    })
}

fn build_day_summary(date: &str, cache: &StatsCache) -> DaySummary {
    let activity = cache.daily_activity.iter().find(|a| a.date == date);
    let tokens: u64 = cache
        .daily_model_tokens
        .iter()
        .find(|d| d.date == date)
        .map(|d| d.tokens_by_model.values().sum())
        .unwrap_or(0);

    DaySummary {
        date: date.to_string(),
        session_count: activity.map_or(0, |a| a.session_count),
        message_count: activity.map_or(0, |a| a.message_count),
        total_tokens: tokens,
        tool_call_count: activity.map_or(0, |a| a.tool_call_count),
    }
}

fn build_weekly_tokens(today: &str, daily: &[RawDailyModelTokens]) -> Vec<DailyTokenEntry> {
    let days = last_n_dates(today, 7);
    days.iter()
        .map(|date| {
            let total: u64 = daily
                .iter()
                .find(|d| d.date == *date)
                .map(|d| d.tokens_by_model.values().sum())
                .unwrap_or(0);
            DailyTokenEntry {
                date: date.clone(),
                day_label: weekday_label(date),
                total_tokens: total,
                is_today: date == today,
            }
        })
        .collect()
}

// ── Date utilities (no chrono dependency) ──

fn yesterday_date(today: &str) -> String {
    let parts: Vec<&str> = today.split('-').collect();
    if parts.len() != 3 { return String::new(); }
    let y: i64 = parts[0].parse().unwrap_or(0);
    let m: i64 = parts[1].parse().unwrap_or(0);
    let d: i64 = parts[2].parse().unwrap_or(0);

    let days = date_to_days(y, m, d) - 1;
    days_to_date(days)
}

fn last_n_dates(today: &str, n: usize) -> Vec<String> {
    let parts: Vec<&str> = today.split('-').collect();
    if parts.len() != 3 { return vec![]; }
    let y: i64 = parts[0].parse().unwrap_or(0);
    let m: i64 = parts[1].parse().unwrap_or(0);
    let d: i64 = parts[2].parse().unwrap_or(0);

    let today_days = date_to_days(y, m, d);
    ((today_days - n as i64 + 1)..=today_days)
        .map(days_to_date)
        .collect()
}

fn weekday_label(date: &str) -> String {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() != 3 { return String::new(); }
    let y: i64 = parts[0].parse().unwrap_or(0);
    let m: i64 = parts[1].parse().unwrap_or(0);
    let d: i64 = parts[2].parse().unwrap_or(0);

    let days = date_to_days(y, m, d);
    // epoch (2000-01-01) was a Saturday = 6
    let dow = ((days % 7) + 7) % 7; // 0=Sat
    let labels = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
    labels[dow as usize].to_string()
}

fn date_to_days(y: i64, m: i64, d: i64) -> i64 {
    // Days from a fixed epoch (2000-01-01 = day 0)
    let mut total: i64 = 0;
    for yr in 2000..y {
        total += if super::usage::is_leap(yr) { 366 } else { 365 };
    }
    let month_days = [31, if super::usage::is_leap(y) { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for mi in 0..(m - 1) as usize {
        total += month_days[mi] as i64;
    }
    total + d - 1
}

fn days_to_date(days: i64) -> String {
    let mut remaining = days;
    let mut y: i64 = 2000;
    loop {
        let year_days = if super::usage::is_leap(y) { 366 } else { 365 };
        if remaining < year_days { break; }
        remaining -= year_days;
        y += 1;
    }
    let month_days = [31, if super::usage::is_leap(y) { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m: usize = 0;
    while m < 12 && remaining >= month_days[m] as i64 {
        remaining -= month_days[m] as i64;
        m += 1;
    }
    format!("{:04}-{:02}-{:02}", y, m + 1, remaining + 1)
}

// ── File reading (reuses pattern from usage.rs) ──

pub fn read_local_dashboard() -> Result<DashboardStats, String> {
    let home = dirs::home_dir().ok_or("cannot find home directory")?;
    let path = home.join(".claude").join("stats-cache.json");
    if !path.exists() {
        return Err("stats-cache.json not found".into());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("read error: {e}"))?;
    parse_dashboard_stats(&content)
}

pub async fn read_sftp_dashboard(
    sftp: &russh_sftp::client::SftpSession,
    home_dir: &str,
) -> Result<DashboardStats, String> {
    let path = format!("{home_dir}/.claude/stats-cache.json");
    let data = sftp.read(&path).await.map_err(|e| format!("sftp read: {e}"))?;
    let content = String::from_utf8(data).map_err(|e| format!("utf8: {e}"))?;
    parse_dashboard_stats(&content)
}
