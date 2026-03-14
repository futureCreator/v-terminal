import { PomodoroSection } from "./PomodoroSection";
import { TimerSection } from "./TimerSection";
import { RecurringSection } from "./RecurringSection";
import "./AlarmPanel.css";

interface AlarmPanelProps {
  onClose: () => void;
}

export function AlarmPanel({ onClose }: AlarmPanelProps) {
  return (
    <div className="alarm-panel">
      <div className="alarm-panel-header">
        <span className="alarm-panel-title">Alarms</span>
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
      <div className="alarm-panel-body">
        <PomodoroSection />
        <TimerSection />
        <RecurringSection />
      </div>
    </div>
  );
}
