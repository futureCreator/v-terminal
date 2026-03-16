import { create } from "zustand"
import { v4 as uuidv4 } from "uuid"
import type { Bookmark } from "../types/browser"

const STORAGE_KEY = "v-terminal:bookmarks"

function load(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(bookmarks: Bookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
}

interface BookmarkStore {
  bookmarks: Bookmark[]
  addBookmark: (data: Omit<Bookmark, "id" | "createdAt">) => Bookmark
  removeBookmark: (id: string) => void
  updateBookmark: (id: string, updates: Partial<Omit<Bookmark, "id" | "createdAt">>) => void
  isBookmarked: (url: string) => boolean
  getBookmarkByUrl: (url: string) => Bookmark | undefined
}

export const useBookmarkStore = create<BookmarkStore>((set, get) => ({
  bookmarks: load(),

  addBookmark: (data) => {
    const bookmark: Bookmark = { ...data, id: uuidv4(), createdAt: Date.now() }
    set((s) => {
      const next = [...s.bookmarks, bookmark]
      save(next)
      return { bookmarks: next }
    })
    return bookmark
  },

  removeBookmark: (id) => {
    set((s) => {
      const next = s.bookmarks.filter((b) => b.id !== id)
      save(next)
      return { bookmarks: next }
    })
  },

  updateBookmark: (id, updates) => {
    set((s) => {
      const next = s.bookmarks.map((b) => (b.id === id ? { ...b, ...updates } : b))
      save(next)
      return { bookmarks: next }
    })
  },

  isBookmarked: (url) => get().bookmarks.some((b) => b.url === url),

  getBookmarkByUrl: (url) => get().bookmarks.find((b) => b.url === url),
}))
