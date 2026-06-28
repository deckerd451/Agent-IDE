import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readControlPlane } from '../scripts/server.mjs';

async function writeControlPlaneFixture({ withJudgment = true } = {}) {
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
    await writeFile(join(dir, '.ai', 'repository-judgment-history.json'), JSON.stringify([{ timestamp: '2026-06-28T00:00:00.000Z', productionRecommendation: 'Production Recommendation Title', shadowRecommendation: 'Shadow Recommendation Title', winner: 'Shadow', readinessScore: 80 }], null, 2));
    await writeFile(join(dir, '.ai', 'repository-judgment.json'), JSON.stringify({
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
    }, null, 2));
    await writeFile(join(dir, '.ai', 'repository-judgment.md'), '# Repository Judgment (Shadow Mode)\n\nRaw markdown artifact.\n');
  }
  return dir;
}

test('Control Plane reads Repository Judgment JSON and markdown without changing production recommendation', async () => {
  const dir = await writeControlPlaneFixture();
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.recommendation.title, 'Production Recommendation Title');
  assert.equal(controlPlane.repositoryJudgment.candidates[0].title, 'Shadow Recommendation Title');
  assert.match(controlPlane.repositoryJudgment.markdown, /Repository Judgment \(Shadow Mode\)/);
});

test('missing Repository Judgment artifacts do not break Control Plane reads', async () => {
  const dir = await writeControlPlaneFixture({ withJudgment: false });
  const controlPlane = await readControlPlane(dir);
  assert.equal(controlPlane.recommendation.title, 'Production Recommendation Title');
  assert.equal(controlPlane.repositoryJudgment, null);
});

test('Work Queue renders shadow recommendation comparison and shadow-mode label', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'));
  for (const expected of [
    'Shadow Recommendation',
    'Shadow Mode — not currently driving the Work Queue',
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
