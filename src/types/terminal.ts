export type Layout = 1 | 2 | 3 | 4 | 6 | 9;

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
  hasActivity?: boolean; // has unread output since last viewed
}

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
}

export interface SessionData {
  tabs: Array<{
    id: string;
    label: string;
    cwd: string;
    layout: Layout;
    broadcastEnabled: boolean;
    sshCommand?: string;
    shellProgram?: string;
    shellArgs?: string[];
  }>;
  activeTabId: string;
}

export interface DaemonSessionInfo {
  id: string;
  label: string;
  cwd: string;
  created_at: number;
  last_active: number;
}
