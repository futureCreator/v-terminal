import { useState } from "react"
import { useBookmarkStore } from "../../store/bookmarkStore"
import { useBrowserHistoryStore } from "../../store/browserHistoryStore"
import "./BrowserEmptyState.css"

interface BrowserEmptyStateProps {
  tabId: string
  onNavigate: (url: string) => void
}

// ── Helper: extract favicon URL from an origin ──
function faviconUrl(url: string): string {
  try {
    const { origin } = new URL(url)
    return `${origin}/favicon.ico`
  } catch {
    return ""
  }
}

// ── Helper: first uppercase letter of the hostname ──
function domainInitial(url: string): string {
  try {
    const { hostname } = new URL(url)
    const label = hostname.replace(/^www\./, "")
    return label.charAt(0).toUpperCase()
  } catch {
    return "?"
  }
}

// ── Helper: relative time string ──
function timeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

// ── Favicon tile with initial fallback ──
interface FaviconImageProps {
  url: string
  size?: number
}

function FaviconImage({ url, size = 24 }: FaviconImageProps) {
  const [failed, setFailed] = useState(false)
  const src = faviconUrl(url)
  const initial = domainInitial(url)

  if (!src || failed) {
    return (
      <div
        className="browser-empty-initial"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="browser-empty-favicon"
      onError={() => setFailed(true)}
    />
  )
}

export function BrowserEmptyState({ tabId, onNavigate }: BrowserEmptyStateProps) {
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const getHistory = useBrowserHistoryStore((s) => s.getHistory)
  const recent = getHistory(tabId).slice(0, 10)

  return (
    <div className="browser-empty">
      {/* ── Bookmarks ── */}
      {bookmarks.length > 0 && (
        <section className="browser-empty-section">
          <h2 className="browser-empty-section-title">Bookmarks</h2>
          <div className="browser-empty-grid">
            {bookmarks.map((bm) => (
              <button
                key={bm.id}
                className="browser-empty-tile"
                onClick={() => onNavigate(bm.url)}
                title={bm.url}
              >
                <div className="browser-empty-tile-icon">
                  <FaviconImage url={bm.url} size={24} />
                </div>
                <span className="browser-empty-tile-name">{bm.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Recent history ── */}
      {recent.length > 0 && (
        <section className="browser-empty-section">
          <h2 className="browser-empty-section-title">Recent in this Workspace</h2>
          <div className="browser-empty-list">
            {recent.map((entry, idx) => (
              <button
                key={`${entry.url}-${idx}`}
                className="browser-empty-row"
                onClick={() => onNavigate(entry.url)}
                title={entry.url}
              >
                <div className="browser-empty-row-icon">
                  <FaviconImage url={entry.url} size={16} />
                </div>
                <div className="browser-empty-row-body">
                  <span className="browser-empty-row-title">
                    {entry.title || entry.url}
                  </span>
                  <span className="browser-empty-row-url">{entry.url}</span>
                </div>
                <span className="browser-empty-row-time">{timeAgo(entry.visitedAt)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty-empty state: nothing saved yet */}
      {bookmarks.length === 0 && recent.length === 0 && (
        <div className="browser-empty-blank">
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            className="browser-empty-blank-icon"
          >
            <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
            <path
              d="M6 17h36"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="13.5" r="1.5" fill="currentColor" />
            <circle cx="18" cy="13.5" r="1.5" fill="currentColor" />
            <circle cx="24" cy="13.5" r="1.5" fill="currentColor" />
          </svg>
          <p className="browser-empty-blank-label">Enter a URL to get started</p>
        </div>
      )}
    </div>
  )
}
