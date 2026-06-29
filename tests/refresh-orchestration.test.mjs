import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { nonCriticalStepIds, persistControlPlane, readControlPlane } from '../scripts/server.mjs';
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

test('execution-model, repository-judgment, and ai-handoff-validation are classified as non-critical', () => {
  assert.ok(nonCriticalStepIds.has('execution-model'), 'execution-model must be non-critical');
  assert.ok(nonCriticalStepIds.has('repository-judgment'), 'repository-judgment must be non-critical shadow-mode output');
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


test('refresh persists Product Intelligence Strategic Context into active recommendation prompt', async () => {
  const { dir, cleanup } = await makeRepo({
    ...minimalAi,
    'goals.md': '# Goals\n\n## Product Thesis\nAgent IDE helps local-first teams turn repository intelligence into safe next implementation work.\n\n## Current Focus\nMake prompt previews consistently reflect generated intelligence.\n\n## Success Criteria\n- Preview Prompt includes strategic context.\n\n## Manual Goals\n- Product intent: Local-first AI coding assistant.\n- Current focus: Deterministic Product Intelligence propagation.\n- Success criteria: Preview Prompt includes Strategic Context.\n- Long-term vision: Reliable repository control plane.\n',
    'strategy.md': '# Strategy\n\n## Current Product Bet\nPrompt previews consistently reflect generated Product Intelligence context.\n\n## Current Experiment\nPreview Prompt includes Strategic Context after refresh.\n',
    'repository-health.md': '# Repository Health\n\n## Risks\n- Preview Prompt can omit strategic context after refresh.\n\n## Intelligence Completeness\n- Product thesis present.\n',
    'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Propagate Product Intelligence Strategic Context into active recommendation prompt.\n',
    'decisions.md': '# Decisions\n\n## Active Decisions\n- All generators must be deterministic, local-first, and make no LLM calls.\n',
    'intelligence-quality.json': JSON.stringify({ overallScore: 85, canonicalIntelligenceQuality: { completenessState: 'Complete', score: 100 } }, null, 2),
  });
  try {
    await persistControlPlane(dir, null, new Date('2026-06-29T00:00:00.000Z'));

    const nextPrompt = await readFile(join(dir, '.ai', 'next-improvement-prompt.md'), 'utf8');
    const activeRecommendation = JSON.parse(await readFile(join(dir, '.ai', 'active-recommendation.json'), 'utf8'));
    const controlPlane = await readControlPlane(dir);

    assert.match(nextPrompt, /## Strategic Context/, 'next improvement prompt must contain Product Intelligence Strategic Context');
    assert.match(activeRecommendation.implementationPrompt, /## Strategic Context/, 'active recommendation implementationPrompt must contain Strategic Context');
    assert.equal(activeRecommendation.implementationPrompt, nextPrompt, 'active recommendation must persist the exact generated prompt body');
    assert.match(controlPlane.recommendation.implementationPrompt, /## Strategic Context/, 'Control Plane Preview Prompt source must include Strategic Context');
    assert.equal(controlPlane.recommendation.implementationPrompt, nextPrompt, 'Control Plane must expose the same generated prompt body');
    assert.equal(controlPlane.packages.builder, controlPlane.recommendation.implementationPrompt, 'Copy/Open Codex builder prompt must use the same source body');
  } finally {
    await cleanup();
  }
});
