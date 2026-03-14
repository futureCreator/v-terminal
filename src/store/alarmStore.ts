import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "v-terminal:alarms";
const SAVE_DEBOUNCE_MS = 300;

export interface RecurringAlarm {
  id: string;
  label: string;
  time: string; // "HH:mm"
  weekdays: boolean[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  enabled: boolean;
  lastTriggered?: number;
}

export interface PomodoroConfig {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
}

export type PomodoroPhase = "idle" | "focus" | "break" | "longBreak";

export interface PomodoroState {
  phase: PomodoroPhase;
  remainingMs: number;
  completedSessions: number;
  lastTickAt: number | null;
}

export interface CountdownTimer {
  id: string;
  label: string;
  durationMs: number;
  remainingMs: number;
  status: "running" | "paused" | "finished";
  lastTickAt: number | null;
}

interface AlarmStore {
  alarms: RecurringAlarm[];
  pomodoroConfig: PomodoroConfig;
  pomodoroState: PomodoroState;
  timers: CountdownTimer[];

  addAlarm: (label: string, time: string, weekdays: boolean[]) => void;
  removeAlarm: (id: string) => void;
  toggleAlarm: (id: string) => void;
  updateAlarm: (id: string, updates: Partial<Omit<RecurringAlarm, "id">>) => void;
  markTriggered: (id: string) => void;

  setPomodoroConfig: (config: Partial<PomodoroConfig>) => void;
  startPomodoro: () => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  resetPomodoro: () => void;
  tickPomodoro: () => void;

  addTimer: (label: string, durationMs: number) => void;
  removeTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  tickAllTimers: () => void;
  clearFinishedTimers: () => void;
}

const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
};

const IDLE_POMODORO: PomodoroState = {
  phase: "idle",
  remainingMs: 0,
  completedSessions: 0,
  lastTickAt: null,
};

export function getPhaseDuration(phase: PomodoroPhase, config: PomodoroConfig): number {
  switch (phase) {
    case "focus": return config.focusMinutes * 60_000;
    case "break": return config.breakMinutes * 60_000;
    case "longBreak": return config.longBreakMinutes * 60_000;
    default: return 0;
  }
}

interface PersistedData {
  alarms: RecurringAlarm[];
  pomodoroConfig: PomodoroConfig;
}

function load(): PersistedData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { alarms: [], pomodoroConfig: DEFAULT_POMODORO_CONFIG };
    const data = JSON.parse(raw) as PersistedData;
    return {
      alarms: data.alarms ?? [],
      pomodoroConfig: { ...DEFAULT_POMODORO_CONFIG, ...data.pomodoroConfig },
    };
  } catch {
    return { alarms: [], pomodoroConfig: DEFAULT_POMODORO_CONFIG };
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save(alarms: RecurringAlarm[], pomodoroConfig: PomodoroConfig) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ alarms, pomodoroConfig }));
    } catch {}
  }, SAVE_DEBOUNCE_MS);
}

export const useAlarmStore = create<AlarmStore>((set) => {
  const persisted = load();

  return {
    alarms: persisted.alarms,
    pomodoroConfig: persisted.pomodoroConfig,
    pomodoroState: { ...IDLE_POMODORO },
    timers: [],

    // ── Recurring Alarms ──────────────────────────────────────────
    addAlarm: (label, time, weekdays) =>
      set((s) => {
        const alarm: RecurringAlarm = { id: uuidv4(), label, time, weekdays, enabled: true };
        const alarms = [...s.alarms, alarm];
        save(alarms, s.pomodoroConfig);
        return { alarms };
      }),

    removeAlarm: (id) =>
      set((s) => {
        const alarms = s.alarms.filter((a) => a.id !== id);
        save(alarms, s.pomodoroConfig);
        return { alarms };
      }),

    toggleAlarm: (id) =>
      set((s) => {
        const alarms = s.alarms.map((a) =>
          a.id === id ? { ...a, enabled: !a.enabled } : a
        );
        save(alarms, s.pomodoroConfig);
        return { alarms };
      }),

    updateAlarm: (id, updates) =>
      set((s) => {
        const alarms = s.alarms.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        );
        save(alarms, s.pomodoroConfig);
        return { alarms };
      }),

    markTriggered: (id) =>
      set((s) => ({
        alarms: s.alarms.map((a) =>
          a.id === id ? { ...a, lastTriggered: Date.now() } : a
        ),
      })),

    // ── Pomodoro ──────────────────────────────────────────────────
    setPomodoroConfig: (config) =>
      set((s) => {
        const pomodoroConfig = { ...s.pomodoroConfig, ...config };
        save(s.alarms, pomodoroConfig);
        return { pomodoroConfig };
      }),

    startPomodoro: () =>
      set((s) => ({
        pomodoroState: {
          phase: "focus" as const,
          remainingMs: s.pomodoroConfig.focusMinutes * 60_000,
          completedSessions: 0,
          lastTickAt: Date.now(),
        },
      })),

    pausePomodoro: () =>
      set((s) => ({
        pomodoroState: { ...s.pomodoroState, lastTickAt: null },
      })),

    resumePomodoro: () =>
      set((s) => ({
        pomodoroState: { ...s.pomodoroState, lastTickAt: Date.now() },
      })),

    resetPomodoro: () => set(() => ({ pomodoroState: { ...IDLE_POMODORO } })),

    tickPomodoro: () =>
      set((s) => {
        const { pomodoroState: ps, pomodoroConfig: pc } = s;
        if (ps.phase === "idle" || ps.lastTickAt === null) return s;

        const now = Date.now();
        const delta = now - ps.lastTickAt;
        const newRemaining = ps.remainingMs - delta;

        if (newRemaining <= 0) {
          let nextPhase: PomodoroPhase;
          let sessions = ps.completedSessions;

          if (ps.phase === "focus") {
            sessions += 1;
            nextPhase = sessions % pc.sessionsBeforeLongBreak === 0 ? "longBreak" : "break";
          } else {
            nextPhase = "focus";
          }

          return {
            pomodoroState: {
              phase: nextPhase,
              remainingMs: getPhaseDuration(nextPhase, pc),
              completedSessions: sessions,
              lastTickAt: now,
            },
          };
        }

        return {
          pomodoroState: { ...ps, remainingMs: newRemaining, lastTickAt: now },
        };
      }),

    // ── Countdown Timers ──────────────────────────────────────────
    addTimer: (label, durationMs) =>
      set((s) => ({
        timers: [
          ...s.timers,
          {
            id: uuidv4(),
            label,
            durationMs,
            remainingMs: durationMs,
            status: "running" as const,
            lastTickAt: Date.now(),
          },
        ],
      })),

    removeTimer: (id) =>
      set((s) => ({ timers: s.timers.filter((t) => t.id !== id) })),

    pauseTimer: (id) =>
      set((s) => ({
        timers: s.timers.map((t) =>
          t.id === id && t.status === "running"
            ? { ...t, status: "paused" as const, lastTickAt: null }
            : t
        ),
      })),

    resumeTimer: (id) =>
      set((s) => ({
        timers: s.timers.map((t) =>
          t.id === id && t.status === "paused"
            ? { ...t, status: "running" as const, lastTickAt: Date.now() }
            : t
        ),
      })),

    tickAllTimers: () =>
      set((s) => {
        const now = Date.now();
        const hasRunning = s.timers.some((t) => t.status === "running");
        if (!hasRunning) return s;
        return {
          timers: s.timers.map((t) => {
            if (t.status !== "running" || t.lastTickAt === null) return t;
            const delta = now - t.lastTickAt;
            const remaining = Math.max(0, t.remainingMs - delta);
            return {
              ...t,
              remainingMs: remaining,
              status: remaining <= 0 ? ("finished" as const) : t.status,
              lastTickAt: remaining <= 0 ? null : now,
            };
          }),
        };
      }),

    clearFinishedTimers: () =>
      set((s) => ({
        timers: s.timers.filter((t) => t.status !== "finished"),
      })),
  };
});
