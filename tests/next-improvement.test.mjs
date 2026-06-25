import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { chooseNextImprovement, generateNextImprovement, renderPrompt } from '../scripts/next-improvement.mjs';

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
    acceptancePattern: /Regenerated strategy no longer reports/i,
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
  assert.match(renderPrompt(selected), /This is a product-owner decision task, not a Codex implementation task\./);
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
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  assert.match(prompt, /deterministically from the selected issue/i);
  assert.match(prompt, /no cloud/i);
  assert.match(prompt, /no LLM calls/i);
});

test('implementation package includes complete deterministic lead-in', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  assert.match(prompt, /^# Reduce Backlog Noise\n\n## Implementation Instructions\nImplement this Implementation Package exactly as written\./);
  for (const expected of [
    'Use the cited repository evidence to identify the root cause before making changes.',
    'Keep the implementation narrowly scoped.',
    'Do not broaden scope beyond the selected issue.',
    'Preserve deterministic, local-first behavior.',
    'Preserve manual intelligence sections.',
    'Avoid unrelated refactoring.',
    'Use only repository-local evidence.',
    'Do not make LLM calls, use cloud services, or add telemetry.',
    'Ensure execution and validation are fully reproducible.',
  ]) {
    assert.match(prompt, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('implementation package includes expected improvement and after implementation sections', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  assert.match(prompt, new RegExp('## Expected Repository Improvement\\n- Repository Health should improve\\.\\n- Intelligence Quality should improve\\.\\n- The selected issue should disappear or downgrade\\.\\n- No new contradictions with `\\.ai/goals\\.md` should be introduced\\.'));
  assert.match(prompt, /## After Implementation\n- Refresh Repository Intelligence\.\n- Compare Repository Health before and after\.\n- Compare Intelligence Quality before and after\.\n- Verify whether the selected issue was resolved\.\n- Summarize any newly discovered issues\.\n- Generate the next Implementation Package\./);
});

test('implementation package sections render in deterministic order', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  const headings = [...prompt.matchAll(/^## .+$/gm)].map((match) => match[0]);
  assert.deepEqual(headings, [
    '## Implementation Instructions',
    '## Selected Issue',
    '## Motivation',
    '## Current Evidence',
    '## Problem',
    '## Goal',
    '## Requirements',
    '## Acceptance Criteria',
    '## Testing Commands',
    '## Constraints',
    '## Expected Repository Improvement',
    '## After Implementation',
  ]);
});

test('generated implementation packages remain deterministic across repeated renders', () => {
  const selected = choice();
  assert.equal(renderPrompt(selected), renderPrompt(selected));
});

test('manual issue generates Product Decision Package', () => {
  const selected = choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } });
  const prompt = renderPrompt(selected);
  assert.equal(selected.packageType, 'product-decision');
  assert.match(prompt, /## Decision Instructions/);
  assert.match(prompt, /This is a product-owner decision task, not a Codex implementation task\./);
  assert.doesNotMatch(prompt, /Implement this exactly|Implement this Implementation Package exactly as written/);
});

test('missing manual goals package includes suggested Manual Goals text', () => {
  const prompt = renderPrompt(choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } }));
  assert.match(prompt, /`\.ai\/goals\.md` `## Manual Goals`/);
  assert.match(prompt, /Product intent: \[Repository owner:/);
  assert.match(prompt, /Do not edit automatically/);
});

test('strategy manual notes package targets canonical goals sections', () => {
  const prompt = renderPrompt(choice({ quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50 } }, strategy: '# Strategy\n\n## Strategy Confidence\nLow\n' }));
  assert.match(prompt, /Add text under `\.ai\/goals\.md` in `## Manual Strategy Notes` or another canonical goals section/);
  assert.match(prompt, /`## Manual Strategy Notes`/);
  assert.match(prompt, /Strategic bet: \[Repository owner:/);
  assert.doesNotMatch(prompt, /`\.ai\/strategy\.md` `## Manual Strategy Notes`/);
});

test('product decision packages never recommend generated artifacts as manual edit targets', () => {
  for (const selected of [
    choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } }),
    choice({ quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50 } }, strategy: '# Strategy\n\n## Strategy Confidence\nLow\n' }),
  ]) {
    const prompt = renderPrompt(selected);
    assert.equal(selected.packageType, 'product-decision');
    assert.match(prompt, /Repository owner edits: `\.ai\/goals\.md`\nEverything else will be regenerated/);
    assert.doesNotMatch(prompt, /Update \.ai\/(?:strategy|architecture|repository-health|context-package)\.md/i);
    assert.doesNotMatch(prompt, /edit(?:ing)?[^\n]*(?:`?\.ai\/(?:strategy|architecture|repository-health|context-package)\.md`?)/i);
  }
});

test('generated Product Decision Package keeps manual strategy edits on canonical goals', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-product-decision-'));
  await mkdir(join(dir, '.ai'), { recursive: true });
  await writeFile(join(dir, '.ai/goals.md'), '# Goals\n\n## Product Purpose\nRepository intelligence control plane.\n');
  await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n\n## Risks\n- No repository health risks detected.\n');
  await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify({ ...healthyQuality, canonicalIntelligenceQuality: { score: 50 } }, null, 2));
  await writeFile(join(dir, '.ai/intelligence-audit.md'), '# Intelligence Audit\n');
  await writeFile(join(dir, '.ai/backlog.md'), '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n');
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n\n## Strategy Confidence\nLow\n');
  await writeFile(join(dir, '.ai/context-package.md'), '# Context Package\nReady.\n');

  const result = await generateNextImprovement(dir);
  const prompt = await readFile(join(dir, '.ai/next-improvement-prompt.md'), 'utf8');

  assert.equal(result.selectedIssue.id, 'strategy-quality');
  assert.equal(result.selectedIssue.packageType, 'product-decision');
  assert.match(prompt, /Repository owner edits: `\.ai\/goals\.md`\nEverything else will be regenerated/);
  assert.match(prompt, /Add text under `\.ai\/goals\.md` in `## Manual Strategy Notes` or another canonical goals section/);
  assert.match(prompt, /`## Manual Strategy Notes`/);
  assert.doesNotMatch(prompt, /\.ai\/strategy\.md/);
});

test('code-fixable issue still generates Implementation Package', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  assert.match(prompt, /## Implementation Instructions/);
  assert.match(prompt, /Implement this Implementation Package exactly as written\./);
});

test('validation-experiment issue generates clearly labeled validation package', () => {
  const selected = choice();
  const prompt = renderPrompt(selected);
  assert.equal(selected.packageType, 'validation-experiment');
  assert.match(prompt, /## Validation Instructions/);
  assert.match(prompt, /Run this Validation Experiment/);
});
