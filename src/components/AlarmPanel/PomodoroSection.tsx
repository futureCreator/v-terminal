import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAlarmStore, getPhaseDuration } from "../../store/alarmStore";

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PomodoroSection() {
  const { t } = useTranslation();
  const pomodoroConfig = useAlarmStore((s) => s.pomodoroConfig);
  const pomodoroState = useAlarmStore((s) => s.pomodoroState);
  const { startPomodoro, pausePomodoro, resumePomodoro, resetPomodoro, setPomodoroConfig } =
    useAlarmStore();

  const [showSettings, setShowSettings] = useState(false);

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
    phase === "focus" ? t('timer.focus') : phase === "break" ? t('timer.break') : phase === "longBreak" ? t('timer.longBreak') : "";

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
      <div className="pomodoro-session-dots">
        {Array.from({ length: sessionsTotal }, (_, i) => (
          <span
            key={i}
            className={`pomodoro-dot${i < sessionsDone ? " pomodoro-dot--done" : ""}`}
            style={i < sessionsDone ? { background: phaseColor } : undefined}
          />
        ))}
        <span className="pomodoro-session-label">
          {phase !== "idle"
            ? `${sessionsDone} / ${sessionsTotal}`
            : t('timer.sessionsIdle', { count: sessionsTotal })}
        </span>
      </div>

      {/* Controls */}
      <div className="pomodoro-controls">
        {phase === "idle" ? (
          <button className="pomodoro-btn pomodoro-btn--primary" onClick={startPomodoro}>
            {t('timer.start')}
          </button>
        ) : (
          <>
            {isRunning ? (
              <button className="pomodoro-btn" onClick={pausePomodoro}>
                {t('timer.pause')}
              </button>
            ) : isPaused ? (
              <button className="pomodoro-btn pomodoro-btn--primary" onClick={resumePomodoro}>
                {t('timer.resume')}
              </button>
            ) : null}
            <button className="pomodoro-btn pomodoro-btn--danger" onClick={resetPomodoro}>
              {t('timer.reset')}
            </button>
          </>
        )}
        <button
            className={`pomodoro-gear-btn${showSettings ? " pomodoro-gear-btn--active" : ""}`}
            onClick={() => setShowSettings((v) => !v)}
            title={t('common.settings')}
            aria-label="Toggle settings"
        >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.8 1.5h2.4l.3 1.8.8.4 1.6-.9 1.7 1.7-.9 1.6.4.8 1.8.3v2.4l-1.8.3-.4.8.9 1.6-1.7 1.7-1.6-.9-.8.4-.3 1.8H6.8l-.3-1.8-.8-.4-1.6.9-1.7-1.7.9-1.6-.4-.8-1.8-.3V6.8l1.8-.3.4-.8-.9-1.6 1.7-1.7 1.6.9.8-.4z"/>
                <circle cx="8" cy="8" r="2.2"/>
            </svg>
        </button>
      </div>

      {/* Settings (stepper) */}
      {showSettings && (
          <div className={`pomodoro-settings${phase !== "idle" ? " pomodoro-settings--disabled" : ""}`}>
              <div className="pomodoro-stepper-row">
                  <span className="pomodoro-stepper-label">{t('timer.focus')}</span>
                  <div className="pomodoro-stepper">
                      <button className="pomodoro-stepper-btn" disabled={phase !== "idle" || pomodoroConfig.focusMinutes <= 5}
                          onClick={() => setPomodoroConfig({ focusMinutes: pomodoroConfig.focusMinutes - 5 })}>−</button>
                      <span className="pomodoro-stepper-value">{pomodoroConfig.focusMinutes}<span className="pomodoro-stepper-unit">m</span></span>
                      <button className="pomodoro-stepper-btn" disabled={phase !== "idle" || pomodoroConfig.focusMinutes >= 120}
                          onClick={() => setPomodoroConfig({ focusMinutes: pomodoroConfig.focusMinutes + 5 })}>+</button>
                  </div>
              </div>
              <div className="pomodoro-stepper-row">
                  <span className="pomodoro-stepper-label">{t('timer.break')}</span>
                  <div className="pomodoro-stepper">
                      <button className="pomodoro-stepper-btn" disabled={phase !== "idle" || pomodoroConfig.breakMinutes <= 1}
                          onClick={() => setPomodoroConfig({ breakMinutes: pomodoroConfig.breakMinutes - 1 })}>−</button>
                      <span className="pomodoro-stepper-value">{pomodoroConfig.breakMinutes}<span className="pomodoro-stepper-unit">m</span></span>
                      <button className="pomodoro-stepper-btn" disabled={phase !== "idle" || pomodoroConfig.breakMinutes >= 60}
                          onClick={() => setPomodoroConfig({ breakMinutes: pomodoroConfig.breakMinutes + 1 })}>+</button>
                  </div>
              </div>
              <div className="pomodoro-stepper-row">
                  <span className="pomodoro-stepper-label">{t('timer.longBreak')}</span>
                  <div className="pomodoro-stepper">
                      <button className="pomodoro-stepper-btn" disabled={phase !== "idle" || pomodoroConfig.longBreakMinutes <= 10}
                          onClick={() => setPomodoroConfig({ longBreakMinutes: pomodoroConfig.longBreakMinutes - 5 })}>−</button>
                      <span className="pomodoro-stepper-value">{pomodoroConfig.longBreakMinutes}<span className="pomodoro-stepper-unit">m</span></span>
                      <button className="pomodoro-stepper-btn" disabled={phase !== "idle" || pomodoroConfig.longBreakMinutes >= 60}
                          onClick={() => setPomodoroConfig({ longBreakMinutes: pomodoroConfig.longBreakMinutes + 5 })}>+</button>
                  </div>
              </div>
              <div className="pomodoro-stepper-row pomodoro-stepper-row--last">
                  <div className="pomodoro-stepper-label-group">
                      <span className="pomodoro-stepper-label">{t('timer.sessionsLabel')}</span>
                      <span className="pomodoro-stepper-sublabel">{t('timer.beforeLongBreak')}</span>
                  </div>
                  <div className="pomodoro-stepper">
                      <button className="pomodoro-stepper-btn" disabled={phase !== "idle" || pomodoroConfig.sessionsBeforeLongBreak <= 1}
                          onClick={() => setPomodoroConfig({ sessionsBeforeLongBreak: pomodoroConfig.sessionsBeforeLongBreak - 1 })}>−</button>
                      <span className="pomodoro-stepper-value">{pomodoroConfig.sessionsBeforeLongBreak}</span>
                      <button className="pomodoro-stepper-btn" disabled={phase !== "idle" || pomodoroConfig.sessionsBeforeLongBreak >= 12}
                          onClick={() => setPomodoroConfig({ sessionsBeforeLongBreak: pomodoroConfig.sessionsBeforeLongBreak + 1 })}>+</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
