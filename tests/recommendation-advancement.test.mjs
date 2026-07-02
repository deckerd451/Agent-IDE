import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRecommendationAdvancement, buildDecisionRanking } from '../scripts/next-improvement.mjs';

const implementedWorked = (overrides = {}) => ({
  timestamp: '2026-06-28T00:00:00.000Z',
  recommendationId: 'done-work',
  recommendationTitle: 'Done Work',
  outcome: 'implemented',
  promptQuality: 'worked',
  ...overrides,
});

function candidate(overrides = {}) {
  return {
    id: 'done-work',
    title: 'Done Work',
    class: 'improvement',
    category: 'testing',
    severity: 'medium',
    actionability: 'code-fixable',
    evidence: 'Backlog item names useful completed work.',
    source: 'Backlog item names useful completed work.',
    reason: 'Useful repository improvement.',
    recommendedAction: 'Implement useful work.',
    ...overrides,
  };
}

test('implemented + worked recommendation is suppressed when another eligible candidate exists', () => {
  const next = candidate({ id: 'next-work', title: 'Next Work', evidence: 'Fresh backlog item.', source: 'Fresh backlog item.' });
  const advanced = applyRecommendationAdvancement([candidate(), next], [implementedWorked()]);
  const ranking = buildDecisionRanking(advanced);

  assert.equal(ranking.selectedIssue.id, 'next-work');
  assert.equal(ranking.advancement.suppressedCandidates.length, 1);
  assert.match(ranking.advancement.suppressedCandidates[0].reason, /Satisfied by implemented \+ worked outcome/);
});

test('implemented + worked recommendation is retained with explicit deterministic reason when incomplete evidence remains', () => {
  const retained = candidate({ evidence: 'Validation confidence is missing.', source: 'Validation confidence is missing.', reason: 'A missing validation confidence gap remains.' });
  const advanced = applyRecommendationAdvancement([retained, candidate({ id: 'other', title: 'Other Work' })], [implementedWorked()]);
  const selectedRetained = advanced.find((item) => item.id === 'done-work');

  assert.equal(selectedRetained.advancement.state, 'retained');
  assert.match(selectedRetained.advancement.reason, /^Retained despite implemented outcome because/);
});

test('partial skipped and failed outcomes do not suppress recommendations', () => {
  for (const outcome of ['partial', 'skipped', 'failed']) {
    const advanced = applyRecommendationAdvancement([candidate(), candidate({ id: 'other', title: 'Other Work' })], [implementedWorked({ outcome })]);
    assert.equal(advanced.some((item) => item.id === 'done-work'), true, `${outcome} should keep candidate eligible`);
    assert.equal(advanced.find((item) => item.id === 'done-work').advancement.state, 'eligible');
  }
});

test('implemented + worked recommendation produces positive empty state when no alternate exists', () => {
  const advanced = applyRecommendationAdvancement([candidate()], [implementedWorked()]);
  const ranking = buildDecisionRanking(advanced);

  assert.equal(ranking.selectedIssue.id, 'no-eligible-next-improvement');
  assert.equal(ranking.selectedIssue.title, 'No eligible next improvement found.');
  assert.equal(ranking.advancement.suppressedCandidates.length, 1);
});

test('implemented + worked validation recommendation is terminal even when validation gap text remains', () => {
  const validation = candidate({
    id: 'validation-xcodebuild-build-succeeded',
    title: 'Run xcodebuild build validation',
    actionability: 'validation-experiment',
    packageType: 'validation-experiment',
    evidence: 'Known Validation Gaps still mention xcodebuild build missing.',
    source: 'Known Validation Gaps still mention xcodebuild build missing.',
    reason: 'A missing validation gap remains in generated markdown.',
  });
  const next = candidate({ id: 'validation-next', title: 'Run next validation', actionability: 'validation-experiment', packageType: 'validation-experiment' });
  const advanced = applyRecommendationAdvancement([validation, next], [implementedWorked({
    recommendationId: 'validation-xcodebuild-build-succeeded',
    recommendationTitle: 'Run xcodebuild build validation',
  })]);
  const ranking = buildDecisionRanking(advanced);

  assert.equal(ranking.selectedIssue.id, 'validation-next');
  assert.ok(ranking.advancement.suppressedCandidates.some((item) => item.id === 'validation-xcodebuild-build-succeeded'));
  assert.match(ranking.advancement.suppressedCandidates.find((item) => item.id === 'validation-xcodebuild-build-succeeded').reason, /completed validation evidence is terminal/);
});

test('skipped wrong-recommendation validation outcome that cites prior validation suppresses same candidate', () => {
  const validation = candidate({
    id: 'validation-xcodebuild-build-succeeded',
    title: 'Run xcodebuild build validation',
    actionability: 'validation-experiment',
    packageType: 'validation-experiment',
    evidence: 'Known Validation Gaps still mention xcodebuild build missing.',
  });
  const next = candidate({ id: 'validation-next', title: 'Run next validation', actionability: 'validation-experiment', packageType: 'validation-experiment' });
  const advanced = applyRecommendationAdvancement([validation, next], [{
    timestamp: '2026-07-01T00:00:00.000Z',
    recommendationId: 'validation-xcodebuild-build-succeeded',
    recommendationTitle: 'Run xcodebuild build validation',
    outcome: 'skipped',
    promptQuality: 'wrong_recommendation',
    userNote: 'Previous outcome already validated this recommendation with existing evidence.',
  }]);
  const ranking = buildDecisionRanking(advanced);

  assert.equal(ranking.selectedIssue.id, 'validation-next');
  assert.ok(ranking.advancement.suppressedCandidates.some((item) => item.id === 'validation-xcodebuild-build-succeeded'));
  assert.match(ranking.advancement.suppressedCandidates.find((item) => item.id === 'validation-xcodebuild-build-succeeded').reason, /prior evidence already validated/);
});

