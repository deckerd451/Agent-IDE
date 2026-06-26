import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLineageModel, classifyEvidenceSource, confidenceFromEvidence, persistEvidenceLineage } from '../scripts/evidence-lineage.mjs';
import { synthesizeEvidenceFromDocs, renderSynthesisMarkdown } from '../scripts/evidence-synthesis.mjs';
import { verifyIntelligence } from '../scripts/intelligence-verification.mjs';

test('classifies canonical, independent, and generated evidence deterministically', () => {
  assert.equal(classifyEvidenceSource('.ai/goals.md'), 'Canonical');
  assert.equal(classifyEvidenceSource('README.md'), 'Canonical');
  assert.equal(classifyEvidenceSource('.ai/architecture.md'), 'Independent');
  assert.equal(classifyEvidenceSource('docs/adr.md'), 'Independent');
  assert.equal(classifyEvidenceSource('.ai/strategy.md'), 'Generated');
  assert.equal(classifyEvidenceSource('.ai/prompts/architect.md'), 'Generated');
});

test('confidence uses independent evidence groups and ignores generated descendants', () => {
  const model = buildLineageModel(['README.md', '.ai/goals.md', '.ai/decisions.md', '.ai/strategy.md', '.ai/prompts/architect.md']);
  const calc = confidenceFromEvidence(model.sources);
  assert.equal(calc.confidence, 'High');
  assert.deepEqual(calc.generatedConfirmations, ['Architect', 'Strategy']);
  const generatedOnly = confidenceFromEvidence(buildLineageModel(['.ai/strategy.md', '.ai/context-package.md', '.ai/prompts/reviewer.md']).sources);
  assert.equal(generatedOnly.confidence, 'None');
});

test('evidence synthesis reports repository inferred state, independent evidence, generated confirmations, and conflicts', () => {
  const docs = {
    '.ai/goals.md': '# Goals\n',
    'README.md': '# Repo\n\n## Product Thesis\nBetween Events experience helps people follow up.\n',
    '.ai/decisions.md': '# Decisions\n\n## Product Thesis\nBetween Events experience helps people follow up.\n',
    '.ai/strategy.md': '# Strategy\n\n## Product Thesis\nBetween Events experience helps people follow up.\n',
    '.ai/architecture.md': '# Architecture\n\n## Product Thesis\nDifferent wording.\n',
  };
  const synthesis = synthesizeEvidenceFromDocs(docs, docs['.ai/goals.md']);
  const field = synthesis.fields.productThesis;
  assert.equal(field.state, 'Repository Inferred');
  assert.equal(field.confidence, 'Medium');
  assert.deepEqual(field.confidenceCalculation.independentGroups, ['Decision Log', 'README']);
  assert.deepEqual(field.confidenceCalculation.generatedConfirmations, ['Strategy']);
  assert.match(field.selectionRule, /conflicting repository evidence/);
  assert.match(renderSynthesisMarkdown(field), /Independent evidence[\s\S]*README/);
});

test('lineage persistence writes .ai/evidence-lineage.json', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lineage-'));
  await mkdir(join(dir, '.ai'));
  await persistEvidenceLineage(dir, ['README.md', '.ai/goals.md', '.ai/strategy.md']);
  const persisted = JSON.parse(await readFile(join(dir, '.ai/evidence-lineage.json'), 'utf8'));
  assert.equal(persisted.categories.Canonical.length, 2);
  assert.equal(persisted.categories.Generated.length, 1);
});

test('verification fails when lineage classifications disagree or generated evidence is independent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lineage-verify-'));
  const ai = join(dir, '.ai');
  await mkdir(ai, { recursive: true });
  await writeFile(join(ai, 'repository-health.md'), '# Repository Health\nConfidence: High\n');
  await writeFile(join(ai, 'intelligence-quality.json'), JSON.stringify({ confidence: { lineageConfidence: { confidence: 'High', independentGroupCount: 1 } }, canonicalIntelligenceQuality: { evidenceSynthesis: { fields: {} } } }));
  await writeFile(join(ai, 'next-improvement-prompt.md'), '# Package\n');
  await writeFile(join(ai, 'intelligence-explanations.json'), JSON.stringify({ evidenceSynthesis: { fields: {} } }));
  await writeFile(join(ai, 'decision-ranking.json'), JSON.stringify({ candidates: [] }));
  await writeFile(join(ai, 'evidence-lineage.json'), JSON.stringify({ sources: [{ file: '.ai/strategy.md', category: 'Independent', group: 'Strategy' }] }));
  const result = await verifyIntelligence(dir, { persist: false, expectedArtifacts: ['repository-health.md', 'intelligence-quality.json', 'evidence-lineage.json'] });
  assert.equal(result.status, 'Failed');
  assert.ok(result.failures.some((failure) => /Evidence lineage mismatch|generated artifacts counted/.test(failure)));
});
