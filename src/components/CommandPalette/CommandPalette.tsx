import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useThemeStore } from "../../store/themeStore";
import { THEME_GROUPS } from "../../themes/definitions";
import "./CommandPalette.css";

interface Command {
  id: string;
  label: string;
  groupLabel: string | null;
  swatch: readonly [string, string, string, string, string] | null;
  action: () => void;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: Props) {
  const { themeId, setThemeId } = useThemeStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build flat command list: auto first, then all themes in group order
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "theme:auto",
        label: "Auto (System)",
        groupLabel: null,
        swatch: null,
        action: () => setThemeId("auto"),
      },
    ];
    for (const group of THEME_GROUPS) {
      for (const theme of group.themes) {
        list.push({
          id: `theme:${theme.id}`,
          label: theme.name,
          groupLabel: group.label,
          swatch: theme.swatch,
          action: () => setThemeId(theme.id),
        });
      }
    }
    return list;
  }, [setThemeId]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.groupLabel?.toLowerCase().includes(q) ?? false)
    );
  }, [commands, q]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Clamp activeIndex when filtered list shrinks
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Scroll active item into view
  useEffect(() => {
    const highlighted = listRef.current?.querySelector<HTMLElement>(".cp-item--highlighted");
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, q]);

  const execute = (cmd: Command) => {
    cmd.action();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) execute(filtered[activeIndex]);
    }
  };

  const activeThemeKey = themeId === "auto" ? "theme:auto" : `theme:${themeId}`;

  if (!isOpen) return null;

  const renderItem = (cmd: Command, cmdIndex: number) => {
    const isHighlighted = cmdIndex === activeIndex;
    const isActive = cmd.id === activeThemeKey;
    return (
      <div
        key={cmd.id}
        className={`cp-item${isHighlighted ? " cp-item--highlighted" : ""}${isActive ? " cp-item--active" : ""}`}
        onMouseEnter={() => setActiveIndex(cmdIndex)}
        onMouseDown={(e) => { e.preventDefault(); execute(cmd); }}
      >
        {cmd.swatch ? (
          <span
            className="cp-swatch"
            style={{ background: cmd.swatch[0] }}
          >
            {cmd.swatch.slice(1).map((color, i) => (
              <span key={i} className="cp-swatch-dot" style={{ background: color }} />
            ))}
          </span>
        ) : (
          <span className="cp-auto-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1.5" width="12" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
              <path d="M4.5 12h5M7 10v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </span>
        )}
        <span className="cp-item-label">{cmd.label}</span>
        {isActive && (
          <svg className="cp-item-check" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  };

  // Grouped view: no search query
  const renderGrouped = () => {
    let cmdIndex = 0;
    const autoCmd = commands[0];
    const autoRendered = renderItem(autoCmd, cmdIndex++);

    const groups = THEME_GROUPS.map((group) => {
      const items = group.themes.map((theme) => {
        const cmd = commands.find((c) => c.id === `theme:${theme.id}`)!;
        const el = renderItem(cmd, cmdIndex++);
        return el;
      });
      return { label: group.label, items };
    });

    return (
      <>
        <div className="cp-section">
          <div className="cp-section-label">테마</div>
          {autoRendered}
        </div>
        {groups.map((g) => (
          <div key={g.label} className="cp-section">
            <div className="cp-section-label">{g.label}</div>
            {g.items}
          </div>
        ))}
      </>
    );
  };

  // Flat view: search query active
  const renderFiltered = () => (
    <>
      {filtered.map((cmd, i) => renderItem(cmd, i))}
    </>
  );

  return createPortal(
    <div
      className="cp-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cp-panel" role="dialog" aria-modal="true" aria-label="커맨드 팔레트">
        {/* Search row */}
        <div className="cp-search-row">
          <svg className="cp-search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="명령어 검색..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="cp-kbd">ESC</kbd>
        </div>

        {/* Command list */}
        <div ref={listRef} className="cp-list">
          {filtered.length === 0 ? (
            <div className="cp-empty">결과 없음</div>
          ) : q ? (
            renderFiltered()
          ) : (
            renderGrouped()
          )}
        </div>

        {/* Footer hint */}
        <div className="cp-footer">
          <span className="cp-hint"><kbd>↑↓</kbd> 탐색</span>
          <span className="cp-hint"><kbd>↵</kbd> 실행</span>
          <span className="cp-hint"><kbd>Ctrl K</kbd> 닫기</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
