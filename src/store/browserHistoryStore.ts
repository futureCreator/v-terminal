import { create } from "zustand"
import type { BrowserHistoryEntry } from "../types/browser"

const STORAGE_KEY = "v-terminal:browser-history"
const MAX_ENTRIES_PER_TAB = 100

function loadAll(): Record<string, BrowserHistoryEntry[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, BrowserHistoryEntry[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

interface BrowserHistoryStore {
  historyByTab: Record<string, BrowserHistoryEntry[]>
  addEntry: (entry: Omit<BrowserHistoryEntry, "visitedAt">) => void
  getHistory: (tabId: string) => BrowserHistoryEntry[]
  clearHistory: (tabId: string) => void
  removeTabHistory: (tabId: string) => void
  searchHistory: (tabId: string, query: string) => BrowserHistoryEntry[]
}

export const useBrowserHistoryStore = create<BrowserHistoryStore>((set, get) => ({
  historyByTab: loadAll(),

  addEntry: (entry) => {
    set((s) => {
      const tabEntries = [...(s.historyByTab[entry.tabId] || [])]
      tabEntries.unshift({ ...entry, visitedAt: Date.now() })
      if (tabEntries.length > MAX_ENTRIES_PER_TAB) {
        tabEntries.length = MAX_ENTRIES_PER_TAB
      }
      const next = { ...s.historyByTab, [entry.tabId]: tabEntries }
      saveAll(next)
      return { historyByTab: next }
    })
  },

  getHistory: (tabId) => get().historyByTab[tabId] || [],

  clearHistory: (tabId) => {
    set((s) => {
      const next = { ...s.historyByTab, [tabId]: [] }
      saveAll(next)
      return { historyByTab: next }
    })
  },

  removeTabHistory: (tabId) => {
    set((s) => {
      const next = { ...s.historyByTab }
      delete next[tabId]
      saveAll(next)
      return { historyByTab: next }
    })
  },

  searchHistory: (tabId, query) => {
    const entries = get().historyByTab[tabId] || []
    const q = query.toLowerCase()
    return entries.filter(
      (e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)
    )
  },
}))
