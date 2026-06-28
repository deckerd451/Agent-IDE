import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDecisionRanking, compileEngineeringTask, renderPrompt } from '../scripts/next-improvement.mjs';

function issue(overrides = {}) {
  return {
    id: 'candidate',
    kind: 'candidate',
    class: 'improvement',
    category: 'automation-opportunity',
    severity: 'medium',
    actionability: 'code-fixable',
    packageType: 'implementation',
    source: '.ai/backlog.md',
    title: 'Add deterministic recommendation candidate extraction',
    evidence: 'Backlog asks to add deterministic recommendation candidate extraction.',
    reason: 'Candidate extraction is too narrow today.',
    recommendedAction: 'Add deterministic candidate extraction from repository artifacts.',
    priority: 90,
    expectedImprovementValues: { repositoryHealth: 5, canonicalCompleteness: 0, quality: 6, verification: 3, handoffReadiness: 4 },
    ...overrides,
  };
}

test('concrete recommendation passes through unchanged', () => {
  const selected = issue();
  const task = compileEngineeringTask(selected);
  assert.equal(task.status, 'preserved');
  assert.equal(task.title, selected.title);
  assert.equal(task.originalRecommendation.title, selected.title);
});

test('strategic observation compiles into concrete task', () => {
  const selected = issue({
    title: 'Advance strategy: Control Plane reports repository handoff readiness as Ready.',
    evidence: 'Control Plane reports repository handoff readiness as Ready.',
    reason: 'Strategy evidence identifies repository-local intent.',
    recommendedAction: 'Advance strategy.',
  });
  const task = compileEngineeringTask(selected);
  assert.equal(task.status, 'compiled');
  assert.equal(task.title, 'Expand deterministic recommendation candidate extraction after handoff readiness is Ready');
  assert.match(task.rootCause, /state signal, not an implementation task/);
  assert.ok(task.acceptanceCriteria.some((item) => /not passed directly/.test(item)));
});

test('readiness signal compiles into concrete task and ranking preserves original recommendation', () => {
  const ranking = buildDecisionRanking([issue({
    id: 'readiness',
    title: 'Advance strategy: Control Plane reports repository handoff readiness as Ready.',
    evidence: 'Control Plane reports repository handoff readiness as Ready.',
    reason: 'Repository Judgment selected a readiness signal.',
    recommendedAction: 'Advance strategy.',
  })]);
  assert.equal(ranking.engineeringTask.status, 'compiled');
  assert.equal(ranking.originalSelectedRecommendation.title, 'Advance strategy: Control Plane reports repository handoff readiness as Ready.');
  assert.equal(ranking.selectedIssue.title, 'Expand deterministic recommendation candidate extraction after handoff readiness is Ready');
  assert.equal(ranking.candidates[0].title, ranking.selectedIssue.title);
});

test('un-compilable vague recommendation is blocked', () => {
  const ranking = buildDecisionRanking([issue({
    id: 'vague',
    title: 'Things soon',
    evidence: 'Important improvement noted.',
    reason: 'Future work should be better.',
    recommendedAction: 'Consider things.',
  })]);
  assert.equal(ranking.engineeringTask.status, 'blocked');
  assert.equal(ranking.selectedIssue.title, 'Recommendation requires task clarification.');
  const prompt = renderPrompt({ selectedIssue: ranking.candidates[0], decisionRanking: ranking });
  assert.match(prompt, /Recommendation requires task clarification\./);
  assert.match(prompt, /Missing deterministic evidence/);
});

test('implementation prompt uses compiled task details', () => {
  const ranking = buildDecisionRanking([issue({
    id: 'readiness',
    title: 'Advance strategy: Control Plane reports repository handoff readiness as Ready.',
    evidence: 'Control Plane reports repository handoff readiness as Ready.',
    reason: 'Repository Judgment selected a readiness signal.',
    recommendedAction: 'Advance strategy.',
  })]);
  const prompt = renderPrompt({ selectedIssue: ranking.candidates[0], decisionRanking: ranking });
  assert.match(prompt, /^# Expand deterministic recommendation candidate extraction after handoff readiness is Ready/);
  assert.match(prompt, /## Engineering Task Compilation/);
  assert.match(prompt, /Original selected recommendation: Advance strategy: Control Plane reports repository handoff readiness as Ready\./);
  assert.match(prompt, /Implementation target: Add deterministic Engineering Task Compilation or candidate extraction behavior/);
  assert.doesNotMatch(prompt, /^# Advance strategy: Control Plane reports repository handoff readiness as Ready\./);
});

test('Do Next preview and copy paths use shared non-empty implementation prompt helper', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'));
  assert.match(source, /function implementationPrompt\(data: ControlPlane, documents: Record<string, DocumentState>\)/);
  assert.match(source, /<TaskArtifact artifactType=\{userTask\?\.artifactType \?\? 'implementation-prompt'\}/);
  assert.match(source, /'copy-implementation-prompt': implementationPrompt\(data, documents\)/);
  assert.match(source, /\['Builder Prompt', implementationPrompt\(data, documents\)\]/);
  assert.match(source, /Recommendation requires task clarification/);
});
