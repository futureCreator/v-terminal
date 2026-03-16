import { create } from "zustand"
import type { BrowserPanelState } from "../types/browser"

interface BrowserStore {
  panels: Record<string, BrowserPanelState>
  setPanel: (panelId: string, state: BrowserPanelState) => void
  updatePanel: (panelId: string, updates: Partial<BrowserPanelState>) => void
  removePanel: (panelId: string) => void
  getPanel: (panelId: string) => BrowserPanelState | undefined
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  panels: {},

  setPanel: (panelId, state) => {
    set((s) => ({ panels: { ...s.panels, [panelId]: state } }))
  },

  updatePanel: (panelId, updates) => {
    set((s) => {
      const existing = s.panels[panelId]
      if (!existing) return s
      return { panels: { ...s.panels, [panelId]: { ...existing, ...updates } } }
    })
  },

  removePanel: (panelId) => {
    set((s) => {
      const next = { ...s.panels }
      delete next[panelId]
      return { panels: next }
    })
  },

  getPanel: (panelId) => get().panels[panelId],
}))
