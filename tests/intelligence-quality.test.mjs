import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyIntelligenceSource, computeQualitySnapshot, computeTrend, detectContradictions, detectDuplicateSections, normalizeConfidence } from '../scripts/intelligence-quality.mjs';

const baseDocs = {
  'goals.md': '# Goals\n\n## Product Thesis\nAgent IDE creates local repository intelligence.\n\n## North Star Metric\nUseful handoffs\n\n## Current Focus\nQuality loop\n\n## Manual Goals\nKeep note.\n',
  'strategy.md': '# Strategy\n\n## Product Thesis\nAgent IDE creates local repository intelligence.\n\n## North Star Metric\nUseful handoffs\n\n## Current Product Bet\nQuality loop\n\n## Strategy Confidence\nHigh\n\n## Evidence Sources\n- README.md\n',
  'architecture.md': '# Architecture\n\n## Product Thesis\nAgent IDE creates local repository intelligence.\n\n## North Star Metric\nUseful handoffs\n\n## Current Focus\nQuality loop\n\n## Core Systems\nControl Plane and local scripts.\n',
  'decisions.md': '# Decisions\n\n## Active Decisions\n- Deterministic only.\n',
  'validation.md': '# Validation\n\n## Confidence\nHigh\n\n## Commands Run\n- `npm run build`\n',
  'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Improve intelligence quality.\n',
  'repository-health.md': '# Repository Health\nConfidence: High\n\n## Quality Signals\n- Evidence-backed strategy.\n',
  'agents.md': '# Agents\n\n## Responsibilities\n- Local deterministic agents.\n',
  'code.md': '# Code\n\n## Code Map\n- scripts/intelligence-quality.mjs computes quality.\n',
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

test('classifies canonical intelligence and generated artifacts deterministically', () => {
  assert.equal(classifyIntelligenceSource('goals.md'), 'canonical');
  assert.equal(classifyIntelligenceSource('.ai/prompts/architect.md'), 'derived');
  assert.equal(classifyIntelligenceSource('context-package.md'), 'derived');
  assert.equal(classifyIntelligenceSource('exports/context.md'), 'derived');
});

test('prompt files containing repeated headings do not lower canonical consistency', async () => {
  const docs = { ...baseDocs, 'prompts/architect.md': '# Architect\n\n## Product Thesis\nA\n\n## Product Thesis\nB\n' };
  const snapshot = await computeQualitySnapshot(await repoWithDocs(docs), docs);
  assert.equal(snapshot.consistency.score, 100);
  assert.deepEqual(snapshot.consistency.duplicatedSections, []);
  assert.ok(!snapshot.recentRegressions.some((item) => item.includes('prompts/architect.md') || item.includes('Product Thesis')));
  assert.doesNotMatch(snapshot.recommendedAction, /prompt|duplicate|Product Thesis/i);
  assert.equal(snapshot.generatedExportQuality.promptsFreshnessOnly, true);
});

test('context-package duplication does not create contradiction warnings', async () => {
  const docs = { ...baseDocs, 'context-package.md': '# Context Package\n\n## Product Thesis\nDifferent exported wording.\n\n## Product Thesis\nRepeated exported wording.\n' };
  const snapshot = await computeQualitySnapshot(await repoWithDocs(docs), docs);
  assert.equal(snapshot.consistency.productThesisConsistent, true);
  assert.deepEqual(snapshot.consistency.contradictions, []);
  assert.deepEqual(snapshot.consistency.duplicatedSections, []);
  assert.ok(!snapshot.recentRegressions.some((item) => item.includes('context-package.md') || item.includes('Product Thesis')));
});

test('derived duplicate headings stay out of regressions and recommendations', async () => {
  const docs = {
    ...baseDocs,
    'context-package.md': '# Context Package\n\n## Product Thesis\nExport copy.\n\n## Product Thesis\nRepeated export copy.\n',
    'prompts/architect.md': '# Architect\n\n## Product Thesis\nPrompt copy.\n\n## Product Thesis\nRepeated prompt copy.\n',
    'prompts/builder.md': '# Builder\n\n## Product Thesis\nPrompt copy.\n\n## Product Thesis\nRepeated prompt copy.\n',
    'prompts/reviewer.md': '# Reviewer\n\n## Product Thesis\nPrompt copy.\n\n## Product Thesis\nRepeated prompt copy.\n',
    'prompts/debugger.md': '# Debugger\n\n## Product Thesis\nPrompt copy.\n\n## Product Thesis\nRepeated prompt copy.\n',
  };
  const snapshot = await computeQualitySnapshot(await repoWithDocs(docs), docs);
  assert.deepEqual(snapshot.consistency.duplicatedSections, []);
  assert.ok(!snapshot.recentRegressions.some((item) => /prompts\/.*\.md|context-package\.md|Duplicate section: .*Product Thesis/.test(item)));
  assert.doesNotMatch(snapshot.recommendedAction, /prompt|duplicate|Product Thesis/i);
});

test('Product Thesis comparison ignores generated exports', async () => {
  const docs = { ...baseDocs, 'prompts/builder.md': '## Product Thesis\nCloud analytics dashboard\n', 'context-package.md': '## Product Thesis\nCloud analytics dashboard\n' };
  const snapshot = await computeQualitySnapshot(await repoWithDocs(docs), docs);
  assert.equal(snapshot.consistency.productThesisConsistent, true);
  assert.ok(!snapshot.recentRegressions.some((item) => /Product Thesis differs/.test(item)));
});



test('equivalent Product Thesis wording is not flagged as a contradiction', async () => {
  const docs = {
    ...baseDocs,
    'goals.md': baseDocs['goals.md'].replace('Agent IDE creates local repository intelligence.', 'Agent IDE exists to make repository understanding the primary developer interface.'),
    'strategy.md': baseDocs['strategy.md'].replace('Agent IDE creates local repository intelligence.', 'Agent IDE exists to make repository understanding the primary developer interface.'),
    'architecture.md': baseDocs['architecture.md'].replace('Agent IDE creates local repository intelligence.', `Agent IDE exists to make repository understanding the primary developer interface.

Product Thesis Evidence:
README.md`),
  };
  const snapshot = await computeQualitySnapshot(await repoWithDocs(docs), docs);
  assert.equal(snapshot.consistency.productThesisConsistent, true);
  assert.ok(!snapshot.recentRegressions.some((item) => /Product Thesis differs/.test(item)));
});

test('equivalent Current Focus wording is not flagged as a contradiction', async () => {
  const docs = {
    ...baseDocs,
    'goals.md': baseDocs['goals.md'].replace('Quality loop', 'Repository quality loop'),
    'strategy.md': baseDocs['strategy.md'].replace('Quality loop', 'Repository quality loop'),
    'architecture.md': baseDocs['architecture.md'].replace('Quality loop', `Repository quality loop

Current Focus Evidence:
.ai/goals.md`),
  };
  const snapshot = await computeQualitySnapshot(await repoWithDocs(docs), docs);
  assert.equal(snapshot.consistency.currentFocusConsistent, true);
  assert.ok(!snapshot.recentRegressions.some((item) => /Current Focus differs/.test(item)));
});

test('validation confidence normalization tolerates expected wording differences', async () => {
  assert.equal(normalizeConfidence('- Medium'), 'medium');
  assert.equal(normalizeConfidence('Mixed validation coverage'), 'medium');
  const docs = { ...baseDocs, 'validation.md': `# Validation

## Confidence
- Mixed validation coverage
`, 'repository-health.md': `# Repository Health
Confidence: Medium

## Quality Signals
- Evidence-backed strategy.
` };
  const snapshot = await computeQualitySnapshot(await repoWithDocs(docs), docs);
  assert.equal(snapshot.consistency.validationConsistent, true);
  assert.ok(!snapshot.recentRegressions.some((item) => /Validation confidence differs/.test(item)));
});

test('Nearify and Agent IDE retain expected quality scores after export generation', async () => {
  const nearifyDocs = {
    ...baseDocs,
    'goals.md': '# Goals\n\n## Product Thesis\nNearify helps people maintain real-world relationships through timely follow-up workflows.\n\n## North Star Metric\nMeaningful follow-ups\n\n## Current Focus\nEvent-aware relationship workflows\n',
    'strategy.md': '# Strategy\n\n## Product Thesis\nNearify helps people maintain real-world relationships through timely follow-up workflows.\n\n## North Star Metric\nMeaningful follow-ups\n\n## Current Product Bet\nEvent-aware relationship workflows\n\n## Strategy Confidence\nHigh\n\n## Evidence Sources\n- README.md\n',
    'architecture.md': '# Architecture\n\n## Product Thesis\nNearify helps people maintain real-world relationships through timely follow-up workflows.\n\n## North Star Metric\nMeaningful follow-ups\n\n## Current Focus\nEvent-aware relationship workflows\n\n## Core Systems\nRelationship context engine.\n',
    'context-package.md': '# Context Package\n\n## Product Thesis\nShort duplicated export.\n',
    'prompts/reviewer.md': '# Reviewer\n\n## Product Thesis\nExported prompt copy.\n\n## Product Thesis\nRepeated prompt copy.\n',
  };
  const agentIde = await computeQualitySnapshot(await repoWithDocs(baseDocs), baseDocs);
  const nearify = await computeQualitySnapshot(await repoWithDocs(nearifyDocs), nearifyDocs);
  assert.ok(agentIde.canonicalIntelligenceQuality.score >= 95);
  assert.ok(agentIde.overallScore >= 95);
  assert.ok(nearify.canonicalIntelligenceQuality.score >= 95);
  assert.ok(nearify.overallScore >= 95);
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
  const weakDocs = { ...baseDocs, 'agents.md': '', 'validation.md': '# Validation\n\n## Confidence\nLow\n' };
  const weak = await computeQualitySnapshot(await repoWithDocs(weakDocs), weakDocs);
  assert.ok(weak.overallScore < snapshot.overallScore);
  assert.match(weak.recommendedAction, /missing intelligence/i);
});
