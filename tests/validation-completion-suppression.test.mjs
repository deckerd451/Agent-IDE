import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNextImprovementWithCandidates, stableContextPackageHash } from '../scripts/next-improvement.mjs';

const healthyQuality = {
  coverage: {
    goalsPresent: true,
    strategyPresent: true,
    architecturePresent: true,
    decisionsPresent: true,
    validationPresent: true,
    backlogPresent: true,
    repositoryHealthPresent: true,
    agentsPresent: true,
    codePresent: true,
  },
  canonicalIntelligenceQuality: { score: 100, fields: { manualGoals: { percent: 100, state: 'Complete', missing: [] } }, requiredFields: [], evidenceSynthesis: { fields: {} } },
  confidence: { score: 95, validationConfidence: 'High' },
  generatedExportQuality: { score: 90 },
  consistency: { contradictions: [], duplicatedSections: [] },
  freshness: { canonicalStaleDocuments: [] },
};

function healthyChoice(overrides = {}) {
  const contextPackage = overrides.contextPackage ?? '# Context Package\nSnapshot A\n';
  return chooseNextImprovementWithCandidates({
    health: '# Repository Health\n\n## Risks\n- No repository health risks detected.\n',
    quality: healthyQuality,
    backlog: '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n',
    strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n',
    audit: '',
    goals: '',
    repositoryPath: '/tmp/repo',
    contextPackage,
    ...overrides,
  });
}

test('completed validation workflow suppresses same validation recommendation for same snapshot', () => {
  const contextPackage = '# Context Package\nSnapshot A\n';
  const workflowKey = 'Validation:validation-experiment:Run AI Handoff Validation';
  const result = healthyChoice({
    contextPackage,
    validationCompletions: [{
      workflowKey,
      completedAt: '2026-06-27T00:00:00.000Z',
      repositoryPath: '/tmp/repo',
      selectedIssueId: 'ai-handoff-validation',
      recommendationTitle: 'Run AI Handoff Validation',
      contextPackageHash: stableContextPackageHash(contextPackage),
    }],
  });

  assert.equal(result.selectedIssue.id, 'repository-up-to-date');
  assert.equal(result.selectedIssue.title, 'Repository is up to date');
  assert.match(result.selectedIssue.reason, /No high-priority improvement detected/);
});

test('changed intelligence snapshot allows validation recommendation to reappear', () => {
  const completedContextPackage = '# Context Package\nSnapshot A\n';
  const changedContextPackage = '# Context Package\nSnapshot B\n';
  const result = healthyChoice({
    contextPackage: changedContextPackage,
    validationCompletions: [{
      workflowKey: 'Validation:validation-experiment:Run AI Handoff Validation',
      completedAt: '2026-06-27T00:00:00.000Z',
      repositoryPath: '/tmp/repo',
      selectedIssueId: 'ai-handoff-validation',
      recommendationTitle: 'Run AI Handoff Validation',
      contextPackageHash: stableContextPackageHash(completedContextPackage),
    }],
  });

  assert.equal(result.selectedIssue.id, 'ai-handoff-validation');
  assert.equal(result.selectedIssue.title, 'Run AI Handoff Validation');
});

test('stableContextPackageHash strips Generated timestamp so hash is stable across refreshes', () => {
  const base = '# Context Package\n\n## Product Thesis\nsome content\n\n## Current Focus\nfocus here\n';
  const withTimestamp1 = `# Context Package\n\nGenerated: 2026-06-27T00:00:00.000Z\n\n## Product Thesis\nsome content\n\n## Current Focus\nfocus here\n`;
  const withTimestamp2 = `# Context Package\n\nGenerated: 2026-06-27T01:23:45.678Z\n\n## Product Thesis\nsome content\n\n## Current Focus\nfocus here\n`;

  const hash1 = stableContextPackageHash(withTimestamp1);
  const hash2 = stableContextPackageHash(withTimestamp2);

  assert.ok(hash1, 'hash should be defined');
  assert.equal(hash1, hash2, 'same content with different Generated: timestamps must produce the same stable hash');
});

test('refresh step scenario: completion record from terminal step suppresses same recommendation', () => {
  const contextPackageBeforeRefresh = '# Context Package\n\nGenerated: 2026-06-27T10:00:00.000Z\n\n## Product Thesis\nsome content\n';
  const contextPackageAfterRefresh  = '# Context Package\n\nGenerated: 2026-06-27T10:05:00.000Z\n\n## Product Thesis\nsome content\n';

  const storedHash = stableContextPackageHash(contextPackageBeforeRefresh);
  const workflowKey = 'Validation:validation-experiment:Run AI Handoff Validation';

  const result = healthyChoice({
    contextPackage: contextPackageAfterRefresh,
    validationCompletions: [{
      workflowKey,
      completedAt: '2026-06-27T10:04:00.000Z',
      repositoryPath: '/tmp/repo',
      selectedIssueId: 'ai-handoff-validation',
      recommendationTitle: 'Run AI Handoff Validation',
      contextPackageHash: storedHash,
    }],
  });

  assert.notEqual(result.selectedIssue.id, 'ai-handoff-validation', 'workflow must not be stuck on refresh step after terminal refresh action');
  assert.equal(result.selectedIssue.id, 'repository-up-to-date', 'same repository content with different Generated: timestamp must still suppress the recommendation');
});
