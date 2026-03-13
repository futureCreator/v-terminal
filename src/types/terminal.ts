export type Layout = 1 | 2 | 3 | 4 | "4c" | 6 | 9;

export interface Panel {
  id: string;
  ptyId: string | null; // null until attached to a daemon session
  existingSessionId?: string; // pre-selected from session picker (attach mode)
}

export interface Tab {
  id: string;
  label: string;
  cwd: string;
  layout: Layout;
  panels: Panel[];
  broadcastEnabled: boolean;
  sshCommand?: string;
  shellProgram?: string; // e.g. "wsl.exe"
  shellArgs?: string[];  // e.g. ["-d", "Ubuntu"]
  pendingSessionPick?: boolean; // show session picker instead of terminals
}

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
}

export interface DaemonSessionInfo {
  id: string;
  label: string;
  cwd: string;
  created_at: number;
  last_active: number;
}

export interface SavedTabPanel {
  panelId: string;
  ptyId: string;
}

export interface SavedTab {
  id: string;
  label: string;
  layout: Layout;
  panels: SavedTabPanel[];
  savedAt: number; // ms timestamp
}
