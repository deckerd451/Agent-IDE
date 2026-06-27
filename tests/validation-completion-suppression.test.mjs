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
