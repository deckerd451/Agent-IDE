import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateNextImprovement } from '../scripts/next-improvement.mjs';

async function exists(path) {
  return access(path).then(() => true).catch((error) => error?.code === 'ENOENT' ? false : Promise.reject(error));
}

async function makeRepo(prefix, aiFiles = {}) {
  const repo = await mkdtemp(join(tmpdir(), prefix));
  await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'nearify', description: 'Local-first repository intelligence control plane.', scripts: { test: 'node --test' } }, null, 2));
  await writeFile(join(repo, 'README.md'), '# Nearify\n\nRepository-local planning and validation.\n');
  if (Object.keys(aiFiles).length) await mkdir(join(repo, '.ai'), { recursive: true });
  for (const [file, content] of Object.entries(aiFiles)) await writeFile(join(repo, '.ai', file), content);
  return repo;
}

async function assertRecommendationDoesNotTargetMissingCanonical(repo, result) {
  const text = [result.selectedIssue?.recommendedAction, result.prompt, JSON.stringify(result.decisionRanking)].join('\n');
  for (const match of text.matchAll(/\.ai\/[a-z-]+\.(?:md|json)/g)) {
    if (match[0] === '.ai/goals.md') assert.equal(await exists(join(repo, '.ai/goals.md')), true, `${match[0]} should exist before recommendation guidance is rendered`);
  }
}

test('bootstraps repository with no .ai directory before rendering recommendation guidance', async () => {
  const repo = await makeRepo('agent-ide-no-ai-');
  const result = await generateNextImprovement(repo);
  const goals = await readFile(join(repo, '.ai/goals.md'), 'utf8');
  assert.match(goals, /# Goals/);
  assert.match(goals, /Generated deterministically from repository-local files only/);
  assert.equal(result.canonicalBootstrap.created, true);
  await assertRecommendationDoesNotTargetMissingCanonical(repo, result);
});

test('bootstraps partial .ai directory with only architecture intelligence', async () => {
  const repo = await makeRepo('agent-ide-nearify-', { 'architecture.md': '# Architecture\n\n## Core Systems\n- Local control plane.\n' });
  const result = await generateNextImprovement(repo);
  const goals = await readFile(join(repo, '.ai/goals.md'), 'utf8');
  assert.match(goals, /Architecture evidence: \.ai\/architecture\.md exists/);
  assert.equal(result.canonicalBootstrap.created, true);
  await assertRecommendationDoesNotTargetMissingCanonical(repo, result);
});

test('bootstraps repository missing only .ai/goals.md', async () => {
  const repo = await makeRepo('agent-ide-missing-goals-', {
    'architecture.md': '# Architecture\n\n- Existing architecture.\n',
    'strategy.md': '# Strategy\n\n## Strategy Confidence\nLow\n',
  });
  const result = await generateNextImprovement(repo);
  assert.equal(await exists(join(repo, '.ai/goals.md')), true);
  assert.equal(result.canonicalBootstrap.before, 'missing');
  await assertRecommendationDoesNotTargetMissingCanonical(repo, result);
});

test('preserves complete canonical intelligence contract without bootstrap', async () => {
  const repo = await makeRepo('agent-ide-complete-ai-', {
    'goals.md': '# Goals\n\n## Product Purpose\nLocal-first control plane.\n\n## Manual Goals\n- Product intent: Improve repository intelligence.\n- Current focus: Keep workflows deterministic.\n- Success criteria: Tests pass.\n- Long-term vision: Every repository starts safely.\n\n## Manual Strategy Notes\n- Current Product Bet: Bootstrap missing intelligence.\n- North Star Metric: Useful recommendations.\n- Strategic Differentiator: Deterministic local evidence.\n- Success Definition: No missing canonical targets.\n',
  });
  const result = await generateNextImprovement(repo);
  assert.equal(result.canonicalBootstrap.created, false);
  assert.notEqual(result.selectedIssue.id, 'canonical-bootstrap');
  await assertRecommendationDoesNotTargetMissingCanonical(repo, result);
});
