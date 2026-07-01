import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { nonCriticalStepIds, persistControlPlane, readControlPlane } from '../scripts/server.mjs';
import { generateNextImprovement } from '../scripts/next-improvement.mjs';

async function makeRepo(aiFiles = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'refresh-orch-test-'));
  const aiDir = join(dir, '.ai');
  await mkdir(aiDir, { recursive: true });
  for (const [name, content] of Object.entries(aiFiles)) {
    await mkdir(dirname(join(aiDir, name)), { recursive: true });
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


test('refresh pipeline suppresses Nearify skipped unavailable-Xcode validation recommendation and promotes next candidate', async () => {
  const skippedId = 'validation-full-simulator-device-build-not-run-by-default-no-full-xcodebuild';
  const nextId = 'validation-run-documentation-validation-with-npm-test';
  const initialContextPackage = '# Context Package\n\nNearify validation snapshot.\n';
  const skippedOutcome = {
    timestamp: '2026-06-30T00:00:00.000Z',
    repository: 'Nearify',
    recommendationId: skippedId,
    recommendationTitle: 'Full simulator/device build: Not run by default; no full xcodebuild',
    promptHash: 'nearify-xcode-skip',
    outcome: 'skipped',
    promptQuality: 'worked',
    userNote: 'Skipped: Linux without unavailable local Xcode/xcodebuild simulator tooling.',
    testsRun: [],
    refreshAfterCompletion: true,
  };
  const { dir, aiDir, cleanup } = await makeRepo({
    'goals.md': '# Goals\n\n## Product Thesis\nNearify helps people discover nearby events.\n\n## Current Focus\nValidate the iOS app handoff.\n\n## Manual Goals\n- Product intent: Nearify helps people discover nearby events.\n- Current focus: Validate the iOS app handoff.\n- Success criteria: Local validation guidance stays actionable.\n- Long-term vision: Reliable local event discovery.\n',
    'architecture.md': '# Architecture\n\n## Core Systems\n- Nearify.xcodeproj iOS app.\n\n## Primary Flows\n- User opens the iOS app and reviews nearby events.\n',
    'strategy.md': '# Strategy\n\n## Product Thesis\nNearify helps people discover nearby events.\n\n## Current Product Bet\nValidate the iOS app handoff.\n\n## Strategy Confidence\nHigh\n',
    'decisions.md': '# Decisions\n\n## Active Decisions\n- Keep validation local-first and deterministic.\n',
    'validation.md': '# Validation\n\n## Confidence\n- High\n\n## Commands Run\n- `npm test`\n\n## Xcode Project Validation\n- Xcode project validation metadata detected.\n- `xcodebuild -list -project Nearify.xcodeproj`\n- Scheme: `Nearify`\n- Full simulator/device build: Not run by default; no full xcodebuild.\n- Run documentation validation with npm test.\n',
    'repository-health.md': '# Repository Health\n\nOverall Health: Healthy\nConfidence: High\n\n## Risks\n- No repository health risks detected.\n',
    'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n',
    'context-package.md': initialContextPackage,
    'intelligence-audit.md': '# Intelligence Audit\n\nNo contradictions detected.\n',
    'intelligence-quality.json': JSON.stringify({
      coverage: { goalsPresent: true, strategyPresent: true, architecturePresent: true, decisionsPresent: true, validationPresent: true, backlogPresent: true, repositoryHealthPresent: true, agentsPresent: true, codePresent: true },
      consistency: { contradictions: [], duplicatedSections: [] },
      canonicalIntelligenceQuality: { score: 92, fields: { manualGoals: { state: 'Complete', percent: 100, missing: [] } }, strategyFields: { classification: 'Present', percent: 100, requiredFields: [] } },
      generatedExportQuality: { score: 94 },
      confidence: { score: 88, validationConfidence: 'High' },
      freshness: { canonicalStaleDocuments: [] },
    }, null, 2),
    'ai-handoff-validation.md': '# AI Handoff Validation\n\nReady.\n',
    'intelligence-verification.md': '# Intelligence Verification\n\nReady.\n',
    'agents.md': '# Agents\n\n- Builder.\n',
    'code.md': '# Code\n\n- Nearify iOS app.\n',
    'ai-handoff-validation.json': JSON.stringify({ overallScore: 100, status: 'Ready', contradictions: [], missingExplanations: [] }, null, 2),
    'prompts/architect.md': '# Architect Prompt\nReady.\n',
    'prompts/builder.md': '# Builder Prompt\nReady.\n',
    'prompts/reviewer.md': '# Reviewer Prompt\nReady.\n',
    'prompts/debugger.md': '# Debugger Prompt\nReady.\n',
    'outcomes.json': JSON.stringify([skippedOutcome], null, 2),
    'outcomes.md': '# Outcome Tracking\n\n## Last Outcome\n- Time: 2026-06-30T00:00:00.000Z\n- Recommendation: Full simulator/device build: Not run by default; no full xcodebuild\n- Outcome: Skipped\n- Prompt quality: Worked without clarification\n- Note: Skipped: Linux without unavailable local Xcode/xcodebuild simulator tooling.\n',
  });
  try {
    await mkdir(join(dir, 'Nearify.xcodeproj'), { recursive: true });

    await persistControlPlane(dir, null, new Date('2026-07-01T00:00:00.000Z'));

    const ranking = JSON.parse(await readFile(join(aiDir, 'decision-ranking.json'), 'utf8'));
    const active = JSON.parse(await readFile(join(aiDir, 'active-recommendation.json'), 'utf8'));
    const contextPackage = await readFile(join(aiDir, 'context-package.md'), 'utf8');

    assert.notEqual(ranking.selectedIssue?.id, skippedId, 'decision ranking must not reselect the skipped unavailable-Xcode recommendation');
    assert.notEqual(active.id, skippedId, 'active recommendation must not persist the skipped unavailable-Xcode recommendation');
    assert.doesNotMatch(contextPackage, new RegExp(`Selected Issue ID: ${skippedId}`), 'context package must not report the skipped unavailable-Xcode recommendation as selected');
    assert.equal(ranking.selectedIssue?.id, nextId, 'next eligible validation candidate must be promoted');
    assert.equal(active.id, nextId, 'active recommendation must expose the promoted next eligible candidate');
    assert.match(contextPackage, new RegExp(`Selected Issue ID: ${nextId}`), 'context package must report the promoted next eligible candidate');
  } finally {
    await cleanup();
  }
});
