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

function assertCoherent(selected, expected) {
  const prompt = renderPrompt(selected);
  assert.equal(selected.id, expected.id);
  assert.equal(selected.title, expected.title);
  assert.match(prompt, new RegExp(`# ${expected.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(prompt, new RegExp(`ID: ${expected.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(prompt, new RegExp(`Category: ${expected.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
  assert.match(prompt, expected.evidencePattern);
  assert.match(prompt, expected.problemPattern);
  assert.match(prompt, expected.acceptancePattern);
  return prompt;
}

test('missing manual goals produces coherent manual-goals prompt', () => {
  const selected = choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } });
  const prompt = assertCoherent(selected, {
    id: 'missing-manual-goals',
    title: 'Complete Manual Repository Intent Notes',
    category: 'missing manual goals',
    evidencePattern: /Manual Goals are missing/i,
    problemPattern: /missing populated Manual Goals/i,
    acceptancePattern: /Manual Goals are populated/i,
  });
  assert.doesNotMatch(prompt, /severe backlog noise/i);
});

test('backlog noise produces coherent backlog prompt', () => {
  const manyItems = Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n');
  const selected = choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${manyItems}\n` });
  const prompt = assertCoherent(selected, {
    id: 'backlog-noise',
    title: 'Reduce Backlog Noise',
    category: 'backlog filtering bugs',
    evidencePattern: /Backlog contains 26 items/i,
    problemPattern: /backlog contains severe noise/i,
    acceptancePattern: /Backlog noise is removed, merged, or downgraded/i,
  });
  assert.doesNotMatch(prompt, /Fill in `\.ai\/goals\.md`/i);
});

test('strategy gap produces coherent strategy prompt', () => {
  const selected = choice({ quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50 } }, strategy: '# Strategy\n\n## Strategy Confidence\nLow\n' });
  assertCoherent(selected, {
    id: 'strategy-quality',
    title: 'Strengthen Strategy Quality',
    category: 'fill strategy manual notes',
    evidencePattern: /Strategy Confidence: Low/i,
    problemPattern: /Strategy quality is weak or under-evidenced/i,
    acceptancePattern: /Strategy intelligence describes repository intent/i,
  });
});

test('no serious issue produces AI handoff validation prompt', () => {
  const selected = choice();
  const prompt = assertCoherent(selected, {
    id: 'ai-handoff-validation',
    title: 'Run AI Handoff Validation',
    category: 'AI handoff validation',
    evidencePattern: /No serious repository intelligence issue detected/i,
    problemPattern: /No serious repository intelligence issue is detected/i,
    acceptancePattern: /AI handoff validation is documented/i,
  });
  assert.doesNotMatch(prompt, /unless adding or documenting a validation workflow[\s\S]*Update the smallest set of source files/i);
});

test('no prompt contains title/evidence/category mismatch', () => {
  const scenarios = [
    choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } }),
    choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }),
    choice({ quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50 } }, strategy: '# Strategy\n\n## Strategy Confidence\nLow\n' }),
    choice(),
  ];

  for (const selected of scenarios) {
    const prompt = renderPrompt(selected);
    assert.match(prompt, new RegExp(`# ${selected.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(prompt, new RegExp(`Category: ${selected.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
    assert.match(prompt, new RegExp(selected.evidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (selected.id !== 'missing-manual-goals') assert.doesNotMatch(prompt, /Manual Goals are missing|Manual Goals are populated/i);
    if (selected.id !== 'backlog-noise') assert.doesNotMatch(prompt, /Backlog contains \d+ items|Backlog noise is removed/i);
    if (selected.id !== 'strategy-quality') assert.doesNotMatch(prompt, /Strategy Confidence: Low|Strategy intelligence describes/i);
  }
});


test('strategy manual gap does not beat code-fixable backlog issue', () => {
  const manyItems = Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n');
  const selected = choice({
    quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50 } },
    strategy: '# Strategy\n\n## Strategy Confidence\nLow\n',
    backlog: `# Backlog\n\n## Prioritized Backlog\n${manyItems}\n`,
  });
  assert.equal(selected.id, 'backlog-noise');
  assert.equal(selected.actionability, 'code-fixable');
});

test('missing manual goals is marked manual', () => {
  const selected = choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } });
  assert.equal(selected.actionability, 'manual');
});

test('code-fixable contradiction is selected before manual strategy note', () => {
  const selected = choice({
    quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50 }, consistency: { contradictions: ['Goals contradict strategy.'], duplicatedSections: [] } },
    strategy: '# Strategy\n\n## Strategy Confidence\nLow\n',
  });
  assert.equal(selected.id, 'consistency-cleanup');
  assert.equal(selected.actionability, 'code-fixable');
});

test('manual issue prompt includes manual-task warning', () => {
  const selected = choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } });
  assert.match(renderPrompt(selected), /This is a manual product-owner task, not a Codex implementation task\./);
});

test('no code-fixable issues produces AI handoff validation', () => {
  const selected = choice();
  assert.equal(selected.id, 'ai-handoff-validation');
  assert.equal(selected.actionability, 'validation-experiment');
});

test('prompt includes constraints', () => {
  const prompt = renderPrompt(choice());
  for (const expected of ['local-first', 'deterministic', 'no LLM calls', 'no cloud', 'no telemetry', 'preserve manual sections', 'keep changes small and reviewable']) {
    assert.match(prompt, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('prompt preserves deterministic/no-cloud/no-LLM language', () => {
  const prompt = renderPrompt(choice());
  assert.match(prompt, /deterministically from the selected issue/i);
  assert.match(prompt, /no cloud/i);
  assert.match(prompt, /no LLM calls/i);
});
