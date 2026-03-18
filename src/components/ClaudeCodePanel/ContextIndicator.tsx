import type { PanelConnection } from "../../types/terminal";

interface ContextIndicatorProps {
  connection: PanelConnection | undefined;
  cwd: string | null;
}

export function ContextIndicator({ connection, cwd }: ContextIndicatorProps) {
  const label = connection
    ? connection.type === "ssh"
      ? `SSH ${connection.label ?? ""}`
      : connection.type === "wsl"
        ? `WSL ${connection.shellArgs?.[1] ?? ""}`
        : "Local"
    : "No session";

  return (
    <div className="claude-context">
      <span className="claude-context-dot" />
      <div className="claude-context-info">
        <span className="claude-context-label">{label}</span>
        {cwd && <span className="claude-context-cwd">{cwd}</span>}
      </div>
    </div>
  );
}
