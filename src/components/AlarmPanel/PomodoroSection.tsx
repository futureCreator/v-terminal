import { useState } from "react";
import { useAlarmStore, getPhaseDuration } from "../../store/alarmStore";

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PomodoroSection() {
  const [showSettings, setShowSettings] = useState(false);

  const pomodoroConfig = useAlarmStore((s) => s.pomodoroConfig);
  const pomodoroState = useAlarmStore((s) => s.pomodoroState);
  const { startPomodoro, pausePomodoro, resumePomodoro, resetPomodoro, setPomodoroConfig } =
    useAlarmStore();

  const { phase, remainingMs, completedSessions, lastTickAt } = pomodoroState;
  const isRunning = phase !== "idle" && lastTickAt !== null;
  const isPaused = phase !== "idle" && lastTickAt === null;

  const totalMs =
    phase === "idle"
      ? pomodoroConfig.focusMinutes * 60_000
      : getPhaseDuration(phase, pomodoroConfig);

  const progress = totalMs > 0 ? remainingMs / totalMs : 1;
  const displayMs = phase === "idle" ? pomodoroConfig.focusMinutes * 60_000 : remainingMs;

  const phaseLabel =
    phase === "focus" ? "집중" : phase === "break" ? "휴식" : phase === "longBreak" ? "긴 휴식" : "";

  const phaseColor =
    phase === "focus"
      ? "var(--accent)"
      : phase === "break"
        ? "var(--success)"
        : phase === "longBreak"
          ? "var(--warning)"
          : "var(--label-tertiary)";

  const r = 44;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * (1 - progress);

  const sessionsTotal = pomodoroConfig.sessionsBeforeLongBreak;
  const sessionsDone = completedSessions % sessionsTotal;

  return (
    <div className="pomodoro-section">
      {/* Ring */}
      <div className="pomodoro-ring-container">
        <svg className="pomodoro-ring" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} className="pomodoro-track" />
          <circle
            cx="50"
            cy="50"
            r={r}
            className="pomodoro-progress"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: phase === "idle" ? 0 : dashoffset,
              stroke: phase === "idle" ? "var(--separator)" : phaseColor,
            }}
          />
        </svg>
        <div className="pomodoro-ring-text">
          <span className="pomodoro-time">{formatMs(displayMs)}</span>
          {phase !== "idle" && (
            <span className="pomodoro-phase" style={{ color: phaseColor }}>{phaseLabel}</span>
          )}
        </div>
      </div>

      {/* Session dots */}
      {phase !== "idle" && (
        <div className="pomodoro-session-dots">
          {Array.from({ length: sessionsTotal }, (_, i) => (
            <span
              key={i}
              className={`pomodoro-dot${i < sessionsDone ? " pomodoro-dot--done" : ""}`}
              style={i < sessionsDone ? { background: phaseColor } : undefined}
            />
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="pomodoro-controls">
        {phase === "idle" ? (
          <button className="pomodoro-btn pomodoro-btn--primary" onClick={startPomodoro}>
            시작
          </button>
        ) : (
          <>
            {isRunning ? (
              <button className="pomodoro-btn" onClick={pausePomodoro}>
                일시정지
              </button>
            ) : isPaused ? (
              <button className="pomodoro-btn pomodoro-btn--primary" onClick={resumePomodoro}>
                재개
              </button>
            ) : null}
            <button className="pomodoro-btn pomodoro-btn--danger" onClick={resetPomodoro}>
              초기화
            </button>
          </>
        )}
      </div>

      {/* Settings toggle */}
      <button
        className="pomodoro-settings-toggle"
        onClick={() => setShowSettings((v) => !v)}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M12.95 3.05l-1.41 1.41M4.46 11.54l-1.41 1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span>설정</span>
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="none"
          style={{ transform: showSettings ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <path d="M1.5 3L4 5.5 6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {showSettings && (
        <div className="pomodoro-settings">
          <div className="pomodoro-setting-row">
            <label className="pomodoro-setting-label">집중</label>
            <input
              className="pomodoro-setting-input"
              type="number"
              min="1"
              max="120"
              value={pomodoroConfig.focusMinutes}
              onChange={(e) => setPomodoroConfig({ focusMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
            />
            <span className="pomodoro-setting-unit">분</span>
          </div>
          <div className="pomodoro-setting-row">
            <label className="pomodoro-setting-label">휴식</label>
            <input
              className="pomodoro-setting-input"
              type="number"
              min="1"
              max="60"
              value={pomodoroConfig.breakMinutes}
              onChange={(e) => setPomodoroConfig({ breakMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
            />
            <span className="pomodoro-setting-unit">분</span>
          </div>
          <div className="pomodoro-setting-row">
            <label className="pomodoro-setting-label">긴 휴식</label>
            <input
              className="pomodoro-setting-input"
              type="number"
              min="1"
              max="60"
              value={pomodoroConfig.longBreakMinutes}
              onChange={(e) => setPomodoroConfig({ longBreakMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
            />
            <span className="pomodoro-setting-unit">분</span>
          </div>
          <div className="pomodoro-setting-row">
            <label className="pomodoro-setting-label">긴 휴식 주기</label>
            <input
              className="pomodoro-setting-input"
              type="number"
              min="1"
              max="12"
              value={pomodoroConfig.sessionsBeforeLongBreak}
              onChange={(e) => setPomodoroConfig({ sessionsBeforeLongBreak: Math.max(1, parseInt(e.target.value) || 1) })}
            />
            <span className="pomodoro-setting-unit">세션</span>
          </div>
        </div>
      )}
    </div>
  );
}
