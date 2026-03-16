import { useState, useRef, useEffect, useCallback } from "react"
import "./BrowserUrlBar.css"

interface BrowserUrlBarProps {
  url: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  isBookmarked: boolean
  onNavigate: (url: string) => void
  onGoBack: () => void
  onGoForward: () => void
  onReload: () => void
  onToggleBookmark: () => void
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function BrowserUrlBar({
  url,
  isLoading,
  canGoBack,
  canGoForward,
  isBookmarked,
  onNavigate,
  onGoBack,
  onGoForward,
  onReload,
  onToggleBookmark,
}: BrowserUrlBarProps) {
  const [draft, setDraft] = useState(url)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep draft in sync when URL changes externally (navigation from webview)
  useEffect(() => {
    if (!isFocused) {
      setDraft(url)
    }
  }, [url, isFocused])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    // Select all text on focus so user can immediately type a new URL
    requestAnimationFrame(() => {
      inputRef.current?.select()
    })
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
    setDraft(url)
  }, [url])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        const normalized = normalizeUrl(draft)
        if (normalized) {
          // onNavigate is async — catch errors so they don't get silently swallowed
          Promise.resolve(onNavigate(normalized)).catch((err) => {
            console.error("[BrowserUrlBar] navigation failed:", err)
          })
        }
        inputRef.current?.blur()
      } else if (e.key === "Escape") {
        setDraft(url)
        inputRef.current?.blur()
      }
    },
    [draft, url, onNavigate]
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value)
  }, [])

  return (
    <div className="browser-urlbar">
      <div className="browser-urlbar-inner">
        {/* Navigation buttons */}
        <div className="browser-urlbar-nav">
          <button
            className="browser-urlbar-btn"
            onClick={onGoBack}
            disabled={!canGoBack}
            aria-label="Go back"
            title="Go Back"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 2L4 7L9 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="browser-urlbar-btn"
            onClick={onGoForward}
            disabled={!canGoForward}
            aria-label="Go forward"
            title="Go Forward"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5 2L10 7L5 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className={`browser-urlbar-btn${isLoading ? " browser-urlbar-btn--loading" : ""}`}
            onClick={onReload}
            aria-label={isLoading ? "Stop loading" : "Reload"}
            title={isLoading ? "Stop" : "Reload"}
          >
            {isLoading ? (
              /* Stop icon */
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
              </svg>
            ) : (
              /* Reload icon */
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M12 7A5 5 0 1 1 7 2M7 2L10 5M7 2L4 5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>

        {/* URL input */}
        <div className="browser-urlbar-input-wrap">
          <input
            ref={inputRef}
            className="browser-urlbar-input"
            type="text"
            value={draft}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            aria-label="URL"
          />
        </div>

        {/* Bookmark star */}
        <button
          className={`browser-urlbar-btn browser-urlbar-btn--star${isBookmarked ? " browser-urlbar-btn--bookmarked" : ""}`}
          onClick={onToggleBookmark}
          aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
          title={isBookmarked ? "Remove Bookmark" : "Add Bookmark"}
        >
          {isBookmarked ? (
            /* Filled star */
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1.5L8.545 5.145L12.5 5.635L9.75 8.315L10.59 12.5L7 10.385L3.41 12.5L4.25 8.315L1.5 5.635L5.455 5.145L7 1.5Z"
                fill="var(--warning)"
                stroke="var(--warning)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            /* Outline star */
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1.5L8.545 5.145L12.5 5.635L9.75 8.315L10.59 12.5L7 10.385L3.41 12.5L4.25 8.315L1.5 5.635L5.455 5.145L7 1.5Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Loading progress bar */}
      {isLoading && <div className="browser-urlbar-progress" aria-hidden="true" />}
    </div>
  )
}
