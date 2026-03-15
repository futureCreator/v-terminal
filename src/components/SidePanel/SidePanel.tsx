import { useState, useEffect } from "react";
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

export type SidebarTab = "notes" | "alerts";
type AlarmTab = "pomodoro" | "timer" | "recurring";

interface SidePanelProps {
  tabId: string;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
}

export function SidePanel({ tabId, activeTab, onTabChange, onClose }: SidePanelProps) {
  const [alarmSubTab, setAlarmSubTab] = useState<AlarmTab>("pomodoro");

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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2.5" y="1" width="9" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
              <line x1="5" y1="4.5" x2="9" y2="4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="7" x2="9" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="9.5" x2="7.5" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span>Notes</span>
          </button>
          <button
            className={`side-panel-tab${activeTab === "alerts" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("alerts")}
            title="Alerts"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5C4.5 1.5 3.5 3.5 3.5 5.5v2L2 9.5h10l-1.5-2v-2c0-2-1-4-3.5-4z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
              <path d="M5.5 10.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            <span>Alerts</span>
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

        {activeTab === "alerts" && (
          <>
            <div className="alarm-segmented-control">
              <button
                className={`alarm-segment${alarmSubTab === "pomodoro" ? " alarm-segment--active" : ""}`}
                onClick={() => setAlarmSubTab("pomodoro")}
              >
                Pomodoro
              </button>
              <button
                className={`alarm-segment${alarmSubTab === "timer" ? " alarm-segment--active" : ""}`}
                onClick={() => setAlarmSubTab("timer")}
              >
                Timer
              </button>
              <button
                className={`alarm-segment${alarmSubTab === "recurring" ? " alarm-segment--active" : ""}`}
                onClick={() => setAlarmSubTab("recurring")}
              >
                Recurring
              </button>
            </div>

            <div className="alarm-panel-body">
              {alarmSubTab === "pomodoro" && <PomodoroSection />}
              {alarmSubTab === "timer" && <TimerSection />}
              {alarmSubTab === "recurring" && <RecurringSection />}
            </div>
          </>
        )}
      </div>

      <QuickStatus alarmSubTab={activeTab === "alerts" ? alarmSubTab : null} />
    </div>
  );
}

function QuickStatus({ alarmSubTab }: { alarmSubTab: AlarmTab | null }) {
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

  if (alarmSubTab !== "pomodoro" && pomodoroPhase !== "idle") {
    const totalSec = Math.max(0, Math.floor(pomodoroRemaining / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const phaseLabel = pomodoroPhase === "focus" ? "Focus" : pomodoroPhase === "break" ? "Break" : "Long Break";
    const phaseColor = pomodoroPhase === "focus" ? "var(--accent)" : pomodoroPhase === "break" ? "var(--success)" : "var(--warning)";
    items.push({ color: phaseColor, text: `${phaseLabel} ${m}:${String(s).padStart(2, "0")}` });
  }

  if (alarmSubTab !== "timer" && (runningTimers > 0 || pausedTimers > 0)) {
    const parts: string[] = [];
    if (runningTimers > 0) parts.push(`${runningTimers} running`);
    if (pausedTimers > 0) parts.push(`${pausedTimers} paused`);
    items.push({ color: "var(--accent)", text: parts.join(", ") });
  }

  if (alarmSubTab !== "recurring" && nextAlarm) {
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
