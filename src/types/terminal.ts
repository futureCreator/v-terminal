export type Layout = 1 | 2 | 3 | 4 | "4c" | 6 | 9;

export interface Panel {
  id: string;
  ptyId: string | null;
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
  sshCommand?: string;
  shellProgram?: string;
  shellArgs?: string[];
  label?: string;
}
