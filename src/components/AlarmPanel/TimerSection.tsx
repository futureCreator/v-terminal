import { useState } from "react";
import { useAlarmStore } from "../../store/alarmStore";
import type { CountdownTimer } from "../../store/alarmStore";

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes >= 60 ? `${minutes / 60}시간` : `${minutes}분`;
}

const PRESETS = [5, 10, 15, 30, 60];

export function TimerSection() {
  const [customLabel, setCustomLabel] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");

  const timers = useAlarmStore((s) => s.timers);
  const { addTimer, removeTimer, pauseTimer, resumeTimer, clearFinishedTimers } = useAlarmStore();

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
    <div className="timer-section">
      {/* Presets */}
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

      {/* Custom input */}
      <div className="timer-custom-row">
        <input
          className="timer-custom-input timer-custom-label"
          type="text"
          placeholder="이름 (선택)"
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

      {/* Timer list */}
      {timers.length > 0 && (
        <>
          <div className="timer-list-header">
            <span className="timer-list-title">활성 타이머</span>
            {finishedCount > 0 && (
              <button
                className="timer-clear-btn"
                onClick={clearFinishedTimers}
                title="완료 항목 삭제"
              >
                완료 삭제
              </button>
            )}
          </div>
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
        </>
      )}

      {timers.length === 0 && (
        <div className="timer-empty">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>프리셋을 선택하거나<br />커스텀 타이머를 추가하세요</span>
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
  const progress = durationMs > 0 ? (1 - remainingMs / durationMs) : 1;

  return (
    <div className={`timer-item${status === "finished" ? " timer-item--finished" : ""}`}>
      <div className="timer-item-progress" style={{ width: `${Math.min(100, progress * 100)}%` }} />
      <div className="timer-item-content">
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
    </div>
  );
}
