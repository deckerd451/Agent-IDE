import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeEvidenceFromDocs, renderSynthesisMarkdown } from '../scripts/evidence-synthesis.mjs';
import { renderPrompt } from '../scripts/next-improvement.mjs';

const goalsMissing = '# Goals\n\n## Manual Goals\n- Product intent: Agent IDE helps teams.\n';

test('single-source synthesis uses exact repository wording with low confidence', () => {
  const result = synthesizeEvidenceFromDocs({ '.ai/goals.md': goalsMissing, '.ai/strategy.md': '# Strategy\n\n## Current Product Bet\nCompleteness-aware intelligence makes generated packages safer.\n' }, goalsMissing);
  const field = result.fields.currentProductBet;
  assert.equal(field.suggestedWording, 'Completeness-aware intelligence makes generated packages safer.');
  assert.equal(field.confidence, 'None');
  assert.deepEqual(field.confidenceCalculation.generatedConfirmations, ['Strategy']);
  assert.equal(field.evidence.length, 1);
});

test('multi-source synthesis ignores generated duplicate outputs for confidence', () => {
  const docs = {
    '.ai/goals.md': goalsMissing,
    'README.md': '# Repo\n\n## North Star Metric\nUseful handoffs accepted by repository owners.\n',
    '.ai/strategy.md': '# Strategy\n\n## North Star Metric\nUseful handoffs accepted by repository owners.\n',
    '.ai/context-package.md': '# Context\n\n## North Star Metric\nUseful handoffs accepted by repository owners.\n',
  };
  const result = synthesizeEvidenceFromDocs(docs, goalsMissing);
  assert.equal(result.fields.northStarMetric.confidence, 'Low');
  assert.deepEqual(result.fields.northStarMetric.confidenceCalculation.independentGroups, ['README']);
  assert.deepEqual(result.fields.northStarMetric.confidenceCalculation.generatedConfirmations, ['Context Package', 'Strategy']);
  assert.equal(result.fields.northStarMetric.suggestedWording, 'Useful handoffs accepted by repository owners.');
});

test('conflicting repository evidence chooses deterministic wording and lowers confidence', () => {
  const result = synthesizeEvidenceFromDocs({
    '.ai/goals.md': goalsMissing,
    '.ai/strategy.md': '# Strategy\n\n## Strategic Differentiator\nLocal-first deterministic repository intelligence.\n',
    '.ai/architecture.md': '# Architecture\n\n## Strategic Differentiator\nCloud-hosted collaborative intelligence.\n',
  }, goalsMissing);
  assert.equal(result.fields.strategicDifferentiator.suggestedWording, 'Cloud-hosted collaborative intelligence.');
  assert.equal(result.fields.strategicDifferentiator.confidence, 'Low');
  assert.equal(result.fields.strategicDifferentiator.allEvidence.length, 2);
});

test('no evidence reports none and renders placeholder', () => {
  const result = synthesizeEvidenceFromDocs({ '.ai/goals.md': goalsMissing, '.ai/strategy.md': '# Strategy\n' }, goalsMissing);
  assert.equal(result.fields.whatNotToBuild.confidence, 'None');
  assert.equal(renderSynthesisMarkdown(result.fields.whatNotToBuild), 'Missing field.');
});

test('product decision package renders evidence synthesis owner actions', () => {
  const synthesis = synthesizeEvidenceFromDocs({ '.ai/goals.md': goalsMissing, '.ai/strategy.md': '# Strategy\n\n## Success Criteria\nRepository owners accept generated handoff packages.\n' }, goalsMissing);
  const selectedIssue = {
    id: 'missing-manual-goals', category: 'missing manual goals', severity: 'high', actionability: 'manual', packageType: 'product-decision', source: 'Manual Goals Partial (25%).', title: 'Complete Manual Repository Intent Notes', evidence: 'Manual Goals Partial (25%).', reason: 'Manual Goals completeness is below the deterministic threshold.', recommendedAction: 'Complete only incomplete fields.',
    completenessExplanation: { missing: ['Success criteria'], requiredFields: [{ label: 'Success criteria', found: false, manualUpdate: '- Success criteria: [Repository owner: describe how success should be judged.]' }], computed: { percent: 25 }, classification: 'Partial', threshold: 'test' },
    evidenceSynthesis: synthesis,
  };
  const prompt = renderPrompt({ selectedIssue, decisionRanking: { candidates: [] } });
  assert.match(prompt, /Suggested Canonical Wording/);
  assert.match(prompt, /Repository owners accept generated handoff packages\./);
  assert.match(prompt, /Review\n- Accept\n- Edit\n- Reject/);
});
