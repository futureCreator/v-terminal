# Claude Code Dashboard Tab Design

## Overview

Add a Dashboard tab to the existing ClaudeCodePanel (left sidebar) that displays Claude Code usage metrics, model distribution, cache efficiency, and weekly trends. Data is sourced from local files — no external API calls. For SSH/WSL sessions, files are read via SFTP (same mechanism as CLAUDE.md discovery).

## Data Sources

### Primary: `~/.claude/stats-cache.json`

This file contains two separate arrays for daily data:

**`dailyActivity`** — session/message/toolCall counts per day (no token data):
```json
{
  "date": "2025-12-28",
  "messageCount": 50,
  "sessionCount": 3,
  "toolCallCount": 120
}
```

**`dailyModelTokens`** — token counts per model per day:
```json
{
  "date": "2025-12-28",
  "tokensByModel": {
    "claude-opus-4-5-20251101": 150000,
    "claude-sonnet-4-5-20251101": 80000
  }
}
```

**`modelUsage`** — cumulative per-model token breakdown:
```json
{
  "claude-opus-4-5-20251101": {
    "inputTokens": 607362,
    "outputTokens": 2272497,
    "cacheReadInputTokens": 875053258,
    "cacheCreationInputTokens": 83393179
  }
}
```

**Top-level fields:** `totalSessions`, `totalMessages`, `lastComputedDate`

### Data Mapping

| UI Element | Data Source |
|---|---|
| Today's Sessions/Messages | `dailyActivity` (filter by today's date) |
| Today's Tokens | `dailyModelTokens` (sum tokensByModel for today) |
| vs Yesterday | `dailyModelTokens` (compare today vs yesterday total tokens) |
| Model Distribution | `modelUsage` (cumulative totals) |
| Cache Hit Rate | `modelUsage` (aggregate cacheReadInputTokens) |
| 7-Day Trend | `dailyModelTokens` (last 7 entries) |

### Scope Note
JSONL conversation files (`~/.claude/projects/<project>/<conversation>.jsonl`) are NOT parsed in this version. All data comes from `stats-cache.json` only. JSONL parsing may be added in a future iteration for more granular analysis.

## UI Design

### Tab Placement
- Third tab in ClaudeCodePanel: `CLAUDE.md | Git | Dashboard`
- Dashboard tab uses a bar-chart icon (consistent with existing icon-only and text-only tab styles)
- Keyboard shortcut: `Ctrl+Shift+D`
- `ClaudeCodeTab` type updated to: `"claude-md" | "git" | "dashboard"`

### Dashboard Layout (300px wide, vertical scroll)

#### Section 1: Today's Summary
Four metric cards in a 2x2 grid:
- **Sessions** — today's session count (from `dailyActivity`)
- **Messages** — today's message count (from `dailyActivity`)
- **Tokens** — today's total tokens, sum of all models (from `dailyModelTokens`)
- **vs Yesterday** — token usage percentage change compared to yesterday (↑ green / ↓ red / — neutral). Specifically compares total token count: `((today - yesterday) / yesterday) * 100`

Styling: compact cards with large number + small label below. Use secondary background color.

#### Section 2: Model Distribution
- Horizontal stacked bar showing proportion of each model (by total token count from `modelUsage`)
- Legend below with model short name and token counts
- Model display names are computed in the frontend by parsing the model identifier string (e.g., `claude-opus-4-5-20251101` → `Opus 4.5`)
- Color-coded: distinct color per model family

#### Section 3: Cache Efficiency
- Single metric: cache hit rate percentage
- Formula: `cacheReadInputTokens / (inputTokens + cacheReadInputTokens + cacheCreationInputTokens) * 100`
  - Denominator includes all input token types for accurate representation
- Visual: horizontal progress bar filled to the percentage
- Label: "Cache Hit Rate" with percentage value
- Subtitle: "Higher is better — cached tokens reduce quota usage"

#### Section 4: 7-Day Trend
- Vertical bar chart (CSS-only, no chart library)
- 7 bars representing last 7 days of total token usage (from `dailyModelTokens`)
- X-axis: day labels (Mon, Tue, etc.)
- Horizontal dashed line showing 7-day average
- Bar height relative to max day in the period
- Today's bar highlighted with accent color

### Empty State
When no data is available (fresh install or no Claude Code usage):
- Centered icon + message: "No usage data yet"
- Subtitle: "Start using Claude Code to see your dashboard"

### Loading State
- Skeleton placeholders matching the card/chart layout

## Architecture

### Backend (Rust)

#### New IPC Command: `get_dashboard_stats`
```rust
#[tauri::command]
async fn get_dashboard_stats(session_id: String) -> Result<DashboardStats, String>
```

The `session_id` parameter is used to determine session type (local/WSL/SSH) and resolve the correct file path. For SSH/WSL sessions, `stats-cache.json` is read via SFTP from the remote home directory.

**DashboardStats struct:**
```rust
struct DashboardStats {
    today: DaySummary,
    yesterday: DaySummary,
    model_usage: Vec<ModelUsage>,
    cache_hit_rate: f64,              // 0.0 - 100.0
    daily_tokens: Vec<DailyTokens>,   // last 7 days
    total_sessions: u64,
    total_messages: u64,
}

struct DaySummary {
    date: String,
    session_count: u64,               // from dailyActivity
    message_count: u64,               // from dailyActivity
    total_tokens: u64,                // from dailyModelTokens (sum of tokensByModel)
    tool_call_count: u64,             // from dailyActivity
}

struct ModelUsage {
    model: String,                    // raw model identifier
    input_tokens: u64,
    output_tokens: u64,
    cache_read_tokens: u64,
    cache_creation_tokens: u64,
    total_tokens: u64,                // input + output + cache_read + cache_creation
    percentage: f64,                  // share of total usage
}

struct DailyTokens {
    date: String,
    day_label: String,                // "Mon", "Tue", etc.
    total_tokens: u64,
    is_today: bool,
}
```

**Implementation note:** The existing `usage.rs::parse_stats_cache` already parses `stats-cache.json`. The new `dashboard.rs` should reuse or extend this parser rather than creating a duplicate. Specifically, `cacheCreationInputTokens` must be parsed (the existing parser omits this field).

**Data flow:**
1. Determine session type (local/WSL/SSH) from session_id
2. Read `~/.claude/stats-cache.json` (local file or via SFTP)
3. Parse both `dailyActivity` and `dailyModelTokens` arrays
4. Compute derived metrics (cache hit rate, day comparisons, model percentages)
5. Return `DashboardStats`

### Frontend (React/TypeScript)

#### New Store: `dashboardStore.ts`
```typescript
interface DashboardState {
  stats: DashboardStats | null;
  loading: boolean;
  error: string | null;
  refresh: (sessionId: string) => Promise<void>;
}
```

#### New Component: `DashboardTab.tsx`
- Lives in `src/components/ClaudeCodePanel/DashboardTab.tsx`
- Sub-components (all in the same directory):
  - `TodaySummary.tsx` — 2x2 metric cards
  - `ModelDistribution.tsx` — stacked bar + legend (includes model name formatting logic)
  - `CacheEfficiency.tsx` — progress bar
  - `WeeklyTrend.tsx` — CSS bar chart

#### ClaudeCodePanel Changes
- Add third tab ("Dashboard") with bar-chart icon
- Update `ClaudeCodeTab` type to include `"dashboard"`
- Route to `DashboardTab` when selected
- Auto-refresh dashboard data when tab becomes active
- Refresh on 60-second interval while visible (paused when `document.hidden === true`)

#### UsageBar Changes
- Click handler: opens ClaudeCodePanel and switches to Dashboard tab
- No other changes to UsageBar content

#### Keyboard Shortcut
- `Ctrl+Shift+D`: Toggle ClaudeCodePanel open with Dashboard tab active

### Styling
- Font: JetBrains Mono for numbers, Pretendard for labels
- Colors: follow existing theme variables
- Dark/light theme support via CSS variables
- Compact layout optimized for 300px width

## Scope Exclusions
- No external API calls (OAuth usage endpoint)
- No MCP server, hooks, or permissions display (future work)
- No cost/USD calculations (subscription users — cost is meaningless)
- No chart libraries (CSS-only charts)
- No historical data beyond 7 days in trend chart
- No JSONL conversation file parsing (future work)

## File Changes Summary

### New Files
- `src-tauri/src/claude/dashboard.rs` — stats parsing and computation (reuses existing parser where possible)
- `src/store/dashboardStore.ts` — Zustand store
- `src/components/ClaudeCodePanel/DashboardTab.tsx` — main dashboard component
- `src/components/ClaudeCodePanel/DashboardTab.css` — styles
- `src/components/ClaudeCodePanel/TodaySummary.tsx`
- `src/components/ClaudeCodePanel/ModelDistribution.tsx`
- `src/components/ClaudeCodePanel/CacheEfficiency.tsx`
- `src/components/ClaudeCodePanel/WeeklyTrend.tsx`

### Modified Files
- `src-tauri/src/claude/mod.rs` — register dashboard module
- `src-tauri/src/lib.rs` — register `get_dashboard_stats` command
- `src/components/ClaudeCodePanel/ClaudeCodePanel.tsx` — add Dashboard tab, update `ClaudeCodeTab` type
- `src/components/ClaudeCodePanel/ClaudeCodePanel.css` — tab styling for 3 tabs
- `src/components/UsageBar/UsageBar.tsx` — add click handler
- `src/lib/tauriIpc.ts` — add `getDashboardStats` IPC function
- `src/App.tsx` — register `Ctrl+Shift+D` shortcut
