import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateContextPackage } from '../scripts/context-package.mjs';
import { validateAIHandoff } from '../scripts/ai-handoff-validation.mjs';

async function repo(files) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-context-'));
  await mkdir(join(dir, '.ai'), { recursive: true });
  for (const [file, text] of Object.entries(files)) await writeFile(join(dir, '.ai', file), text);
  return dir;
}

const ranking = {
  selectedIssue: { id: 'ai-handoff-validation', title: 'Run AI Handoff Validation', rank: 1, priorityScore: 10 },
  selectionExplanation: 'Run AI Handoff Validation is ranked #1 with priority 10 and total expected improvement +11.',
  scoringRules: ['Priority score = issue base priority + severity boost + actionability boost, capped at 100.'],
  tieBreaking: ['priorityScore desc', 'id asc'],
  candidates: [{
    id: 'ai-handoff-validation',
    title: 'Run AI Handoff Validation',
    rank: 1,
    selected: true,
    packageType: 'validation-experiment',
    actionability: 'validation-experiment',
    priorityScore: 10,
    expectedImprovement: { repositoryHealth: 2, quality: 2, verification: 4, handoffReadiness: 3, total: 11 },
    reason: 'Healthy repositories still need deterministic handoff validation.',
    recommendedAction: 'Run and document a local AI handoff validation dry run.',
  }],
};

const baseFiles = {
  'goals.md': '# Goals\n\n## Product Thesis\nNearify helps people maintain real-world relationships.\n\n## Current Focus\nBetween-events follow-up.\n',
  'strategy.md': '# Strategy\n\n## North Star Metric\nMeaningful follow-ups\n\n## Current Product Bet\nBetween-events follow-up.\n\n## Strategy Confidence\nHigh\n\n## Strategy Evidence Sources\n- .ai/goals.md\n',
  'architecture.md': '# Architecture\n\n## Core Systems\nRelationship context engine.\n',
  'decisions.md': '# Decisions\n\n## Active Decisions\n- Local-first only.\n',
  'validation.md': '# Validation\n\n## Confidence\nHigh\n\n## Commands Run\n- npm test\n',
  'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Improve handoff validation.\n',
  'repository-health.md': '# Health\n\n## Recommended Next Step\nRun AI Handoff Validation.\n',
  'next-improvement-prompt.md': '# Next\n\n## Selected Issue\n- Title: Run AI Handoff Validation\n',
  'decision-ranking.json': `${JSON.stringify(ranking, null, 2)}\n`,
  'intelligence-explanations.json': JSON.stringify({ decisionRanking: { selected: { id: 'ai-handoff-validation' } }, recommendation: { selected: { title: 'Run AI Handoff Validation' } } }),
};

test('Context Package includes reconstructable Decision Ranking', async () => {
  const dir = await repo(baseFiles);
  await generateContextPackage(dir);
  const contextPackage = await readFile(join(dir, '.ai/context-package.md'), 'utf8');
  assert.match(contextPackage, /^## Decision Ranking$/m);
  assert.match(contextPackage, /Selected Issue: Run AI Handoff Validation/);
  assert.match(contextPackage, /Selected Issue ID: ai-handoff-validation/);
  assert.match(contextPackage, /Package Type\/Actionability: validation-experiment/);
  assert.match(contextPackage, /Ranked Candidates:[\s\S]*Run AI Handoff Validation \(ai-handoff-validation\)/);
  assert.match(contextPackage, /Priority Score: 10/);
  assert.match(contextPackage, /Expected Improvement: .*total: 11/);
  assert.match(contextPackage, /Deterministic Selection Explanation:/);
});

test('generated Decision Ranking makes handoff validation present', async () => {
  const dir = await repo(baseFiles);
  await generateContextPackage(dir);
  const validation = await validateAIHandoff(dir);
  assert.equal(validation.categories.decisionRanking.status, 'Present');
  assert.ok(!validation.hiddenInformation.includes('Decision ranking'));
  assert.ok(!validation.contradictions.includes('Package omits decision ranking.'));
});
