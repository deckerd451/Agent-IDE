import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { evaluateCanonicalStrategyCompleteness } from '../scripts/canonical-completeness.mjs';
import { applyCanonicalEdit } from '../scripts/server.mjs';

async function repoWithGoals(markdown) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-canonical-edit-'));
  await mkdir(join(dir, '.ai'), { recursive: true });
  await writeFile(join(dir, '.ai/goals.md'), markdown);
  return dir;
}

const edit = (repositoryPath, overrides = {}) => applyCanonicalEdit({
  repositoryPath,
  filePath: '.ai/goals.md',
  section: '## Manual Strategy Notes',
  fieldLabel: 'Current Product Bet',
  markdownBlock: '- Current Product Bet:\n  Owner-approved bet.',
  ...overrides,
});

test('inserts field into existing section and preserves existing goals content', async () => {
  const dir = await repoWithGoals('# Goals\n\n## Product Purpose\nKeep local intelligence.\n\n## Manual Strategy Notes\n\n## What Not To Build\nNo cloud.\n');
  const result = await edit(dir);
  const goals = await readFile(join(dir, '.ai/goals.md'), 'utf8');
  assert.equal(result.changedFile, '.ai/goals.md');
  assert.equal(result.insertedSection, false);
  assert.match(goals, /## Product Purpose\nKeep local intelligence\./);
  assert.match(goals, /## Manual Strategy Notes\n\n- Current Product Bet:\n  Owner-approved bet\.\n\n## What Not To Build/);
  assert.match(goals, /No cloud\./);
});

test('creates missing Manual Strategy Notes section deterministically', async () => {
  const dir = await repoWithGoals('# Goals\n\n## Product Purpose\nKeep local intelligence.\n');
  const result = await edit(dir);
  const goals = await readFile(join(dir, '.ai/goals.md'), 'utf8');
  assert.equal(result.insertedSection, true);
  assert.match(goals, /## Manual Strategy Notes\n\n- Current Product Bet:/);
});

test('refuses duplicate field', async () => {
  const dir = await repoWithGoals('# Goals\n\n## Manual Strategy Notes\n\n- Current Product Bet: Existing.\n');
  await assert.rejects(edit(dir), /Field already exists/);
});

test('refuses empty text', async () => {
  const dir = await repoWithGoals('# Goals\n\n## Manual Strategy Notes\n');
  await assert.rejects(edit(dir, { markdownBlock: '   ' }), /empty/);
});

test('refuses wrong field label', async () => {
  const dir = await repoWithGoals('# Goals\n\n## Manual Strategy Notes\n');
  await assert.rejects(edit(dir, { markdownBlock: '- Strategic Differentiator: Different.' }), /expected field label/);
});

test('refuses paths outside repository', async () => {
  const dir = await repoWithGoals('# Goals\n\n## Manual Strategy Notes\n');
  await assert.rejects(edit(dir, { filePath: '../outside.md' }), /only target \.ai\/goals\.md|outside/);
  assert.ok(resolve(dir));
});


test('field inserted by applyCanonicalEdit is recognized by strategy completeness evaluation', async () => {
  const dir = await repoWithGoals('# Goals\n\n## Manual Strategy Notes\n');
  await edit(dir, { markdownBlock: '- Current Product Bet: Owner-approved bet.' });
  const goals = await readFile(join(dir, '.ai/goals.md'), 'utf8');
  const result = evaluateCanonicalStrategyCompleteness(goals);
  const field = result.requiredFields.find((item) => item.key === 'currentProductBet');
  assert.equal(field.classification, 'Present');
  assert.equal(field.present, true);
});
