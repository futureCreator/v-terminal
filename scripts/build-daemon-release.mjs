import { execSync } from 'child_process';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const rustcOutput = execSync('rustc -vV').toString();
const targetTriple = rustcOutput.match(/host: (.+)/)[1].trim();

const isWindows = process.platform === 'win32';
const ext = isWindows ? '.exe' : '';

console.log('Building v-terminal-daemon (release)...');
execSync('cargo build --bin v-terminal-daemon --release', {
  cwd: join(projectRoot, 'src-tauri'),
  stdio: 'inherit',
});

const srcBinary = join(projectRoot, 'src-tauri', 'target', 'release', `v-terminal-daemon${ext}`);
const destDir = join(projectRoot, 'src-tauri', 'binaries');
const destBinary = join(destDir, `v-terminal-daemon-${targetTriple}${ext}`);

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

copyFileSync(srcBinary, destBinary);
console.log(`Daemon ready -> ${destBinary}`);
