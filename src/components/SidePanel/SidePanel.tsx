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
          >
            Notes
          </button>
          <button
            className={`side-panel-tab${activeTab === "alerts" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("alerts")}
          >
            Alerts
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

      {activeTab === "notes" && (
        <div className="note-panel-body">
          <NoteEditor tabId={tabId} />
          <TodoSection tabId={tabId} />
        </div>
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

  const items: { icon: string; text: string }[] = [];

  if (alarmSubTab !== "pomodoro" && pomodoroPhase !== "idle") {
    const totalSec = Math.max(0, Math.floor(pomodoroRemaining / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const phaseLabel = pomodoroPhase === "focus" ? "Focus" : pomodoroPhase === "break" ? "Break" : "Long Break";
    items.push({ icon: "\u{1F345}", text: `${phaseLabel} ${m}:${String(s).padStart(2, "0")}` });
  }

  if (alarmSubTab !== "timer" && (runningTimers > 0 || pausedTimers > 0)) {
    const parts: string[] = [];
    if (runningTimers > 0) parts.push(`${runningTimers} running`);
    if (pausedTimers > 0) parts.push(`${pausedTimers} paused`);
    items.push({ icon: "\u23F1", text: parts.join(", ") });
  }

  if (alarmSubTab !== "recurring" && nextAlarm) {
    items.push({ icon: "\u{1F514}", text: `Next ${nextAlarm.time}` });
  }

  if (items.length === 0) return null;

  return (
    <div className="alarm-quick-status">
      {items.map((item, i) => (
        <span key={i} className="alarm-quick-status-item">
          <span className="alarm-quick-status-icon">{item.icon}</span>
          <span className="alarm-quick-status-text">{item.text}</span>
        </span>
      ))}
    </div>
  );
}
