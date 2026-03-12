import { useEffect, useRef } from "react";
import { useThemeStore } from "../../store/themeStore";
import { THEME_GROUPS } from "../../themes/definitions";
import "./ThemePicker.css";

interface ThemePickerProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
}

export function ThemePicker({ anchorRef, isOpen, onClose }: ThemePickerProps) {
  const { themeId, setThemeId } = useThemeStore();
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div ref={pickerRef} className="theme-picker">
      <div className="theme-picker-header">Theme</div>

      {/* Auto */}
      <button
        className={`theme-picker-item ${themeId === "auto" ? "theme-picker-item--active" : ""}`}
        onClick={() => { setThemeId("auto"); onClose(); }}
      >
        <span className="theme-picker-auto-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1.5" width="12" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M4.5 12h5M7 10v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </span>
        <span className="theme-picker-name">Auto</span>
        {themeId === "auto" && <CheckIcon />}
      </button>

      {/* Grouped themes */}
      {THEME_GROUPS.map((group) => (
        <div key={group.label} className="theme-picker-group">
          <div className="theme-picker-group-label">{group.label}</div>
          {group.themes.map((theme) => (
            <button
              key={theme.id}
              className={`theme-picker-item ${themeId === theme.id ? "theme-picker-item--active" : ""}`}
              onClick={() => { setThemeId(theme.id); onClose(); }}
            >
              <span className="theme-picker-swatch" style={{ background: theme.swatch[0] }}>
                {theme.swatch.slice(1).map((color, i) => (
                  <span key={i} className="theme-picker-dot" style={{ background: color }} />
                ))}
              </span>
              <span className="theme-picker-name">{theme.name}</span>
              {themeId === theme.id && <CheckIcon />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="theme-picker-check" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
