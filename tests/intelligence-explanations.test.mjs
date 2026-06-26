import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { explainCompleteness, explainHealth, explainQuality, explainRecommendation, persistIntelligenceExplanations } from '../scripts/intelligence-explanations.mjs';
import { generateNextImprovement } from '../scripts/next-improvement.mjs';
import { verifyIntelligence } from '../scripts/intelligence-verification.mjs';

test('completeness explanations include required fields, evidence, score, and classification', () => {
  const explanation = explainCompleteness(`# Goals\n\n## Manual Goals\n- Product intent: Help owners understand repositories.\n- Current focus: Explain deterministic intelligence.\n`);
  const manual = explanation.fields.manualGoals;
  assert.equal(manual.computed.percent, 50);
  assert.equal(manual.classification, 'Partial');
  assert.deepEqual(manual.missing, ['Success criteria', 'Long-term vision']);
  assert.match(manual.reason.join('\n'), /Success criteria not detected/);
});

test('recommendation explanations list candidates and selected deterministic priority', () => {
  const selected = { id: 'missing-manual-goals', title: 'Complete Manual Repository Intent Notes', category: 'missing manual goals', actionability: 'manual', evidence: 'Manual Goals Partial', recommendedAction: 'Complete goals.' };
  const explanation = explainRecommendation(selected, [
    { id: 'strategy-quality', title: 'Strengthen Strategy Quality', category: 'strategy', actionability: 'manual', evidence: 'Low' },
    selected,
    { id: 'stale-intelligence', title: 'Refresh Stale Intelligence', category: 'freshness', actionability: 'manual', evidence: 'stale' },
  ]);
  assert.equal(explanation.selected.title, 'Complete Manual Repository Intent Notes');
  assert.equal(explanation.selected.priority, 74);
  assert.equal(explanation.classification, 'Consistent');
  assert.equal(explanation.candidateIssues.length, 3);
});

test('health and quality explanations include rule-backed deductions and evidence', () => {
  const completeness = { fields: { manualGoals: { requirements: [{ label: 'Product intent', complete: true }, { label: 'Success criteria', complete: false }] } } };
  const health = explainHealth({ risks: ['Manual Goals Partial (50%). Missing: Success criteria.'], canonicalCompleteness: completeness });
  assert.equal(health[0].rule, 'Manual Goals completeness < 100%');
  assert.match(health[0].evidence.join('\n'), /Success criteria missing/);
  const quality = explainQuality({ overallScore: 82, canonicalIntelligenceQuality: { completenessScore: 50, fields: { manualGoals: { missing: ['Success criteria'], percent: 50 } } }, consistency: { score: 100, contradictions: [] }, freshness: { score: 100, staleDocuments: [] }, confidence: { score: 90 }, verification: { score: 100, failures: [] } });
  assert.equal(quality.score, 82);
  assert.match(quality.deductions[0].rule, /Missing Success criteria/);
});

test('packages include recommendation explanation and persisted artifact can be verified for contradictions', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'agent-ide-explanations-'));
  await mkdir(join(repo, '.ai'), { recursive: true });
  await writeFile(join(repo, '.ai', 'repository-health.md'), '# Repository Health\n\n## Risks\n- Manual Goals Partial (50%). Missing: Success criteria.\n');
  await writeFile(join(repo, '.ai', 'intelligence-quality.json'), JSON.stringify({ coverage: { goalsPresent: true }, canonicalIntelligenceQuality: { fields: { manualGoals: { state: 'Partial', percent: 50, missing: ['Success criteria'] } }, score: 50 }, consistency: { contradictions: [], duplicatedSections: [] }, confidence: { score: 100 }, generatedExportQuality: { score: 100 }, freshness: { canonicalStaleDocuments: [] } }));
  for (const file of ['intelligence-audit.md', 'backlog.md', 'strategy.md', 'context-package.md']) await writeFile(join(repo, '.ai', file), '');
  const result = await generateNextImprovement(repo);
  assert.match(result.prompt, /## Why This Issue Was Selected/);
  await persistIntelligenceExplanations(repo, { completeness: { fields: { manualGoals: { classification: 'Partial', computed: { percent: 50 } } } }, recommendation: result.explanation });
  const persisted = JSON.parse(await readFile(join(repo, '.ai', 'intelligence-explanations.json'), 'utf8'));
  assert.equal(persisted.recommendation.selected.title, result.selectedIssue.title);
  const verification = await verifyIntelligence(repo, { persist: false, expectedArtifacts: ['next-improvement-prompt.md', 'intelligence-quality.json', 'intelligence-explanations.json'] });
  assert.equal(verification.failures.filter((failure) => /Explanation contradiction/.test(failure)).length, 0);
});
