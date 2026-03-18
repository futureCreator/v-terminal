# Claude Code Dashboard Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Dashboard tab to the ClaudeCodePanel left sidebar that displays Claude Code usage metrics (today's summary, model distribution, cache efficiency, 7-day trend) from local `stats-cache.json` data.

**Architecture:** Extend the existing Rust `usage.rs` parser to extract `dailyActivity` and `cacheCreationInputTokens` fields, expose a new `get_dashboard_stats` IPC command, and add a React `DashboardTab` component with four CSS-only visualization sections inside the existing `ClaudeCodePanel`.

**Tech Stack:** Rust (serde_json, chrono date math), TypeScript/React, Zustand, Tauri IPC, CSS-only charts

**Spec:** `docs/superpowers/specs/2026-03-18-claude-code-dashboard-design.md`

---

## File Map

### Rust Backend — New Files
- `src-tauri/src/claude/dashboard.rs` — DashboardStats struct, parsing logic that extends existing stats-cache.json reader

### Rust Backend — Modified Files
- `src-tauri/src/claude/mod.rs` — Register `dashboard` module, export `DashboardStats` type
- `src-tauri/src/commands/claude_commands.rs` — Add `get_dashboard_stats` command handler
- `src-tauri/src/lib.rs` — Register `get_dashboard_stats` in `generate_handler!`

### Frontend — New Files
- `src/store/dashboardStore.ts` — Zustand store for dashboard state
- `src/components/ClaudeCodePanel/DashboardTab.tsx` — Main dashboard container
- `src/components/ClaudeCodePanel/DashboardTab.css` — Dashboard styles
- `src/components/ClaudeCodePanel/TodaySummary.tsx` — 2x2 metric cards
- `src/components/ClaudeCodePanel/ModelDistribution.tsx` — Stacked bar + legend
- `src/components/ClaudeCodePanel/CacheEfficiency.tsx` — Progress bar metric
- `src/components/ClaudeCodePanel/WeeklyTrend.tsx` — CSS bar chart

### Frontend — Modified Files
- `src/lib/tauriIpc.ts` — Add `DashboardStats` interface and `getDashboardStats` IPC function
- `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx` — Add Dashboard tab, update `ClaudeCodeTab` type
- `src/components/ClaudeCodePanel/ClaudeCodePanel.css` — Tab styling for 3 tabs
- `src/components/UsageBar/UsageBar.tsx` — Add click handler to open dashboard
- `src/App.tsx` — Register `Ctrl+Shift+D` shortcut

---

## Task 1: Rust Backend — Dashboard Stats Parser

**Files:**
- Create: `src-tauri/src/claude/dashboard.rs`
- Modify: `src-tauri/src/claude/mod.rs`

- [ ] **Step 1: Create `dashboard.rs` with types and parser**

Create `src-tauri/src/claude/dashboard.rs`:

```rust
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
```

- [ ] **Step 2: Register module in `mod.rs`**

In `src-tauri/src/claude/mod.rs`, add `pub mod dashboard;` after the existing module declarations, and add the `DashboardStats` re-export:

```rust
pub mod dashboard;
```

Also make `is_leap` and `chrono_today` public in `usage.rs` so `dashboard.rs` can call them via `super::usage::`:

In `src-tauri/src/claude/usage.rs`, change:
- `fn chrono_today()` → `pub fn chrono_today()`
- `fn is_leap(year: i64)` → `pub fn is_leap(year: i64)`

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: compiles without errors (warnings OK)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/claude/dashboard.rs src-tauri/src/claude/mod.rs src-tauri/src/claude/usage.rs
git commit -m "feat(dashboard): add DashboardStats parser for stats-cache.json"
```

---

## Task 2: Rust Backend — IPC Command Registration

**Files:**
- Modify: `src-tauri/src/commands/claude_commands.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `get_dashboard_stats` command handler**

In `src-tauri/src/commands/claude_commands.rs`, first add the import at the top alongside existing imports:

```rust
use crate::claude::dashboard;
```

Then add after the existing `get_usage` function (around line 79):

```rust
#[tauri::command]
pub async fn get_dashboard_stats(
    state: tauri::State<'_, crate::session::manager::SessionManager>,
    session_id: String,
) -> Result<dashboard::DashboardStats, String> {
    let (session_type, connection_id) = state.get_session_info(&session_id).await?;
    match session_type {
        SessionType::Local | SessionType::Wsl => {
            dashboard::read_local_dashboard()
        }
        SessionType::Ssh => {
            let cid = connection_id.ok_or("no connection id")?;
            let sftp = state.open_sftp(&cid).await?;
            let home = sftp.canonicalize(".").await.unwrap_or_else(|_| "/root".to_string());
            dashboard::read_sftp_dashboard(&sftp, &home).await
        }
    }
}
```

- [ ] **Step 2: Register in `lib.rs`**

In `src-tauri/src/lib.rs`, add `commands::claude_commands::get_dashboard_stats` to the `generate_handler!` macro (after the existing `get_usage` entry):

```rust
commands::claude_commands::get_dashboard_stats,
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5`
Expected: compiles without errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/claude_commands.rs src-tauri/src/lib.rs
git commit -m "feat(dashboard): register get_dashboard_stats IPC command"
```

---

## Task 3: Frontend — IPC Types and Function

**Files:**
- Modify: `src/lib/tauriIpc.ts`

- [ ] **Step 1: Add TypeScript interfaces**

In `src/lib/tauriIpc.ts`, add after the existing `ModelUsageData` interface (around line 69):

```typescript
export interface DashboardStats {
  today: DaySummary;
  yesterday: DaySummary;
  modelUsage: ModelUsageEntry[];
  cacheHitRate: number;
  dailyTokens: DailyTokenEntry[];
  totalSessions: number;
  totalMessages: number;
}

export interface DaySummary {
  date: string;
  sessionCount: number;
  messageCount: number;
  totalTokens: number;
  toolCallCount: number;
}

export interface ModelUsageEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  percentage: number;
}

export interface DailyTokenEntry {
  date: string;
  dayLabel: string;
  totalTokens: number;
  isToday: boolean;
}
```

- [ ] **Step 2: Add IPC function**

In `src/lib/tauriIpc.ts`, add after the existing `getUsage` function (around line 227):

```typescript
async getDashboardStats(sessionId: string): Promise<DashboardStats> {
  return invoke<DashboardStats>("get_dashboard_stats", { sessionId });
},
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/tauriIpc.ts
git commit -m "feat(dashboard): add DashboardStats IPC types and function"
```

---

## Task 4: Frontend — Dashboard Store

**Files:**
- Create: `src/store/dashboardStore.ts`

- [ ] **Step 1: Create the Zustand store**

Create `src/store/dashboardStore.ts`:

```typescript
import { create } from "zustand";
import { ipc, type DashboardStats } from "../lib/tauriIpc";

interface DashboardState {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refresh: (sessionId: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  loading: false,
  error: null,

  refresh: async (sessionId: string) => {
    set({ loading: true, error: null });
    try {
      const stats = await ipc.getDashboardStats(sessionId);
      set({ stats, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/store/dashboardStore.ts
git commit -m "feat(dashboard): add dashboardStore with refresh action"
```

---

## Task 5: Frontend — Dashboard Sub-Components

**Files:**
- Create: `src/components/ClaudeCodePanel/TodaySummary.tsx`
- Create: `src/components/ClaudeCodePanel/ModelDistribution.tsx`
- Create: `src/components/ClaudeCodePanel/CacheEfficiency.tsx`
- Create: `src/components/ClaudeCodePanel/WeeklyTrend.tsx`

- [ ] **Step 1: Create `TodaySummary.tsx`**

```typescript
import type { DaySummary } from "../../lib/tauriIpc";

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  today: DaySummary;
  yesterday: DaySummary;
}

export function TodaySummary({ today, yesterday }: Props) {
  const diff =
    yesterday.totalTokens > 0
      ? ((today.totalTokens - yesterday.totalTokens) / yesterday.totalTokens) * 100
      : 0;
  const diffSign = diff > 0 ? "↑" : diff < 0 ? "↓" : "—";
  const diffClass =
    diff > 0 ? "dash-card-diff--up" : diff < 0 ? "dash-card-diff--down" : "";

  return (
    <div className="dash-summary">
      <div className="dash-card">
        <span className="dash-card-value">{today.sessionCount}</span>
        <span className="dash-card-label">Sessions</span>
      </div>
      <div className="dash-card">
        <span className="dash-card-value">{today.messageCount}</span>
        <span className="dash-card-label">Messages</span>
      </div>
      <div className="dash-card">
        <span className="dash-card-value">{formatNum(today.totalTokens)}</span>
        <span className="dash-card-label">Tokens</span>
      </div>
      <div className="dash-card">
        <span className={`dash-card-value ${diffClass}`}>
          {diffSign} {Math.abs(Math.round(diff))}%
        </span>
        <span className="dash-card-label">vs Yesterday</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ModelDistribution.tsx`**

```typescript
import type { ModelUsageEntry } from "../../lib/tauriIpc";

const MODEL_COLORS = [
  "var(--system-purple, #af52de)",
  "var(--system-blue, #007aff)",
  "var(--system-teal, #5ac8fa)",
  "var(--system-green, #34c759)",
  "var(--system-orange, #ff9500)",
  "var(--system-red, #ff3b30)",
];

function shortModelName(model: string): string {
  // "claude-opus-4-5-20251101" → "Opus 4.5"
  // "claude-sonnet-4-5-20251101" → "Sonnet 4.5"
  const match = model.match(/claude-(\w+)-(\d+)-(\d+)/);
  if (!match) return model;
  const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  return `${name} ${match[2]}.${match[3]}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  models: ModelUsageEntry[];
}

export function ModelDistribution({ models }: Props) {
  if (models.length === 0) return null;

  return (
    <div className="dash-section">
      <div className="dash-section-title">Model Distribution</div>
      <div className="dash-model-bar">
        {models.map((m, i) => (
          <div
            key={m.model}
            className="dash-model-bar-segment"
            style={{
              width: `${Math.max(m.percentage, 1)}%`,
              backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length],
            }}
            title={`${shortModelName(m.model)}: ${m.percentage.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="dash-model-legend">
        {models.map((m, i) => (
          <div key={m.model} className="dash-model-legend-item">
            <span
              className="dash-model-dot"
              style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
            />
            <span className="dash-model-name">{shortModelName(m.model)}</span>
            <span className="dash-model-tokens">{formatTokens(m.totalTokens)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `CacheEfficiency.tsx`**

```typescript
interface Props {
  hitRate: number; // 0-100
}

export function CacheEfficiency({ hitRate }: Props) {
  return (
    <div className="dash-section">
      <div className="dash-section-title">Cache Efficiency</div>
      <div className="dash-cache">
        <div className="dash-cache-header">
          <span className="dash-cache-label">Cache Hit Rate</span>
          <span className="dash-cache-value">{hitRate.toFixed(1)}%</span>
        </div>
        <div className="dash-cache-bar">
          <div
            className="dash-cache-bar-fill"
            style={{ width: `${Math.min(hitRate, 100)}%` }}
          />
        </div>
        <span className="dash-cache-hint">
          Higher is better — cached tokens reduce quota usage
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `WeeklyTrend.tsx`**

```typescript
import type { DailyTokenEntry } from "../../lib/tauriIpc";

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  days: DailyTokenEntry[];
}

export function WeeklyTrend({ days }: Props) {
  if (days.length === 0) return null;

  const max = Math.max(...days.map((d) => d.totalTokens), 1);
  const avg = days.reduce((s, d) => s + d.totalTokens, 0) / days.length;
  const avgPct = (avg / max) * 100;

  return (
    <div className="dash-section">
      <div className="dash-section-title">7-Day Trend</div>
      <div className="dash-trend">
        <div className="dash-trend-chart">
          <div
            className="dash-trend-avg"
            style={{ bottom: `${avgPct}%` }}
            title={`Avg: ${formatTokens(avg)}`}
          />
          {days.map((d) => {
            const pct = max > 0 ? (d.totalTokens / max) * 100 : 0;
            return (
              <div key={d.date} className="dash-trend-col">
                <div
                  className={`dash-trend-bar ${d.isToday ? "dash-trend-bar--today" : ""}`}
                  style={{ height: `${pct}%` }}
                  title={formatTokens(d.totalTokens)}
                />
                <span className="dash-trend-label">{d.dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ClaudeCodePanel/TodaySummary.tsx src/components/ClaudeCodePanel/ModelDistribution.tsx src/components/ClaudeCodePanel/CacheEfficiency.tsx src/components/ClaudeCodePanel/WeeklyTrend.tsx
git commit -m "feat(dashboard): add TodaySummary, ModelDistribution, CacheEfficiency, WeeklyTrend components"
```

---

## Task 6: Frontend — DashboardTab Container and Styles

**Files:**
- Create: `src/components/ClaudeCodePanel/DashboardTab.tsx`
- Create: `src/components/ClaudeCodePanel/DashboardTab.css`

- [ ] **Step 1: Create `DashboardTab.tsx`**

```typescript
import { useEffect, useRef } from "react";
import { useDashboardStore } from "../../store/dashboardStore";
import { TodaySummary } from "./TodaySummary";
import { ModelDistribution } from "./ModelDistribution";
import { CacheEfficiency } from "./CacheEfficiency";
import { WeeklyTrend } from "./WeeklyTrend";
import "./DashboardTab.css";

interface Props {
  sessionId: string | null;
}

export function DashboardTab({ sessionId }: Props) {
  const { stats, loading, error, refresh } = useDashboardStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    refresh(sessionId);

    // Auto-refresh every 60s, paused when tab hidden
    const tick = () => {
      if (!document.hidden && sessionId) {
        refresh(sessionId);
      }
    };
    intervalRef.current = setInterval(tick, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionId, refresh]);

  if (!sessionId) {
    return (
      <div className="dash-empty">
        <svg className="dash-empty-icon" width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
          <rect x="1" y="8" width="3" height="7" rx="0.5" />
          <rect x="6.5" y="4" width="3" height="11" rx="0.5" />
          <rect x="12" y="1" width="3" height="14" rx="0.5" />
        </svg>
        <span className="dash-empty-title">No active session</span>
        <span className="dash-empty-sub">Open a terminal to see dashboard</span>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="dash-loading">
        <div className="dash-skeleton dash-skeleton--cards" />
        <div className="dash-skeleton dash-skeleton--bar" />
        <div className="dash-skeleton dash-skeleton--bar" />
        <div className="dash-skeleton dash-skeleton--chart" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="dash-empty">
        <svg className="dash-empty-icon" width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
          <rect x="1" y="8" width="3" height="7" rx="0.5" />
          <rect x="6.5" y="4" width="3" height="11" rx="0.5" />
          <rect x="12" y="1" width="3" height="14" rx="0.5" />
        </svg>
        <span className="dash-empty-title">No usage data yet</span>
        <span className="dash-empty-sub">Start using Claude Code to see your dashboard</span>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="dash-scroll">
      <TodaySummary today={stats.today} yesterday={stats.yesterday} />
      <ModelDistribution models={stats.modelUsage} />
      <CacheEfficiency hitRate={stats.cacheHitRate} />
      <WeeklyTrend days={stats.dailyTokens} />
    </div>
  );
}
```

- [ ] **Step 2: Create `DashboardTab.css`**

```css
/* ── Dashboard scroll container ── */
.dash-scroll {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow-y: auto;
  padding: 2px;
}

.dash-scroll::-webkit-scrollbar { width: 4px; }
.dash-scroll::-webkit-scrollbar-track { background: transparent; }
.dash-scroll::-webkit-scrollbar-thumb { background: var(--bg-tertiary); border-radius: 2px; }

/* ── Today's Summary cards ── */
.dash-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.dash-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 6px;
  background: var(--bg-terminal);
  border: 1px solid var(--bg-panel-border);
  border-radius: var(--radius-sm);
}

.dash-card-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 18px;
  font-weight: 700;
  color: var(--label-primary);
  line-height: 1.2;
}

.dash-card-label {
  font-size: 10px;
  color: var(--label-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

.dash-card-diff--up { color: var(--system-green); }
.dash-card-diff--down { color: var(--system-red); }

/* ── Sections ── */
.dash-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--bg-terminal);
  border: 1px solid var(--bg-panel-border);
  border-radius: var(--radius-sm);
}

.dash-section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--label-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ── Model Distribution ── */
.dash-model-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  gap: 1px;
}

.dash-model-bar-segment {
  transition: width 0.3s ease;
}

.dash-model-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dash-model-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.dash-model-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dash-model-name {
  color: var(--label-primary);
  flex: 1;
}

.dash-model-tokens {
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  color: var(--label-secondary);
}

/* ── Cache Efficiency ── */
.dash-cache {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dash-cache-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dash-cache-label {
  font-size: 11px;
  color: var(--label-primary);
}

.dash-cache-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--system-green);
}

.dash-cache-bar {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.dash-cache-bar-fill {
  height: 100%;
  background: var(--system-green);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.dash-cache-hint {
  font-size: 9px;
  color: var(--label-tertiary);
  line-height: 1.3;
}

/* ── Weekly Trend ── */
.dash-trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 80px;
  position: relative;
}

.dash-trend-avg {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px dashed var(--label-tertiary);
  opacity: 0.4;
  pointer-events: none;
}

.dash-trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}

.dash-trend-bar {
  width: 100%;
  background: var(--bg-tertiary);
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
  min-height: 2px;
}

.dash-trend-bar--today {
  background: var(--system-blue, #007aff);
}

.dash-trend-label {
  font-size: 9px;
  color: var(--label-tertiary);
  margin-top: 4px;
  font-family: "JetBrains Mono", monospace;
}

/* ── Empty / Loading states ── */
.dash-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 32px 16px;
  flex: 1;
}

.dash-empty-icon {
  font-size: 24px;
  opacity: 0.5;
}

.dash-empty-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--label-primary);
}

.dash-empty-sub {
  font-size: 11px;
  color: var(--label-tertiary);
  text-align: center;
}

.dash-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px;
}

.dash-skeleton {
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  animation: dash-pulse 1.5s ease-in-out infinite;
}

.dash-skeleton--cards { height: 100px; }
.dash-skeleton--bar { height: 60px; }
.dash-skeleton--chart { height: 100px; }

@keyframes dash-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ClaudeCodePanel/DashboardTab.tsx src/components/ClaudeCodePanel/DashboardTab.css
git commit -m "feat(dashboard): add DashboardTab container with styles"
```

---

## Task 7: Frontend — Integrate Dashboard Tab into ClaudeCodePanel

**Files:**
- Modify: `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx`
- Modify: `src/components/ClaudeCodePanel/ClaudeCodePanel.css`

- [ ] **Step 1: Update `ClaudeCodeTab` type**

In `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx`, change line 11:

```typescript
// Before:
export type ClaudeCodeTab = "claude-md" | "git";

// After:
export type ClaudeCodeTab = "claude-md" | "git" | "dashboard";
```

- [ ] **Step 2: Add Dashboard tab button and content**

In the same file, add the import at the top:

```typescript
import { DashboardTab } from "./DashboardTab";
```

In the JSX header section (inside `.claude-panel-tabs`), add a third tab button after the Git tab button:

```typescript
<button
  className={`claude-panel-tab${activeTab === "dashboard" ? " claude-panel-tab--active" : ""}`}
  onClick={() => onTabChange("dashboard")}
  title="Dashboard"
>
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="1" y="8" width="3" height="7" rx="0.5" />
    <rect x="6.5" y="4" width="3" height="11" rx="0.5" />
    <rect x="12" y="1" width="3" height="14" rx="0.5" />
  </svg>
</button>
```

In the body section, add after the Git panel conditional render:

```typescript
{activeTab === "dashboard" && (
  <DashboardTab sessionId={focusedSessionId} />
)}
```

- [ ] **Step 3: Update CSS for 3 tabs**

No CSS changes needed — the `.claude-panel-tab` already uses `flex: 1` which distributes space evenly across any number of tabs.

- [ ] **Step 4: Verify the app compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/components/ClaudeCodePanel/ClaudeCodePanel.tsx
git commit -m "feat(dashboard): integrate Dashboard tab into ClaudeCodePanel"
```

---

## Task 8: Frontend — Keyboard Shortcut and UsageBar Click

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/UsageBar/UsageBar.tsx`

- [ ] **Step 1: Fix `claudePanelTab` localStorage initialization in App.tsx**

In `src/App.tsx`, find the `claudePanelTab` state initialization (around line 84) and update it to restore from localStorage:

```typescript
// Before:
const [claudePanelTab, setClaudePanelTab] = useState<ClaudeCodeTab>("claude-md");

// After:
const [claudePanelTab, setClaudePanelTab] = useState<ClaudeCodeTab>(() => {
  const stored = localStorage.getItem("v-terminal:claude-panel-tab");
  if (stored === "claude-md" || stored === "git" || stored === "dashboard") return stored;
  return "claude-md";
});
```

- [ ] **Step 2: Add `Ctrl+Shift+D` shortcut in App.tsx**

In `src/App.tsx`, find the keyboard shortcut handler section (around lines 154-170 where `Ctrl+Shift+G` and `Ctrl+Shift+L` are handled). Add a new case for `Ctrl+Shift+D`:

```typescript
// Ctrl+Shift+D → open Claude panel on Dashboard tab
if (e.ctrlKey && e.shiftKey && e.key === "D") {
  e.preventDefault();
  if (!claudePanelOpen) {
    setClaudePanelOpen(true);
    localStorage.setItem("v-terminal:claude-panel-open", "true");
  }
  setClaudePanelTab("dashboard");
  localStorage.setItem("v-terminal:claude-panel-tab", "dashboard");
  return;
}
```

- [ ] **Step 3: Add click handler to UsageBar**

In `src/components/UsageBar/UsageBar.tsx`, update the component to accept an `onOpenDashboard` callback prop and make the bar clickable:

```typescript
interface UsageBarProps {
  claudePanelOpen: boolean;
  onOpenDashboard?: () => void;
}

export function UsageBar({ claudePanelOpen, onOpenDashboard }: UsageBarProps) {
```

Wrap the root div with an onClick handler and a cursor style:

```typescript
<div
  className="usage-bar"
  onClick={onOpenDashboard}
  style={{ cursor: onOpenDashboard ? "pointer" : undefined }}
>
```

- [ ] **Step 4: Pass the handler from App.tsx**

In `src/App.tsx`, update the UsageBar render (around line 932) to pass the handler:

```typescript
<UsageBar
  claudePanelOpen={claudePanelOpen}
  onOpenDashboard={() => {
    if (!claudePanelOpen) {
      setClaudePanelOpen(true);
      localStorage.setItem("v-terminal:claude-panel-open", "true");
    }
    setClaudePanelTab("dashboard");
    localStorage.setItem("v-terminal:claude-panel-tab", "dashboard");
  }}
/>
```

- [ ] **Step 5: Verify the app compiles**

Run: `cd /Users/handongho/.openclaw/workspace/projects/v-terminal && npm run build 2>&1 | tail -10`

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/UsageBar/UsageBar.tsx
git commit -m "feat(dashboard): add Ctrl+Shift+D shortcut and UsageBar click handler"
```

---

## Task Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Rust dashboard parser | +dashboard.rs, ~mod.rs, ~usage.rs |
| 2 | IPC command registration | ~claude_commands.rs, ~lib.rs |
| 3 | Frontend IPC types | ~tauriIpc.ts |
| 4 | Dashboard store | +dashboardStore.ts |
| 5 | Dashboard sub-components | +TodaySummary, +ModelDistribution, +CacheEfficiency, +WeeklyTrend |
| 6 | DashboardTab container + CSS | +DashboardTab.tsx, +DashboardTab.css |
| 7 | ClaudeCodePanel integration | ~ClaudeCodePanel.tsx |
| 8 | Shortcut + UsageBar click | ~App.tsx, ~UsageBar.tsx |
