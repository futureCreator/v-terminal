export type Layout = 1 | 2 | "2r" | 3 | 4 | "3c" | 6;

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
  type: 'local' | 'ssh' | 'wsl' | 'note';
  sshProfileId?: string;
  shellProgram?: string;
  shellArgs?: string[];
  wslDistro?: string;
  label?: string;
}
