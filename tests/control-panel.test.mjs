import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { test } from 'node:test';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const controlPanel = await readFile('terminal/control-panel.sh', 'utf8');
const docs = await readFile('terminal/README.md', 'utf8');
const execFileAsync = promisify(execFile);

test('terminal control panel file exists for the npm control script', async () => {
  await access('terminal/control-panel.sh');
  assert.equal(packageJson.scripts.control, 'bash terminal/control-panel.sh');
});

test('npm control script launches the project-owned terminal control panel', () => {
  assert.equal(packageJson.scripts.control, 'bash terminal/control-panel.sh');
  assert.match(controlPanel, /Agent IDE terminal control panel/);
  assert.match(controlPanel, /No interactive input detected; control panel launched successfully and is exiting\./);
});

test('control panel preserves existing local developer commands', () => {
  for (const command of ['npm run server', 'npm run dev', 'npm test', 'npm run build']) {
    assert.match(controlPanel, new RegExp(command.replaceAll(' ', '\\s+')));
  }
});

test('control panel writes deterministic local logs and opens the Vite URL', () => {
  assert.match(controlPanel, /LOG_DIR="\$ROOT_DIR\/\.dev-logs"/);
  assert.match(controlPanel, /server\.log/);
  assert.match(controlPanel, /vite\.log/);
  assert.match(controlPanel, /http:\/\/localhost:5173/);
});

test('terminal documentation matches package scripts and stop command', () => {
  assert.match(docs, /npm run control/);
  assert.match(docs, /npm run server/);
  assert.match(docs, /npm run dev/);
  assert.match(docs, /npm test/);
  assert.match(docs, /npm run build/);
  assert.match(docs, /npm run control -- stop/);
});


test('control panel dashboard renders repository, development, quality, and logs sections non-interactively', async () => {
  const { stdout } = await execFileAsync('bash', ['-lc', 'bash terminal/control-panel.sh < /dev/null']);

  assert.match(stdout, /Repository\n/);
  assert.match(stdout, /Connected repository:/);
  assert.match(stdout, /Current branch:/);
  assert.match(stdout, /Working tree:\s+(Clean|Modified)/);
  assert.match(stdout, /Development\n/);
  assert.match(stdout, /API server:\s+(Running|Stopped)/);
  assert.match(stdout, /Vite:\s+(Running|Stopped)/);
  assert.match(stdout, /Quality\n/);
  assert.match(stdout, /Last test result:\s+(Passing|Unknown)/);
  assert.match(stdout, /Last build result:\s+(Healthy|Unknown)/);
  assert.match(stdout, /Logs\n/);
  assert.match(stdout, /\.dev-logs location:/);
  assert.match(stdout, /Agent IDE terminal control panel/);
});

test('control panel dashboard implementation does not read repository intelligence or recommendations', () => {
  assert.doesNotMatch(controlPanel, /\.ai/);
  assert.doesNotMatch(controlPanel, /recommendation/i);
});
