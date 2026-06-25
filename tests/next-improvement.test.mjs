import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseNextImprovement, renderPrompt } from '../scripts/next-improvement.mjs';

const healthyQuality = {
  coverage: { goalsPresent: true, strategyPresent: true, architecturePresent: true, decisionsPresent: true, validationPresent: true, backlogPresent: true, repositoryHealthPresent: true, agentsPresent: true, codePresent: true },
  consistency: { contradictions: [], duplicatedSections: [] },
  canonicalIntelligenceQuality: { score: 92 },
  generatedExportQuality: { score: 94 },
  confidence: { score: 88, validationConfidence: 'High' },
  freshness: { canonicalStaleDocuments: [] },
};

function choice(overrides = {}) {
  return chooseNextImprovement({ health: '# Repository Health\n\n## Risks\n- No repository health risks detected.\n', quality: healthyQuality, backlog: '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n', strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n', contextPackage: '# Context Package\nReady.\n', audit: '', ...overrides });
}

test('contradiction risk produces a consistency cleanup prompt', () => {
  const selected = choice({ quality: { ...healthyQuality, consistency: { contradictions: ['Product Thesis differs across Goals, Strategy, and Architecture.'], duplicatedSections: [] } } });
  assert.equal(selected.kind, 'consistency-cleanup');
  assert.match(renderPrompt(selected), /contradictory or duplicate canonical intelligence/i);
});

test('weak validation produces validation prompt', () => {
  const selected = choice({ quality: { ...healthyQuality, confidence: { score: 40, validationConfidence: 'Low' } } });
  assert.equal(selected.kind, 'validation');
  assert.match(selected.title, /validation confidence/i);
});

test('no serious issue produces AI handoff validation prompt', () => {
  const selected = choice();
  assert.equal(selected.kind, 'ai-handoff-validation');
  assert.equal(selected.title, 'Run AI handoff validation for this repository.');
});

test('prompt includes constraints', () => {
  const prompt = renderPrompt(choice());
  for (const expected of ['local-first', 'deterministic', 'no LLM calls', 'no cloud', 'no telemetry', 'preserve manual sections', 'keep changes small and reviewable']) {
    assert.match(prompt, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('prompt preserves deterministic/no-cloud/no-LLM language', () => {
  const prompt = renderPrompt(choice());
  assert.match(prompt, /deterministically from the Control Plane inputs/i);
  assert.match(prompt, /no cloud/i);
  assert.match(prompt, /no LLM calls/i);
});
