export interface Bookmark {
  id: string
  name: string
  url: string
  favicon?: string
  createdAt: number
}

export interface BrowserHistoryEntry {
  url: string
  title: string
  favicon?: string
  visitedAt: number
  tabId: string
}

export interface BrowserPanelState {
  panelId: string
  url: string
  title: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  error?: string
}
