import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCanonicalCompleteness, evaluateCanonicalStrategyCompleteness } from '../scripts/canonical-completeness.mjs';
import { computeQualitySnapshot } from '../scripts/intelligence-quality.mjs';
import { chooseNextImprovement, renderPrompt } from '../scripts/next-improvement.mjs';

const completeGoals = `# Goals

## Product Thesis
Agent IDE turns repository intelligence into a local control plane.

## Current Focus
Make canonical completeness deterministic.

## Current Product Bet
Completeness-aware intelligence makes generated packages safer.

## What Not To Build
Do not add cloud calls, telemetry, or LLM evaluation.

## Long-Term Vision
Repository understanding becomes the default development interface.

## Manual Goals
- Product intent: Make repository intelligence complete enough for safe handoffs.
- Current focus: Replace binary presence checks with deterministic completeness.
- Success criteria: Health, quality, packages, and control plane agree.
- Long-term vision: Local repository memory guides every agent handoff.

## Success Criteria
- Completeness is deterministic.
`;

test('canonical completeness classifies missing, partial, complete, and strong Manual Goals', () => {
  assert.equal(evaluateCanonicalCompleteness('').fields.manualGoals.state, 'Missing');
  const partial = evaluateCanonicalCompleteness('# Goals\n\n## Manual Goals\n- Product intent: Build local intelligence.\n');
  assert.equal(partial.fields.manualGoals.state, 'Partial');
  assert.equal(partial.fields.manualGoals.percent, 25);
  assert.deepEqual(partial.fields.manualGoals.missing, ['Current focus', 'Success criteria', 'Long-term vision']);

  const complete = evaluateCanonicalCompleteness('# Goals\n\n## Manual Goals\n- Product intent: Build local intelligence.\n- Current focus: Completeness.\n- Success criteria: Artifacts agree.\n- Long-term vision: Better handoffs.\n');
  assert.equal(complete.fields.manualGoals.state, 'Complete');
  assert.equal(complete.fields.manualGoals.percent, 100);

  const strong = evaluateCanonicalCompleteness(`${completeGoals}\n- Product intent: Keep all evidence repository-local.\n- Current focus: Render percentages everywhere.\n- Success criteria: Regression tests cover artifacts.\n- Long-term vision: Agents start from canonical intelligence.\n`);
  assert.equal(strong.fields.manualGoals.state, 'Strong');
  assert.equal(strong.fields.manualGoals.percent, 100);
});

test('canonical completeness percentage averages deterministic canonical fields', () => {
  const snapshot = evaluateCanonicalCompleteness(completeGoals);
  assert.equal(snapshot.state, 'Complete');
  assert.equal(snapshot.score, 100);
});


test('canonical strategy completeness classifies required strategy fields deterministically without changing canonical score', () => {
  const result = evaluateCanonicalStrategyCompleteness(`# Goals

## Current Product Bet
Test package guidance.

## What Not To Build
Cloud scoring.
`);
  assert.equal(result.classification, 'Partial');
  assert.deepEqual(result.missing, ['Strategic Differentiator', 'Strategy Evidence']);
  assert.equal(result.requiredFields.find((field) => field.label === 'Repository Principles').optional, true);
  assert.equal(result.requiredFields.find((field) => field.label === 'Current Product Bet').classification, 'Present');
  assert.equal(evaluateCanonicalCompleteness('').score, 0);
});

test('intelligence quality incorporates canonical completeness fields', async () => {
  const docs = { 'goals.md': completeGoals, 'strategy.md': '# Strategy\n\n## Product Thesis\nAgent IDE turns repository intelligence into a local control plane.\n\n## Current Product Bet\nCompleteness-aware intelligence makes generated packages safer.\n\n## North Star Metric\nUseful handoffs\n', 'architecture.md': '# Architecture\n\n## Product Thesis\nAgent IDE turns repository intelligence into a local control plane.\n\n## Current Focus\nMake canonical completeness deterministic.\n', 'validation.md': '# Validation\n\n## Confidence\nHigh\n', 'repository-health.md': '# Repository Health\nConfidence: High\n\n## Risks\n- No repository health risks detected.\n', 'decisions.md': 'x', 'backlog.md': '- Work', 'agents.md': 'x', 'code.md': 'x', 'context-package.md': 'x', 'prompts/architect.md': 'x', 'prompts/builder.md': 'x', 'prompts/reviewer.md': 'x', 'prompts/debugger.md': 'x', 'intelligence-verification.json': '{"score":100,"failures":[]}' };
  const quality = await computeQualitySnapshot(process.cwd(), docs, null, []);
  assert.equal(quality.canonicalIntelligenceQuality.completenessScore, 100);
  assert.equal(quality.canonicalIntelligenceQuality.fields.manualGoals.percent, 100);
});

test('product decision package identifies incomplete Manual Goals fields below threshold', () => {
  const quality = { coverage: { goalsPresent: true }, canonicalIntelligenceQuality: { score: 50, fields: { manualGoals: { state: 'Partial', percent: 50, missing: ['Success criteria', 'Long-term vision'] } } }, consistency: { contradictions: [], duplicatedSections: [] }, confidence: { score: 90 }, generatedExportQuality: { score: 100 }, freshness: { canonicalStaleDocuments: [] } };
  const selected = chooseNextImprovement({ health: '# Repository Health\n\n## Risks\n- Manual Goals Partial (50%). Missing: Success criteria, Long-term vision.\n', quality, strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n', contextPackage: 'ready' });
  assert.equal(selected.id, 'missing-manual-goals');
  const prompt = renderPrompt(selected);
  assert.match(prompt, /Success criteria, Long-term vision/);
});
