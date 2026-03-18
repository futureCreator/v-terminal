import { useUsageStore } from "../../store/usageStore";
import { UsageGauge } from "./UsageGauge";
import "./UsageBar.css";

interface UsageBarProps {
  claudePanelOpen: boolean;
  onOpenDashboard?: () => void;
}

export function UsageBar({ claudePanelOpen, onOpenDashboard }: UsageBarProps) {
  const entries = useUsageStore((s) => s.entries);

  if (!claudePanelOpen) return null;
  if (entries.length === 0) return null;

  return (
    <div
      className="usage-bar"
      onClick={onOpenDashboard}
      style={{ cursor: onOpenDashboard ? "pointer" : undefined }}
    >
      {entries.map((entry) => (
        <UsageGauge key={entry.sessionId} entry={entry} />
      ))}
    </div>
  );
}
