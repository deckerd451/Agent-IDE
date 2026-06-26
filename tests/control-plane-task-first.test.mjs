import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePromise = readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('Control Plane uses a task-first layout before diagnostics', async () => {
  const source = await sourcePromise;
  const todays = source.indexOf('Today\'s Work');
  assert.ok(todays > -1, 'Today\'s Work is rendered');
  assert.ok(todays < source.indexOf('aria-label="Repository Health"'));
  assert.ok(todays < source.indexOf('aria-label="Repository Quality"'));
  assert.ok(todays < source.indexOf('Decision Ranking — current winner'));
  for (const expected of ['After This', 'Estimated Improvement', 'Owner Action', 'Implementation Action', 'Quick AI Actions']) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Control Plane maps Today and After This to Decision Ranking ranks', async () => {
  const source = await sourcePromise;
  assert.match(source, /const todaysWork = candidateByRank\(data, 1\)/);
  assert.match(source, /const afterThis = candidateByRank\(data, 2\)/);
  assert.match(source, /data\.decisionRanking\?\.candidates\?\.find\(\(candidate\) => candidate\.rank === rank\)/);
});

test('advanced diagnostics are collapsed by default', async () => {
  const source = await sourcePromise;
  assert.match(source, /<details className="controlCard qualityCard" aria-label="Repository Quality"><summary>Repository Quality<\/summary>/);
  assert.match(source, /<details className="controlCard qualityCard" aria-label="Verification"><summary>Verification<\/summary>/);
  assert.match(source, /<details className="controlCard disclosureCard"><summary>Evidence Explorer<\/summary>/);
  assert.match(source, /<details className="controlCard disclosureCard"><summary>Timeline<\/summary>/);
  assert.doesNotMatch(source, /<details open>/);
});

test('refresh progress summary compares previous and current snapshots deterministically', async () => {
  const source = await sourcePromise;
  for (const expected of ['Repository Intelligence Updated', 'previousIssue.id !== nextIssue.id', 'repositoryQualityBefore', 'repositoryQualityAfter', 'confidenceBefore', 'confidenceAfter', 'nextTask: nextIssue.title']) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
