import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useThemeStore } from "../../store/themeStore";
import { THEME_GROUPS } from "../../themes/definitions";
import "./CommandPalette.css";

export interface PaletteCommand {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  action: () => void | Promise<void>;
}

export interface PaletteSection {
  category: string;
  commands: PaletteCommand[];
}

interface Command {
  id: string;
  label: string;
  category: string;
  subSection: string | null;
  icon: React.ReactNode;
  isActive?: boolean;
  action: () => void | Promise<void>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  extraSections?: PaletteSection[];
}

export function CommandPalette({ isOpen, onClose, extraSections = [] }: Props) {
  const { themeId, setThemeId } = useThemeStore();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    // Extra sections first (e.g., tab navigation)
    for (const section of extraSections) {
      for (const cmd of section.commands) {
        list.push({
          id: cmd.id,
          label: cmd.label,
          category: section.category,
          subSection: null,
          icon: cmd.icon,
          isActive: cmd.isActive,
          action: cmd.action,
        });
      }
    }

    // Theme commands
    const activeThemeKey = themeId === "auto" ? "theme:auto" : `theme:${themeId}`;

    list.push({
      id: "theme:auto",
      label: "Auto (System)",
      category: "Theme",
      subSection: null,
      icon: (
        <span className="cp-auto-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1.5" width="12" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M4.5 12h5M7 10v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </span>
      ),
      isActive: activeThemeKey === "theme:auto",
      action: () => setThemeId("auto"),
    });

    for (const group of THEME_GROUPS) {
      for (const theme of group.themes) {
        list.push({
          id: `theme:${theme.id}`,
          label: theme.name,
          category: "Theme",
          subSection: group.label,
          icon: (
            <span className="cp-swatch" style={{ background: theme.swatch[0] }}>
              {theme.swatch.slice(1).map((color: string, i: number) => (
                <span key={i} className="cp-swatch-dot" style={{ background: color }} />
              ))}
            </span>
          ),
          isActive: activeThemeKey === `theme:${theme.id}`,
          action: () => setThemeId(theme.id),
        });
      }
    }

    return list;
  }, [extraSections, themeId, setThemeId]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.subSection?.toLowerCase().includes(q) ?? false) ||
        c.category.toLowerCase().includes(q)
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

  const execute = async (cmd: Command) => {
    await cmd.action();
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

  if (!isOpen) return null;

  const renderItem = (cmd: Command, cmdIndex: number) => {
    const isHighlighted = cmdIndex === activeIndex;
    return (
      <div
        key={cmd.id}
        className={`cp-item${isHighlighted ? " cp-item--highlighted" : ""}${cmd.isActive ? " cp-item--active" : ""}`}
        onMouseEnter={() => setActiveIndex(cmdIndex)}
        onMouseDown={(e) => { e.preventDefault(); execute(cmd); }}
      >
        {cmd.icon}
        <span className="cp-item-label">{cmd.label}</span>
        {cmd.isActive && (
          <svg className="cp-item-check" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  };

  // Grouped view: no search query — groups by category then subSection
  const renderGrouped = () => {
    const categoryOrder: string[] = [];
    const categoryMap = new Map<string, { sectionOrder: (string | null)[]; sectionMap: Map<string | null, Command[]> }>();
    const cmdIndexMap = new Map<string, number>();
    let idx = 0;

    for (const cmd of commands) {
      if (!categoryMap.has(cmd.category)) {
        categoryOrder.push(cmd.category);
        categoryMap.set(cmd.category, { sectionOrder: [], sectionMap: new Map() });
      }
      const cat = categoryMap.get(cmd.category)!;
      if (!cat.sectionMap.has(cmd.subSection)) {
        cat.sectionOrder.push(cmd.subSection);
        cat.sectionMap.set(cmd.subSection, []);
      }
      cat.sectionMap.get(cmd.subSection)!.push(cmd);
      cmdIndexMap.set(cmd.id, idx++);
    }

    return categoryOrder.map((catLabel, catIdx) => {
      const { sectionOrder, sectionMap } = categoryMap.get(catLabel)!;
      return (
        <div key={catLabel} className={`cp-category${catIdx > 0 ? " cp-category--divided" : ""}`}>
          <div className="cp-category-label">{catLabel}</div>
          {sectionOrder.map((secLabel) => {
            const cmds = sectionMap.get(secLabel)!;
            return (
              <div key={secLabel ?? "__root"} className="cp-section">
                {secLabel && <div className="cp-section-label">{secLabel}</div>}
                {cmds.map((cmd) => renderItem(cmd, cmdIndexMap.get(cmd.id)!))}
              </div>
            );
          })}
        </div>
      );
    });
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
      <div className="cp-panel" role="dialog" aria-modal="true" aria-label="Command Palette">
        {/* Search row */}
        <div className="cp-search-row">
          <svg className="cp-search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Search commands..."
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
            <div className="cp-empty">No results</div>
          ) : q ? (
            renderFiltered()
          ) : (
            renderGrouped()
          )}
        </div>

        {/* Footer hint */}
        <div className="cp-footer">
          <span className="cp-hint"><kbd>↑↓</kbd> Navigate</span>
          <span className="cp-hint"><kbd>↵</kbd> Execute</span>
          <span className="cp-hint"><kbd>Ctrl K</kbd> Close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
