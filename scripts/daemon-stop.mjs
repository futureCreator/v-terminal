import { createConnection } from 'net';

const isWindows = process.platform === 'win32';

// Check if daemon is running
const daemonRunning = await new Promise((resolve) => {
  const sock = createConnection({ host: '127.0.0.1', port: 57320 });
  sock.once('connect', () => { sock.destroy(); resolve(true); });
  sock.once('error', () => resolve(false));
});

if (!daemonRunning) {
  console.log('Daemon is not running.');
  process.exit(0);
}

// Kill by process name
try {
  if (isWindows) {
    import('child_process').then(({ execSync }) => {
      execSync('taskkill /F /IM v-terminal-daemon.exe', { stdio: 'inherit' });
      console.log('Daemon stopped.');
    });
  } else {
    import('child_process').then(({ execSync }) => {
      execSync('pkill -f v-terminal-daemon', { stdio: 'inherit' });
      console.log('Daemon stopped.');
    });
  }
} catch (e) {
  console.error('Failed to stop daemon:', e.message);
  process.exit(1);
}
