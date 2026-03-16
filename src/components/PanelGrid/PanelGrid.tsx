import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Tab, PanelConnection } from "../../types/terminal";
import { TerminalPane } from "../TerminalPane/TerminalPane";
import { BrowserPane } from "../BrowserPane/BrowserPane";
import { PanelContextMenu } from "../PanelContextMenu/PanelContextMenu";
import { getGridConfig } from "../../lib/layoutMath";
import { useTabStore } from "../../store/tabStore";
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
  onActivePanelChanged?: (ptyId: string | null, panelId?: string) => void;
  navRef?: React.MutableRefObject<PanelNavHandle | null>;
}

export function PanelGrid({ tab, isVisible, onActivePanelChanged, navRef }: PanelGridProps) {
  const { setPtyId, clearPtyId, switchPanelConnection } = useTabStore();
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
      switchPanelConnection(tab.id, ctxMenu.panelId, connection);
      setCtxMenu(null);
    },
    [ctxMenu, tab.id, switchPanelConnection]
  );

  // 레이아웃이 바뀌면 줌 해제
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
    onActivePanelChanged(activePanel?.ptyId ?? null, activePanelId);
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

  const siblingPtyIds = useMemo(
    () => tab.panels.filter((p) => p.ptyId !== null).map((p) => p.ptyId as string),
    [tab.panels]
  );

  const handlePtyCreated = useCallback(
    (panelId: string, ptyId: string) => {
      setPtyId(tab.id, panelId, ptyId);
    },
    [tab.id, setPtyId]
  );

  const handlePtyKilled = useCallback(
    (panelId: string) => {
      clearPtyId(tab.id, panelId);
    },
    [tab.id, clearPtyId]
  );

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
        return panel.connection?.type === "browser" ? (
          <div
            key={panel.id}
            className="panel-ctx-wrapper"
            onContextMenu={(e) => handleContextMenu(e, panel.id, panel.connection)}
            style={hidden ? { display: "none" } : undefined}
          >
            <BrowserPane
              panelId={panel.id}
              tabId={tab.id}
              initialUrl={panel.connection.browserUrl}
              isActive={activePanelId === panel.id}
              isVisible={isVisible && !hidden && !ctxMenu}
              onFocus={() => setActivePanelId(panel.id)}
            />
          </div>
        ) : (
          <div
            key={panel.id}
            className="panel-ctx-wrapper"
            onContextMenu={(e) => handleContextMenu(e, panel.id, panel.connection)}
            style={{
              ...(tab.layout === 3 && index === 0 && !isZoomed ? { gridRow: "1 / 3" } : {}),
              ...(hidden ? { display: "none" } : {}),
            }}
          >
            <TerminalPane
              cwd={tab.cwd}
              isActive={panel.id === activePanelId}
              broadcastEnabled={tab.broadcastEnabled}
              siblingPtyIds={siblingPtyIds}
              sshCommand={panel.connection?.sshCommand}
              shellProgram={panel.connection?.shellProgram}
              shellArgs={panel.connection?.shellArgs}
              existingSessionId={panel.existingSessionId}
              onPtyCreated={(ptyId) => handlePtyCreated(panel.id, ptyId)}
              onPtyKilled={() => handlePtyKilled(panel.id)}
              onFocus={() => setActivePanelId(panel.id)}
              onNextPanel={handleNextPanel}
              onPrevPanel={handlePrevPanel}
            />
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
