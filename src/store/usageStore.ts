import { create } from "zustand";
import { ipc, type UsageData } from "../lib/tauriIpc";

export interface UsageEntry {
  sessionId: string;
  environment: string;
  data: UsageData;
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
          entries: [...filtered, { sessionId, environment, data }],
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
