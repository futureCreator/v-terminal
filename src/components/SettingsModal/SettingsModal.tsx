import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTerminalConfigStore, MIN_FONT_SIZE, MAX_FONT_SIZE, DEFAULT_FONT_SIZE } from "../../store/terminalConfigStore";
import type { CursorStyle } from "../../store/terminalConfigStore";
import { useThemeStore } from "../../store/themeStore";
import { THEME_GROUPS } from "../../themes/definitions";
import "./SettingsModal.css";

type Tab = "appearance" | "terminal";

const FONT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "JetBrainsMonoNerdFont", label: "JetBrains Mono Nerd" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "Cascadia Code", label: "Cascadia Code" },
  { value: "Source Code Pro", label: "Source Code Pro" },
  { value: "IBM Plex Mono", label: "IBM Plex Mono" },
  { value: "Hack", label: "Hack" },
  { value: "Inconsolata", label: "Inconsolata" },
  { value: "Monaspace Neon", label: "Monaspace Neon" },
  { value: "Geist Mono", label: "Geist Mono" },
  { value: "Victor Mono", label: "Victor Mono" },
  { value: "Commit Mono", label: "Commit Mono" },
  { value: "Maple Mono", label: "Maple Mono" },
  { value: "Recursive Mono", label: "Recursive Mono" },
  { value: "Iosevka", label: "Iosevka" },
  { value: "Sarasa Mono K", label: "Sarasa Mono K" },
  { value: "Tab0 Mono K", label: "Tab0 Mono K" },
];

const CURSOR_OPTIONS: Array<{ value: CursorStyle; label: string }> = [
  { value: "block", label: "Block" },
  { value: "underline", label: "Underline" },
  { value: "bar", label: "Bar" },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("appearance");
  const [closing, setClosing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const {
    fontSize, fontFamily, cursorStyle, cursorBlink, lineHeight, scrollback,
    setFontSize, setFontFamily, setCursorStyle, setCursorBlink, setLineHeight, setScrollback,
    increaseFontSize, decreaseFontSize, resetFontSize,
  } = useTerminalConfigStore();

  const { themeId, setThemeId } = useThemeStore();

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 140);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`settings-overlay${closing ? " settings-overlay--closing" : ""}`}
      onClick={handleOverlayClick}
    >
      <div className="settings-modal" ref={modalRef}>
        {/* Header */}
        <div className="settings-header">
          <div className="settings-title-group">
            <svg className="settings-title-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M3.05 3.05l1.06 1.06M9.89 9.89l1.06 1.06M10.95 3.05l-1.06 1.06M4.11 9.89l-1.06 1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span className="settings-title">Settings</span>
          </div>
          <button className="settings-close" onClick={handleClose} aria-label="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="settings-body">
          {/* Left Nav */}
          <nav className="settings-nav">
            <button
              className={`settings-nav-item${activeTab === "appearance" ? " settings-nav-item--active" : ""}`}
              onClick={() => setActiveTab("appearance")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Appearance
            </button>
            <button
              className={`settings-nav-item${activeTab === "terminal" ? " settings-nav-item--active" : ""}`}
              onClick={() => setActiveTab("terminal")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3 5.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Terminal
            </button>
          </nav>

          {/* Right Content */}
          <div className="settings-content">
            {activeTab === "appearance" && (
              <AppearanceTab
                fontFamily={fontFamily}
                fontSize={fontSize}
                themeId={themeId}
                onFontFamilyChange={setFontFamily}
                onFontSizeIncrease={increaseFontSize}
                onFontSizeDecrease={decreaseFontSize}
                onFontSizeReset={resetFontSize}
                onThemeChange={setThemeId}
              />
            )}
            {activeTab === "terminal" && (
              <TerminalTab
                cursorStyle={cursorStyle}
                cursorBlink={cursorBlink}
                lineHeight={lineHeight}
                scrollback={scrollback}
                fontSize={fontSize}
                onCursorStyleChange={setCursorStyle}
                onCursorBlinkChange={setCursorBlink}
                onLineHeightChange={setLineHeight}
                onScrollbackChange={setScrollback}
                onFontSizeChange={setFontSize}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ── Appearance Tab ────────────────────────────────────────────── */

interface AppearanceTabProps {
  fontFamily: string;
  fontSize: number;
  themeId: string;
  onFontFamilyChange: (family: string) => void;
  onFontSizeIncrease: () => void;
  onFontSizeDecrease: () => void;
  onFontSizeReset: () => void;
  onThemeChange: (id: string) => void;
}

function AppearanceTab({
  fontFamily,
  fontSize,
  themeId,
  onFontFamilyChange,
  onFontSizeIncrease,
  onFontSizeDecrease,
  onFontSizeReset,
  onThemeChange,
}: AppearanceTabProps) {
  return (
    <>
      {/* Font Section */}
      <div className="settings-section">
        <div className="settings-section-label">Font</div>

        {/* Font Family */}
        <div className="settings-select-wrap">
          <select
            className="settings-select"
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <svg className="settings-select-chevron" width="8" height="5" viewBox="0 0 8 5" fill="none">
            <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Font Preview */}
        <div className="settings-font-preview">
          <code style={{ fontFamily: `"${fontFamily}", "JetBrainsMonoNerdFont", monospace` }}>
            <span className="settings-preview-keyword">const </span>
            <span className="settings-preview-fn">greet</span>
            <span className="settings-preview-text"> = (</span>
            <span className="settings-preview-text">name</span>
            <span className="settings-preview-text">) =&gt; {"{"}</span>
            {"\n"}
            <span className="settings-preview-text">  </span>
            <span className="settings-preview-keyword">return </span>
            <span className="settings-preview-string">`Hello, ${"${"}name${"}"}`</span>
            <span className="settings-preview-text">;</span>
            {"\n"}
            <span className="settings-preview-text">{"}"};</span>
            {"\n"}
            <span className="settings-preview-comment">{"// 0O 1lI |{}[]() -> =>"}</span>
          </code>
        </div>

        {/* Font Size Stepper */}
        <div className="settings-stepper-row">
          <button
            className="settings-stepper-btn"
            onClick={onFontSizeDecrease}
            disabled={fontSize <= MIN_FONT_SIZE}
            title="Decrease font size"
            aria-label="Decrease font size"
          >
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
              <path d="M1 1h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="settings-stepper-value"
            onClick={onFontSizeReset}
            title={`Reset to ${DEFAULT_FONT_SIZE}px`}
          >
            {fontSize}px
          </button>
          <button
            className="settings-stepper-btn"
            onClick={onFontSizeIncrease}
            disabled={fontSize >= MAX_FONT_SIZE}
            title="Increase font size"
            aria-label="Increase font size"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <span className="settings-stepper-sublabel">Also adjustable with Ctrl +/-</span>
        </div>
      </div>

      <div className="settings-divider" />

      {/* Theme Section */}
      <div className="settings-section">
        <div className="settings-section-label">Theme</div>

        {/* Auto */}
        <button
          className={`settings-theme-auto${themeId === "auto" ? " settings-theme-auto--active" : ""}`}
          onClick={() => onThemeChange("auto")}
        >
          <svg className="settings-theme-auto-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1.5" width="12" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M4.5 12h5M7 10v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          <span className="settings-theme-auto-label">Auto</span>
          {themeId === "auto" && <CheckIcon />}
        </button>

        {/* Theme Groups */}
        {THEME_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="settings-theme-group-label">{group.label}</div>
            <div className="settings-theme-grid">
              {group.themes.map((theme) => (
                <button
                  key={theme.id}
                  className={`settings-theme-card${themeId === theme.id ? " settings-theme-card--active" : ""}`}
                  onClick={() => onThemeChange(theme.id)}
                  title={theme.name}
                >
                  <div
                    className="settings-theme-card-preview"
                    style={{ background: theme.swatch[0] }}
                  >
                    <div className="settings-theme-card-line" style={{ background: theme.swatch[1] }} />
                    <div className="settings-theme-card-line" style={{ background: theme.swatch[2] }} />
                    <div className="settings-theme-card-line" style={{ background: theme.swatch[3] }} />
                  </div>
                  <span className="settings-theme-card-name">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Terminal Tab ──────────────────────────────────────────────── */

interface TerminalTabProps {
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  lineHeight: number;
  scrollback: number;
  fontSize: number;
  onCursorStyleChange: (style: CursorStyle) => void;
  onCursorBlinkChange: (blink: boolean) => void;
  onLineHeightChange: (height: number) => void;
  onScrollbackChange: (lines: number) => void;
  onFontSizeChange: (size: number) => void;
}

function TerminalTab({
  cursorStyle,
  cursorBlink,
  lineHeight,
  scrollback,
  onCursorStyleChange,
  onCursorBlinkChange,
  onLineHeightChange,
  onScrollbackChange,
}: TerminalTabProps) {
  return (
    <>
      {/* Cursor Section */}
      <div className="settings-section">
        <div className="settings-section-label">Cursor</div>

        {/* Cursor Style */}
        <div className="settings-field">
          <span className="settings-field-label">Cursor Style</span>
          <div className="settings-select-wrap">
            <select
              className="settings-select"
              value={cursorStyle}
              onChange={(e) => onCursorStyleChange(e.target.value as CursorStyle)}
            >
              {CURSOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <svg className="settings-select-chevron" width="8" height="5" viewBox="0 0 8 5" fill="none">
              <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Cursor Blink */}
        <div className="settings-toggle-row">
          <span className="settings-toggle-label">Cursor Blink</span>
          <button
            className={`settings-toggle${cursorBlink ? " settings-toggle--on" : ""}`}
            onClick={() => onCursorBlinkChange(!cursorBlink)}
            role="switch"
            aria-checked={cursorBlink}
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>
      </div>

      <div className="settings-divider" />

      {/* Display Section */}
      <div className="settings-section">
        <div className="settings-section-label">Display</div>

        {/* Line Height */}
        <div className="settings-field">
          <span className="settings-field-label">
            Line Height
            <span className="settings-field-sublabel"> (1.0 - 1.6)</span>
          </span>
          <input
            className="settings-number-input"
            type="number"
            min="1.0"
            max="1.6"
            step="0.1"
            value={lineHeight}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) onLineHeightChange(val);
            }}
          />
        </div>

        {/* Scrollback */}
        <div className="settings-field">
          <span className="settings-field-label">
            Scrollback Lines
            <span className="settings-field-sublabel"> (1000 - 10000)</span>
          </span>
          <input
            className="settings-number-input"
            type="number"
            min="1000"
            max="10000"
            step="1000"
            value={scrollback}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) onScrollbackChange(val);
            }}
          />
        </div>
      </div>
    </>
  );
}

/* ── Shared Icons ──────────────────────────────────────────────── */

function CheckIcon() {
  return (
    <svg className="settings-theme-auto-check" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
