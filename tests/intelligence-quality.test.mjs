import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeQualitySnapshot, computeTrend, detectContradictions, detectDuplicateSections } from '../scripts/intelligence-quality.mjs';

const baseDocs = {
  'goals.md': '# Goals\n\n## Product Thesis\nAgent IDE creates local repository intelligence.\n\n## North Star Metric\nUseful handoffs\n\n## Current Focus\nQuality loop\n\n## Manual Goals\nKeep note.\n',
  'strategy.md': '# Strategy\n\n## Product Thesis\nAgent IDE creates local repository intelligence.\n\n## North Star Metric\nUseful handoffs\n\n## Current Product Bet\nQuality loop\n\n## Strategy Confidence\nHigh\n\n## Evidence Sources\n- README.md\n',
  'architecture.md': '# Architecture\n\n## Product Thesis\nAgent IDE creates local repository intelligence.\n\n## North Star Metric\nUseful handoffs\n\n## Current Focus\nQuality loop\n\n## Core Systems\nControl Plane and local scripts.\n',
  'decisions.md': '# Decisions\n\n## Active Decisions\n- Deterministic only.\n',
  'validation.md': '# Validation\n\n## Confidence\nHigh\n\n## Commands Run\n- `npm run build`\n',
  'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Improve intelligence quality.\n',
  'context-package.md': '# Context Package\n\nReady.\n',
  'prompts/architect.md': 'Architect prompt',
  'prompts/builder.md': 'Builder prompt',
  'prompts/reviewer.md': 'Reviewer prompt',
  'prompts/debugger.md': 'Debugger prompt',
};

async function repoWithDocs(docs = baseDocs) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-quality-'));
  await mkdir(join(dir, '.ai/prompts'), { recursive: true });
  await Promise.all(Object.entries(docs).map(([file, content]) => writeFile(join(dir, '.ai', file), content)));
  return dir;
}

test('consistency scoring rewards aligned intelligence', async () => {
  const snapshot = await computeQualitySnapshot(await repoWithDocs(), baseDocs);
  assert.equal(snapshot.consistency.score, 100);
  assert.equal(snapshot.consistency.productThesisConsistent, true);
});

test('trend computation identifies improving, stable, and needs attention states', () => {
  const current = { overallScore: 80, recentRegressions: [], consistency: { contradictions: [] } };
  assert.equal(computeTrend([{ overallScore: 70 }], current), 'Improving');
  assert.equal(computeTrend([{ overallScore: 79 }], current), 'Stable');
  assert.equal(computeTrend([{ overallScore: 90 }], current), 'Needs Attention');
});

test('drift detection reports changed strategy, backlog size, and risks', async () => {
  const previous = await computeQualitySnapshot(await repoWithDocs(), baseDocs);
  const docs = { ...baseDocs, 'strategy.md': baseDocs['strategy.md'].replace('Quality loop', 'Audit panel'), 'backlog.md': `${baseDocs['backlog.md']}- Add trend chart.\n`, 'architecture.md': `${baseDocs['architecture.md']}\n## Risks\n- Missing screenshots.\n` };
  const snapshot = await computeQualitySnapshot(await repoWithDocs(docs), docs, previous, [{ overallScore: previous.overallScore }]);
  assert.equal(snapshot.drift.strategyChanged, true);
  assert.equal(snapshot.drift.backlogGrew, true);
  assert.deepEqual(snapshot.drift.newRisks, ['Missing screenshots.']);
});

test('contradictory product thesis detection is deterministic', () => {
  assert.equal(detectContradictions(['Local repository intelligence', 'Cloud analytics dashboard']), true);
  assert.equal(detectContradictions(['Local repository intelligence', 'local repository intelligence']), false);
});

test('duplicate strategy detection reports repeated headings', () => {
  assert.deepEqual(detectDuplicateSections('# Strategy\n\n## Product Thesis\nA\n\n## Product Thesis\nB\n'), ['Product Thesis']);
});

test('freshness calculation marks stale documents', async () => {
  const dir = await repoWithDocs();
  const old = new Date(Date.now() - 20 * 86400000);
  await utimes(join(dir, '.ai/goals.md'), old, old);
  const snapshot = await computeQualitySnapshot(dir, baseDocs);
  assert.ok(snapshot.freshness.staleDocuments.includes('goals.md'));
  assert.ok(snapshot.freshness.score < 100);
});

test('quality score combines coverage, consistency, freshness, and confidence', async () => {
  const snapshot = await computeQualitySnapshot(await repoWithDocs(), baseDocs);
  assert.ok(snapshot.overallScore >= 90);
  const weakDocs = { ...baseDocs, 'context-package.md': '', 'validation.md': '# Validation\n\n## Confidence\nLow\n' };
  const weak = await computeQualitySnapshot(await repoWithDocs(weakDocs), weakDocs);
  assert.ok(weak.overallScore < snapshot.overallScore);
  assert.match(weak.recommendedAction, /missing intelligence/i);
});
