import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readControlPlane } from '../scripts/server.mjs';

async function writeControlPlaneFixture({ withJudgment = true, ready = false, invalidJudgment = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'shadow-control-plane-'));
  await mkdir(join(dir, '.ai', 'prompts'), { recursive: true });
  const files = {
    'goals.md': '# Goals\n\n## Product Thesis\nAgent IDE recommends repository work.\n',
    'architecture.md': '# Architecture\n\n## Core Systems\nControl Plane.\n',
    'strategy.md': '# Strategy\n\n## Current Product Bet\nCompare ranking engines safely.\n',
    'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Improve shadow recommendation visibility.\n',
    'decisions.md': '# Decisions\n\n## Active Decisions\n- Keep Repository Judgment in shadow mode.\n',
    'validation.md': '# Validation\n\n## Commands Run\n- npm test\n',
    'repository-health.md': '# Repository Health\nOverall Health: Healthy\nConfidence: High\n\n## Recommended Next Step\nProduction health recommendation.\n',
    'context-package.md': '# Context Package\nReady.\n',
    'next-improvement-prompt.md': '# Production Recommendation Title\n\n## Current Evidence\n- Source risk/recommendation: Production evidence.\n- Reason: Production reason.\n',
    'prompts/architect.md': '# Architect\n',
    'prompts/builder.md': '# Builder\n',
    'prompts/reviewer.md': '# Reviewer\n',
    'prompts/debugger.md': '# Debugger\n',
    'repository-judgment-evaluation.md': '# Repository Judgment Evaluation\n',
  };
  for (const [file, content] of Object.entries(files)) await writeFile(join(dir, '.ai', file), content);
  if (withJudgment) {
    const history = ready
      ? [1, 2, 3].map((index) => ({ timestamp: `2026-06-28T00:00:0${index}.000Z`, productionRecommendation: 'Production Recommendation Title', shadowRecommendation: 'Shadow Recommendation Title', winner: 'Shadow', readinessScore: 90 }))
      : [{ timestamp: '2026-06-28T00:00:00.000Z', productionRecommendation: 'Production Recommendation Title', shadowRecommendation: 'Shadow Recommendation Title', winner: 'Shadow', readinessScore: 80 }];
    await writeFile(join(dir, '.ai', 'repository-judgment-history.json'), JSON.stringify(history, null, 2));
    const judgment = JSON.stringify({
      mode: 'shadow',
      generatedAt: '1970-01-01T00:00:00.000Z',
      selectionPolicy: 'Shadow Mode only.',
      candidates: [{
        id: 'shadow-one',
        title: 'Shadow Recommendation Title',
        category: 'workflow-simplification',
        confidence: 0.83,
        totalScore: 88.2,
        whyItMatters: 'It evaluates future ranking readiness.',
        evidence: [{ sourceFile: '.ai/backlog.md', sourceSection: 'Prioritized Backlog', text: 'Improve shadow recommendation visibility.' }],
      }],
    }, null, 2);
    await writeFile(join(dir, '.ai', 'repository-judgment.json'), invalidJudgment ? '{ invalid json' : judgment);
    await writeFile(join(dir, '.ai', 'repository-judgment.md'), '# Repository Judgment (Shadow Mode)\n\nRaw markdown artifact.\n');
  }
  return dir;
}

test('Not Ready uses Legacy while reading Repository Judgment JSON and markdown', async () => {
  const dir = await writeControlPlaneFixture();
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.activeRecommendationSource, 'Legacy');
  assert.equal(controlPlane.recommendation.title, 'Production Recommendation Title');
  assert.equal(controlPlane.legacyRecommendation.title, 'Production Recommendation Title');
  assert.equal(controlPlane.repositoryJudgment.candidates[0].title, 'Shadow Recommendation Title');
  assert.match(controlPlane.repositoryJudgment.markdown, /Repository Judgment \(Shadow Mode\)/);
});

test('missing Repository Judgment artifacts do not break Control Plane reads', async () => {
  const dir = await writeControlPlaneFixture({ withJudgment: false });
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.activeRecommendationSource, 'Legacy');
  assert.equal(controlPlane.recommendation.title, 'Production Recommendation Title');
  assert.equal(controlPlane.repositoryJudgment, null);
});



test('Ready for Promotion uses Repository Judgment recommendation and implementation prompt', async () => {
  const dir = await writeControlPlaneFixture({ ready: true });
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.repositoryJudgmentReadiness.promotionStatus, 'Ready for Promotion');
  assert.equal(controlPlane.activeRecommendationSource, 'Repository Judgment');
  assert.equal(controlPlane.recommendation.title, 'Shadow Recommendation Title');
  assert.equal(controlPlane.legacyRecommendation.title, 'Production Recommendation Title');
  assert.equal(controlPlane.packages.builder, controlPlane.recommendation.prompt);
  assert.match(controlPlane.recommendation.prompt, /Selected Repository Judgment Candidate/);
  assert.match(controlPlane.recommendation.prompt, /Shadow Recommendation Title/);
});

test('invalid Repository Judgment artifact falls back to Legacy', async () => {
  const dir = await writeControlPlaneFixture({ ready: true, invalidJudgment: true });
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.activeRecommendationSource, 'Legacy');
  assert.equal(controlPlane.recommendation.title, 'Production Recommendation Title');
  assert.equal(controlPlane.repositoryJudgment, null);
});

test('Work Queue renders active recommendation source and legacy comparison', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'));
  for (const expected of [
    'Shadow Recommendation',
    'Recommendation Source:',
    'Advanced legacy recommendation comparison',
    'Production Recommendation:',
    'Shadow Recommendation:',
    'Use this to evaluate whether Repository Judgment is ready to become the primary recommendation engine.',
    'Repository Judgment raw artifact details',
    'Repository Judgment Readiness',
    'Current readiness score',
    'Consecutive shadow wins',
    'Promotion status',
  ]) assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('compiled engineering task appears in Control Plane response with implementation prompt', async () => {
  const dir = await writeControlPlaneFixture({ withJudgment: false });
  const engineeringTask = {
    schemaVersion: 1,
    status: 'compiled',
    originalRecommendation: { id: 'readiness', title: 'Advance strategy: Control Plane reports repository handoff readiness as Ready.' },
    title: 'Expand deterministic recommendation candidate extraction after handoff readiness is Ready',
    rootCause: 'Repository handoff readiness is a state signal, not an implementation task.',
    implementationTarget: 'Add deterministic Engineering Task Compilation behavior.',
    likelyFiles: ['scripts/next-improvement.mjs', 'src/App.tsx'],
    deterministicEvidence: ['Control Plane reports repository handoff readiness as Ready.'],
    acceptanceCriteria: ['The Do Next card can display the compiled task title.'],
    nonGoals: ['Do not change Repository Judgment promotion thresholds.'],
    clarification: null,
  };
  await writeFile(join(dir, '.ai', 'next-improvement-prompt.md'), '');
  await writeFile(join(dir, '.ai', 'decision-ranking.json'), JSON.stringify({
    schemaVersion: 1,
    engineeringTask,
    originalSelectedRecommendation: engineeringTask.originalRecommendation,
    candidates: [{ rank: 1, selected: true, id: 'readiness', kind: 'readiness', class: 'improvement', category: 'automation', severity: 'medium', actionability: 'code-fixable', packageType: 'implementation', title: engineeringTask.title, evidence: engineeringTask.deterministicEvidence[0], reason: engineeringTask.rootCause, recommendedAction: engineeringTask.implementationTarget, priorityScore: 98, expectedImprovement: { total: 1, repositoryHealth: 0, canonicalCompleteness: 0, quality: 1, verification: 0, handoffReadiness: 0 }, engineeringTask }],
    selectedIssue: { id: 'readiness', title: engineeringTask.title, rank: 1, priorityScore: 98 },
    selectionExplanation: 'Compiled task selected.',
  }, null, 2));
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.recommendation.originalRecommendationTitle, 'Advance strategy: Control Plane reports repository handoff readiness as Ready.');
  assert.equal(controlPlane.recommendation.displayTitle, engineeringTask.title);
  assert.equal(controlPlane.recommendation.engineeringTask.title, engineeringTask.title);
  assert.match(controlPlane.recommendation.implementationPrompt, /^# Expand deterministic recommendation candidate extraction after handoff readiness is Ready/);
  assert.equal(controlPlane.packages.builder, controlPlane.recommendation.implementationPrompt);
});

test('decorated Control Plane recommendation is the single source for card preview copy and open prompts', async () => {
  const dir = await writeControlPlaneFixture({ withJudgment: false });
  const originalTitle = 'Advance strategy: Control Plane reports repository handoff readiness as Ready.';
  const actionableTitle = 'Expand deterministic recommendation candidate extraction after handoff readiness is Ready';
  const engineeringTask = {
    schemaVersion: 1,
    status: 'compiled',
    originalRecommendation: { id: 'readiness', title: originalTitle },
    title: actionableTitle,
    rootCause: 'Repository handoff readiness is a state signal, not an implementation task.',
    implementationTarget: 'Add deterministic Engineering Task Compilation behavior.',
    likelyFiles: ['scripts/next-improvement.mjs', 'src/App.tsx'],
    deterministicEvidence: ['Control Plane reports repository handoff readiness as Ready.'],
    acceptanceCriteria: ['The Do Next card, preview prompt, copy prompt, and open prompt use the actionable title.'],
    nonGoals: ['Do not change Repository Judgment promotion thresholds.'],
    clarification: null,
  };
  await writeFile(join(dir, '.ai', 'next-improvement-prompt.md'), `# ${originalTitle}\n\n## Goal\n${originalTitle}\n`);
  await writeFile(join(dir, '.ai', 'decision-ranking.json'), JSON.stringify({
    schemaVersion: 1,
    engineeringTask,
    originalSelectedRecommendation: engineeringTask.originalRecommendation,
    candidates: [{
      rank: 1,
      selected: true,
      id: 'readiness',
      kind: 'readiness',
      class: 'improvement',
      category: 'automation',
      severity: 'medium',
      actionability: 'code-fixable',
      packageType: 'implementation',
      title: originalTitle,
      evidence: engineeringTask.deterministicEvidence[0],
      reason: 'Repository Judgment selected a readiness signal.',
      recommendedAction: 'Advance strategy.',
      priorityScore: 98,
      expectedImprovement: { total: 1, repositoryHealth: 0, canonicalCompleteness: 0, quality: 1, verification: 0, handoffReadiness: 0 },
      engineeringTask,
    }],
    selectedIssue: { id: 'readiness', title: originalTitle, rank: 1, priorityScore: 98 },
    selectionExplanation: 'Compiled task selected from a vague readiness recommendation.',
  }, null, 2));

  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.recommendation.displayTitle, actionableTitle);
  assert.equal(controlPlane.recommendation.engineeringTask.title, actionableTitle);
  assert.equal(controlPlane.recommendation.originalRecommendationTitle, originalTitle);
  assert.match(controlPlane.recommendation.implementationPrompt, new RegExp(`^# ${actionableTitle}`));
  assert.doesNotMatch(controlPlane.recommendation.implementationPrompt, new RegExp(`^# ${originalTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.doesNotMatch(controlPlane.recommendation.implementationPrompt, new RegExp(`## Goal\n${originalTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.doesNotMatch(controlPlane.recommendation.implementationPrompt, /## Goal\nAdvance strategy\./);
  assert.match(controlPlane.recommendation.implementationPrompt, new RegExp(`## Goal\n${actionableTitle}`));
  assert.match(controlPlane.recommendation.implementationPrompt, /## Why This Helps\nRepository handoff readiness is a state signal, not an implementation task\./);
  assert.match(controlPlane.recommendation.implementationPrompt, /## Original Repository Judgment Recommendation\n- Title: Advance strategy: Control Plane reports repository handoff readiness as Ready\./);
  assert.equal(controlPlane.recommendation.prompt, controlPlane.recommendation.implementationPrompt);
  assert.equal(controlPlane.packages.builder, controlPlane.recommendation.implementationPrompt);
});

test('blocked engineering task returns clarification prompt instead of empty implementation prompt', async () => {
  const dir = await writeControlPlaneFixture({ withJudgment: false });
  const engineeringTask = {
    schemaVersion: 1,
    status: 'blocked',
    originalRecommendation: { id: 'vague', title: 'Things soon' },
    title: 'Recommendation requires task clarification.',
    rootCause: 'The recommendation is vague.',
    implementationTarget: 'Clarify the task.',
    likelyFiles: ['.ai/backlog.md'],
    deterministicEvidence: ['Important improvement noted.'],
    acceptanceCriteria: ['A concrete implementation target is identified before prompt generation.'],
    nonGoals: ['Do not generate a vague implementation prompt.'],
    clarification: 'Missing deterministic evidence: concrete action, implementation target, likely files, and acceptance criteria.',
  };
  await writeFile(join(dir, '.ai', 'next-improvement-prompt.md'), '');
  await writeFile(join(dir, '.ai', 'decision-ranking.json'), JSON.stringify({
    schemaVersion: 1,
    engineeringTask,
    originalSelectedRecommendation: engineeringTask.originalRecommendation,
    candidates: [{ rank: 1, selected: true, id: 'vague', kind: 'vague', class: 'improvement', category: 'automation', severity: 'medium', actionability: 'manual', packageType: 'task-clarification', title: engineeringTask.title, evidence: engineeringTask.deterministicEvidence[0], reason: engineeringTask.rootCause, recommendedAction: engineeringTask.implementationTarget, priorityScore: 98, expectedImprovement: { total: 1, repositoryHealth: 0, canonicalCompleteness: 0, quality: 1, verification: 0, handoffReadiness: 0 }, engineeringTask }],
    selectedIssue: { id: 'vague', title: engineeringTask.title, rank: 1, priorityScore: 98 },
    selectionExplanation: 'Blocked task selected.',
  }, null, 2));
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.recommendation.blockingState.state, 'blocked');
  assert.match(controlPlane.recommendation.implementationPrompt, /Recommendation requires task clarification/);
  assert.match(controlPlane.recommendation.implementationPrompt, /Missing deterministic evidence/);
});

test('readControlPlane uses persisted active-recommendation.json over repositoryJudgment.candidates[0] after refresh', async () => {
  const dir = await writeControlPlaneFixture({ ready: true }); // candidates[0] = 'Shadow Recommendation Title'

  // Simulate persistControlPlane having selected a different, decorated recommendation via generateNextImprovement
  const rawJudgmentTitle = 'Advance strategy: Control Plane reports repository handoff readiness as Ready.';
  const backlogTitle = 'Add backlog quality';
  const backlogPrompt = `# ${backlogTitle}\n\n## Implementation Instructions\nAdd a backlog quality metric.\n\n## Goal\n${backlogTitle}\n\n## Why This Helps\nBacklog quality is actionable.\n\n## Acceptance Criteria\n- Backlog quality metric is added.\n`;
  const activeRecommendation = {
    title: backlogTitle,
    displayTitle: backlogTitle,
    originalRecommendationTitle: rawJudgmentTitle,
    displaySummary: 'Backlog quality is actionable.',
    implementationPrompt: backlogPrompt,
    prompt: backlogPrompt,
    packageType: 'implementation',
    whyItMatters: 'Backlog quality is actionable.',
    evidenceSource: '.ai/next-improvement-prompt.md',
    id: 'add-backlog-quality',
    promptHash: 'abc123def456',
  };
  await writeFile(join(dir, '.ai', 'active-recommendation.json'), JSON.stringify(activeRecommendation, null, 2));

  const controlPlane = await readControlPlane(dir);

  assert.equal(controlPlane.recommendation.title, backlogTitle, 'title must come from active-recommendation.json, not repositoryJudgment.candidates[0]');
  assert.equal(controlPlane.recommendation.displayTitle, backlogTitle);
  assert.match(controlPlane.recommendation.implementationPrompt, new RegExp(`^# ${backlogTitle}`), 'implementationPrompt must start with the selected actionable candidate title');
  assert.doesNotMatch(controlPlane.recommendation.implementationPrompt, /## Goal\nAdvance strategy/, 'implementationPrompt must not contain the raw Repository Judgment goal heading');
  assert.doesNotMatch(controlPlane.recommendation.implementationPrompt, new RegExp(rawJudgmentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'raw Repository Judgment title must not appear in implementationPrompt');
  assert.match(controlPlane.recommendation.implementationPrompt, new RegExp(`## Goal\n${backlogTitle}`), 'implementationPrompt must contain the actionable candidate title in the Goal section');
  assert.equal(controlPlane.recommendation.prompt, controlPlane.recommendation.implementationPrompt, 'prompt and implementationPrompt must be the same');
  assert.equal(controlPlane.packages.builder, controlPlane.recommendation.implementationPrompt, 'packages.builder must match implementationPrompt');
  // Shadow source metadata should still reflect Repository Judgment status
  assert.equal(controlPlane.activeRecommendationSource, 'Repository Judgment');
});

test('readControlPlane falls back to repositoryJudgment.candidates[0] when active-recommendation.json does not exist', async () => {
  const dir = await writeControlPlaneFixture({ ready: true }); // no active-recommendation.json written
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.activeRecommendationSource, 'Repository Judgment');
  assert.equal(controlPlane.recommendation.title, 'Shadow Recommendation Title', 'without persisted recommendation, falls back to repositoryJudgment.candidates[0]');
  assert.match(controlPlane.recommendation.implementationPrompt, /Selected Repository Judgment Candidate/);
});
