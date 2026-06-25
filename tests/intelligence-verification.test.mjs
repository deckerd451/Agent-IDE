import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyIntelligence, sha256 } from '../scripts/intelligence-verification.mjs';

const expected = ['strategy.md', 'repository-health.md', 'next-improvement-prompt.md'];

async function fixture(name = 'agent-ide-verification-') {
  const dir = await mkdtemp(join(tmpdir(), name));
  await mkdir(join(dir, '.ai'), { recursive: true });
  return dir;
}

test('successful verification records generated and displayed hashes', async () => {
  const dir = await fixture();
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n');
  await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n');
  await writeFile(join(dir, '.ai/next-improvement-prompt.md'), '# Next\n');

  const metadata = await verifyIntelligence(dir, { expectedArtifacts: expected });

  assert.equal(metadata.status, 'Verified');
  assert.equal(metadata.score, 100);
  assert.equal(metadata.artifacts[0].generatedHash, sha256('# Strategy\n'));
  assert.equal(metadata.artifacts[0].displayedHash, metadata.artifacts[0].generatedHash);
  assert.match(await readFile(join(dir, '.ai/intelligence-verification.json'), 'utf8'), /All displayed intelligence verified/);
});

test('missing artifact detection reports specific failure', async () => {
  const dir = await fixture();
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n');

  const metadata = await verifyIntelligence(dir, { expectedArtifacts: ['strategy.md', 'repository-health.md'] });

  assert.equal(metadata.status, 'Failed');
  assert.deepEqual(metadata.artifacts.find((item) => item.artifact === 'repository-health.md')?.failures, ['Expected artifact missing.']);
});

test('hash mismatch detects stale displayed intelligence', async () => {
  const dir = await fixture();
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\nLatest\n');

  const metadata = await verifyIntelligence(dir, { expectedArtifacts: ['strategy.md'], displayedContents: { 'strategy.md': '# Strategy\nStale\n' } });

  assert.equal(metadata.status, 'Failed');
  assert.deepEqual(metadata.failures, ['strategy.md: Displayed hash differs from generated hash.']);
});

test('timestamp mismatch detects artifacts older than refresh start', async () => {
  const dir = await fixture();
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n');
  const future = new Date(Date.now() + 60_000).toISOString();

  const metadata = await verifyIntelligence(dir, { expectedArtifacts: ['strategy.md'], refreshStartedAt: future });

  assert.equal(metadata.status, 'Failed');
  assert.deepEqual(metadata.artifacts[0].failures, ['Artifact timestamp is older than refresh start.']);
});

test('unchanged required artifact detects stale refresh', async () => {
  const dir = await fixture();
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n');
  const first = await verifyIntelligence(dir, { expectedArtifacts: ['strategy.md'] });
  const second = await verifyIntelligence(dir, { expectedArtifacts: ['strategy.md'], previousVerification: first, refreshStartedAt: new Date(Date.now() - 1000).toISOString(), requireChangedArtifacts: ['strategy.md'] });

  assert.equal(second.status, 'Failed');
  assert.deepEqual(second.artifacts[0].failures, ['Refresh completed but artifact hash is unchanged.']);
});
