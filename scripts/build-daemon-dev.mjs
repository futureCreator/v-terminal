import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, existsSync, writeFileSync, unlinkSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createConnection } from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const rustcOutput = execSync('rustc -vV').toString();
const targetTriple = rustcOutput.match(/host: (.+)/)[1].trim();

const isWindows = process.platform === 'win32';
const ext = isWindows ? '.exe' : '';

const srcBinary = join(projectRoot, 'src-tauri', 'target', 'debug', `v-terminal-daemon${ext}`);
const destDir = join(projectRoot, 'src-tauri', 'binaries');
const destBinary = join(destDir, `v-terminal-daemon-${targetTriple}${ext}`);

// Tauri build script validates externalBin paths before compilation.
// Create a placeholder so the check passes, then replace with the real binary.
if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}
if (!existsSync(destBinary)) {
  writeFileSync(destBinary, '');
}

// If daemon is already running, skip rebuild (locked exe on Windows)
const daemonRunning = await new Promise((resolve) => {
  const sock = createConnection({ host: '127.0.0.1', port: 57320 });
  sock.once('connect', () => { sock.destroy(); resolve(true); });
  sock.once('error', () => resolve(false));
});

if (daemonRunning) {
  console.log('Daemon already running, skipping build.');
  // On Windows, tauri-build copies binaries/ → target/debug/v-terminal-daemon.exe and
  // panics with "Access Denied" if that file is the currently-running daemon process.
  // Windows allows renaming a running executable (FILE_SHARE_DELETE), so we rename the
  // locked file out of the way and create a fresh unlocked copy at the original path.
  // The running daemon keeps working from the renamed path; tauri-build gets a clean file.
  if (isWindows && existsSync(srcBinary)) {
    const oldBinary = `${srcBinary}.old`;
    try {
      if (existsSync(oldBinary)) unlinkSync(oldBinary);
      renameSync(srcBinary, oldBinary);
      copyFileSync(oldBinary, srcBinary);
      console.log('Unlocked daemon binary for tauri-build (Windows).');
    } catch (e) {
      console.warn(`Could not unlock daemon binary: ${e.message}`);
    }
  }
} else {
  console.log('Building v-terminal-daemon (debug)...');
  execSync('cargo build --bin v-terminal-daemon', {
    cwd: join(projectRoot, 'src-tauri'),
    stdio: 'inherit',
  });
}

// AV software may lock the newly compiled binary while scanning.
// Retry a few times with a short delay.
function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

function copyWithRetry(src, dest, retries = 10, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      if (existsSync(dest)) unlinkSync(dest);
      copyFileSync(src, dest);
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`Copy failed (${e.code}), retrying in ${delayMs}ms... (${i + 1}/${retries})`);
      sleep(delayMs);
    }
  }
}

if (!daemonRunning) {
  copyWithRetry(srcBinary, destBinary);
  console.log(`Daemon ready -> ${destBinary}`);
}
