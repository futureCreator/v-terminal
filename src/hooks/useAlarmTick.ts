import { useEffect } from "react";
import { useAlarmStore } from "../store/alarmStore";
import type { PomodoroPhase } from "../store/alarmStore";

let permissionGranted: boolean | null = null;

async function notify(title: string, body: string) {
  try {
    const mod = await import("@tauri-apps/plugin-notification");
    if (permissionGranted === null) {
      permissionGranted = await mod.isPermissionGranted();
      if (!permissionGranted) {
        const result = await mod.requestPermission();
        permissionGranted = result === "granted";
      }
    }
    if (permissionGranted) {
      mod.sendNotification({ title, body });
    }
  } catch {
    // Not in Tauri context or plugin unavailable
  }
}

export function useAlarmTick() {
  useEffect(() => {
    let prevPomodoroPhase: PomodoroPhase =
      useAlarmStore.getState().pomodoroState.phase;

    const interval = setInterval(() => {
      const state = useAlarmStore.getState();
      const now = Date.now();

      // ── 1. Recurring alarms ──────────────────────────────────
      const currentTime = new Date();
      const hhmm = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
      const weekday = (currentTime.getDay() + 6) % 7; // Mon=0..Sun=6

      for (const alarm of state.alarms) {
        if (!alarm.enabled || !alarm.weekdays[weekday] || alarm.time !== hhmm) continue;
        if (alarm.lastTriggered && now - alarm.lastTriggered < 60_000) continue;
        state.markTriggered(alarm.id);
        notify("알림", alarm.label || `${alarm.time} 알림`);
      }

      // ── 2. Pomodoro tick ─────────────────────────────────────
      if (state.pomodoroState.phase !== "idle" && state.pomodoroState.lastTickAt !== null) {
        state.tickPomodoro();
        const newPhase = useAlarmStore.getState().pomodoroState.phase;
        if (prevPomodoroPhase !== newPhase) {
          if (newPhase === "focus") {
            notify("포모도로", "휴식 끝! 집중 시간입니다.");
          } else if (newPhase === "break") {
            notify("포모도로", "집중 세션 완료! 짧은 휴식을 취하세요.");
          } else if (newPhase === "longBreak") {
            notify("포모도로", "수고했어요! 긴 휴식을 취하세요.");
          }
        }
        prevPomodoroPhase = newPhase;
      } else {
        prevPomodoroPhase = state.pomodoroState.phase;
      }

      // ── 3. Countdown timers tick ─────────────────────────────
      const runningTimers = state.timers.filter((t) => t.status === "running");
      if (runningTimers.length > 0) {
        const prevStatuses = new Map(state.timers.map((t) => [t.id, t.status]));
        state.tickAllTimers();
        const newTimers = useAlarmStore.getState().timers;
        for (const t of newTimers) {
          if (prevStatuses.get(t.id) === "running" && t.status === "finished") {
            notify("타이머", `${t.label || "타이머"} 완료!`);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);
}
