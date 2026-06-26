import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateAIHandoff } from '../scripts/ai-handoff-validation.mjs';

async function repo(files) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-handoff-'));
  await mkdir(join(dir, '.ai'), { recursive: true });
  for (const [file, text] of Object.entries(files)) await writeFile(join(dir, '.ai', file), text);
  return dir;
}

const completePackage = `# Context Package

## Product Thesis
Nearify helps people maintain real-world relationships.

## Current Focus
Between-events relationship follow-up.

## Canonical Intelligence Ownership
Human-owned source of truth: .ai/goals.md.

## Strategy
Current Product Bet: Improve between-events follow-up. Strategy Confidence: High because evidence sources include goals and validation rationale.

## Core Systems
Follow-Up Engine, Event Presence, Notification Pipeline.

## Key Decisions
- Preserve local-first deterministic intelligence.

## Decision Ranking
Selected Issue: Run AI Handoff Validation
Selected Issue ID: ai-handoff-validation
Package Type/Actionability: validation-experiment
Priority Score: 10
Expected Improvement: total: 11
Deterministic Selection Explanation: Run AI Handoff Validation is ranked #1 with priority 10 and total expected improvement +11.

Ranked Candidates:
1. Run AI Handoff Validation (ai-handoff-validation)
  - selected: yes
  - package type/actionability: validation-experiment
  - priority score: 10
  - expected improvement: total: 11

## Highest-Priority Issue
- ID: ai-handoff-validation
- Title: Run AI Handoff Validation

## Next Implementation Step
Run deterministic handoff validation.

## Validation Summary
npm test and npm run build pass.

## Repository Health Summary
Recommended Next Step: Run AI Handoff Validation.

## Confidence Explanation
Confidence uses repository-local evidence lineage and deterministic rationale.
`;

const ranking = JSON.stringify({ selectedIssue: { id: 'ai-handoff-validation', title: 'Run AI Handoff Validation', rank: 1 }, candidates: [{ id: 'ai-handoff-validation', title: 'Run AI Handoff Validation', rank: 1, selected: true }] });
const explanations = JSON.stringify({ decisionRanking: { selected: { id: 'ai-handoff-validation' } }, recommendation: { selected: { title: 'Run AI Handoff Validation' } } });

async function validateWithContext(contextPackage, extra = {}) {
  return validateAIHandoff(await repo({
    'context-package.md': contextPackage,
    'strategy.md': '# Strategy\n\n## Current Product Bet\nImprove between-events follow-up.\n\n## Strategy Confidence\nHigh\nEvidence: .ai/goals.md\n',
    'architecture.md': '# Architecture\n\n## Core Systems\nFollow-Up Engine.\n',
    'repository-health.md': '# Repository Health\n\n## Recommended Next Step\nRun AI Handoff Validation.\n',
    'next-improvement-prompt.md': '# Run AI Handoff Validation\n\n## Selected Issue\n- Title: Run AI Handoff Validation\n\n## Current Evidence\n- Source risk/recommendation: No serious issue.\n- Reason: Healthy control plane.\n',
    'decision-ranking.json': ranking,
    'intelligence-explanations.json': explanations,
    ...extra,
  }));
}

const complete = await validateWithContext(completePackage);
assert.equal(complete.status, 'Ready');
assert.equal(complete.categories.currentProductBet.status, 'Present');
assert.equal(complete.categories.architecture.status, 'Present');
assert.equal(complete.contradictions.length, 0);

const missingProductBet = await validateWithContext(completePackage.replace(/Current Product Bet: Improve between-events follow-up\. /, ''));
assert.equal(missingProductBet.categories.currentProductBet.status, 'Missing');

const missingArchitecture = await validateWithContext(completePackage.replace('Follow-Up Engine, Event Presence, Notification Pipeline.', '- No generated content available yet.'));
assert.equal(missingArchitecture.categories.architecture.status, 'Missing');
assert.ok(missingArchitecture.contradictions.some((item) => /architecture/i.test(item)));

const hiddenDecisionRanking = await validateWithContext(completePackage.replace(/## Decision Ranking[\s\S]*?(?=\n## Highest-Priority Issue)/, ''));
assert.equal(hiddenDecisionRanking.categories.decisionRanking.status, 'Missing');
assert.ok(hiddenDecisionRanking.contradictions.includes('Package omits decision ranking.'));

const hiddenEvidence = await validateWithContext(completePackage, { 'evidence-synthesis.json': JSON.stringify({ fields: { product: { label: 'Product Thesis', suggestedWording: 'Hidden synthesized wording' } } }) });
assert.ok(hiddenEvidence.contradictions.some((item) => /Evidence synthesis/.test(item)));

const contradictory = await validateWithContext(completePackage.replace('Confidence uses repository-local evidence lineage and deterministic rationale.', '').replace('because evidence sources include goals and validation rationale.', ''));
assert.ok(contradictory.contradictions.some((item) => /confidence/i.test(item)) || contradictory.missingExplanations.includes('Confidence explanation'));

const nearify = await validateWithContext(completePackage.replace('Nearify helps people maintain real-world relationships.', 'Nearify helps people maintain real-world relationships through event context and timely follow-up workflows.'));
assert.ok(nearify.overallScore >= 85);

const reconstructableDecisionRankingPackage = completePackage;

const reconstructableDecisionRanking = await validateWithContext(reconstructableDecisionRankingPackage);
assert.equal(reconstructableDecisionRanking.categories.decisionRanking.status, 'Present');
assert.ok(!reconstructableDecisionRanking.hiddenInformation.includes('Decision ranking'));
assert.ok(!reconstructableDecisionRanking.contradictions.includes('Package omits decision ranking.'));

const nearifyReconstructable = await validateWithContext(reconstructableDecisionRankingPackage.replace('Nearify helps people maintain real-world relationships.', 'Nearify helps people maintain real-world relationships through event context and timely follow-up workflows.'));
assert.ok(!nearifyReconstructable.hiddenInformation.includes('Decision ranking'));
assert.ok(!nearifyReconstructable.contradictions.includes('Package omits decision ranking.'));
