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
