import { useRef, useState } from "react";
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
}

export function SplitToolbar({
  activeLayout,
  broadcastEnabled,
  onLayoutChange,
  onToggleBroadcast,
  onOpenPalette,
}: SplitToolbarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const themeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <div className="split-toolbar">
        <button
          className="palette-btn"
          onClick={onOpenPalette}
          title="Command Palette (Ctrl+K)"
          aria-label="Open command palette"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 6.5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8.5 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="split-toolbar-sep" />
        <div className="split-toolbar-group">
          {LAYOUTS.map(({ value, label, icon }) => (
            <button
              key={value}
              className={`split-btn ${activeLayout === value ? "split-btn--active" : ""}`}
              onClick={() => onLayoutChange(value)}
              title={label}
              aria-label={label}
              aria-pressed={activeLayout === value}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="split-toolbar-sep" />
        <button
          className={`broadcast-btn ${broadcastEnabled ? "broadcast-btn--active" : ""}`}
          onClick={onToggleBroadcast}
          title={broadcastEnabled ? "Disable broadcast" : "Broadcast input to all panels"}
          aria-label="Toggle broadcast"
          aria-pressed={broadcastEnabled}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <path d="M5.5 5.5A3.5 3.5 0 0 0 5.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M10.5 5.5A3.5 3.5 0 0 1 10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M3.5 3.5A6.36 6.36 0 0 0 3.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M12.5 3.5A6.36 6.36 0 0 1 12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="split-toolbar-sep" />
        <button
          ref={themeButtonRef}
          className={`theme-toggle-btn ${pickerOpen ? "theme-toggle-btn--open" : ""}`}
          onClick={() => setPickerOpen((v) => !v)}
          title="Change theme"
          aria-label="Change theme"
          aria-expanded={pickerOpen}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M12.95 3.05l-1.06 1.06M4.11 11.89l-1.06 1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <ThemePicker
        anchorRef={themeButtonRef}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
