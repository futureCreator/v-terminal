export type Layout = 1 | 2 | 3 | 4 | 6 | 9;

export interface Panel {
  id: string;
  ptyId: string | null; // null until PTY is spawned
}

export interface Tab {
  id: string;
  label: string;
  cwd: string;
  layout: Layout;
  panels: Panel[];
  broadcastEnabled: boolean;
}

export interface SessionData {
  tabs: Array<{
    id: string;
    label: string;
    cwd: string;
    layout: Layout;
    broadcastEnabled: boolean;
  }>;
  activeTabId: string;
}
