import type { UsageEntry } from "../../store/usageStore";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01 && usd > 0) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

export function UsageGauge({ entry }: { entry: UsageEntry }) {
  const { data } = entry;

  return (
    <div className="usage-gauge">
      <span className="usage-gauge-env">{entry.environment}</span>
      <span className="usage-gauge-cost">{formatCost(data.todayCostUsd)}</span>
      <span className="usage-gauge-sep">today</span>
      <span className="usage-gauge-tokens">
        {formatTokens(data.todayInputTokens)} in
      </span>
      <span className="usage-gauge-divider">/</span>
      <span className="usage-gauge-cost-total">{formatCost(data.totalCostUsd)}</span>
      <span className="usage-gauge-sep">total</span>
    </div>
  );
}
