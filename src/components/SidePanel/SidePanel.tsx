import { useEffect } from "react";
import { NoteEditor } from "../NotePanel/NoteEditor";
import { TodoSection } from "../NotePanel/TodoSection";
import { PomodoroSection } from "../AlarmPanel/PomodoroSection";
import { TimerSection } from "../AlarmPanel/TimerSection";
import { RecurringSection } from "../AlarmPanel/RecurringSection";
import { useNoteStore } from "../../store/noteStore";
import { useAlarmStore } from "../../store/alarmStore";
import "../NotePanel/NotePanel.css";
import "../AlarmPanel/AlarmPanel.css";
import "./SidePanel.css";

export type SidebarTab = "notes" | "pomodoro" | "timer" | "recurring";

interface SidePanelProps {
  tabId: string;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
}

export function SidePanel({ tabId, activeTab, onTabChange, onClose }: SidePanelProps) {
  // Migrate legacy global note on first mount
  useEffect(() => {
    useNoteStore.getState().migrateOldNote(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <div className="side-panel-tabs">
          <button
            className={`side-panel-tab${activeTab === "notes" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("notes")}
            title="Notes"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2.5" y="1" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="5" y1="4.5" x2="10" y2="4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="9.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`side-panel-tab${activeTab === "pomodoro" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("pomodoro")}
            title="Focus"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="8" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="7.5" y1="5" x2="7.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7.5" y1="8" x2="9.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7.5" y1="1.5" x2="7.5" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`side-panel-tab${activeTab === "timer" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("timer")}
            title="Timer"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M3.5 2.5h8l-1.5 5 1.5 5h-8l1.5-5-1.5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <line x1="3" y1="2.5" x2="12" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="3" y1="12.5" x2="12" y2="12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`side-panel-tab${activeTab === "recurring" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("recurring")}
            title="Alarm"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 2C5 2 3.5 4 3.5 6v2.5L2 10.5h11l-1.5-2V6c0-2-1.5-4-4-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M5.5 11a2 2 0 004 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <button
          className="side-panel-close"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M1.5 1.5l6 6M7.5 1.5l-6 6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="side-panel-body">
        {activeTab === "notes" && (
          <>
            <NoteEditor tabId={tabId} />
            <TodoSection tabId={tabId} />
          </>
        )}
        {activeTab === "pomodoro" && (
          <div className="alarm-panel-body"><PomodoroSection /></div>
        )}
        {activeTab === "timer" && (
          <div className="alarm-panel-body"><TimerSection /></div>
        )}
        {activeTab === "recurring" && (
          <div className="alarm-panel-body"><RecurringSection /></div>
        )}
      </div>

      <QuickStatus activeTab={activeTab} />
    </div>
  );
}

function QuickStatus({ activeTab }: { activeTab: SidebarTab }) {
  const pomodoroPhase = useAlarmStore((s) => s.pomodoroState.phase);
  const pomodoroRemaining = useAlarmStore((s) => s.pomodoroState.remainingMs);
  const timers = useAlarmStore((s) => s.timers);
  const alarms = useAlarmStore((s) => s.alarms);

  const runningTimers = timers.filter((t) => t.status === "running").length;
  const pausedTimers = timers.filter((t) => t.status === "paused").length;
  const enabledAlarms = alarms.filter((a) => a.enabled);

  const nextAlarm = enabledAlarms.length > 0
    ? enabledAlarms.reduce((earliest, a) => (a.time < earliest.time ? a : earliest))
    : null;

  const items: { color: string; text: string }[] = [];

  if (activeTab !== "pomodoro" && pomodoroPhase !== "idle") {
    const totalSec = Math.max(0, Math.floor(pomodoroRemaining / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const phaseLabel = pomodoroPhase === "focus" ? "Focus" : pomodoroPhase === "break" ? "Break" : "Long Break";
    const phaseColor = pomodoroPhase === "focus" ? "var(--accent)" : pomodoroPhase === "break" ? "var(--success)" : "var(--warning)";
    items.push({ color: phaseColor, text: `${phaseLabel} ${m}:${String(s).padStart(2, "0")}` });
  }

  if (activeTab !== "timer" && (runningTimers > 0 || pausedTimers > 0)) {
    const parts: string[] = [];
    if (runningTimers > 0) parts.push(`${runningTimers} running`);
    if (pausedTimers > 0) parts.push(`${pausedTimers} paused`);
    items.push({ color: "var(--accent)", text: parts.join(", ") });
  }

  if (activeTab !== "recurring" && nextAlarm) {
    items.push({ color: "var(--warning)", text: `Next ${nextAlarm.time}` });
  }

  if (items.length === 0) return null;

  return (
    <div className="alarm-quick-status">
      {items.map((item, i) => (
        <span key={i} className="alarm-quick-status-item">
          <span className="alarm-quick-status-dot" style={{ background: item.color }} />
          <span className="alarm-quick-status-text">{item.text}</span>
        </span>
      ))}
    </div>
  );
}
