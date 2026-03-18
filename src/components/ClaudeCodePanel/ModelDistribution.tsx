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
