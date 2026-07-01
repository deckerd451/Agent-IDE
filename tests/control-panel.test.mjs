import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { repositoryIntelligenceStatus, renderRepositoryIntelligence } from '../terminal/decision-status.mjs';

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



test('control panel dashboard renders repository intelligence section in status output', async () => {
  const { stdout } = await execFileAsync('bash', ['-lc', 'npm run control -- status']);

  assert.match(stdout, /Repository Intelligence\n/);
  assert.match(stdout, /Decision:/);
  assert.match(stdout, /Development\n/);
  assert.match(stdout, /Quality\n/);
  assert.match(stdout, /Logs\n/);
});

test('repository intelligence status renders populated recommendation artifacts', async () => {
  const dir = await mkdtempRepo();
  try {
    const ai = join(dir, '.ai');
    await mkdir(ai, { recursive: true });
    await writeFile(join(ai, 'active-recommendation.json'), JSON.stringify({ title: 'Tighten execution package', packageType: 'implementation', confidence: 'High' }));
    await writeFile(join(ai, 'decision-ranking.json'), JSON.stringify({ selectedIssue: { id: 'tighten', title: 'Fallback title' }, candidates: [{ id: 'tighten', title: 'Tighten execution package', packageType: 'implementation', selected: true }] }));
    await writeFile(join(ai, 'ai-handoff-validation.json'), JSON.stringify({ status: 'Ready', overallScore: 96 }));

    const rendered = renderRepositoryIntelligence(await repositoryIntelligenceStatus(dir));

    assert.match(rendered, /Decision:\s+Tighten execution package/);
    assert.match(rendered, /Package type:\s+implementation/);
    assert.match(rendered, /Confidence:\s+High/);
    assert.match(rendered, /Handoff readiness:\s+Ready \(96\/100\)/);
    assert.match(rendered, /Execution agents:\s+Claude, Codex, ChatGPT, Gemini, Generic/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('repository intelligence status renders empty state for missing artifacts', async () => {
  const dir = await mkdtempRepo();
  try {
    const rendered = renderRepositoryIntelligence(await repositoryIntelligenceStatus(dir));

    assert.match(rendered, /Repository Intelligence/);
    assert.match(rendered, /Decision: Not available — refresh repository intelligence in Agent IDE\./);
    assert.doesNotMatch(rendered, /Package type:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('repository intelligence status ignores invalid JSON without crashing', async () => {
  const dir = await mkdtempRepo();
  try {
    const ai = join(dir, '.ai');
    await mkdir(ai, { recursive: true });
    await writeFile(join(ai, 'active-recommendation.json'), '{not json');
    await writeFile(join(ai, 'decision-ranking.json'), '{also not json');

    const rendered = renderRepositoryIntelligence(await repositoryIntelligenceStatus(dir));

    assert.match(rendered, /Decision: Not available — refresh repository intelligence in Agent IDE\./);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('terminal dashboard does not expose workflow or FSM language', async () => {
  const { stdout } = await execFileAsync('bash', ['-lc', 'npm run control -- status']);

  assert.doesNotMatch(stdout, /workflow/i);
  assert.doesNotMatch(stdout, /FSM/i);
  assert.doesNotMatch(stdout, /currentStep|completionState|repositoryState/);
});

async function mkdtempRepo() {
  const { mkdtemp } = await import('node:fs/promises');
  return mkdtemp(join(tmpdir(), 'agent-ide-control-panel-'));
}
