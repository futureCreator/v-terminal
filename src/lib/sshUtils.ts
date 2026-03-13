import type { SshProfile } from "../types/terminal";

export function buildSshCommand(
  profile: Pick<SshProfile, "username" | "host" | "port" | "identityFile">
): string {
  let cmd = `ssh ${profile.username}@${profile.host}`;
  if (profile.port !== 22) cmd += ` -p ${profile.port}`;
  if (profile.identityFile) cmd += ` -i "${profile.identityFile}"`;
  return cmd;
}
