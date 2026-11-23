import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const processes = [];
let shuttingDown = false;

function startProcess(label, colorCode, cwd, args) {
  const child = spawn('npm', args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: process.platform === 'win32',
  });

  const prefix = `\x1b[${colorCode}m[${label}]\x1b[0m `;

  const pipeLines = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        target.write(`${prefix}${line}\n`);
      }
    });
    stream.on('end', () => {
      if (buffer.length > 0) {
        target.write(`${prefix}${buffer}\n`);
      }
    });
  };

  pipeLines(child.stdout, process.stdout);
  pipeLines(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0 && code !== null) {
      console.error(`${prefix}Exited unexpectedly with code ${code}. Stopping all services...`);
      shutdown(code);
    }
  });

  processes.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const proc of processes) {
    if (!proc.killed) {
      proc.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(exitCode), 250);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('\x1b[1mStarting HabitFlow Backend & Frontend Development Servers...\x1b[0m');
startProcess('SERVER', '32', resolve(rootDir, 'server'), ['run', 'dev']);
startProcess('CLIENT', '36', resolve(rootDir, 'client'), ['run', 'dev']);
