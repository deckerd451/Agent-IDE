import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const controlPanel = await readFile('terminal/control-panel.sh', 'utf8');
const docs = await readFile('terminal/README.md', 'utf8');

test('npm control script launches the project-owned terminal control panel', () => {
  assert.equal(packageJson.scripts.control, 'bash terminal/control-panel.sh');
  assert.match(controlPanel, /Agent IDE terminal control panel/);
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
