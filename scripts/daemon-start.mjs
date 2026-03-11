import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createConnection } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const isWindows = process.platform === 'win32';
const ext = isWindows ? '.exe' : '';

// Check if daemon is already running
const daemonRunning = await new Promise((resolve) => {
  const sock = createConnection({ host: '127.0.0.1', port: 57320 });
  sock.once('connect', () => { sock.destroy(); resolve(true); });
  sock.once('error', () => resolve(false));
});

if (daemonRunning) {
  console.log('Daemon is already running on port 57320.');
  process.exit(0);
}

// Build daemon if binary doesn't exist
const binaryPath = join(projectRoot, 'src-tauri', 'target', 'debug', `v-terminal-daemon${ext}`);

if (!existsSync(binaryPath)) {
  console.log('Building v-terminal-daemon (debug)...');
  execSync('cargo build --bin v-terminal-daemon', {
    cwd: join(projectRoot, 'src-tauri'),
    stdio: 'inherit',
  });
}

// Spawn daemon as detached background process
const child = spawn(binaryPath, [], {
  detached: true,
  stdio: 'ignore',
});
child.unref();

// Wait up to 5s for daemon to be ready
console.log('Starting daemon...');
for (let i = 0; i < 50; i++) {
  await new Promise((r) => setTimeout(r, 100));
  const ready = await new Promise((resolve) => {
    const sock = createConnection({ host: '127.0.0.1', port: 57320 });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
  });
  if (ready) {
    console.log('Daemon started (pid: ' + child.pid + ')');
    process.exit(0);
  }
}

console.error('Daemon did not start in time.');
process.exit(1);
