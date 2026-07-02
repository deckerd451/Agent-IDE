import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNextImprovementWithCandidates, expandRecommendationCandidates, renderPrompt } from '../scripts/next-improvement.mjs';

const healthyQuality = {
  coverage: { goalsPresent: true, strategyPresent: true, architecturePresent: true, decisionsPresent: true, validationPresent: true, backlogPresent: true, repositoryHealthPresent: true, agentsPresent: true, codePresent: true },
  confidence: { score: 90, validationConfidence: 'High' },
  generatedExportQuality: { score: 90 },
  canonicalIntelligenceQuality: { score: 90, fields: { manualGoals: { percent: 100, state: 'Complete' } }, strategyFields: { requiredFields: [] } },
  consistency: { contradictions: [], duplicatedSections: [] },
  freshness: { canonicalStaleDocuments: [] },
};

const health = '# Repository Health\n\n## Risks\n- No repository health risks detected.\n';
const contextPackage = '# Context Package\nReady.\n';

function outcomeFor(id, title) {
  return { timestamp: '2026-06-28T00:00:00.000Z', recommendationId: id, recommendationTitle: title, outcome: 'implemented', promptQuality: 'worked' };
}

test('candidate expansion extracts multiple deterministic candidates from source artifacts', () => {
  const candidates = expandRecommendationCandidates({
    backlog: '# Backlog\n\n## Prioritized Backlog\n- Add offline retry tests for refresh.\n- Improve recommendation trace filtering.\n',
    strategy: '# Strategy\n\n## Next Strategic Moves\n- Surface source reasons in Do Next.\n',
    health: '# Health\n\n## Weaknesses\n- Remediate stale validation docs.\n',
  });

  assert.ok(candidates.length >= 4);
  assert.deepEqual(candidates.slice(0, 2).map((candidate) => candidate.source), ['.ai/backlog.md Prioritized Backlog', '.ai/backlog.md Prioritized Backlog']);
});

test('implemented candidate is suppressed and next eligible expanded candidate is selected', () => {
  const backlog = '# Backlog\n\n## Prioritized Backlog\n- Add offline retry tests for refresh.\n- Improve recommendation trace filtering.\n';
  const first = expandRecommendationCandidates({ backlog })[0];
  const result = chooseNextImprovementWithCandidates({ health, quality: healthyQuality, backlog, strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n', contextPackage, outcomeEntries: [outcomeFor(first.id, first.title)] });

  assert.notEqual(result.selectedIssue.id, first.id);
  assert.equal(result.selectedIssue.title, 'Improve recommendation trace filtering');
  assert.ok(result.decisionRanking.advancement.suppressedCandidates.some((candidate) => candidate.id === first.id));
});

test('positive empty state is selected when all expanded candidates are implemented and satisfied', () => {
  const backlog = '# Backlog\n\n## Prioritized Backlog\n- Add offline retry tests for refresh.\n';
  const [first] = expandRecommendationCandidates({ backlog });
  const result = chooseNextImprovementWithCandidates({ health, quality: healthyQuality, backlog, strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n', contextPackage, outcomeEntries: [outcomeFor(first.id, first.title)] });

  assert.equal(result.selectedIssue.title, 'No eligible next improvement found.');
});

// Backlog-sourced items whose reason text leaks into next-improvement expansion must not
// carry the diagnostic prefix in the display title.
const diagnosticPrefix = 'Repository documentation identifies actionable follow-up work from:';
const diagnosticBacklog = [
  '# Backlog',
  '',
  '## Prioritized Backlog',
  `- **Add Backlog Quality Filtering**`,
  `  - Source: .ai/goals.md`,
  `  - Reason: ${diagnosticPrefix} Add backlog quality filtering`,
  `  - Suggested Next Step: Define the smallest local change needed to add backlog quality filtering.`,
].join('\n');

test('backlog candidate expansion emits an actionable title without the diagnostic prefix', () => {
  const candidates = expandRecommendationCandidates({ backlog: diagnosticBacklog });
  const affected = candidates.filter((c) => /backlog quality/i.test(c.title + c.evidence));
  assert.ok(affected.length > 0, 'expected at least one candidate referencing backlog quality');
  for (const c of affected) {
    assert.ok(
      !c.title.includes(diagnosticPrefix),
      `title must not contain diagnostic prefix; got: "${c.title}"`,
    );
  }
});

test('original diagnostic text is preserved in the evidence field of the expanded candidate', () => {
  const candidates = expandRecommendationCandidates({ backlog: diagnosticBacklog });
  const affected = candidates.filter((c) => /backlog quality/i.test(c.title + c.evidence));
  assert.ok(affected.length > 0, 'expected at least one candidate referencing backlog quality');
  const hasEvidence = affected.some((c) => c.evidence.toLowerCase().includes('backlog quality'));
  assert.ok(hasEvidence, 'at least one candidate must retain the original text in evidence');
});

test('Preview Prompt heading uses the normalized title, not the diagnostic prefix', () => {
  const candidates = expandRecommendationCandidates({ backlog: diagnosticBacklog });
  const candidate = candidates.find((c) => /backlog quality/i.test(c.title + c.evidence));
  assert.ok(candidate, 'expected a candidate referencing backlog quality');
  assert.ok(!candidate.title.includes(diagnosticPrefix), 'candidate title must be normalized before prompt render');
  const prompt = renderPrompt({ selectedIssue: candidate });
  assert.ok(!prompt.startsWith(`# ${diagnosticPrefix}`), 'prompt heading must not start with diagnostic prefix');
  assert.match(prompt, /^# \S/m, 'prompt must have a non-empty H1 heading');
});

const nearifyVagueBacklog = [
  '# Backlog',
  '',
  '## Prioritized Backlog',
  '- Suggested Next Step: Inspect the referenced code path, decide whether the comment still applies...',
].join('\n');

test('vague Nearify backlog suggested next step is not selected over concrete validation gaps', () => {
  const result = chooseNextImprovementWithCandidates({
    health,
    quality: { ...healthyQuality, confidence: { score: 40, validationConfidence: 'Low' } },
    backlog: nearifyVagueBacklog,
    strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n',
    contextPackage,
  });

  assert.notEqual(result.selectedIssue.title, 'Inspect the referenced code path, decide whether the comment still applies...');
  assert.equal(result.selectedIssue.id, 'validation');
  const vague = result.candidates.find((candidate) => candidate.vagueBacklogFragment);
  assert.ok(vague, 'expected downgraded vague backlog fragment to remain visible in ranking history');
  assert.match(vague.evidence, /Original backlog text preserved for comparison: Suggested Next Step: Inspect the referenced code path/);
  assert.ok(vague.rank > result.selectedIssue.rank, 'vague backlog fragment must rank below the primary validation gap');
});

test('concrete backlog quality filtering item remains selectable', () => {
  const result = chooseNextImprovementWithCandidates({
    health,
    quality: healthyQuality,
    backlog: '# Backlog\n\n## Prioritized Backlog\n- Add backlog quality filtering.\n',
    strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n',
    contextPackage,
  });

  assert.equal(result.selectedIssue.title, 'Add backlog quality filtering');
});

const nearifyConcreteBacklog = [
  '# Backlog',
  '',
  '## Prioritized Backlog',
  '- **Implement Nearify profile universal-link handoff**',
  '  - Source: Beacon/Views/Components/ContactSaveFlow.swift:69',
  '  - Reason: Repository comment marked this as Implement https://nearify.org/profile/<id> web route and universal-link handoff to Nearify app.',
  '  - Suggested Next Step: Inspect the referenced code path, decide whether the comment still applies...',
].join('\n');

test('Nearify backlog source comment expands into concrete implementation candidate', () => {
  const candidates = expandRecommendationCandidates({ backlog: nearifyConcreteBacklog });
  const candidate = candidates.find((item) => item.sourceFile === 'Beacon/Views/Components/ContactSaveFlow.swift');

  assert.ok(candidate, 'expected concrete source comment candidate');
  assert.equal(candidate.packageType, 'implementation');
  assert.equal(candidate.actionability, 'code-fixable');
  assert.equal(candidate.sourceLine, 69);
  assert.deepEqual(candidate.affectedFiles, ['Beacon/Views/Components/ContactSaveFlow.swift']);
  assert.match(candidate.source, /Beacon\/Views\/Components\/ContactSaveFlow\.swift:69/);
  assert.match(candidate.reason, /explicit implementation objective/);
  assert.match(candidate.recommendedAction, /Implement https:\/\/nearify\.org\/profile\/<id> web route and universal-link handoff to Nearify app/);
  assert.ok(candidate.details.acceptance.some((item) => /Beacon\/Views\/Components\/ContactSaveFlow\.swift:69/.test(item)));
});

test('Nearify backlog source comment renders an implementation package with location objective and acceptance criteria', () => {
  const result = chooseNextImprovementWithCandidates({
    health,
    quality: healthyQuality,
    backlog: nearifyConcreteBacklog,
    strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n',
    contextPackage,
  });
  const prompt = renderPrompt(result);

  assert.equal(result.selectedIssue.packageType, 'implementation');
  assert.notEqual(result.selectedIssue.title, 'Recommendation requires task clarification.');
  assert.match(prompt, /Beacon\/Views\/Components\/ContactSaveFlow\.swift:69/);
  assert.match(prompt, /Implement https:\/\/nearify\.org\/profile\/<id> web route and universal-link handoff to Nearify app/);
  assert.match(prompt, /## Affected Files\n- `Beacon\/Views\/Components\/ContactSaveFlow\.swift`/);
  assert.match(prompt, /## Acceptance Criteria[\s\S]*The generated package names source location Beacon\/Views\/Components\/ContactSaveFlow\.swift:69/);
});
