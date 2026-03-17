import { useEffect } from "react";
import { NoteEditor } from "../NotePanel/NoteEditor";
import { TodoSection } from "../NotePanel/TodoSection";
import { TimersPanel } from "./TimersPanel";
import { CheatsheetPanel } from "./CheatsheetPanel";
import { useNoteStore } from "../../store/noteStore";
import "../NotePanel/NotePanel.css";
import "./SidePanel.css";

export type SidebarTab = "notes" | "timers" | "cheatsheet";

interface SidePanelProps {
  tabId: string;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
}

export function SidePanel({ tabId, activeTab, onTabChange, onClose }: SidePanelProps) {
  // Migrate legacy global note on first mount
  useEffect(() => {
    useNoteStore.getState().migrateOldNote(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <div className="side-panel-tabs">
          <button
            className={`side-panel-tab${activeTab === "notes" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("notes")}
            title="Notes"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2.5" y="1" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="5" y1="4.5" x2="10" y2="4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="7" x2="10" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <line x1="5" y1="9.5" x2="8" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`side-panel-tab${activeTab === "timers" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("timers")}
            title="Timers"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="8" r="5" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="7.5" y1="5" x2="7.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7.5" y1="8" x2="9.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7.5" y1="1.5" x2="7.5" y2="3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className={`side-panel-tab${activeTab === "cheatsheet" ? " side-panel-tab--active" : ""}`}
            onClick={() => onTabChange("cheatsheet")}
            title="Cheatsheet"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2.5" y="1" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M5 4.5h5M5 7h5M5 9.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <button
          className="side-panel-close"
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M1.5 1.5l6 6M7.5 1.5l-6 6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="side-panel-body">
        {activeTab === "notes" && (
          <>
            <NoteEditor tabId={tabId} />
            <TodoSection tabId={tabId} />
          </>
        )}
        {activeTab === "timers" && <TimersPanel />}
        {activeTab === "cheatsheet" && <CheatsheetPanel />}
      </div>
    </div>
  );
}
