import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Layout } from "../../types/terminal";
import { ThemePicker } from "../ThemePicker/ThemePicker";
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
  onLayoutChange: (layout: Layout) => void;
  onToggleBroadcast: () => void;
  onOpenPalette: () => void;
  onOpenSshManager: () => void;
  onAddTab: () => void;
}

export function SplitToolbar({
  activeLayout,
  broadcastEnabled,
  onLayoutChange,
  onToggleBroadcast,
  onOpenPalette,
  onOpenSshManager,
  onAddTab,
}: SplitToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
            onClick={() => { setMenuOpen((v) => !v); setThemeOpen(false); }}
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
                <span className="more-menu-item-label">SSH Connections</span>
              </button>
              <div className="more-menu-sep" />
              {/* Appearance */}
              <button
                className="more-menu-item"
                onClick={() => { setMenuOpen(false); setThemeOpen(true); }}
                role="menuitem"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className="more-menu-item-label">Appearance</span>
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>
      <ThemePicker
        anchorRef={moreButtonRef}
        isOpen={themeOpen}
        onClose={() => setThemeOpen(false)}
      />
    </>
  );
}
