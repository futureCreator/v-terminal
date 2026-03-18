import { create } from "zustand";

const STORAGE_KEY = "v-terminal:onboarding-done";

interface OnboardingStore {
  isDone: boolean;
  markDone: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  isDone: localStorage.getItem(STORAGE_KEY) === "true",
  markDone: () => {
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
    set({ isDone: true });
  },
  reset: () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    set({ isDone: false });
  },
}));
