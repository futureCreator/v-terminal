import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import "./CommandPalette.css";

/* ── Types ──────────────────────────────────────────────────────── */

export interface PaletteCommand {
  id: string;
  label: string;
  meta?: string;
  description?: string;
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
  meta?: string;
  description?: string;
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
  onQueryChange?: (query: string) => void;
}

/* ── Fuzzy matching ─────────────────────────────────────────────── */

interface FuzzyResult {
  score: number;
  indices: number[];
}

function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let qi = 0;
  let score = 0;
  const indices: number[] = [];
  let lastMatch = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      if (lastMatch === ti - 1) score += 5; // consecutive
      if (ti === 0 || /[\s\-:_]/.test(t[ti - 1])) score += 3; // word boundary
      if (ti === qi) score += 2; // prefix
      score += 1;
      lastMatch = ti;
      qi++;
    }
  }

  if (qi < q.length) return null;
  return { score, indices };
}

function fuzzyMatchCommand(query: string, cmd: Command): FuzzyResult | null {
  const results = [
    fuzzyMatch(query, cmd.label),
    fuzzyMatch(query, cmd.category),
    cmd.subSection ? fuzzyMatch(query, cmd.subSection) : null,
    cmd.description ? fuzzyMatch(query, cmd.description) : null,
  ].filter((r): r is FuzzyResult => r !== null);

  if (results.length === 0) return null;
  return results.reduce((best, r) => (r.score > best.score ? r : best));
}

function highlightText(text: string, indices: number[]): React.ReactNode {
  if (indices.length === 0) return text;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const idx of indices) {
    if (idx < 0 || idx >= text.length) continue;
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(<mark key={idx} className="cp-match">{text[idx]}</mark>);
    last = idx + 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/* ── Prefix mode ────────────────────────────────────────────────── */

type PrefixMode = "all" | "tabs" | "layout" | "connection";

function parsePrefix(raw: string): { mode: PrefixMode; query: string } {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(">")) {
    return { mode: "tabs", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("#")) {
    return { mode: "connection", query: trimmed.slice(1).trimStart() };
  }
  if (trimmed.startsWith("!")) {
    return { mode: "layout", query: trimmed.slice(1).trimStart() };
  }
  return { mode: "all", query: trimmed };
}

/* ── Component ──────────────────────────────────────────────────── */

export function CommandPalette({ isOpen, onClose, extraSections = [], onQueryChange }: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"in" | "out" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ── Build command list ─────────────────────────────────── */
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    for (const section of extraSections) {
      for (const cmd of section.commands) {
        list.push({
          id: cmd.id,
          label: cmd.label,
          meta: cmd.meta,
          description: cmd.description,
          category: section.category,
          subSection: null,
          icon: cmd.icon,
          isActive: cmd.isActive,
          action: cmd.action,
        });
      }
    }
    return list;
  }, [extraSections]);

  /* ── Parse query prefix + fuzzy filter ──────────────────── */
  const { mode, query: q } = useMemo(() => parsePrefix(query), [query]);

  const filtered = useMemo(() => {
    let pool = commands;

    // Prefix mode filter
    if (mode === "tabs") {
      pool = pool.filter((c) => c.category === "Tab List");
    } else if (mode === "connection") {
      pool = pool.filter((c) => c.category === "Switch Connection");
    } else if (mode === "layout") {
      pool = pool.filter((c) => c.category === "Layout");
    }

    if (!q) return pool;

    // Fuzzy filter + sort by score
    const scored = pool
      .map((cmd) => ({ cmd, result: fuzzyMatchCommand(q, cmd) }))
      .filter((x): x is { cmd: Command; result: FuzzyResult } => x.result !== null);

    scored.sort((a, b) => b.result.score - a.result.score);
    return scored.map((x) => x.cmd);
  }, [commands, q, mode]);

  // Fuzzy match indices for highlighted label rendering
  const matchIndicesMap = useMemo(() => {
    if (!q) return new Map<string, number[]>();
    const map = new Map<string, number[]>();
    for (const cmd of filtered) {
      const r = fuzzyMatch(q, cmd.label);
      if (r) map.set(cmd.id, r.indices);
    }
    return map;
  }, [filtered, q]);

  /* ── Open / close animation ─────────────────────────────── */
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setPhase("in");
      setQuery("");
      setActiveIndex(0);
      onQueryChange?.("");
    } else if (visible) {
      setPhase("out");
      const timer = setTimeout(() => {
        setVisible(false);
        setPhase(null);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Focus input after DOM is rendered (separate effect so inputRef is available)
  useEffect(() => {
    if (visible && isOpen) {
      // Double-rAF to ensure React has committed the DOM
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      });
    }
  }, [visible, isOpen]);

  // Clamp activeIndex
  const totalCount = filtered.length;
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(totalCount - 1, 0)));
  }, [totalCount]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(".cp-item--highlighted");
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, q]);

  /* ── Execute ────────────────────────────────────────────── */
  const execute = useCallback(async (cmd: Command) => {
    await cmd.action();
    onClose();
  }, [onClose]);

  /* ── Keyboard ───────────────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const max = totalCount - 1;
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, max));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        {
          const cmd = resolveCommandAtIndex(activeIndex);
          if (cmd) execute(cmd);
        }
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(max);
        break;
      case "PageDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 8, max));
        break;
      case "PageUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 8, 0));
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          // Jump to previous category
          jumpCategory(-1);
        } else {
          // Jump to next category
          jumpCategory(1);
        }
        break;
    }
  };

  /* ── Category jump (Tab key) ────────────────────────────── */
  const jumpCategory = (dir: 1 | -1) => {
    if (q) return; // flat mode, no categories
    const allItems = buildFlatList();
    if (allItems.length === 0) return;

    // Find boundaries of each category
    const catStarts: number[] = [];
    let lastCat = "";
    for (let i = 0; i < allItems.length; i++) {
      if (allItems[i].category !== lastCat) {
        catStarts.push(i);
        lastCat = allItems[i].category;
      }
    }

    const currentCatIdx = catStarts.findIndex((start, i) => {
      const nextStart = catStarts[i + 1] ?? allItems.length;
      return activeIndex >= start && activeIndex < nextStart;
    });

    let nextCatIdx = currentCatIdx + dir;
    if (nextCatIdx < 0) nextCatIdx = catStarts.length - 1;
    if (nextCatIdx >= catStarts.length) nextCatIdx = 0;
    setActiveIndex(catStarts[nextCatIdx]);
  };

  /* ── Helpers to resolve flat index ──────────────────────── */
  const buildFlatList = (): Command[] => {
    return [...filtered];
  };

  const resolveCommandAtIndex = (idx: number): Command | undefined => {
    return filtered[idx];
  };

  /* ── Render ─────────────────────────────────────────────── */
  if (!visible) return null;

  const renderItem = (cmd: Command, globalIndex: number) => {
    const isHighlighted = globalIndex === activeIndex;
    const matchIndices = matchIndicesMap.get(cmd.id);
    return (
      <div
        key={`${cmd.id}-${globalIndex}`}
        className={`cp-item${isHighlighted ? " cp-item--highlighted" : ""}${cmd.isActive ? " cp-item--active" : ""}`}
        onMouseEnter={() => setActiveIndex(globalIndex)}
        onMouseDown={(e) => { e.preventDefault(); execute(cmd); }}
      >
        {cmd.icon}
        <span className="cp-item-label">
          {q && matchIndices ? highlightText(cmd.label, matchIndices) : cmd.label}
        </span>
        {cmd.meta && <span className="cp-item-meta">{cmd.meta}</span>}
        {cmd.isActive && (
          <svg className="cp-item-check" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  };

  // Description for the currently highlighted command
  const highlightedCmd = resolveCommandAtIndex(activeIndex);
  const showDescription = highlightedCmd?.description && !q;

  // Grouped view: no search query
  const renderGrouped = () => {
    let globalIndex = 0;

    const categoryOrder: string[] = [];
    const categoryMap = new Map<string, { sectionOrder: (string | null)[]; sectionMap: Map<string | null, Command[]> }>();
    const cmdIndexMap = new Map<number, number>(); // internal idx -> global idx

    let idx = 0;
    for (const cmd of filtered) {
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
      cmdIndexMap.set(idx, globalIndex + idx);
      idx++;
    }

    let runningIdx = 0;
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
                {cmds.map((cmd) => {
                  const gi = cmdIndexMap.get(runningIdx)!;
                  runningIdx++;
                  return renderItem(cmd, gi);
                })}
              </div>
            );
          })}
        </div>
      );
    });
  };

  // Flat filtered view
  const renderFiltered = () => (
    <>
      {filtered.map((cmd, i) => renderItem(cmd, i))}
    </>
  );

  // Empty state
  const renderEmpty = () => {
    const suggestions = ["tab", "layout", "panel", "connect"];
    return (
      <div className="cp-empty">
        <div className="cp-empty-title">No results for "{q}"</div>
        <div className="cp-empty-suggestions">
          Try{" "}
          {suggestions.map((s, i) => (
            <span key={s}>
              {i > 0 && (i === suggestions.length - 1 ? ", or " : ", ")}
              <button
                className="cp-empty-suggestion"
                onMouseDown={(e) => { e.preventDefault(); setQuery(s); }}
              >
                {s}
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Mode indicator for prefix
  const modeLabel = mode === "tabs" ? "Tabs" : mode === "connection" ? "Connection" : mode === "layout" ? "Layout" : null;

  return createPortal(
    <div
      className={`cp-backdrop${phase === "out" ? " cp-backdrop--out" : ""}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`cp-panel${phase === "out" ? " cp-panel--out" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* Search row */}
        <div className="cp-search-row">
          <svg className="cp-search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {modeLabel && <span className="cp-mode-badge">{modeLabel}</span>}
          <input
            ref={inputRef}
            className="cp-input"
            placeholder={mode === "tabs" ? "Switch to tab..." : mode === "connection" ? "Switch connection..." : mode === "layout" ? "Change layout..." : "Search commands..."}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); onQueryChange?.(e.target.value); }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="cp-kbd">ESC</kbd>
        </div>

        {/* Command list */}
        <div ref={listRef} className="cp-list">
          {totalCount === 0 ? (
            renderEmpty()
          ) : q ? (
            renderFiltered()
          ) : (
            renderGrouped()
          )}
        </div>

        {/* Description bar */}
        {showDescription && (
          <div className="cp-description">
            {highlightedCmd!.description}
          </div>
        )}

        {/* Footer hint */}
        <div className="cp-footer">
          <span className="cp-hint"><kbd>↑↓</kbd> Navigate</span>
          <span className="cp-hint"><kbd>↵</kbd> Execute</span>
          <span className="cp-hint"><kbd>Tab</kbd> Jump</span>
          <span className="cp-hint"><kbd>&gt;</kbd> Tabs</span>
          <span className="cp-hint"><kbd>#</kbd> Connect</span>
          <span className="cp-hint"><kbd>!</kbd> Layout</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
