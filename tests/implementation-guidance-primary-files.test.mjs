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

test('inferred primary files are limited to files that exist in the connected target repository', () => {
  const candidate = {
    rank: 1,
    id: 'intelligence-contradiction-cleanup',
    title: 'Clean Up Intelligence Contradictions',
    category: 'intelligence contradictions',
    severity: 'high',
    actionability: 'code-fixable',
    priorityScore: 95,
    expectedImprovement: { total: 1, repositoryHealth: 1, canonicalCompleteness: 1, quality: 1, verification: 0, handoffReadiness: 1 },
    reason: 'Canonical intelligence contradicts itself; recommendation ranking logic in Agent IDE should not leak into target guidance.',
    evidence: 'Contradictions between `.ai/goals.md` and `.ai/strategy.md`.',
    selected: true,
  };
  const recommendation = {
    title: 'Clean Up Intelligence Contradictions',
    originalRecommendationTitle: 'Clean Up Intelligence Contradictions',
    displaySummary: 'Resolve canonical intelligence contradictions before implementation.',
    explanation: 'Manual/canonical intelligence needs cleanup.',
    whyItMatters: 'Contradictions lower repository handoff readiness.',
    actionability: 'code-fixable',
    packageType: 'implementation',
    evidenceSource: '.ai/next-improvement-prompt.md',
    prompt: 'The target repository has contradictions in `.ai/goals.md` and `.ai/strategy.md`.',
  };

  const result = selectPrimaryFiles(candidate, recommendation, {
    existingFiles: ['.ai/goals.md', '.ai/strategy.md', '.ai/architecture.md', '.ai/context-package.md', 'Nearify/App.swift'],
  });

  assert.equal(result.primaryFile, '.ai/goals.md');
  assert.notEqual(result.primaryFile, 'scripts/next-improvement.mjs');
  assert.equal(result.source, 'direct');
});

test('missing implementation-location guidance is shown when inferred Agent IDE files do not exist in target repository', () => {
  const candidate = {
    rank: 1,
    id: 'backlog-noise',
    title: 'Reduce Backlog Noise',
    category: 'recommendation ranking',
    severity: 'medium',
    actionability: 'code-fixable',
    priorityScore: 80,
    expectedImprovement: { total: 1, repositoryHealth: 1, canonicalCompleteness: 0, quality: 1, verification: 0, handoffReadiness: 1 },
    reason: 'Recommendation ranking should improve.',
    evidence: 'No concrete target repository implementation files are named.',
    selected: true,
  };
  const recommendation = {
    title: 'Reduce Backlog Noise',
    explanation: 'Improve recommendation ranking.',
    whyItMatters: 'A noisy backlog hides important work.',
    actionability: 'code-fixable',
    packageType: 'implementation',
    evidenceSource: '.ai/next-improvement-prompt.md',
    prompt: 'No likely files are named by repository intelligence.',
  };

  const result = selectPrimaryFiles(candidate, recommendation, {
    existingFiles: ['.ai/goals.md', '.ai/strategy.md', 'Nearify/App.swift'],
  });

  assert.equal(result.primaryFile, null);
  assert.equal(result.source, 'missing');
  assert.match(result.note, /No existing implementation or test file/);
});

test('validation-experiment guidance for Xcode gaps prefers project and validation artifacts over canonical goals', () => {
  const candidate = {
    rank: 1,
    id: 'xcode-validation-gap',
    title: 'Full simulator/device build: Not run by default; no full xcodebuild',
    category: 'validation gap',
    severity: 'medium',
    actionability: 'validation-experiment',
    priorityScore: 82,
    expectedImprovement: { total: 1, repositoryHealth: 1, canonicalCompleteness: 0, quality: 1, verification: 1, handoffReadiness: 1 },
    reason: 'Nearify has an Xcode validation gap. Manual intent lives in `.ai/goals.md`, and validation notes live in `.ai/validation.md`.',
    evidence: 'Full simulator/device build was not run by default; no full xcodebuild.',
    selected: true,
  };
  const recommendation = {
    title: 'Full simulator/device build: Not run by default; no full xcodebuild',
    explanation: 'Validate the Xcode project locally before claiming full build readiness.',
    whyItMatters: 'Xcode build validation proves the handoff can be executed locally.',
    actionability: 'validation-experiment',
    packageType: 'validation-experiment',
    evidenceSource: '.ai/validation.md',
    prompt: 'Validation gap cites `.ai/goals.md` and `.ai/validation.md` but does not require canonical edits.',
  };

  const result = selectPrimaryFiles(candidate, recommendation, {
    existingFiles: ['Beacon.xcodeproj', '.ai/validation.md', '.ai/goals.md', 'Nearify/App.swift'],
  });

  assert.equal(result.primaryFile, 'Beacon.xcodeproj');
  assert.notEqual(result.primaryFile, '.ai/goals.md');
  assert.ok(result.supportingFiles.includes('.ai/validation.md'));
  assert.deepEqual(result.validationCommands, [
    'xcodebuild -list -project Beacon.xcodeproj',
    "xcodebuild build -project Beacon.xcodeproj -scheme <Scheme> -destination 'platform=iOS Simulator,name=<Simulator Name>'",
  ]);
  assert.match(result.note, /validation guidance/i);
});
