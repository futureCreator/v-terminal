import { useState } from "react";
import { useAlarmStore, getPhaseDuration } from "../../store/alarmStore";

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PomodoroSection() {
  const [collapsed, setCollapsed] = useState(false);
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

  const r = 38;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * (1 - progress);

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
        <span className="alarm-section-label">포모도로</span>
        {phase !== "idle" && (
          <span className="alarm-section-meta">{formatMs(remainingMs)}</span>
        )}
      </button>

      {!collapsed && (
        <div className="pomodoro-body">
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
              {phase !== "idle" && <span className="pomodoro-phase" style={{ color: phaseColor }}>{phaseLabel}</span>}
            </div>
          </div>

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

          {phase !== "idle" && (
            <div className="pomodoro-info">
              세션 {completedSessions % pomodoroConfig.sessionsBeforeLongBreak}/{pomodoroConfig.sessionsBeforeLongBreak}
            </div>
          )}

          <button
            className="pomodoro-settings-toggle"
            onClick={() => setShowSettings((v) => !v)}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M12.95 3.05l-1.41 1.41M4.46 11.54l-1.41 1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span>설정</span>
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
      )}
    </div>
  );
}
