import { useState, useRef, useEffect, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ipc } from "../../lib/tauriIpc";
import { useBrowserConfigStore } from "../../store/browserConfigStore";
import { useTabStore } from "../../store/tabStore";
import "./BrowserPanel.css";

interface BrowserPanelProps {
  panelId: string;
  tabId: string;
  browserUrl?: string;
  isActive: boolean;
  isVisible: boolean;
  onFocus: () => void;
}

interface BrowserUrlPayload {
  label: string;
  url: string;
}

export function BrowserPanel({
  panelId,
  tabId,
  browserUrl,
  isActive,
  isVisible,
  onFocus,
}: BrowserPanelProps) {
  const webviewLabel = `browser-${panelId}`;
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(browserUrl ?? "");
  const [inputValue, setInputValue] = useState(browserUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const urlRef = useRef(url);
  urlRef.current = url;
  const createdRef = useRef(false);

  const getStartUrl = useBrowserConfigStore((s) => s.getStartUrl);
  const switchPanelConnection = useTabStore((s) => s.switchPanelConnection);

  // Persist URL changes to workspace
  const persistUrl = useCallback((newUrl: string) => {
    switchPanelConnection(tabId, panelId, {
      type: "browser",
      browserUrl: newUrl,
    });
  }, [tabId, panelId, switchPanelConnection]);

  // Create webview on mount
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;

    const startUrl = browserUrl || getStartUrl();
    const rect = el.getBoundingClientRect();

    ipc.browserCreate(
      webviewLabel,
      startUrl,
      rect.left,
      rect.top,
      rect.width,
      rect.height,
    ).then(() => {
      setCreated(true);
      createdRef.current = true;
      setError(null);
      setUrl(startUrl);
      setInputValue(startUrl === "about:blank" ? "" : startUrl);
    }).catch((err) => {
      setError(String(err));
    });

    return () => {
      if (createdRef.current) {
        ipc.browserDestroy(webviewLabel).catch(() => {});
        createdRef.current = false;
      }
    };
  }, [webviewLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for URL changes
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<BrowserUrlPayload>("browser-url-changed", (event) => {
      if (event.payload.label !== webviewLabel) return;
      const newUrl = event.payload.url;
      if (newUrl !== urlRef.current) {
        setUrl(newUrl);
        setInputValue(newUrl === "about:blank" ? "" : newUrl);
        persistUrl(newUrl);
      }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [webviewLabel, persistUrl]);

  // ResizeObserver + visibility sync — single effect handles both
  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || !created) return;

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const syncBounds = () => {
      if (!createdRef.current) return;
      if (!isVisible) {
        ipc.browserResize(webviewLabel, 0, 0, 0, 0).catch(() => {});
      } else {
        const rect = el.getBoundingClientRect();
        ipc.browserResize(webviewLabel, rect.left, rect.top, rect.width, rect.height).catch(() => {});
      }
    };

    const throttledSync = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        syncBounds();
      }, 50);
    };

    const observer = new ResizeObserver(throttledSync);
    observer.observe(el);

    // Also sync on window resize
    window.addEventListener("resize", throttledSync);

    // Initial sync (handles visibility on mount/tab switch)
    syncBounds();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", throttledSync);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [webviewLabel, created, isVisible]);

  // Navigation handlers
  const handleNavigate = useCallback((targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    ipc.browserNavigate(webviewLabel, trimmed).catch(() => {});
  }, [webviewLabel]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(inputValue);
  }, [inputValue, handleNavigate]);

  const handleBack = useCallback(() => {
    ipc.browserGoBack(webviewLabel).catch(() => {});
  }, [webviewLabel]);

  const handleForward = useCallback(() => {
    ipc.browserGoForward(webviewLabel).catch(() => {});
  }, [webviewLabel]);

  const handleReload = useCallback(() => {
    ipc.browserReload(webviewLabel).catch(() => {});
  }, [webviewLabel]);

  const handleRetry = useCallback(() => {
    setError(null);
    const el = placeholderRef.current;
    if (!el) return;
    const startUrl = browserUrl || getStartUrl();
    const rect = el.getBoundingClientRect();
    ipc.browserCreate(webviewLabel, startUrl, rect.left, rect.top, rect.width, rect.height)
      .then(() => {
        setCreated(true);
        createdRef.current = true;
      })
      .catch((err) => setError(String(err)));
  }, [webviewLabel, browserUrl, getStartUrl]);

  return (
    <div
      className={`browser-panel${isActive ? " browser-panel--active" : ""}`}
      onClick={onFocus}
    >
      {/* Toolbar */}
      <div className="browser-toolbar">
        <button className="browser-nav-btn" onClick={handleBack} title="Back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="browser-nav-btn" onClick={handleForward} title="Forward">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2.5L9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="browser-nav-btn" onClick={handleReload} title="Reload">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7a4.5 4.5 0 1 1 1 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M2.5 11.5V7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <form className="browser-url-form" onSubmit={handleUrlSubmit}>
          <input
            className="browser-url-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter URL..."
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      </div>

      {/* Webview placeholder */}
      <div ref={placeholderRef} className="browser-content">
        {error && (
          <div className="browser-error">
            <p className="browser-error-msg">{error}</p>
            <button className="browser-retry-btn" onClick={handleRetry}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
