import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Layout } from "../../types/terminal";
import { useThemeStore } from "../../store/themeStore";
import { useTerminalFontStore, MIN_SIZE, MAX_SIZE, DEFAULT_SIZE } from "../../store/terminalFontStore";
import { THEME_GROUPS } from "../../themes/definitions";
import "./SplitToolbar.css";

const LAYOUTS: Array<{ value: Layout; label: string; icon: React.ReactNode }> = [
  {
    value: 1,
    label: "Single",
    icon: (
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <rect x="1" y="1" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: 2,
    label: "2 Panels",
    icon: (
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <rect x="1" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="10" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: 3,
    label: "3 Panels",
    icon: (
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <rect x="1" y="1" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
        <rect x="10" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="10" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: 4,
    label: "4 Panels",
    icon: (
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
        <rect x="1" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="10" y="1" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="1" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="10" y="7.5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  {
    value: "4c",
    label: "4 Columns",
    icon: (
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
        <rect x="1" y="1" width="4.25" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="6.25" y="1" width="4.25" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="11.5" y="1" width="4.25" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="16.75" y="1" width="4.25" height="12" rx="1" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
  },
  {
    value: 6,
    label: "6 Panels",
    icon: (
      <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
        <rect x="1" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="7.5" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="14" y="1" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="1" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="7.5" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
        <rect x="14" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.1" />
      </svg>
    ),
  },
  {
    value: 9,
    label: "9 Panels",
    icon: (
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
        {[0, 1, 2].map((col) =>
          [0, 1, 2].map((row) => (
            <rect
              key={`${col}-${row}`}
              x={1 + col * 6.5}
              y={1 + row * 4.8}
              width="5"
              height="3.6"
              rx="0.8"
              stroke="currentColor"
              strokeWidth="1"
            />
          ))
        )}
      </svg>
    ),
  },
];

interface SplitToolbarProps {
  activeLayout: Layout;
  broadcastEnabled: boolean;
  sidebarOpen: boolean;
  onLayoutChange: (layout: Layout) => void;
  onToggleBroadcast: () => void;
  onToggleToolkit: () => void;
  onOpenPalette: () => void;
  onOpenSshManager: () => void;
  onAddTab: () => void;
}

export function SplitToolbar({
  activeLayout,
  broadcastEnabled,
  sidebarOpen,
  onLayoutChange,
  onToggleBroadcast,
  onToggleToolkit,
  onOpenPalette,
  onOpenSshManager,
  onAddTab,
}: SplitToolbarProps) {
  const { themeId, setThemeId } = useThemeStore();
  const { fontSize, increase: fontIncrease, decrease: fontDecrease, reset: fontReset } = useTerminalFontStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState<"main" | "appearance">("main");
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) setView("main");
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen && moreButtonRef.current) {
      const rect = moreButtonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen]);

  return (
    <>
      <div className="split-toolbar">
        <button
          className="toolbar-add-btn"
          onClick={onAddTab}
          title="New Tab"
          aria-label="New tab"
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        <div className="more-wrap">
          <button
            ref={moreButtonRef}
            className={`more-btn${menuOpen ? " more-btn--open" : ""}`}
            onClick={() => { setMenuOpen((v) => !v); }}
            title="More options"
            aria-label="More options"
            aria-expanded={menuOpen}
          >
            <svg width="16" height="4" viewBox="0 0 16 4" fill="none">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
              <circle cx="8" cy="2" r="1.5" fill="currentColor" />
              <circle cx="14" cy="2" r="1.5" fill="currentColor" />
            </svg>
          </button>
          {menuOpen && createPortal(
            <div
              ref={menuRef}
              className="more-menu"
              role="menu"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              {view === "main" ? (
                <>
                  {/* Layout */}
                  <div className="more-menu-section">
                    <span className="more-menu-section-label">Layout</span>
                    <div className="more-menu-layout-row">
                      {LAYOUTS.map(({ value, label, icon }) => (
                        <button
                          key={value}
                          className={`more-menu-layout-btn${activeLayout === value ? " more-menu-layout-btn--active" : ""}`}
                          onClick={() => { onLayoutChange(value); setMenuOpen(false); }}
                          title={label}
                          aria-label={label}
                          aria-pressed={activeLayout === value}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="more-menu-sep" />
                  {/* Command Palette */}
                  <button
                    className="more-menu-item"
                    onClick={() => { onOpenPalette(); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M4 6.5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8.5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span className="more-menu-item-label">Command Palette</span>
                    <span className="more-menu-kbd">Ctrl+K</span>
                  </button>
                  <div className="more-menu-sep" />
                  {/* Broadcast */}
                  <button
                    className={`more-menu-item${broadcastEnabled ? " more-menu-item--broadcast" : ""}`}
                    onClick={() => { onToggleBroadcast(); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                      <path d="M5.5 5.5A3.5 3.5 0 0 0 5.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M10.5 5.5A3.5 3.5 0 0 1 10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M3.5 3.5A6.36 6.36 0 0 0 3.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M12.5 3.5A6.36 6.36 0 0 1 12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span className="more-menu-item-label">Broadcast Input</span>
                    {broadcastEnabled && <span className="more-menu-badge">ON</span>}
                  </button>
                  <div className="more-menu-sep" />
                  {/* SSH */}
                  <button
                    className="more-menu-item"
                    onClick={() => { onOpenSshManager(); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="2.5" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="1" y="9.5" width="14" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                      <circle cx="12.5" cy="4.5" r="1" fill="currentColor" />
                      <circle cx="12.5" cy="11.5" r="1" fill="currentColor" />
                      <circle cx="10" cy="4.5" r="0.7" fill="currentColor" opacity="0.5" />
                      <circle cx="10" cy="11.5" r="0.7" fill="currentColor" opacity="0.5" />
                    </svg>
                    <span className="more-menu-item-label">SSH Profiles</span>
                  </button>
                  <div className="more-menu-sep" />
                  {/* Toolkit */}
                  <button
                    className={`more-menu-item${sidebarOpen ? " more-menu-item--active" : ""}`}
                    onClick={() => { onToggleToolkit(); setMenuOpen(false); }}
                    role="menuitem"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                      <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                    <span className="more-menu-item-label">Toolkit</span>
                    <span className="more-menu-kbd">Ctrl+Shift+N</span>
                  </button>
                  <div className="more-menu-sep" />
                  {/* Appearance */}
                  <button
                    className="more-menu-item"
                    onClick={() => setView("appearance")}
                    role="menuitem"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span className="more-menu-item-label">Appearance</span>
                    <svg className="more-menu-chevron" width="6" height="10" viewBox="0 0 6 10" fill="none">
                      <path d="M1 1.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="more-menu-appearance">
                  {/* Back */}
                  <button className="more-menu-back" onClick={() => setView("main")}>
                    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                      <path d="M5.5 1.5L1.5 6l4 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                  </button>
                  <div className="more-menu-sep" />
                  {/* Terminal Font Size */}
                  <div className="more-menu-font-section">
                    <span className="more-menu-section-label">Terminal Font</span>
                    <div className="more-menu-font-control">
                      <button
                        className="more-menu-font-btn"
                        onClick={fontDecrease}
                        disabled={fontSize <= MIN_SIZE}
                        title="Decrease font size (Ctrl+-)"
                        aria-label="Decrease font size"
                      >
                        <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
                          <path d="M1 1h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        className="more-menu-font-value"
                        onClick={fontReset}
                        title={`Reset to ${DEFAULT_SIZE}px (Ctrl+0)`}
                      >
                        {fontSize}px
                      </button>
                      <button
                        className="more-menu-font-btn"
                        onClick={fontIncrease}
                        disabled={fontSize >= MAX_SIZE}
                        title="Increase font size (Ctrl+=)"
                        aria-label="Increase font size"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="more-menu-sep" />
                  {/* Auto */}
                  <button
                    className={`more-menu-theme-item${themeId === "auto" ? " more-menu-theme-item--active" : ""}`}
                    onClick={() => { setThemeId("auto"); setMenuOpen(false); }}
                  >
                    <span className="more-menu-theme-auto">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="1.5" width="12" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
                        <path d="M4.5 12h5M7 10v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className="more-menu-theme-name">Auto</span>
                    {themeId === "auto" && <ThemeCheckIcon />}
                  </button>
                  {/* Groups */}
                  {THEME_GROUPS.map((group) => (
                    <div key={group.label} className="more-menu-theme-group">
                      <div className="more-menu-theme-group-label">{group.label}</div>
                      {group.themes.map((theme) => (
                        <button
                          key={theme.id}
                          className={`more-menu-theme-item${themeId === theme.id ? " more-menu-theme-item--active" : ""}`}
                          onClick={() => { setThemeId(theme.id); setMenuOpen(false); }}
                        >
                          <span className="more-menu-theme-swatch" style={{ background: theme.swatch[0] }}>
                            {theme.swatch.slice(1).map((color, i) => (
                              <span key={i} className="more-menu-theme-dot" style={{ background: color }} />
                            ))}
                          </span>
                          <span className="more-menu-theme-name">{theme.name}</span>
                          {themeId === theme.id && <ThemeCheckIcon />}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>,
            document.body
          )}
        </div>
      </div>
    </>
  );
}

function ThemeCheckIcon() {
  return (
    <svg className="more-menu-theme-check" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
