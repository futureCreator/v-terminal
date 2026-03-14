import { useState } from "react";
import { useAlarmStore } from "../../store/alarmStore";
import type { CountdownTimer } from "../../store/alarmStore";

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60 ? `${minutes / 60}시간` : `${minutes}분`;
}

const PRESETS = [5, 10, 15, 30, 60];

export function TimerSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");

  const timers = useAlarmStore((s) => s.timers);
  const { addTimer, removeTimer, pauseTimer, resumeTimer, clearFinishedTimers } = useAlarmStore();

  const activeCount = timers.filter((t) => t.status !== "finished").length;
  const finishedCount = timers.filter((t) => t.status === "finished").length;

  const handleAddPreset = (minutes: number) => {
    addTimer("", minutes * 60_000);
  };

  const handleAddCustom = () => {
    const mins = parseInt(customMinutes);
    if (isNaN(mins) || mins <= 0) return;
    addTimer(customLabel.trim(), mins * 60_000);
    setCustomLabel("");
    setCustomMinutes("");
  };

  return (
    <div className="alarm-section">
      <button
        className="alarm-section-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <svg
          className={`alarm-chevron${collapsed ? "" : " alarm-chevron--open"}`}
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
        >
          <path d="M2 1.5L5.5 4 2 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="alarm-section-label">타이머</span>
        {activeCount > 0 && <span className="alarm-section-count">{activeCount}</span>}
        {finishedCount > 0 && (
          <button
            className="alarm-section-clear"
            onClick={(e) => { e.stopPropagation(); clearFinishedTimers(); }}
            aria-label="완료 항목 삭제"
            title="완료 항목 삭제"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 3h7M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 5.5v3M7 5.5v3M3.5 3l.5 7a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l.5-7"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </button>

      {!collapsed && (
        <div className="timer-body">
          {timers.length > 0 && (
            <div className="timer-list">
              {timers.map((timer) => (
                <TimerItem
                  key={timer.id}
                  timer={timer}
                  onPause={pauseTimer}
                  onResume={resumeTimer}
                  onRemove={removeTimer}
                />
              ))}
            </div>
          )}

          <div className="timer-presets">
            {PRESETS.map((m) => (
              <button
                key={m}
                className="timer-preset-btn"
                onClick={() => handleAddPreset(m)}
              >
                {m >= 60 ? `${m / 60}h` : `${m}m`}
              </button>
            ))}
          </div>

          <div className="timer-custom-row">
            <input
              className="timer-custom-input timer-custom-label"
              type="text"
              placeholder="이름"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCustom(); }}
            />
            <input
              className="timer-custom-input timer-custom-minutes"
              type="number"
              placeholder="분"
              min="1"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCustom(); }}
            />
            <button
              className="timer-add-btn"
              onClick={handleAddCustom}
              title="추가"
              disabled={!customMinutes || parseInt(customMinutes) <= 0}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimerItem({
  timer,
  onPause,
  onResume,
  onRemove,
}: {
  timer: CountdownTimer;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { id, remainingMs, durationMs, status, label } = timer;

  return (
    <div className={`timer-item${status === "finished" ? " timer-item--finished" : ""}`}>
      {status !== "finished" ? (
        <button
          className="timer-play-btn"
          onClick={() => (status === "running" ? onPause(id) : onResume(id))}
          aria-label={status === "running" ? "일시정지" : "재개"}
        >
          {status === "running" ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="1.5" y="1" width="2.5" height="8" rx="0.5" fill="currentColor" />
              <rect x="6" y="1" width="2.5" height="8" rx="0.5" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2.5 1.5v7l6-3.5-6-3.5z" fill="currentColor" />
            </svg>
          )}
        </button>
      ) : (
        <span className="timer-done-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <span className="timer-label">{label || formatDuration(durationMs)}</span>
      <span className={`timer-time${status === "finished" ? " timer-time--done" : ""}`}>
        {status === "finished" ? "완료" : formatMs(remainingMs)}
      </span>
      <button
        className="timer-remove-btn"
        onClick={() => onRemove(id)}
        aria-label="삭제"
        title="삭제"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
