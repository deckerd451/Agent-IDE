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

test('verification detects product decision package and explanation mismatch', async () => {
  const dir = await fixture('agent-ide-verification-package-');
  await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n\n## Quality Signals\n- Manual Goals Partial (50%)\n');
  await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify({ canonicalIntelligenceQuality: { fields: { manualGoals: { state: 'Partial', percent: 50 } } } }));
  await writeFile(join(dir, '.ai/intelligence-explanations.json'), JSON.stringify({ completeness: { fields: { manualGoals: {
    classification: 'Partial',
    computed: { percent: 50 },
    missing: ['Success criteria'],
    requiredFields: [
      { label: 'Product intent', found: true, manualUpdate: '- Product intent: [Repository owner: describe the product purpose this repository should serve.]' },
      { label: 'Success criteria', found: false, manualUpdate: '- Success criteria: [Repository owner: describe how success should be judged.]' },
    ],
  } } } }));
  await writeFile(join(dir, '.ai/next-improvement-prompt.md'), '# Complete Manual Repository Intent Notes\n\n## Selected Issue\n- ID: missing-manual-goals\n- Package Type: product-decision\n\n## Deterministic Evaluation\n- Completeness percentage: 75%\n- Classification: Partial\n\n## Suggested Manual Update\n```md\n- Product intent: [Repository owner: describe the product purpose this repository should serve.]\n```\n');

  const metadata = await verifyIntelligence(dir, { persist: false, expectedArtifacts: ['repository-health.md', 'intelligence-quality.json', 'intelligence-explanations.json', 'next-improvement-prompt.md'] });
  assert.equal(metadata.status, 'Failed');
  assert.ok(metadata.failures.some((failure) => /package Manual Goals 75% vs explanation 50%/.test(failure)));
  assert.ok(metadata.failures.some((failure) => /missing field not shown: Success criteria/.test(failure)));
  assert.ok(metadata.failures.some((failure) => /Suggested Manual Update fields: Product intent\..*Omitted missing fields: Success criteria\..*Incorrectly suggested completed fields: Product intent\./.test(failure)));
});

test('verification detects suggested manual update saying none while canonical fields are missing', async () => {
  const dir = await fixture('agent-ide-verification-contradiction-');
  await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n\n## Quality Signals\n- Manual Goals Partial (75%)\n');
  await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify({ canonicalIntelligenceQuality: { fields: { manualGoals: { state: 'Partial', percent: 75 } } } }));
  await writeFile(join(dir, '.ai/intelligence-explanations.json'), JSON.stringify({ completeness: { fields: { manualGoals: {
    classification: 'Partial', computed: { percent: 75 }, missing: ['Long-term vision'],
    requiredFields: [{ label: 'Long-term vision', found: false, manualUpdate: '- Long-term vision: [Repository owner: describe the long-term vision for this product.]' }],
  } } } }));
  await writeFile(join(dir, '.ai/next-improvement-prompt.md'), '# Complete Manual Repository Intent Notes\n\n## Selected Issue\n- ID: missing-manual-goals\n- Package Type: product-decision\n\n## Deterministic Evaluation\n- Missing fields:\n- Long-term vision\n- Completeness percentage: 75%\n- Classification: Partial\n\n## Suggested Manual Update\nNo Manual Goals fields require updates.\n');

  const metadata = await verifyIntelligence(dir, { persist: false, expectedArtifacts: ['repository-health.md', 'intelligence-quality.json', 'intelligence-explanations.json', 'next-improvement-prompt.md'] });
  assert.equal(metadata.status, 'Failed');
  assert.ok(metadata.failures.some((failure) => /Product Decision Package contradiction: Suggested Manual Update does not match canonical completeness evaluation\./.test(failure)));
  assert.equal(metadata.failureCount, metadata.failures.length);
  assert.equal(metadata.failureReason, metadata.failures[0]);
});

async function writeProductDecisionFixture(dir, { missing, suggested, requiredFields, decisionRanking = true }) {
  await writeFile(join(dir, '.ai/repository-health.md'), `# Repository Health\n\n## Quality Signals\n- Manual Goals ${missing.length ? 'Partial (75%)' : 'Complete (100%)'}\n`);
  await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify({ canonicalIntelligenceQuality: { fields: { manualGoals: { state: missing.length ? 'Partial' : 'Complete', percent: missing.length ? 75 : 100 } } } }));
  await writeFile(join(dir, '.ai/intelligence-explanations.json'), JSON.stringify({
    recommendation: { selected: { title: 'Complete Manual Repository Intent Notes' } },
    completeness: { fields: { manualGoals: { classification: missing.length ? 'Partial' : 'Complete', computed: { percent: missing.length ? 75 : 100 }, missing, requiredFields } } },
  }));
  if (decisionRanking) await writeFile(join(dir, '.ai/decision-ranking.json'), JSON.stringify({ selectedIssue: { id: 'missing-manual-goals' }, candidates: [{ id: 'missing-manual-goals', title: 'Complete Manual Repository Intent Notes', rank: 1, selected: true }] }));
  await writeFile(join(dir, '.ai/next-improvement-prompt.md'), `# Complete Manual Repository Intent Notes\n\n## Selected Issue\n- ID: missing-manual-goals\n- Package Type: product-decision\n\n## Decision Ranking\n1. Complete Manual Repository Intent Notes (selected)\n\n## Deterministic Evaluation\n- Missing fields:\n${missing.map((field) => `- ${field}`).join('\n')}\n- Completeness percentage: ${missing.length ? 75 : 100}%\n- Classification: ${missing.length ? 'Partial' : 'Complete'}\n\n## Suggested Manual Update\n${suggested}\n\n## Acceptance Criteria\n- Suggested Manual Update exactly matches the canonical Deterministic Evaluation missing fields.\n`);
}

const longTermVisionField = { label: 'Long-term vision', found: false, manualUpdate: '- Long-term vision: [Repository owner: describe the long-term vision for this product.]' };
const productIntentField = { label: 'Product intent', found: true, manualUpdate: '- Product intent: [Repository owner: describe the product purpose this repository should serve.]' };

test('product decision verification passes when one missing field matches suggested update', async () => {
  const dir = await fixture('agent-ide-verification-product-pass-');
  await writeProductDecisionFixture(dir, { missing: ['Long-term vision'], suggested: '```md\n- Long-term vision: [Repository owner: describe the long-term vision for this product.]\n```', requiredFields: [productIntentField, longTermVisionField] });

  const metadata = await verifyIntelligence(dir, { persist: false, expectedArtifacts: ['repository-health.md', 'intelligence-quality.json', 'intelligence-explanations.json', 'next-improvement-prompt.md'] });

  assert.equal(metadata.status, 'Verified');
  assert.deepEqual(metadata.crossChecks, []);
});

test('product decision verification reports omitted missing suggested update fields', async () => {
  const dir = await fixture('agent-ide-verification-product-omitted-');
  await writeProductDecisionFixture(dir, { missing: ['Long-term vision'], suggested: 'No Manual Goals fields require updates.', requiredFields: [productIntentField, longTermVisionField] });

  const metadata = await verifyIntelligence(dir, { persist: false, expectedArtifacts: ['repository-health.md', 'intelligence-quality.json', 'intelligence-explanations.json', 'next-improvement-prompt.md'] });

  assert.equal(metadata.status, 'Failed');
  assert.ok(metadata.failures.some((failure) => /Canonical missing fields: Long-term vision\..*Suggested Manual Update fields: none\..*Omitted missing fields: Long-term vision\..*Incorrectly suggested completed fields: none\./.test(failure)));
});

test('product decision verification reports completed fields suggested for update', async () => {
  const dir = await fixture('agent-ide-verification-product-completed-');
  await writeProductDecisionFixture(dir, { missing: ['Long-term vision'], suggested: '```md\n- Long-term vision: [Repository owner: describe the long-term vision for this product.]\n- Product intent: [Repository owner: describe the product purpose this repository should serve.]\n```', requiredFields: [productIntentField, longTermVisionField] });

  const metadata = await verifyIntelligence(dir, { persist: false, expectedArtifacts: ['repository-health.md', 'intelligence-quality.json', 'intelligence-explanations.json', 'next-improvement-prompt.md'] });

  assert.equal(metadata.status, 'Failed');
  assert.ok(metadata.failures.some((failure) => /Incorrectly suggested completed fields: Product intent\./.test(failure)));
});

test('all verified artifacts with cross-check failure exposes separate cross-check failure row', async () => {
  const dir = await fixture('agent-ide-verification-cross-check-');
  await writeProductDecisionFixture(dir, { missing: ['Long-term vision'], suggested: 'No Manual Goals fields require updates.', requiredFields: [productIntentField, longTermVisionField] });

  const metadata = await verifyIntelligence(dir, { persist: false, expectedArtifacts: ['repository-health.md', 'intelligence-quality.json', 'intelligence-explanations.json', 'next-improvement-prompt.md'] });

  assert.equal(metadata.status, 'Failed');
  assert.ok(metadata.artifacts.every((artifact) => artifact.status === 'Verified'));
  assert.deepEqual(metadata.crossChecks.map((check) => check.check), ['Cross-artifact consistency']);
  assert.equal(metadata.crossChecks[0].status, 'Failed');
  assert.match(metadata.summary, /verification failure/);
});
