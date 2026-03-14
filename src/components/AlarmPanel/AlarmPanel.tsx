import { useState } from "react";
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
        <span className="alarm-panel-title">알림</span>
        <button
          className="alarm-panel-close"
          onClick={onClose}
          aria-label="Close alarms"
          title="알림 닫기"
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
          포모도로
        </button>
        <button
          className={`alarm-segment${activeTab === "timer" ? " alarm-segment--active" : ""}`}
          onClick={() => setActiveTab("timer")}
        >
          타이머
        </button>
        <button
          className={`alarm-segment${activeTab === "recurring" ? " alarm-segment--active" : ""}`}
          onClick={() => setActiveTab("recurring")}
        >
          반복 알림
        </button>
      </div>

      <div className="alarm-panel-body">
        {activeTab === "pomodoro" && <PomodoroSection />}
        {activeTab === "timer" && <TimerSection />}
        {activeTab === "recurring" && <RecurringSection />}
      </div>
    </div>
  );
}
