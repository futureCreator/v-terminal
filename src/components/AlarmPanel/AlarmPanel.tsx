import { useState } from "react";
import { useAlarmStore } from "../../store/alarmStore";
import { PomodoroSection } from "./PomodoroSection";
import { TimerSection } from "./TimerSection";
import { RecurringSection } from "./RecurringSection";
import "./AlarmPanel.css";

type AlarmTab = "pomodoro" | "timer" | "recurring";

interface AlarmPanelProps {
  onClose: () => void;
}

export function AlarmPanel({ onClose }: AlarmPanelProps) {
  const [activeTab, setActiveTab] = useState<AlarmTab>("pomodoro");

  return (
    <div className="alarm-panel">
      <div className="alarm-panel-header">
        <span className="alarm-panel-title">Alerts</span>
        <button
          className="alarm-panel-close"
          onClick={onClose}
          aria-label="Close alerts"
          title="Close alerts"
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

      <div className="alarm-segmented-control">
        <button
          className={`alarm-segment${activeTab === "pomodoro" ? " alarm-segment--active" : ""}`}
          onClick={() => setActiveTab("pomodoro")}
        >
          Pomodoro
        </button>
        <button
          className={`alarm-segment${activeTab === "timer" ? " alarm-segment--active" : ""}`}
          onClick={() => setActiveTab("timer")}
        >
          Timer
        </button>
        <button
          className={`alarm-segment${activeTab === "recurring" ? " alarm-segment--active" : ""}`}
          onClick={() => setActiveTab("recurring")}
        >
          Recurring
        </button>
      </div>

      <div className="alarm-panel-body">
        {activeTab === "pomodoro" && <PomodoroSection />}
        {activeTab === "timer" && <TimerSection />}
        {activeTab === "recurring" && <RecurringSection />}
      </div>

      <QuickStatus activeTab={activeTab} />
    </div>
  );
}

function QuickStatus({ activeTab }: { activeTab: AlarmTab }) {
  const pomodoroPhase = useAlarmStore((s) => s.pomodoroState.phase);
  const pomodoroRemaining = useAlarmStore((s) => s.pomodoroState.remainingMs);
  const timers = useAlarmStore((s) => s.timers);
  const alarms = useAlarmStore((s) => s.alarms);

  const runningTimers = timers.filter((t) => t.status === "running").length;
  const pausedTimers = timers.filter((t) => t.status === "paused").length;
  const enabledAlarms = alarms.filter((a) => a.enabled);

  // Find next alarm time
  const nextAlarm = enabledAlarms.length > 0
    ? enabledAlarms.reduce((earliest, a) => (a.time < earliest.time ? a : earliest))
    : null;

  const items: { icon: string; text: string }[] = [];

  // Show pomodoro status when not on pomodoro tab
  if (activeTab !== "pomodoro" && pomodoroPhase !== "idle") {
    const totalSec = Math.max(0, Math.floor(pomodoroRemaining / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const phaseLabel = pomodoroPhase === "focus" ? "Focus" : pomodoroPhase === "break" ? "Break" : "Long Break";
    items.push({ icon: "🍅", text: `${phaseLabel} ${m}:${String(s).padStart(2, "0")}` });
  }

  // Show timer status when not on timer tab
  if (activeTab !== "timer" && (runningTimers > 0 || pausedTimers > 0)) {
    const parts: string[] = [];
    if (runningTimers > 0) parts.push(`${runningTimers} running`);
    if (pausedTimers > 0) parts.push(`${pausedTimers} paused`);
    items.push({ icon: "⏱", text: parts.join(", ") });
  }

  // Show next alarm when not on recurring tab
  if (activeTab !== "recurring" && nextAlarm) {
    items.push({ icon: "🔔", text: `Next ${nextAlarm.time}` });
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
