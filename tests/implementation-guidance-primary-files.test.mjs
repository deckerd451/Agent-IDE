import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPrimaryFiles } from '../src/implementation-guidance.ts';

test('code-fixable implementation guidance prefers implementation and test files over .ai/goals.md', () => {
  const candidate = {
    rank: 1,
    id: 'backlog-noise',
    title: 'Add backlog quality filtering',
    category: 'backlog filtering bugs',
    severity: 'medium',
    actionability: 'code-fixable',
    priorityScore: 90,
    expectedImprovement: { total: 1, repositoryHealth: 1, canonicalCompleteness: 0, quality: 1, verification: 0, handoffReadiness: 1 },
    reason: 'Backlog quality filtering should reduce noisy candidates. Manual intent lives in `.ai/goals.md`.',
    evidence: 'Source risk cites `.ai/goals.md`, `.ai/backlog.md`, and `tests/backlog-quality-filtering.test.mjs`.',
    selected: true,
  };
  const recommendation = {
    title: 'Add backlog quality filtering',
    explanation: 'Reduce backlog noise deterministically.',
    whyItMatters: 'A noisy backlog hides the highest leverage work.',
    actionability: 'code-fixable',
    packageType: 'implementation',
    evidenceSource: '.ai/next-improvement-prompt.md',
    prompt: 'Likely files: `.ai/goals.md`, `scripts/next-improvement.mjs`, `tests/backlog-quality-filtering.test.mjs`.',
  };

  const result = selectPrimaryFiles(candidate, recommendation);

  assert.equal(result.primaryFile, 'scripts/next-improvement.mjs');
  assert.equal(result.source, 'direct');
  assert.ok(result.supportingFiles.includes('tests/backlog-quality-filtering.test.mjs'));
  assert.ok(result.supportingFiles.includes('.ai/goals.md'), 'manual evidence can remain supporting, but not primary');
});

test('manual product-decision guidance may use .ai/goals.md as primary file', () => {
  const candidate = {
    rank: 1,
    id: 'missing-manual-goals',
    title: 'Complete Manual Repository Intent Notes',
    category: 'missing manual goals',
    severity: 'high',
    actionability: 'manual',
    priorityScore: 95,
    expectedImprovement: { total: 1, repositoryHealth: 1, canonicalCompleteness: 1, quality: 1, verification: 0, handoffReadiness: 0 },
    reason: 'Manual Goals completeness is below threshold.',
    evidence: 'Missing fields in `.ai/goals.md`.',
    selected: true,
  };
  const recommendation = {
    title: 'Complete Manual Repository Intent Notes',
    explanation: 'Repository owner must complete canonical intent.',
    whyItMatters: 'Manual intent frames generated intelligence.',
    actionability: 'manual',
    packageType: 'product-decision',
    evidenceSource: '.ai/next-improvement-prompt.md',
    prompt: 'Repository Owner edits: `.ai/goals.md`. Everything else will be regenerated.',
  };

  const result = selectPrimaryFiles(candidate, recommendation);

  assert.equal(result.primaryFile, '.ai/goals.md');
  assert.equal(result.source, 'direct');
});
