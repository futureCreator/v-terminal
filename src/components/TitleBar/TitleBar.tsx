import { getCurrentWindow } from "@tauri-apps/api/window";
import "./TitleBar.css";

export function TitleBar() {
  const win = getCurrentWindow();
  const isWindows = navigator.platform.toUpperCase().includes("WIN");

  if (isWindows) {
    return (
      <div className="titlebar titlebar--windows" data-tauri-drag-region>
        <span className="titlebar-app-name" data-tauri-drag-region>
          v-terminal
        </span>
        <div className="titlebar-win-controls">
          <button
            className="win-btn win-btn--minimize"
            onClick={() => win.minimize()}
            title="Minimize"
            aria-label="Minimize window"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="win-btn win-btn--maximize"
            onClick={() => win.toggleMaximize()}
            title="Maximize"
            aria-label="Maximize window"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </button>
          <button
            className="win-btn win-btn--close"
            onClick={() => win.close()}
            title="Close"
            aria-label="Close window"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-traffic-lights">
        <button
          className="traffic-light traffic-close"
          onClick={() => win.close()}
          title="Close"
          aria-label="Close window"
        >
          <svg className="traffic-light-icon" viewBox="0 0 6 6" fill="none">
            <path d="M1 1l4 4M5 1L1 5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="traffic-light traffic-minimize"
          onClick={() => win.minimize()}
          title="Minimize"
          aria-label="Minimize window"
        >
          <svg className="traffic-light-icon" viewBox="0 0 6 6" fill="none">
            <path d="M1 3h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="traffic-light traffic-maximize"
          onClick={() => win.toggleMaximize()}
          title="Zoom"
          aria-label="Zoom window"
        >
          <svg className="traffic-light-icon" viewBox="0 0 6 6" fill="none">
            <path d="M1 1l4 4M1 5V1h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="titlebar-spacer" data-tauri-drag-region />
    </div>
  );
}
