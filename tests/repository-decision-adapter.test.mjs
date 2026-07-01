import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRepositoryDecision, createRepositoryDecisionFromArtifacts } from '../src/repository-decision.ts';
import { repositoryIntelligenceStatus, renderRepositoryIntelligence } from '../terminal/decision-status.mjs';

const fixture = {
  status: { repositoryName: 'Nearify', overallHealth: 'Healthy', repositoryHandoffReadiness: 'Ready', currentConfidence: 'High' },
  recommendation: { displayTitle: 'Add outcome evidence capture', packageType: 'implementation', explanation: 'Outcome evidence improves refresh quality.' },
  selectedCandidate: { id: 'outcome', title: 'Add outcome evidence capture', reason: 'Outcome evidence improves refresh quality.', packageType: 'implementation', selected: true },
  quality: { confidence: { score: 88 } },
  aiHandoffValidation: { status: 'Ready', overallScore: 91 },
};

test('browser and terminal receive identical RepositoryDecision values from shared adapter', async () => {
  const browserDecision = createRepositoryDecision(fixture);
  const dir = await mkdir(join(tmpdir(), `repo-decision-${Date.now()}`), { recursive: true });
  await mkdir(join(dir, '.ai'), { recursive: true });
  await writeFile(join(dir, '.ai', 'intelligence-snapshot.json'), JSON.stringify(fixture.status));
  await writeFile(join(dir, '.ai', 'active-recommendation.json'), JSON.stringify(fixture.recommendation));
  await writeFile(join(dir, '.ai', 'decision-ranking.json'), JSON.stringify({ selectedIssue: fixture.selectedCandidate, candidates: [fixture.selectedCandidate] }));
  await writeFile(join(dir, '.ai', 'intelligence-quality.json'), JSON.stringify(fixture.quality));
  await writeFile(join(dir, '.ai', 'ai-handoff-validation.json'), JSON.stringify(fixture.aiHandoffValidation));
  const terminalDecision = await repositoryIntelligenceStatus(dir);
  assert.deepEqual(terminalDecision, browserDecision);
});

test('RepositoryDecision adapter is read-only and deterministic', () => {
  const first = createRepositoryDecision(fixture);
  const second = createRepositoryDecision(structuredClone(fixture));
  assert.deepEqual(second, first);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.executionAgents), true);
  assert.throws(() => { first.selectedDecision = 'Changed'; }, TypeError);
});

test('terminal rendering consumes adapter fields without independent decision aliases', () => {
  const decision = createRepositoryDecisionFromArtifacts({ ...fixture, activeRecommendation: fixture.recommendation, decisionRanking: { candidates: [fixture.selectedCandidate] } });
  const rendered = renderRepositoryIntelligence(decision);
  assert.match(rendered, /Decision:\s+Add outcome evidence capture/);
  assert.match(rendered, /Package type:\s+implementation/);
  assert.match(rendered, /Confidence:\s+High/);
  assert.equal('decision' in decision, false);
  assert.equal('agents' in decision, false);
});

test('browser behavior keeps existing decision wording', () => {
  const decision = createRepositoryDecision(fixture);
  assert.equal(decision.repositoryStatus, 'Nearify · Healthy · Ready · High');
  assert.equal(decision.selectedDecision, 'Add outcome evidence capture');
  assert.equal(decision.decisionSummary, 'Outcome evidence improves refresh quality.');
  assert.equal(decision.recommendedOwnerAction, 'Refresh repository intelligence');
});
