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
  const diffSign = diff > 0 ? "\u2191" : diff < 0 ? "\u2193" : "\u2014";
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
