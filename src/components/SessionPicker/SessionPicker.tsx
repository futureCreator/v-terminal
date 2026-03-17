import { useEffect, useState, useCallback, useMemo } from "react";
import { ipc } from "../../lib/tauriIpc";
import { useSshStore } from "../../store/sshStore";
import { panelCount, getGridConfig } from "../../lib/layoutMath";
import type { Layout, PanelConnection } from "../../types/terminal";
import "./SessionPicker.css";

/* ── Exported types ─────────────────────────────────────────────── */

export interface SessionPickResult {
  layout: Layout;
  panelConnections: PanelConnection[];
}

interface SessionPickerProps {
  onNewSession: (result: SessionPickResult) => void;
}

/* ── Internal types ─────────────────────────────────────────────── */

interface ConnectionOption {
  id: string;
  type: "local" | "ssh" | "wsl";
  name: string;
  subtitle: string;
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
}

function optionToConnection(opt: ConnectionOption): PanelConnection {
  return {
    type: opt.type,
    sshProfileId: opt.sshProfileId,
    shellProgram: opt.shellProgram,
    shellArgs: opt.shellArgs,
    label: opt.type === "local" ? undefined : opt.name,
  };
}

/* ── Icons ──────────────────────────────────────────────────────── */

const IconTerminal = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="2.5" width="13" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.25" />
    <path d="M4.5 6.5l3 3-3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9 12h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

const IconLinux = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 1.5C5.8 1.5 4 3.3 4 5.5c0 1.3.5 2.5 1.2 3.3l-.8 2.7c-.2.5 0 1 .4 1.2l1.4.8c.4.2.9 0 1.1-.4l.2-.8h.9l.2.8c.2.4.7.6 1.1.4l1.4-.8c.4-.2.6-.7.4-1.2L11 8.9C11.6 8.1 12 7 12 5.7 12 3.4 10.2 1.5 8 1.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="6.5" cy="5.5" r=".7" fill="currentColor" />
    <circle cx="9.5" cy="5.5" r=".7" fill="currentColor" />
  </svg>
);

const IconSsh = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="4.5" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <rect x="9.5" y="4.5" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
    <path d="M6.5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M8.5 6.5l2 1.5-2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconChevron = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2.5 3.5L5 6.5L7.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconCheck = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2.5 6.5L5 9L9.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Layout Icon ────────────────────────────────────────────────── */

function LayoutIcon({ layout }: { layout: Layout }) {
  const s = { stroke: "currentColor", strokeWidth: 1.2, fill: "none" };
  switch (layout) {
    case 1:
      return (
        <svg width="28" height="20" viewBox="0 0 28 20">
          <rect x="2" y="2" width="24" height="16" rx="2" {...s} />
        </svg>
      );
    case 2:
      return (
        <svg width="28" height="20" viewBox="0 0 28 20">
          <rect x="2" y="2" width="11" height="16" rx="1.5" {...s} />
          <rect x="15" y="2" width="11" height="16" rx="1.5" {...s} />
        </svg>
      );
    case 3:
      return (
        <svg width="28" height="20" viewBox="0 0 28 20">
          <rect x="2" y="2" width="11" height="16" rx="1.5" {...s} />
          <rect x="15" y="2" width="11" height="7" rx="1.2" {...s} />
          <rect x="15" y="11" width="11" height="7" rx="1.2" {...s} />
        </svg>
      );
    case 4:
      return (
        <svg width="28" height="20" viewBox="0 0 28 20">
          <rect x="2" y="2" width="11" height="7" rx="1.2" {...s} />
          <rect x="15" y="2" width="11" height="7" rx="1.2" {...s} />
          <rect x="2" y="11" width="11" height="7" rx="1.2" {...s} />
          <rect x="15" y="11" width="11" height="7" rx="1.2" {...s} />
        </svg>
      );
    case "4c":
      return (
        <svg width="28" height="20" viewBox="0 0 28 20">
          <rect x="1" y="2" width="5.5" height="16" rx="1" {...s} />
          <rect x="8" y="2" width="5.5" height="16" rx="1" {...s} />
          <rect x="15" y="2" width="5.5" height="16" rx="1" {...s} />
          <rect x="22" y="2" width="5.5" height="16" rx="1" {...s} />
        </svg>
      );
    case 6:
      return (
        <svg width="28" height="20" viewBox="0 0 28 20">
          <rect x="1" y="2" width="7.5" height="7" rx="1" {...s} />
          <rect x="10.25" y="2" width="7.5" height="7" rx="1" {...s} />
          <rect x="19.5" y="2" width="7.5" height="7" rx="1" {...s} />
          <rect x="1" y="11" width="7.5" height="7" rx="1" {...s} />
          <rect x="10.25" y="11" width="7.5" height="7" rx="1" {...s} />
          <rect x="19.5" y="11" width="7.5" height="7" rx="1" {...s} />
        </svg>
      );
    case 9:
      return (
        <svg width="28" height="20" viewBox="0 0 28 20">
          {[0, 1, 2].map((col) =>
            [0, 1, 2].map((row) => (
              <rect
                key={`${col}-${row}`}
                x={1 + col * 9}
                y={1 + row * 6.3}
                width="7.5"
                height="5"
                rx="0.8"
                {...s}
              />
            ))
          )}
        </svg>
      );
  }
}

/* ── Constants ──────────────────────────────────────────────────── */

const LAYOUT_OPTIONS: Layout[] = [1, 2, 3, 4, "4c", 6, 9];

/* ── PanelConfigGrid (per-panel mode) ───────────────────────────── */

function PanelConfigGrid({
  layout,
  selections,
  connectionOptions,
  openDropdownIndex,
  onOpenDropdown,
  onSelect,
}: {
  layout: Layout;
  selections: string[];
  connectionOptions: ConnectionOption[];
  openDropdownIndex: number | null;
  onOpenDropdown: (index: number | null) => void;
  onSelect: (panelIndex: number, optionId: string) => void;
}) {
  const gridConfig = getGridConfig(layout);
  const count = panelCount(layout);

  // Close dropdown on outside click
  useEffect(() => {
    if (openDropdownIndex === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (target.closest(".sp-panel-dropdown")) return;
      onOpenDropdown(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdownIndex, onOpenDropdown]);

  return (
    <div
      className="sp-panel-grid"
      style={{
        gridTemplateColumns: gridConfig.gridTemplateColumns,
        gridTemplateRows: gridConfig.gridTemplateRows,
      }}
    >
      {Array.from({ length: count }, (_, i) => {
        const selectedOpt =
          connectionOptions.find((o) => o.id === selections[i]) ??
          connectionOptions[0];
        const isOpen = openDropdownIndex === i;

        return (
          <div
            key={i}
            className="sp-panel-cell"
            style={layout === 3 && i === 0 ? { gridRow: "1 / 3" } : undefined}
          >
            <span className="sp-panel-cell-label">Panel {i + 1}</span>
            <div className="sp-panel-dropdown">
              <button
                className="sp-panel-dropdown-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenDropdown(isOpen ? null : i);
                }}
              >
                <span
                  className={`sp-dot sp-dot--${selectedOpt.type}`}
                />
                <span className="sp-panel-dropdown-name">
                  {selectedOpt.name}
                </span>
                <span className="sp-panel-dropdown-chevron">
                  <IconChevron />
                </span>
              </button>
              {isOpen && (
                <div className="sp-panel-dropdown-menu">
                  {connectionOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className={`sp-panel-dropdown-item ${
                        opt.id === selections[i]
                          ? "sp-panel-dropdown-item--active"
                          : ""
                      }`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onSelect(i, opt.id);
                      }}
                    >
                      <span className={`sp-dot sp-dot--${opt.type}`} />
                      <span className="sp-panel-dropdown-item-name">
                        {opt.name}
                      </span>
                      <span className="sp-panel-dropdown-item-sub">
                        {opt.subtitle}
                      </span>
                      {opt.id === selections[i] && (
                        <span className="sp-panel-dropdown-check">
                          <IconCheck />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── SessionPicker ──────────────────────────────────────────────── */

export function SessionPicker({ onNewSession }: SessionPickerProps) {
  const [wslDistros, setWslDistros] = useState<string[]>([]);
  const { profiles: sshProfiles } = useSshStore();

  // New session config state
  const [selectedLayout, setSelectedLayout] = useState<Layout>(1);
  const [connectionMode, setConnectionMode] = useState<"all" | "perPanel">(
    "all"
  );
  const [perPanelSelections, setPerPanelSelections] = useState<string[]>([
    "local",
  ]);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(
    null
  );

  const numPanels = useMemo(
    () => panelCount(selectedLayout),
    [selectedLayout]
  );

  // Reset per-panel selections when layout changes
  useEffect(() => {
    setPerPanelSelections(new Array(numPanels).fill("local"));
    setOpenDropdownIndex(null);
  }, [numPanels]);

  // Build connection options
  const connectionOptions = useMemo<ConnectionOption[]>(() => {
    const opts: ConnectionOption[] = [
      { id: "local", type: "local", name: "Local Shell", subtitle: "PowerShell" },
    ];
    for (const distro of wslDistros) {
      opts.push({
        id: `wsl:${distro}`,
        type: "wsl",
        name: distro,
        subtitle: "WSL",
        shellProgram: "wsl.exe",
        shellArgs: ["-d", distro],
      });
    }
    for (const profile of sshProfiles) {
      opts.push({
        id: `ssh:${profile.id}`,
        type: "ssh",
        name: profile.name,
        subtitle: `${profile.username}@${profile.host}`,
        sshProfileId: profile.id,
      });
    }
    return opts;
  }, [wslDistros, sshProfiles]);

  const findOption = useCallback(
    (id: string) =>
      connectionOptions.find((o) => o.id === id) ?? connectionOptions[0],
    [connectionOptions]
  );

  useEffect(() => {
    ipc
      .getWslDistros()
      .then(setWslDistros)
      .catch(() => setWslDistros([]));
  }, []);

  // "All Same" mode — click connection → open immediately
  const handleAllSameClick = useCallback(
    (opt: ConnectionOption) => {
      const connection = optionToConnection(opt);
      const count = panelCount(selectedLayout);
      onNewSession({
        layout: selectedLayout,
        panelConnections: new Array(count).fill(connection),
      });
    },
    [selectedLayout, onNewSession]
  );

  // "Per Panel" mode — update one panel's selection
  const handlePerPanelSelect = useCallback(
    (panelIndex: number, optionId: string) => {
      setPerPanelSelections((prev) => {
        const next = [...prev];
        next[panelIndex] = optionId;
        return next;
      });
      setOpenDropdownIndex(null);
    },
    []
  );

  // "Per Panel" mode — open button
  const handlePerPanelOpen = useCallback(() => {
    const panelConnections = perPanelSelections.map((id) => {
      const opt = findOption(id);
      return optionToConnection(opt);
    });
    onNewSession({
      layout: selectedLayout,
      panelConnections,
    });
  }, [selectedLayout, perPanelSelections, findOption, onNewSession]);

  const isMultiPanel = numPanels > 1;

  return (
    <div className="sp-root">
      <div className="sp-container">
        {/* ── Layout Picker ── */}
        <div className="sp-group">
          <div className="sp-group-label">Layout</div>
          <div className="sp-layout-picker">
            {LAYOUT_OPTIONS.map((layout) => (
              <button
                key={String(layout)}
                className={`sp-layout-btn ${
                  selectedLayout === layout ? "sp-layout-btn--active" : ""
                }`}
                onClick={() => setSelectedLayout(layout)}
                title={`${panelCount(layout)} ${panelCount(layout) === 1 ? "Panel" : "Panels"}`}
              >
                <LayoutIcon layout={layout} />
                <span className="sp-layout-count">
                  {panelCount(layout)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Connection ── */}
        <div className="sp-group">
          <div className="sp-group-label">Connection</div>

          {isMultiPanel && (
            <div className="sp-segmented">
              <button
                className={`sp-segmented-btn ${
                  connectionMode === "all" ? "sp-segmented-btn--active" : ""
                }`}
                onClick={() => setConnectionMode("all")}
              >
                All Same
              </button>
              <button
                className={`sp-segmented-btn ${
                  connectionMode === "perPanel"
                    ? "sp-segmented-btn--active"
                    : ""
                }`}
                onClick={() => setConnectionMode("perPanel")}
              >
                Per Panel
              </button>
            </div>
          )}

          {!isMultiPanel || connectionMode === "all" ? (
            <div className="sp-group-body">
              {connectionOptions.map((opt) => (
                <button
                  key={opt.id}
                  className="sp-row"
                  onClick={() => handleAllSameClick(opt)}
                >
                  <span
                    className={`sp-row-icon sp-row-icon--${opt.type}`}
                  >
                    {opt.type === "ssh" ? (
                      <IconSsh />
                    ) : opt.type === "wsl" ? (
                      <IconLinux />
                    ) : (
                      <IconTerminal />
                    )}
                  </span>
                  <span className="sp-row-content">
                    <span className="sp-row-title">{opt.name}</span>
                    <span className="sp-row-subtitle">{opt.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="sp-per-panel">
              <PanelConfigGrid
                layout={selectedLayout}
                selections={perPanelSelections}
                connectionOptions={connectionOptions}
                openDropdownIndex={openDropdownIndex}
                onOpenDropdown={setOpenDropdownIndex}
                onSelect={handlePerPanelSelect}
              />
              <button className="sp-open-btn" onClick={handlePerPanelOpen}>
                Open
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
