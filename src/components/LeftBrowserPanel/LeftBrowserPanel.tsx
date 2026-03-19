import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ipc } from "../../lib/tauriIpc";
import { useBrowserConfigStore } from "../../store/browserConfigStore";
import "./LeftBrowserPanel.css";

const WEBVIEW_LABEL = "browser-left-panel";
const URL_STORAGE_KEY = "v-terminal:browser-panel-url";

interface LeftBrowserPanelProps {
  isVisible: boolean;
  overlayActive: boolean;
  onClose: () => void;
}

interface BrowserUrlPayload {
  label: string;
  url: string;
}

export function LeftBrowserPanel({ isVisible, overlayActive, onClose }: LeftBrowserPanelProps) {
  const { t } = useTranslation();
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(() => localStorage.getItem(URL_STORAGE_KEY) ?? "");
  const [inputValue, setInputValue] = useState(() => localStorage.getItem(URL_STORAGE_KEY) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const urlRef = useRef(url);
  urlRef.current = url;
  const createdRef = useRef(false);
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;

  const getStartUrl = useBrowserConfigStore((s) => s.getStartUrl);

  // Persist URL changes to localStorage
  const persistUrl = useCallback((newUrl: string) => {
    try {
      localStorage.setItem(URL_STORAGE_KEY, newUrl);
    } catch {}
  }, []);

  // Lazy-create webview on first isVisible=true (keep-alive: never destroyed)
  useEffect(() => {
    if (!isVisible || createdRef.current) return;

    const el = placeholderRef.current;
    if (!el) return;

    const startUrl = localStorage.getItem(URL_STORAGE_KEY) || getStartUrl();
    const rect = el.getBoundingClientRect();

    ipc.browserCreate(
      WEBVIEW_LABEL,
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
      persistUrl(startUrl);
    }).catch((err) => {
      setError(String(err));
    });
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for URL changes from the webview
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    listen<BrowserUrlPayload>("browser-url-changed", (event) => {
      if (event.payload.label !== WEBVIEW_LABEL) return;
      const newUrl = event.payload.url;
      if (newUrl !== urlRef.current) {
        setUrl(newUrl);
        setInputValue(newUrl === "about:blank" ? "" : newUrl);
        persistUrl(newUrl);
      }
    }).then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [persistUrl]);

  // Sync webview bounds: show when visible, hide (0,0,0,0) when not
  const shouldShow = isVisible && !overlayActive;

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el || !createdRef.current) return;

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const syncBounds = () => {
      if (!createdRef.current) return;
      if (!shouldShow) {
        ipc.browserResize(WEBVIEW_LABEL, 0, 0, 0, 0).catch(() => {});
      } else {
        const rect = el.getBoundingClientRect();
        ipc.browserResize(WEBVIEW_LABEL, rect.left, rect.top, rect.width, rect.height).catch(() => {});
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

    window.addEventListener("resize", throttledSync);

    // Initial sync
    syncBounds();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", throttledSync);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [shouldShow]);

  // Navigation handlers
  const handleNavigate = useCallback((targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    ipc.browserNavigate(WEBVIEW_LABEL, trimmed).catch(() => {});
  }, []);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(inputValue);
  }, [inputValue, handleNavigate]);

  const handleBack = useCallback(() => {
    ipc.browserGoBack(WEBVIEW_LABEL).catch(() => {});
  }, []);

  const handleForward = useCallback(() => {
    ipc.browserGoForward(WEBVIEW_LABEL).catch(() => {});
  }, []);

  const handleReload = useCallback(() => {
    ipc.browserReload(WEBVIEW_LABEL).catch(() => {});
  }, []);

  const handleHome = useCallback(() => {
    const homeUrl = getStartUrl();
    ipc.browserNavigate(WEBVIEW_LABEL, homeUrl).catch(() => {});
    setInputValue(homeUrl);
  }, [getStartUrl]);

  const handleRetry = useCallback(() => {
    setError(null);
    const el = placeholderRef.current;
    if (!el) return;
    const startUrl = localStorage.getItem(URL_STORAGE_KEY) || getStartUrl();
    const rect = el.getBoundingClientRect();
    ipc.browserCreate(WEBVIEW_LABEL, startUrl, rect.left, rect.top, rect.width, rect.height)
      .then(() => {
        setCreated(true);
        createdRef.current = true;
      })
      .catch((err) => setError(String(err)));
  }, [getStartUrl]);

  return (
    <div className={`left-browser-panel${isVisible ? "" : " left-browser-panel--hidden"}`}>
      {/* Header */}
      <div className="left-browser-header">
        <span className="left-browser-title">{t('browser.title')}</span>
        <button
          className="left-browser-close"
          onClick={onClose}
          aria-label="Close browser panel"
          title="Close browser panel"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Toolbar */}
      <div className="left-browser-toolbar">
        <button className="left-browser-nav-btn" onClick={handleBack} title={t('browser.back')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7 9 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="left-browser-nav-btn" onClick={handleForward} title={t('browser.forward')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2.5L9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="left-browser-nav-btn" onClick={handleReload} title={t('browser.reload')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7a4.5 4.5 0 1 1 1 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <path d="M2.5 11.5V7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button className="left-browser-nav-btn" onClick={handleHome} title={t('browser.home')}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L7 2.5L11.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 6v5.5h2.25V9h1.5v2.5H10V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <form className="left-browser-url-form" onSubmit={handleUrlSubmit}>
          <input
            className="left-browser-url-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t('browser.enterUrl')}
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      </div>

      {/* Webview placeholder */}
      <div ref={placeholderRef} className="left-browser-content">
        {error && !created && (
          <div className="left-browser-error">
            <p className="left-browser-error-msg">{error}</p>
            <button className="left-browser-retry-btn" onClick={handleRetry}>
              {t('browser.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
