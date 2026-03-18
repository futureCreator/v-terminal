import type { UsageEntry } from "../../store/usageStore";

function formatCountdown(resetAt: number | null): string {
  if (!resetAt) return "";
  const remaining = resetAt * 1000 - Date.now();
  if (remaining <= 0) return "resetting...";
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function gaugeColor(percent: number): string {
  if (percent >= 85) return "var(--system-red)";
  if (percent >= 60) return "var(--system-yellow)";
  return "var(--system-green)";
}

export function UsageGauge({ entry }: { entry: UsageEntry }) {
  const color = gaugeColor(entry.usedPercent);
  const countdown = formatCountdown(entry.resetAt);

  return (
    <div className="usage-gauge">
      <span className="usage-gauge-plan">{entry.plan}</span>
      <div className="usage-gauge-bar">
        <div
          className="usage-gauge-fill"
          style={{ width: `${Math.min(entry.usedPercent, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="usage-gauge-pct">{Math.round(entry.usedPercent)}%</span>
      {countdown && <span className="usage-gauge-timer">{countdown}</span>}
      <span className="usage-gauge-env">{entry.environment}</span>
    </div>
  );
}
