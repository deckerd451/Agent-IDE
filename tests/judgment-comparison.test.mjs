import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { generateJudgmentComparison } from '../scripts/judgment-comparison.mjs';
import { readControlPlane } from '../scripts/server.mjs';

async function makeRepo({ repo = true, product = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'jc-test-'));
  await mkdir(join(dir, '.ai', 'prompts'), { recursive: true });
  const base = {
    'goals.md': '# Goals\n\n## Product Thesis\nAgent IDE recommends repository work.\n',
    'strategy.md': '# Strategy\n\n## Current Product Bet\nCompare deterministic recommendation engines.\n',
    'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Improve judgment comparison.\n',
    'architecture.md': '# Architecture\n\n## Core Systems\nControl Plane.\n',
    'decisions.md': '# Decisions\n\n## Active Decisions\n- Keep Product Judgment shadow-only.\n',
    'context-package.md': '# Context Package\nReady.\n',
    'repository-health.md': '# Repository Health\nOverall Health: Healthy\nConfidence: High\n',
    'execution-model.md': '# Execution Model\nLocal deterministic generators.\n',
    'repository-judgment.md': '# Repository Judgment\n',
    'product-judgment.md': '# Product Judgment\n',
    'product-judgment-evaluation.md': '# Product Judgment Evaluation\n',
    'repository-judgment-evaluation.md': '# Repository Judgment Evaluation\n',
    'validation.md': '# Validation\n',
    'next-improvement-prompt.md': '# Production Recommendation\n\n## Current Evidence\n- Source risk/recommendation: Production evidence.\n- Reason: Production reason.\n',
    'prompts/architect.md': '# Architect\n', 'prompts/builder.md': '# Builder\n', 'prompts/reviewer.md': '# Reviewer\n', 'prompts/debugger.md': '# Debugger\n',
  };
  for (const [file, content] of Object.entries(base)) await writeFile(join(dir, '.ai', file), content, 'utf8');
  if (repo) await writeFile(join(dir, '.ai', 'repository-judgment.json'), JSON.stringify({ mode: 'shadow', candidates: [{ id: 'r1', title: 'Improve Repository Evidence', category: 'repository-health', confidence: 0.8, totalScore: 76, impactScore: 66, strategyScore: 70, leverageScore: 78, sourceFiles: ['.ai/repository-health.md'], whyItMatters: 'Repository health evidence is strongest.', evidence: [{ sourceFile: '.ai/repository-health.md', sourceSection: 'Risks', text: 'Healthy repository.' }] }] }, null, 2));
  if (product) await writeFile(join(dir, '.ai', 'product-judgment.json'), JSON.stringify({ shadowMode: true, candidates: [{ rank: 1, id: 'p1', title: 'Improve Product Value', category: 'product-experience', compositeScore: 84, scores: { productValue: 90, strategic: 88, userImpact: 82, leverage: 80, cost: 70 }, confidence: 'High', evidence: '.ai/strategy.md — Current Product Bet: Compare deterministic recommendation engines.', sourceFiles: ['.ai/strategy.md'], whyItMatters: 'Product value evidence is strongest.', whyOutranks: 'It scores higher on product value.' }] }, null, 2));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('comparison generation is deterministic with deterministic scores', async () => {
  const { dir, cleanup } = await makeRepo();
  try {
    const first = await generateJudgmentComparison(dir);
    const firstRaw = await readFile(join(dir, '.ai', 'judgment-comparison.json'), 'utf8');
    const second = await generateJudgmentComparison(dir);
    const secondRaw = await readFile(join(dir, '.ai', 'judgment-comparison.json'), 'utf8');
    assert.equal(firstRaw, secondRaw);
    assert.equal(first.metrics.agreementScore, second.metrics.agreementScore, 'agreement score is deterministic');
    assert.equal(first.metrics.recommendationDivergenceScore, second.metrics.recommendationDivergenceScore, 'divergence score is deterministic');
  } finally { await cleanup(); }
});

test('missing Product Judgment artifacts are handled safely', async () => {
  const { dir, cleanup } = await makeRepo({ product: false });
  try {
    const comparison = await generateJudgmentComparison(dir);
    assert.equal(comparison.engines.productJudgment.available, false);
    assert.equal(comparison.shadowEvaluation.winner, 'Repository Judgment');
  } finally { await cleanup(); }
});

test('missing Repository Judgment artifacts are handled safely', async () => {
  const { dir, cleanup } = await makeRepo({ repo: false });
  try {
    const comparison = await generateJudgmentComparison(dir);
    assert.equal(comparison.engines.repositoryJudgment.available, false);
    assert.equal(comparison.shadowEvaluation.winner, 'Product Judgment');
  } finally { await cleanup(); }
});

test('Control Plane reads comparison without changing Work Queue authority or shadow mode', async () => {
  const { dir, cleanup } = await makeRepo();
  try {
    await generateJudgmentComparison(dir);
    const controlPlane = await readControlPlane(dir);
    assert.equal(controlPlane.activeRecommendationSource, 'Legacy');
    assert.equal(controlPlane.recommendation.title, 'Production Recommendation');
    assert.equal(controlPlane.judgmentComparison.shadowEvaluation.repositoryJudgmentRemainsAuthoritative, true);
    assert.equal(controlPlane.judgmentComparison.shadowEvaluation.productJudgmentRemainsShadowOnly, true);
  } finally { await cleanup(); }
});

test('UI renders Judgment Comparison card and advanced artifacts', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const expected of ['aria-label="Judgment Comparison"', 'Repository Recommendation', 'Product Recommendation', 'Agreement Score', 'Divergence Score', 'Shared Evidence', 'Unique Repository Judgment Evidence', 'Unique Product Judgment Evidence', 'Comparison Summary', 'Recommendation Winner', 'judgment-comparison.md', 'judgment-comparison.json']) {
    assert.ok(app.includes(expected), `App.tsx must include ${expected}`);
  }
});
