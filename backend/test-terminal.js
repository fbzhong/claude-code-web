const pty = require('node-pty');

console.log('Testing node-pty...');

const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.env.HOME,
  env: process.env
});

console.log('PTY process spawned successfully');

ptyProcess.on('data', function(data) {
  console.log('PTY Output:', data);
});

// Send a test command
setTimeout(() => {
  console.log('Sending test command: echo "Hello from PTY"');
  ptyProcess.write('echo "Hello from PTY"\r');
}, 1000);

// Exit after 3 seconds
setTimeout(() => {
  console.log('Killing PTY process...');
  ptyProcess.kill();
  process.exit(0);
}, 3000);