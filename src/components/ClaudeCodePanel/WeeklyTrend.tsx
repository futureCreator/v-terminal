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
