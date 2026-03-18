interface Props {
  hitRate: number;
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
