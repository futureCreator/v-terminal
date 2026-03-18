import { useUsageStore } from "../../store/usageStore";
import { UsageGauge } from "./UsageGauge";
import "./UsageBar.css";

interface UsageBarProps {
  claudePanelOpen: boolean;
}

export function UsageBar({ claudePanelOpen }: UsageBarProps) {
  const entries = useUsageStore((s) => s.entries);

  if (!claudePanelOpen) return null;
  if (entries.length === 0) return null;

  return (
    <div className="usage-bar">
      {entries.map((entry) => (
        <UsageGauge key={entry.sessionId} entry={entry} />
      ))}
    </div>
  );
}
