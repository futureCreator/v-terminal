import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { PomodoroSection } from "../AlarmPanel/PomodoroSection";
import { TimerSection } from "../AlarmPanel/TimerSection";
import { RecurringSection } from "../AlarmPanel/RecurringSection";
import { useAlarmStore } from "../../store/alarmStore";
import "../AlarmPanel/AlarmPanel.css";

const STORAGE_KEY = "v-terminal:timers-collapsed";

type SectionKey = "pomodoro" | "timer" | "alarms";

interface CollapsedState {
  pomodoro: boolean;
  timer: boolean;
  alarms: boolean;
}

function loadCollapsed(): CollapsedState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { pomodoro: false, timer: false, alarms: false };
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TimersPanel() {
  const [collapsed, setCollapsed] = useState<CollapsedState>(loadCollapsed);

  const toggle = useCallback((key: SectionKey) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <div className="timers-panel">
      <PomodoroCollapsible collapsed={collapsed.pomodoro} onToggle={() => toggle("pomodoro")} />
      <TimerCollapsible collapsed={collapsed.timer} onToggle={() => toggle("timer")} />
      <AlarmsCollapsible collapsed={collapsed.alarms} onToggle={() => toggle("alarms")} />
    </div>
  );
}

/* ── Pomodoro section ─────────────────────────────────────────────── */

function PomodoroCollapsible({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const phase = useAlarmStore((s) => s.pomodoroState.phase);
  const remainingMs = useAlarmStore((s) => s.pomodoroState.remainingMs);

  const isActive = phase !== "idle";
  const phaseLabel = phase === "focus" ? t('timer.focus') : phase === "break" ? t('timer.break') : phase === "longBreak" ? t('timer.longBreak') : "";
  const phaseColor = phase === "focus"
    ? "var(--accent)"
    : phase === "break"
      ? "var(--success)"
      : "var(--warning)";

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={onToggle} aria-expanded={!collapsed}>
        <svg
          className={`collapsible-chevron${!collapsed ? " collapsible-chevron--open" : ""}`}
          width="8" height="8" viewBox="0 0 8 8" fill="none"
        >
          <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="collapsible-label">{t('timer.pomodoro')}</span>
        {isActive && (
          <span className="collapsible-status">
            <span className="collapsible-status-dot" style={{ background: phaseColor }} />
            <span className="collapsible-status-text">{phaseLabel} {formatMs(remainingMs)}</span>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="collapsible-body">
          <div className="alarm-panel-body"><PomodoroSection /></div>
        </div>
      )}
    </div>
  );
}

/* ── Timer section ────────────────────────────────────────────────── */

function TimerCollapsible({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const timers = useAlarmStore((s) => s.timers);

  const runningCount = timers.filter((ti) => ti.status === "running").length;
  const pausedCount = timers.filter((ti) => ti.status === "paused").length;
  const isActive = runningCount > 0 || pausedCount > 0;

  let statusText = "";
  if (runningCount > 0 && pausedCount > 0) {
    statusText = t('timer.runningAndPaused', { running: runningCount, paused: pausedCount });
  } else if (runningCount > 0) {
    statusText = t('timer.runningCount', { count: runningCount });
  } else if (pausedCount > 0) {
    statusText = t('timer.pausedCount', { count: pausedCount });
  }

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={onToggle} aria-expanded={!collapsed}>
        <svg
          className={`collapsible-chevron${!collapsed ? " collapsible-chevron--open" : ""}`}
          width="8" height="8" viewBox="0 0 8 8" fill="none"
        >
          <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="collapsible-label">{t('timer.timerLabel')}</span>
        {isActive && (
          <span className="collapsible-status">
            <span className="collapsible-status-dot" style={{ background: "var(--accent)" }} />
            <span className="collapsible-status-text">{statusText}</span>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="collapsible-body">
          <div className="alarm-panel-body"><TimerSection /></div>
        </div>
      )}
    </div>
  );
}

/* ── Alarms section ───────────────────────────────────────────────── */

function AlarmsCollapsible({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const alarms = useAlarmStore((s) => s.alarms);

  const enabledAlarms = alarms.filter((a) => a.enabled);
  const nextAlarm = enabledAlarms.length > 0
    ? enabledAlarms.reduce((earliest, a) => (a.time < earliest.time ? a : earliest))
    : null;

  return (
    <div className="collapsible-section">
      <button className="collapsible-header" onClick={onToggle} aria-expanded={!collapsed}>
        <svg
          className={`collapsible-chevron${!collapsed ? " collapsible-chevron--open" : ""}`}
          width="8" height="8" viewBox="0 0 8 8" fill="none"
        >
          <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="collapsible-label">{t('alarm.alarms')}</span>
        {nextAlarm && (
          <span className="collapsible-status">
            <span className="collapsible-status-dot" style={{ background: "var(--warning)" }} />
            <span className="collapsible-status-text">{t('timer.nextAlarm', { time: nextAlarm.time })}</span>
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="collapsible-body">
          <div className="alarm-panel-body"><RecurringSection /></div>
        </div>
      )}
    </div>
  );
}
