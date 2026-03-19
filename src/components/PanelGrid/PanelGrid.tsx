import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Tab, PanelConnection } from "../../types/terminal";
import { TerminalPane } from "../TerminalPane/TerminalPane";
import { NotePanel } from "../NotePanel/NotePanel";
import { PanelContextMenu } from "../PanelContextMenu/PanelContextMenu";
import { getGridConfig } from "../../lib/layoutMath";
import { useTabStore } from "../../store/tabStore";
import { useNoteStore } from "../../store/noteStore";
import { useSshStore } from "../../store/sshStore";
import { ipc } from "../../lib/tauriIpc";
import "./PanelGrid.css";

export interface PanelNavHandle {
  nextPanel: () => void;
  prevPanel: () => void;
  toggleZoom: () => void;
}

interface PanelGridProps {
  tab: Tab;
  isVisible: boolean;
  onActivePanelChanged?: (sessionId: string | null, panelId?: string) => void;
  navRef?: React.MutableRefObject<PanelNavHandle | null>;
}

export function PanelGrid({ tab, isVisible, onActivePanelChanged, navRef }: PanelGridProps) {
  const { setSessionId, clearSessionId, switchPanelConnection } = useTabStore();
  const [activePanelId, setActivePanelId] = useState<string>(tab.panels[0]?.id ?? "");
  const [zoomedPanelId, setZoomedPanelId] = useState<string | null>(null);

  const activePanelIdRef = useRef(activePanelId);
  activePanelIdRef.current = activePanelId;

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    panelId: string;
    currentConnection?: PanelConnection;
  } | null>(null);

  // Connection data for context menu
  const { profiles: sshProfiles } = useSshStore();
  const [wslDistros, setWslDistros] = useState<string[]>([]);
  useEffect(() => {
    ipc.getWslDistros().then(setWslDistros).catch(() => setWslDistros([]));
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, panelId: string, connection?: PanelConnection) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, panelId, currentConnection: connection });
    },
    []
  );

  const handleSwitchConnection = useCallback(
    (connection: PanelConnection) => {
      if (!ctxMenu) return;
      // Clean up note data if switching away from note panel
      const currentTab = useTabStore.getState().tabs.find((t) => t.id === tab.id);
      const currentPanel = currentTab?.panels.find((p) => p.id === ctxMenu.panelId);
      if (currentPanel?.connection?.type === "note" && connection.type !== "note") {
        useNoteStore.getState().removeNote(ctxMenu.panelId);
      }
      switchPanelConnection(tab.id, ctxMenu.panelId, connection);
      setCtxMenu(null);
    },
    [ctxMenu, tab.id, switchPanelConnection]
  );

  // Reset zoom when layout changes
  useEffect(() => {
    setZoomedPanelId(null);
  }, [tab.layout]);

  const handleNextPanel = useCallback(() => {
    const panels = tab.panels;
    const idx = panels.findIndex((p) => p.id === activePanelIdRef.current);
    const next = panels[(idx + 1) % panels.length];
    if (next) {
      setActivePanelId(next.id);
      setZoomedPanelId((current) => current !== null ? next.id : null);
    }
  }, [tab.panels]);

  const handlePrevPanel = useCallback(() => {
    const panels = tab.panels;
    const idx = panels.findIndex((p) => p.id === activePanelIdRef.current);
    const prev = panels[(idx - 1 + panels.length) % panels.length];
    if (prev) {
      setActivePanelId(prev.id);
      setZoomedPanelId((current) => current !== null ? prev.id : null);
    }
  }, [tab.panels]);

  const handleToggleZoom = useCallback(() => {
    setZoomedPanelId((current) => {
      const next = current !== null ? null : activePanelIdRef.current;
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!onActivePanelChanged) return;
    const activePanel = tab.panels.find((p) => p.id === activePanelId);
    onActivePanelChanged(activePanel?.sessionId ?? null, activePanelId);
  }, [activePanelId, tab.panels, onActivePanelChanged]);

  useEffect(() => {
    if (!navRef) return;
    navRef.current = { nextPanel: handleNextPanel, prevPanel: handlePrevPanel, toggleZoom: handleToggleZoom };
    return () => { navRef.current = null; };
  }, [navRef, handleNextPanel, handlePrevPanel, handleToggleZoom]);

  const gridConfig = getGridConfig(tab.layout);
  const isZoomed = zoomedPanelId !== null;
  const effectiveGrid = isZoomed
    ? { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" }
    : { gridTemplateColumns: gridConfig.gridTemplateColumns, gridTemplateRows: gridConfig.gridTemplateRows };

  const siblingSessionIds = useMemo(
    () => tab.panels.filter((p) => p.sessionId !== null).map((p) => p.sessionId as string),
    [tab.panels]
  );

  const handleSessionCreated = useCallback(
    (panelId: string, sessionId: string, connectionId?: string) => {
      setSessionId(tab.id, panelId, sessionId, connectionId);
    },
    [tab.id, setSessionId]
  );

  const handleSessionKilled = useCallback(
    (panelId: string) => {
      clearSessionId(tab.id, panelId);
    },
    [tab.id, clearSessionId]
  );

  // Resolve SSH profile data for TerminalPane props
  const sshProfileMap = useMemo(() => {
    const map = new Map<string, typeof sshProfiles[0]>();
    for (const p of sshProfiles) map.set(p.id, p);
    return map;
  }, [sshProfiles]);

  return (
    <div
      className="panel-grid"
      style={{
        gridTemplateColumns: effectiveGrid.gridTemplateColumns,
        gridTemplateRows: effectiveGrid.gridTemplateRows,
      }}
    >
      {tab.panels.map((panel, index) => {
        const hidden = isZoomed && panel.id !== zoomedPanelId;
        const connKey = panel.connection
          ? `${panel.connection.type}-${panel.connection.sshProfileId ?? ""}-${panel.connection.wslDistro ?? ""}-${panel.connection.shellProgram ?? ""}`
          : "local";

        // Resolve SSH profile for this panel
        const sshProfile = panel.connection?.sshProfileId
          ? sshProfileMap.get(panel.connection.sshProfileId)
          : undefined;

        return (
          <div
            key={`${panel.id}-${connKey}`}
            className="panel-ctx-wrapper"
            onContextMenu={(e) => handleContextMenu(e, panel.id, panel.connection)}
            style={{
              ...(tab.layout === 3 && index === 0 && !isZoomed ? { gridRow: "1 / 3" } : {}),
              ...(hidden ? { display: "none" } : {}),
            }}
          >
            {panel.connection?.type === "note" ? (
              <NotePanel panelId={panel.id} />
            ) : (
              <TerminalPane
                cwd={tab.cwd}
                isActive={panel.id === activePanelId}
                broadcastEnabled={tab.broadcastEnabled}
                siblingSessionIds={siblingSessionIds}
                connectionType={panel.connection?.type}
                sshHost={sshProfile?.host}
                sshPort={sshProfile?.port}
                sshUsername={sshProfile?.username}
                sshIdentityFile={sshProfile?.identityFile}
                shellProgram={panel.connection?.shellProgram}
                shellArgs={panel.connection?.shellArgs}
                wslDistro={panel.connection?.wslDistro}
                onSessionCreated={(sessionId, connectionId) => handleSessionCreated(panel.id, sessionId, connectionId)}
                onSessionKilled={() => handleSessionKilled(panel.id)}
                onFocus={() => setActivePanelId(panel.id)}
                onNextPanel={handleNextPanel}
                onPrevPanel={handlePrevPanel}
              />
            )}
          </div>
        );
      })}
      {ctxMenu && (
        <PanelContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          currentConnection={ctxMenu.currentConnection}
          wslDistros={wslDistros}
          sshProfiles={sshProfiles}
          onSwitchConnection={handleSwitchConnection}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
