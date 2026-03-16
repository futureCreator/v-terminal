import { useEffect, useRef, useCallback } from "react"
import { useBrowserStore } from "../../store/browserStore"
import { useBookmarkStore } from "../../store/bookmarkStore"
import { useBrowserHistoryStore } from "../../store/browserHistoryStore"
import { browserIpc } from "../../lib/browserIpc"
import { BrowserUrlBar } from "./BrowserUrlBar"
import { BrowserEmptyState } from "./BrowserEmptyState"
import { BrowserErrorState } from "./BrowserErrorState"
import type { BrowserPanelState } from "../../types/browser"
import "./BrowserPane.css"

interface BrowserPaneProps {
  panelId: string
  tabId: string
  initialUrl?: string
  isActive: boolean
  isVisible: boolean
  onFocus: () => void
}

export function BrowserPane({
  panelId,
  tabId,
  initialUrl,
  isActive,
  isVisible,
  onFocus,
}: BrowserPaneProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const webviewCreatedRef = useRef(false)
  const lastBoundsRef = useRef({ x: 0, y: 0, width: 0, height: 0 })

  // ── Store selectors ──
  const panel = useBrowserStore((s) => s.panels[panelId])
  const setPanel = useBrowserStore((s) => s.setPanel)
  const updatePanel = useBrowserStore((s) => s.updatePanel)
  const removePanel = useBrowserStore((s) => s.removePanel)

  const isBookmarked = useBookmarkStore((s) => s.isBookmarked)
  const addBookmark = useBookmarkStore((s) => s.addBookmark)
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark)
  const getBookmarkByUrl = useBookmarkStore((s) => s.getBookmarkByUrl)

  const addHistoryEntry = useBrowserHistoryStore((s) => s.addEntry)

  const url = panel?.url ?? ""
  const title = panel?.title ?? ""
  const isLoading = panel?.isLoading ?? false
  const canGoBack = panel?.canGoBack ?? false
  const canGoForward = panel?.canGoForward ?? false
  const error = panel?.error

  // ── Initialize panel state on mount ──
  useEffect(() => {
    const initial: BrowserPanelState = {
      panelId,
      url: initialUrl ?? "",
      title: "",
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
    }
    setPanel(panelId, initial)
    return () => {
      removePanel(panelId)
    }
  }, [panelId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync WebView bounds with DOM container ──
  const syncBounds = useCallback(() => {
    const el = contentRef.current
    if (!el || !webviewCreatedRef.current) return
    const rect = el.getBoundingClientRect()
    const bounds = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }
    // Skip if nothing changed
    const last = lastBoundsRef.current
    if (
      bounds.x === last.x &&
      bounds.y === last.y &&
      bounds.width === last.width &&
      bounds.height === last.height
    ) {
      return
    }
    lastBoundsRef.current = bounds
    browserIpc.setBounds(panelId, bounds.x, bounds.y, bounds.width, bounds.height).catch(() => {})
  }, [panelId])

  // ── Create WebView and navigate ──
  const createAndNavigate = useCallback(
    async (targetUrl: string) => {
      const el = contentRef.current
      if (!el) {
        console.error("[BrowserPane] contentRef is null — cannot create webview")
        return
      }

      const rect = el.getBoundingClientRect()
      const x = Math.round(rect.x)
      const y = Math.round(rect.y)
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)

      if (width <= 0 || height <= 0) {
        console.error("[BrowserPane] container has zero size:", { x, y, width, height })
        updatePanel(panelId, {
          error: "Browser container has zero size — try resizing the window",
          isLoading: false,
        })
        return
      }

      lastBoundsRef.current = { x, y, width, height }

      try {
        await browserIpc.createWebview(panelId, targetUrl, x, y, width, height)
        webviewCreatedRef.current = true
        updatePanel(panelId, { url: targetUrl, isLoading: true, error: undefined })
        // Ensure the webview is visible — the visibility effect may not re-run
        // since webviewCreatedRef is a ref, not state.
        browserIpc.show(panelId).catch(() => {})
      } catch (err) {
        console.error("[BrowserPane] createWebview failed:", err)
        updatePanel(panelId, {
          error: err instanceof Error ? err.message : String(err),
          isLoading: false,
        })
      }
    },
    [panelId, updatePanel]
  )

  // ── Handle navigation from URL bar ──
  const handleNavigate = useCallback(
    async (targetUrl: string) => {
      if (!webviewCreatedRef.current) {
        await createAndNavigate(targetUrl)
      } else {
        try {
          updatePanel(panelId, { url: targetUrl, isLoading: true, error: undefined })
          await browserIpc.navigate(panelId, targetUrl)
        } catch (err) {
          console.error("[BrowserPane] navigate failed:", err)
          updatePanel(panelId, {
            error: err instanceof Error ? err.message : String(err),
            isLoading: false,
          })
        }
      }
    },
    [panelId, updatePanel, createAndNavigate]
  )

  // ── Navigation actions ──
  const handleGoBack = useCallback(() => {
    browserIpc.goBack(panelId).catch(() => {})
  }, [panelId])

  const handleGoForward = useCallback(() => {
    browserIpc.goForward(panelId).catch(() => {})
  }, [panelId])

  const handleReload = useCallback(() => {
    if (error) {
      // Retry by re-navigating to current URL
      if (url) handleNavigate(url)
      return
    }
    browserIpc.reload(panelId).catch(() => {})
  }, [panelId, error, url, handleNavigate])

  // ── Bookmark toggle ──
  const handleToggleBookmark = useCallback(() => {
    if (!url) return
    const existing = getBookmarkByUrl(url)
    if (existing) {
      removeBookmark(existing.id)
    } else {
      addBookmark({ name: title || url, url })
    }
  }, [url, title, getBookmarkByUrl, removeBookmark, addBookmark])

  // ── Error retry ──
  const handleRetry = useCallback(() => {
    if (url) handleNavigate(url)
  }, [url, handleNavigate])

  // ── Auto-navigate on mount if initialUrl is provided ──
  useEffect(() => {
    if (initialUrl && !webviewCreatedRef.current) {
      createAndNavigate(initialUrl)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen to IPC events ──
  useEffect(() => {
    const unlisteners: Array<() => void> = []

    browserIpc.onUrlChanged(({ panelId: id, url: newUrl }) => {
      if (id !== panelId) return
      updatePanel(panelId, { url: newUrl, error: undefined })
      // Record history entry
      addHistoryEntry({
        tabId,
        url: newUrl,
        title: useBrowserStore.getState().panels[panelId]?.title ?? "",
      })
    }).then((unlisten) => unlisteners.push(unlisten))

    browserIpc.onTitleChanged(({ panelId: id, title: newTitle }) => {
      if (id !== panelId) return
      updatePanel(panelId, { title: newTitle })
    }).then((unlisten) => unlisteners.push(unlisten))

    browserIpc.onLoadingChanged(({ panelId: id, isLoading: loading }) => {
      if (id !== panelId) return
      updatePanel(panelId, { isLoading: loading })
    }).then((unlisten) => unlisteners.push(unlisten))

    return () => {
      unlisteners.forEach((fn) => fn())
    }
  }, [panelId, tabId, updatePanel, addHistoryEntry])

  // ── Visibility: show/hide native WebView ──
  useEffect(() => {
    if (!webviewCreatedRef.current) return
    if (isVisible) {
      browserIpc.show(panelId).catch(() => {})
      // Re-sync bounds when becoming visible (layout may have changed)
      syncBounds()
    } else {
      browserIpc.hide(panelId).catch(() => {})
    }
  }, [isVisible, panelId, syncBounds])

  // ── ResizeObserver + window resize for position sync ──
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      syncBounds()
    })
    observer.observe(el)

    const handleWindowResize = () => syncBounds()
    window.addEventListener("resize", handleWindowResize)

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", handleWindowResize)
    }
  }, [syncBounds])

  // ── Cleanup: destroy native WebView on unmount ──
  useEffect(() => {
    return () => {
      if (webviewCreatedRef.current) {
        browserIpc.close(panelId).catch(() => {})
        webviewCreatedRef.current = false
      }
    }
  }, [panelId])

  // ── Determine what to show in content area ──
  const showEmptyState = !webviewCreatedRef.current && !error && !url
  const bookmarkedCurrent = url ? isBookmarked(url) : false

  return (
    <div
      className={`browser-pane${isActive ? " browser-pane--active" : ""}`}
      onMouseDown={onFocus}
    >
      <BrowserUrlBar
        url={url}
        isLoading={isLoading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        isBookmarked={bookmarkedCurrent}
        onNavigate={handleNavigate}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onReload={handleReload}
        onToggleBookmark={handleToggleBookmark}
      />
      <div ref={contentRef} className="browser-content">
        {error ? (
          <BrowserErrorState error={error} onRetry={handleRetry} />
        ) : showEmptyState ? (
          <BrowserEmptyState tabId={tabId} onNavigate={handleNavigate} />
        ) : null}
        {/* Native WebView renders as an OS overlay on top of this content area */}
      </div>
    </div>
  )
}
