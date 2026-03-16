import "./BrowserErrorState.css"

interface BrowserErrorStateProps {
  error: string
  onRetry: () => void
}

export function BrowserErrorState({ error, onRetry }: BrowserErrorStateProps) {
  return (
    <div className="browser-error">
      <div className="browser-error-card">
        {/* Warning icon */}
        <div className="browser-error-icon-wrap" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 5L37 34H3L20 5Z"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <line
              x1="20"
              y1="16"
              x2="20"
              y2="26"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="20" cy="30.5" r="1.2" fill="currentColor" />
          </svg>
        </div>

        {/* Heading */}
        <h2 className="browser-error-heading">Page Failed to Load</h2>

        {/* Error message */}
        <p className="browser-error-message">{error}</p>

        {/* Retry button */}
        <button className="browser-error-retry" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  )
}
