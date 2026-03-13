import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { Tab } from "../../types/terminal";
import { TerminalPane } from "../TerminalPane/TerminalPane";
import { getGridConfig } from "../../lib/layoutMath";
import { useTabStore } from "../../store/tabStore";
import "./PanelGrid.css";

export interface PanelNavHandle {
  nextPanel: () => void;
  prevPanel: () => void;
  toggleZoom: () => void;
}

interface PanelGridProps {
  tab: Tab;
  onActivePanelChanged?: (ptyId: string | null) => void;
  navRef?: React.MutableRefObject<PanelNavHandle | null>;
}

export function PanelGrid({ tab, onActivePanelChanged, navRef }: PanelGridProps) {
  const { setPtyId, clearPtyId } = useTabStore();
  const [activePanelId, setActivePanelId] = useState<string>(tab.panels[0]?.id ?? "");
  const [zoomedPanelId, setZoomedPanelId] = useState<string | null>(null);

  const activePanelIdRef = useRef(activePanelId);
  activePanelIdRef.current = activePanelId;

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
    onActivePanelChanged(activePanel?.ptyId ?? null);
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
        return (
        <TerminalPane
          key={panel.id}
          style={{
            ...(tab.layout === 3 && index === 0 && !isZoomed ? { gridRow: "1 / 3" } : {}),
            ...(hidden ? { display: "none" } : {}),
          }}
          cwd={tab.cwd}
          isActive={panel.id === activePanelId}
          broadcastEnabled={tab.broadcastEnabled}
          siblingPtyIds={siblingPtyIds}
          sshCommand={index === 0 ? tab.sshCommand : undefined}
          shellProgram={tab.shellProgram}
          shellArgs={tab.shellArgs}
          existingSessionId={panel.existingSessionId}
          onPtyCreated={(ptyId) => handlePtyCreated(panel.id, ptyId)}
          onPtyKilled={() => handlePtyKilled(panel.id)}
          onFocus={() => setActivePanelId(panel.id)}
          onNextPanel={handleNextPanel}
          onPrevPanel={handlePrevPanel}
        />
        );
      })}
    </div>
  );
}
