import { useState, useCallback, useRef } from "react";
import type { Tab } from "../../types/terminal";
import { TerminalPane } from "../TerminalPane/TerminalPane";
import { getGridConfig } from "../../lib/layoutMath";
import { useTabStore } from "../../store/tabStore";
import "./PanelGrid.css";

interface PanelGridProps {
  tab: Tab;
}

export function PanelGrid({ tab }: PanelGridProps) {
  const { setPtyId, clearPtyId } = useTabStore();
  const [activePanelId, setActivePanelId] = useState<string>(tab.panels[0]?.id ?? "");

  const activePanelIdRef = useRef(activePanelId);
  activePanelIdRef.current = activePanelId;

  const handleNextPanel = useCallback(() => {
    const panels = tab.panels;
    const idx = panels.findIndex((p) => p.id === activePanelIdRef.current);
    const next = panels[(idx + 1) % panels.length];
    if (next) setActivePanelId(next.id);
  }, [tab.panels]);

  const handlePrevPanel = useCallback(() => {
    const panels = tab.panels;
    const idx = panels.findIndex((p) => p.id === activePanelIdRef.current);
    const prev = panels[(idx - 1 + panels.length) % panels.length];
    if (prev) setActivePanelId(prev.id);
  }, [tab.panels]);

  const gridConfig = getGridConfig(tab.layout);

  const siblingPtyIds = tab.panels
    .filter((p) => p.ptyId !== null)
    .map((p) => p.ptyId as string);

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
        gridTemplateColumns: gridConfig.gridTemplateColumns,
        gridTemplateRows: gridConfig.gridTemplateRows,
      }}
    >
      {tab.panels.map((panel, index) => (
        <TerminalPane
          key={panel.id}
          cwd={tab.cwd}
          isActive={panel.id === activePanelId}
          broadcastEnabled={tab.broadcastEnabled}
          siblingPtyIds={siblingPtyIds}
          sshCommand={index === 0 ? tab.sshCommand : undefined}
          onPtyCreated={(ptyId) => handlePtyCreated(panel.id, ptyId)}
          onPtyKilled={() => handlePtyKilled(panel.id)}
          onFocus={() => setActivePanelId(panel.id)}
          onNextPanel={handleNextPanel}
          onPrevPanel={handlePrevPanel}
        />
      ))}
    </div>
  );
}
