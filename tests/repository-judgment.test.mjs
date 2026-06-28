import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { generateRepositoryJudgment } from '../scripts/repository-judgment.mjs';
import { generateNextImprovement } from '../scripts/next-improvement.mjs';

const healthyQuality = {
  coverage: { goalsPresent: true, strategyPresent: true, architecturePresent: true, decisionsPresent: true, validationPresent: true, backlogPresent: true, repositoryHealthPresent: true, agentsPresent: true, codePresent: true },
  consistency: { contradictions: [], duplicatedSections: [] },
  canonicalIntelligenceQuality: { score: 92, strategyFields: { classification: 'Present', percent: 100, requiredFields: [] } },
  generatedExportQuality: { score: 94 },
  confidence: { score: 88, validationConfidence: 'High' },
  freshness: { canonicalStaleDocuments: [] },
};

async function writeFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'repo-judgment-'));
  await mkdir(join(dir, '.ai'), { recursive: true });
  await mkdir(join(dir, 'docs'), { recursive: true });
  const files = {
    'goals.md': `# Goals\n\n## Product Thesis\nAgent IDE recommends the single next repository improvement.\n\n## Current Product Bet\nMake product improvements visible after the repository is healthy.\n\n## Success Criteria\n- Users receive one useful next improvement after refresh.\n`,
    'strategy.md': `# Strategy\n\n## Product Thesis\nAgent IDE recommends the single next repository improvement.\n\n## Current Product Bet\nMake product improvements visible after the repository is healthy.\n\n## North Star Metric\nUseful implementation prompts generated per repository refresh.\n`,
    'architecture.md': `# Architecture\n\n## Core Systems\n- UI command surfaces route repository refreshes through the local server.\n- Generated artifacts remain local-first and deterministic.\n`,
    'backlog.md': `# Backlog\n\n## Prioritized Backlog\n- Add product capability mapping for repository workflows.\n- Simplify the refresh workflow handoff copy.\n- Document the shadow judgment artifact for contributors.\n`,
    'decisions.md': `# Decisions\n\n## Active Decisions\n- Decision: Keep repository judgment in shadow mode until candidate ranking is proven stable.\n`,
    'execution-model.md': `# Execution Model\n\n## Workflow\n- Refresh workflow generates deterministic artifacts before recommendation validation.\n`,
    'repository-health.md': `# Repository Health\nConfidence: High\n\n## Risks\n- No repository health risks detected.\n\n## Recommended Next Step\nRun AI handoff validation.\n`,
    'context-package.md': '# Context Package\nReady.\n',
    'intelligence-audit.md': '',
    'intelligence-quality.json': JSON.stringify(healthyQuality, null, 2),
  };
  for (const [file, content] of Object.entries(files)) await writeFile(join(dir, '.ai', file), content);
  await writeFile(join(dir, 'docs', 'repository-judgment-engine-rfc.md'), '# RFC\n\nRepository Judgment Engine v2.\n');
  return dir;
}

function normalizeGeneratedAt(judgment) {
  return JSON.stringify(judgment, null, 2);
}

test('repository judgment output is deterministic', async () => {
  const dir = await writeFixture();
  const first = await generateRepositoryJudgment(dir);
  const second = await generateRepositoryJudgment(dir);
  assert.equal(normalizeGeneratedAt(first), normalizeGeneratedAt(second));
  assert.equal(first.generatedAt, '1970-01-01T00:00:00.000Z');
});

test('repository judgment does not affect current recommendation ranking', async () => {
  const dir = await writeFixture();
  const before = await generateNextImprovement(dir);
  await generateRepositoryJudgment(dir);
  const after = await generateNextImprovement(dir);
  assert.equal(after.selectedIssue.id, before.selectedIssue.id);
  assert.equal(after.decisionRanking.selectedIssue.id, before.decisionRanking.selectedIssue.id);
  assert.deepEqual(after.decisionRanking.candidates.map((candidate) => candidate.id), before.decisionRanking.candidates.map((candidate) => candidate.id));
});

test('repository judgment produces stable candidate IDs', async () => {
  const dir = await writeFixture();
  const first = await generateRepositoryJudgment(dir);
  const firstIds = first.candidates.map((candidate) => candidate.id);
  const second = await generateRepositoryJudgment(dir);
  assert.deepEqual(second.candidates.map((candidate) => candidate.id), firstIds);
  assert.ok(firstIds.length > 0);
  assert.equal(new Set(firstIds).size, firstIds.length);
});

test('repository judgment includes evidence-backed candidates only', async () => {
  const dir = await writeFixture();
  const judgment = await generateRepositoryJudgment(dir);
  assert.ok(judgment.candidates.length > 0);
  for (const candidate of judgment.candidates) {
    assert.ok(candidate.evidence.length > 0, candidate.id);
    assert.ok(candidate.sourceFiles.length > 0, candidate.id);
    assert.ok(candidate.evidence.every((item) => item.sourceFile && item.text), candidate.id);
  }
});

test('repository judgment handles healthy repositories without falling back to validation', async () => {
  const dir = await writeFixture();
  const judgment = await generateRepositoryJudgment(dir);
  assert.ok(judgment.candidates.length >= 3);
  assert.ok(judgment.candidates.some((candidate) => candidate.category === 'product-capability'));
  assert.ok(judgment.candidates.every((candidate) => candidate.id !== 'ai-handoff-validation'));
  const markdown = await readFile(join(dir, '.ai', 'repository-judgment.md'), 'utf8');
  assert.match(markdown, /Repository Judgment \(Shadow Mode\)/);
  assert.match(markdown, /Shadow Candidates/);
});


test('repository judgment writes deterministic evaluation and rolling history artifacts', async () => {
  const dir = await writeFixture();
  await generateRepositoryJudgment(dir);
  const evaluation = await readFile(join(dir, '.ai', 'repository-judgment-evaluation.md'), 'utf8');
  const history = JSON.parse(await readFile(join(dir, '.ai', 'repository-judgment-history.json'), 'utf8'));
  assert.match(evaluation, /Repository Judgment Evaluation/);
  assert.match(evaluation, /Production recommendation/);
  assert.match(evaluation, /Shadow recommendation/);
  assert.match(evaluation, /Overall Winner/);
  assert.match(evaluation, /Readiness score: \d+\/100/);
  assert.match(evaluation, /Shadow wins at least 3 consecutive refreshes/);
  assert.equal(history.length, 1);
  assert.ok(['Production', 'Shadow', 'Tie'].includes(history[0].winner));
  assert.equal(typeof history[0].readinessScore, 'number');
});
