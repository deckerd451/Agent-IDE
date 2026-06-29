import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  mdSection, firstNonBlankLine, normalizeSentence, stemWords, wordOverlap, bullets,
  classifyEvidenceDirection, stripBoilerplatePrefix, isImplementationVerb,
  deriveProductThesis, deriveCurrentProductBet, deriveHighestRiskAssumption,
  deriveCurrentEvidence, deriveHighestLeverageMilestone, deriveRepositoryAlignment,
  deriveStrategicRecommendation, runValidation, renderProductIntelligenceMd,
  generateProductIntelligence,
} from '../scripts/product-intelligence.mjs';

test('product intelligence helper functions are deterministic', () => {
  assert.equal(mdSection('# Doc\n\n## Foo\nbar\nbaz\n\n## Other\nX', 'Foo'), 'bar\nbaz');
  assert.equal(mdSection('# Doc\n\n## Other\nX', 'Missing'), '');
  assert.equal(firstNonBlankLine('# H\n- skip\nplain text'), 'plain text');
  assert.ok(normalizeSentence(`${'a'.repeat(299)}.`).length <= 280);
  assert.equal(stemWords('the repository is healthy').has('the'), false);
  assert.equal(stemWords('the repository is healthy').has('health'), true);
  assert.ok(wordOverlap('add backlog filtering', 'filter the backlog items') >= 2);
  assert.equal(wordOverlap('product thesis', 'fix test runner'), 0);
  assert.deepEqual(bullets('- A\n* B\nC'), ['A', 'B']);
  assert.equal(classifyEvidenceDirection('tests passed'), 'supports');
  assert.equal(classifyEvidenceDirection('data missing'), 'weakens');
  assert.equal(classifyEvidenceDirection('neutral statement'), 'unknown');
  assert.equal(classifyEvidenceDirection('passed but failed'), 'weakens');
  assert.equal(stripBoilerplatePrefix('The repository is currently focused on making X'), 'making X');
  assert.equal(isImplementationVerb('Add backlog quality filtering'), true);
  assert.equal(isImplementationVerb('Repository handoff readiness reaches Ready'), false);
});

test('product intelligence derivation functions follow canonical priorities', () => {
  const goals = '## Product Thesis\nAgent IDE makes repository handoff reliable.\n\n## Current Focus\nFallback bet.\n\n## Success Criteria\n- Handoff readiness reaches Ready\n\n## What Not To Build\nCloud LLM ranking';
  const strategy = '## Current Product Bet\nThe current bet is deterministic handoff quality improves adoption.\n\n## Current Experiment\nRepository handoff readiness reaches Ready\n\n## What Not To Build\nCloud LLM ranking';
  const health = '## Risks\n- missing deterministic handoff quality signal\n- unrelated risk\n\n## Intelligence Completeness\n- Strategy present and complete';
  const architecture = '## Known Gaps\n- deterministic handoff quality gap';
  assert.equal(deriveProductThesis(goals).text, 'Agent IDE makes repository handoff reliable');
  assert.equal(deriveCurrentProductBet(strategy, goals).source, '.ai/strategy.md §Current Product Bet');
  assert.equal(deriveCurrentProductBet('', goals).source, '.ai/goals.md §Current Focus');
  assert.equal(deriveCurrentProductBet('', '').text, null);
  assert.match(deriveHighestRiskAssumption(health, architecture, goals, 'deterministic handoff quality').text, /missing deterministic/);
  const evidence = deriveCurrentEvidence(health, { overallScore: 91, canonicalIntelligenceQuality: { completenessState: 'Complete' } }, [{ outcome: 'implemented', promptQuality: 'worked', recommendationTitle: 'Handoff ready' }], '## Active Decisions\nlocal-first deterministic no LLM', '## Prioritized Backlog\n- Improve deterministic handoff', 'handoff');
  assert.ok(evidence.supports.length >= 3);
  assert.ok([...evidence.supports, ...evidence.weakens, ...evidence.unknown].every((item) => item.source));
  assert.equal(deriveHighestLeverageMilestone(strategy, goals, []).source, '.ai/strategy.md §Current Experiment');
  assert.equal(deriveHighestLeverageMilestone('## Current Experiment\nAdd tests', goals, []).milestoneIsTaskWarning, true);
  assert.equal(deriveRepositoryAlignment({ selectedIssue: { id: 'x', title: 'Improve deterministic handoff quality', evidence: 'handoff quality adoption', actionability: 'code-fixable' } }, 'deterministic handoff quality adoption', '').verdict, 'Strong Alignment');
  assert.equal(deriveRepositoryAlignment({ selectedIssue: { id: 'x', title: 'Fix tests', evidence: '', actionability: 'manual' } }, 'deterministic handoff quality adoption', '').verdict, 'Weak Alignment');
  assert.equal(deriveRepositoryAlignment({ selectedIssue: { id: 'x', title: 'Cloud LLM ranking system', evidence: 'cloud llm ranking system', actionability: 'code-fixable' } }, 'deterministic handoff quality', 'Cloud LLM ranking system').verdict, 'No Alignment');
  assert.equal(deriveRepositoryAlignment(null, 'bet', '').verdict, 'Unknown');
  assert.equal(deriveStrategicRecommendation({ verdict: 'Strong Alignment' }, '', '', ''), null);
  assert.match(deriveStrategicRecommendation({ verdict: 'Weak Alignment' }, '## Prioritized Backlog\n- Improve deterministic handoff quality', 'deterministic handoff quality', '').alternativeDirection, /backlog/);
});

test('validation and markdown rendering expose findings', () => {
  const fields = { productThesis: { text: null, characterCount: 0 }, currentProductBet: { text: null }, highestRiskAssumption: { text: null }, currentEvidence: { supports: [], weakens: [{ text: 'x', source: '' }], unknown: [] }, highestLeverageMilestone: { milestoneIsTaskWarning: true }, repositoryAlignment: { verdict: 'Weak Alignment' }, strategicRecommendation: null };
  const findings = runValidation(fields);
  assert.ok(findings.some((f) => f.code === 'PI-V01' && f.severity === 'BLOCKING'));
  assert.ok(findings.some((f) => f.code === 'PI-V10'));
  const md = renderProductIntelligenceMd({ schemaVersion: 1, generatedAt: '2026-01-01T00:00:00.000Z', productIntelligenceState: 'blocked', ...fields, productThesis: { text: null, source: null }, currentProductBet: { text: null, source: null }, highestRiskAssumption: { text: null, source: null }, highestLeverageMilestone: { text: null, source: null, milestoneIsTaskWarning: true }, repositoryAlignment: { verdict: 'Weak Alignment', selectedCandidateTitle: 'X', explanation: 'Y' }, validationFindings: findings });
  assert.match(md, /^# Product Intelligence/);
  assert.match(md, /Not detected/);
  assert.match(md, /\| Code \| Severity/);
});

test('generateProductIntelligence writes JSON and markdown and degrades gracefully', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pi-'));
  const ai = join(dir, '.ai');
  await mkdir(ai);
  await writeFile(join(ai, 'goals.md'), '## Product Thesis\nAgent IDE makes repository handoff reliable.\n\n## Current Focus\nDeterministic handoff quality.\n\n## Success Criteria\n- Handoff readiness reaches Ready\n');
  await writeFile(join(ai, 'strategy.md'), '## Current Product Bet\nDeterministic handoff quality improves adoption.\n\n## Current Experiment\nHandoff readiness reaches Ready\n');
  await writeFile(join(ai, 'repository-health.md'), '## Risks\n- missing deterministic handoff signal\n\n## Intelligence Completeness\n- Strategy complete\n');
  await writeFile(join(ai, 'decision-ranking.json'), JSON.stringify({ selectedIssue: { id: 'x', title: 'Improve deterministic handoff quality', evidence: 'deterministic handoff quality', actionability: 'code-fixable' } }));
  const out1 = await generateProductIntelligence(dir, { generatedAt: '2026-01-01T00:00:00.000Z' });
  const json1 = await readFile(join(ai, 'product-intelligence.json'), 'utf8');
  assert.equal(JSON.parse(json1).schemaVersion, 1);
  assert.match(await readFile(join(ai, 'product-intelligence.md'), 'utf8'), /^# Product Intelligence/);
  const out2 = await generateProductIntelligence(dir, { generatedAt: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(out2, out1);
  assert.equal((await generateProductIntelligence(await mkdtemp(join(tmpdir(), 'pi-missing-')), { generatedAt: '2026-01-01T00:00:00.000Z' })).productIntelligenceState, 'blocked');
});
