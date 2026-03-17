export type Layout = 1 | 2 | 3 | 4 | "4c" | 6 | 9;

export interface Panel {
  id: string;
  sessionId: string | null;
  connectionId?: string | null;
  connection?: PanelConnection;
}

export interface Tab {
  id: string;
  label: string;
  cwd: string;
  layout: Layout;
  panels: Panel[];
  broadcastEnabled: boolean;
  pendingSessionPick?: boolean;
}

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
}

export interface PanelConnection {
  type: 'local' | 'ssh' | 'wsl';
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  label?: string;
}
