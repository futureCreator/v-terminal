import { create } from "zustand";
import { ipc } from "../lib/tauriIpc";

export interface UsageEntry {
  sessionId: string;
  environment: string;
  plan: string;
  usedPercent: number;
  resetAt: number | null;
}

interface UsageState {
  entries: UsageEntry[];
  refreshForSession: (sessionId: string, environment: string) => Promise<void>;
  removeSession: (sessionId: string) => void;
  clearAll: () => void;
}

export const useUsageStore = create<UsageState>((set) => ({
  entries: [],

  refreshForSession: async (sessionId, environment) => {
    try {
      const data = await ipc.getUsage(sessionId);
      set((state) => {
        const filtered = state.entries.filter((e) => e.sessionId !== sessionId);
        return {
          entries: [...filtered, { sessionId, environment, plan: data.plan, usedPercent: data.usedPercent, resetAt: data.resetAt }],
        };
      });
    } catch {
      set((state) => ({ entries: state.entries.filter((e) => e.sessionId !== sessionId) }));
    }
  },

  removeSession: (sessionId) => {
    set((state) => ({ entries: state.entries.filter((e) => e.sessionId !== sessionId) }));
  },

  clearAll: () => set({ entries: [] }),
}));
