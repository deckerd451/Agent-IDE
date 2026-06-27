import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { nonCriticalStepIds } from '../scripts/server.mjs';
import { generateNextImprovement } from '../scripts/next-improvement.mjs';

async function makeRepo(aiFiles = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'refresh-orch-test-'));
  const aiDir = join(dir, '.ai');
  await mkdir(aiDir, { recursive: true });
  for (const [name, content] of Object.entries(aiFiles)) {
    await writeFile(join(aiDir, name), content, 'utf8');
  }
  return { dir, aiDir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const minimalAi = {
  'goals.md': '# Goals\n\n## Product Purpose\nLocal-first AI coding assistant.\n',
  'architecture.md': '# Architecture\n\n## Core Systems\n- Server\n- Client\n\n## Primary Flows\n- User → Server\n',
  'strategy.md': '# Strategy\n\n## Product Thesis\nOwn your AI context.\n',
  'decisions.md': '# Decisions\n\n## Active Decisions\n- All generators must be deterministic.\n',
  'validation.md': '# Validation\n\n## Commands Run\n- `npm test`\n',
  'repository-health.md': '# Repository Health\n\n## Risks\n- No risks detected.\n',
  'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Add feature.\n',
  'context-package.md': '# Context Package\n\nReady.\n',
};

// ---------------------------------------------------------------------------
// nonCriticalStepIds classification
// ---------------------------------------------------------------------------

test('validation step is classified as non-critical', () => {
  assert.ok(nonCriticalStepIds.has('validation'), 'validation must be non-critical');
});

test('all prompt steps are classified as non-critical', () => {
  for (const role of ['architect', 'builder', 'reviewer', 'debugger']) {
    assert.ok(nonCriticalStepIds.has(`prompts:${role}`), `prompts:${role} must be non-critical`);
  }
});

test('execution-model and ai-handoff-validation are classified as non-critical', () => {
  assert.ok(nonCriticalStepIds.has('execution-model'), 'execution-model must be non-critical');
  assert.ok(nonCriticalStepIds.has('ai-handoff-validation'), 'ai-handoff-validation must be non-critical');
});

test('core intelligence generators are not classified as non-critical', () => {
  const criticalIds = ['architecture', 'backlog', 'decisions', 'strategy', 'repository-health', 'context-package'];
  for (const id of criticalIds) {
    assert.ok(!nonCriticalStepIds.has(id), `${id} must NOT be in nonCriticalStepIds`);
  }
});

// ---------------------------------------------------------------------------
// generateNextImprovement with generatorFailures
// ---------------------------------------------------------------------------

test('recommendation-trace.md is written even when generatorFailures are present', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    const simulatedFailures = [
      { id: 'validation', label: 'Validation', exitCode: 1, output: 'npm run build failed: TypeScript errors in src/App.tsx' },
    ];
    await generateNextImprovement(dir, { generatorFailures: simulatedFailures });
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    assert.ok(trace.length > 0, 'trace must be written');
    assert.ok(trace.startsWith('# Recommendation Trace'), 'trace must start with heading');
  } finally {
    await cleanup();
  }
});

test('recommendation-trace.md lists non-critical generator failures', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    const simulatedFailures = [
      { id: 'validation', label: 'Validation', exitCode: 1, output: 'npm run build failed: TypeScript errors' },
    ];
    await generateNextImprovement(dir, { generatorFailures: simulatedFailures });
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    assert.ok(trace.includes('Non-Critical Generator Failures'), 'trace must include generator failures section');
    assert.ok(trace.includes('Validation'), 'trace must name the failed generator');
    assert.ok(trace.includes('exit: 1') || trace.includes('exitCode') || trace.includes('exit: 1'), 'trace must report exit code');
  } finally {
    await cleanup();
  }
});

test('recommendation-trace.md has no failures section when generatorFailures is empty', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dir, { generatorFailures: [] });
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    assert.ok(!trace.includes('Non-Critical Generator Failures'), 'must not include failures section when none present');
  } finally {
    await cleanup();
  }
});

test('recommendation-trace.md is deterministic across calls with identical failures', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    const simulatedFailures = [
      { id: 'validation', label: 'Validation', exitCode: 1, output: 'npm run build failed' },
    ];
    await generateNextImprovement(dir, { generatorFailures: simulatedFailures });
    const first = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    await generateNextImprovement(dir, { generatorFailures: simulatedFailures });
    const second = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    assert.equal(first, second, 'trace must be byte-for-byte identical across calls with same inputs');
  } finally {
    await cleanup();
  }
});

test('decision-ranking.json and next-improvement-prompt.md are written alongside trace', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    const simulatedFailures = [
      { id: 'validation', label: 'Validation', exitCode: 1, output: 'build failed' },
    ];
    await generateNextImprovement(dir, { generatorFailures: simulatedFailures });
    const ranking = await readFile(join(dir, '.ai', 'decision-ranking.json'), 'utf8');
    const prompt = await readFile(join(dir, '.ai', 'next-improvement-prompt.md'), 'utf8');
    assert.ok(ranking.length > 0, 'decision-ranking.json must be written');
    assert.ok(prompt.length > 0, 'next-improvement-prompt.md must be written');
  } finally {
    await cleanup();
  }
});
