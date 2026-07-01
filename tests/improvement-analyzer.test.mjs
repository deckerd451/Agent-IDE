import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { analyzeImprovements } from '../scripts/improvement-analyzer.mjs';
import { appendOutcome, readOutcomeEvidence } from '../scripts/outcomes.mjs';
import { chooseNextImprovement, chooseNextImprovementWithCandidates, renderPrompt, stableContextPackageHash } from '../scripts/next-improvement.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const healthyQuality = {
  coverage: { goalsPresent: true, strategyPresent: true, architecturePresent: true, decisionsPresent: true, validationPresent: true, backlogPresent: true, repositoryHealthPresent: true, agentsPresent: true, codePresent: true },
  consistency: { contradictions: [], duplicatedSections: [] },
  canonicalIntelligenceQuality: { score: 92, strategyFields: { classification: 'Present', percent: 100, requiredFields: [] } },
  generatedExportQuality: { score: 94 },
  confidence: { score: 88, validationConfidence: 'High' },
  freshness: { canonicalStaleDocuments: [] },
};

const healthyArgs = {
  health: '# Repository Health\n\n## Risks\n- No repository health risks detected.\n',
  quality: healthyQuality,
  backlog: '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n',
  strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n',
  contextPackage: '# Context Package\nReady.\n',
  audit: '',
  goals: '',
};

const executionModelWithOwnershipRisk = `# Execution Model

## Sources of Truth

| Concept | Canonical Owner | Notes |
|---|---|---|
| Product Intent | .ai/goals.md | — |

### Ownership Risks

- Detected: "localStorage client server"
- Potential multiple ownership: Product Intent

## Architectural Risks

- **Implicit or session-scoped persistence detected in decisions: "localStorage"**
  - Category: Persistence
  - Evidence: .ai/decisions.md
`;

const executionModelWithoutRisks = `# Execution Model

## Sources of Truth

| Concept | Canonical Owner | Notes |
|---|---|---|
| Product Intent | .ai/goals.md | — |

## Architectural Risks

- No architectural risks detected from available intelligence.

## Execution Confidence

- Overall Confidence: **High** (90% of intelligence files present)
`;

const decisionsWithLocalStorage = `# Decisions

## Active Decisions
- All generators must be deterministic
- Validation completions stored in localStorage for client-side persistence
`;

// ---------------------------------------------------------------------------
// analyzeImprovements unit tests
// ---------------------------------------------------------------------------

test('analyzeImprovements returns empty array when all docs are empty', () => {
  const results = analyzeImprovements({});
  assert.deepEqual(results, []);
});

test('analyzeImprovements detects localStorage as implicit-state improvement', () => {
  const results = analyzeImprovements({ decisions: decisionsWithLocalStorage });
  assert.ok(results.length > 0, 'Should detect localStorage as improvement');
  const implicit = results.find((r) => r.category === 'implicit-state');
  assert.ok(implicit, 'Should produce implicit-state candidate');
  assert.equal(implicit.class, 'improvement');
  assert.ok(implicit.evidence.includes('localStorage'), 'Evidence must cite localStorage');
  assert.equal(implicit.source, '.ai/decisions.md');
});

test('analyzeImprovements detects execution-model ownership risks', () => {
  const results = analyzeImprovements({ executionModel: executionModelWithOwnershipRisk });
  const ownership = results.filter((r) => r.category === 'ownership-clarification');
  assert.ok(ownership.length > 0, 'Should detect ownership risks');
  assert.ok(ownership.every((r) => r.class === 'improvement'));
  assert.ok(ownership.every((r) => r.evidence.includes('execution-model.md')));
});

test('analyzeImprovements detects execution-model persistence architectural risk', () => {
  const results = analyzeImprovements({ executionModel: executionModelWithOwnershipRisk });
  const persistence = results.find((r) => r.category === 'implicit-state' || /persistence/i.test(r.category));
  // Either from decisions.md or from exec model risks
  // In this case only executionModel is provided — expect exec model risk
  const execRisk = results.find((r) => r.id.startsWith('exec-model-risk'));
  assert.ok(execRisk, 'Should detect exec-model architectural risk');
  assert.equal(execRisk.class, 'improvement');
  assert.ok(execRisk.evidence.includes('localStorage') || execRisk.evidence.includes('persistence'), 'Risk must cite evidence');
});

test('analyzeImprovements skips Repository Health and Missing Intelligence categories from exec model', () => {
  const executionModelWithHealthRisk = `# Execution Model

## Architectural Risks

- **Context package grows stale if not refreshed**
  - Category: Repository Health
  - Evidence: .ai/repository-health.md (Risks)

- **1 generated intelligence files not present: intelligence-quality.json**
  - Category: Missing Intelligence
  - Evidence: .ai/ directory
`;
  const results = analyzeImprovements({ executionModel: executionModelWithHealthRisk });
  const execRisks = results.filter((r) => r.id.startsWith('exec-model-risk'));
  assert.equal(execRisks.length, 0, 'Repository Health and Missing Intelligence risks must not become improvement candidates');
});

test('analyzeImprovements detects technical debt in backlog', () => {
  const backlog = `# Backlog\n\n## Prioritized Backlog\n- Refactor the authentication flow\n- Add new feature\n- Technical debt: clean up legacy state machine\n`;
  const results = analyzeImprovements({ backlog });
  const debt = results.find((r) => r.id === 'technical-debt');
  assert.ok(debt, 'Should detect technical debt');
  assert.equal(debt.class, 'improvement');
  assert.ok(debt.evidence.includes('backlog.md'));
});

test('analyzeImprovements does not flag normal backlog items as technical debt', () => {
  const backlog = `# Backlog\n\n## Prioritized Backlog\n- Add user authentication\n- Improve performance\n- Write better tests\n`;
  const results = analyzeImprovements({ backlog });
  const debt = results.find((r) => r.id === 'technical-debt');
  assert.equal(debt, undefined, 'Normal backlog items must not become debt candidates');
});

test('analyzeImprovements detects strategic drift when product bet absent from architecture', () => {
  // Use bet words that are deliberately absent from architecture and backlog
  const strategy = `# Strategy\n\n## Current Product Bet\nCollaborative multi-user editing with conflict resolution.\n`;
  const architecture = `# Architecture\n\n## Core Systems\n- Server: HTTP API\n- Client: React SPA\n\n## Primary Flows\n- User connects local files → shows improvements\n`;
  const results = analyzeImprovements({ strategy, architecture, backlog: '' });
  const drift = results.find((r) => r.id === 'strategic-drift');
  assert.ok(drift, 'Should detect strategic drift');
  assert.equal(drift.class, 'improvement');
  assert.ok(drift.evidence.includes('strategy.md'));
  assert.ok(drift.evidence.includes('architecture.md'));
});

test('analyzeImprovements does not flag drift when bet words appear in architecture', () => {
  const strategy = `# Strategy\n\n## Current Product Bet\nServer-side deterministic intelligence pipeline.\n`;
  const architecture = `# Architecture\n\n## Core Systems\n- Server: HTTP API for intelligence\n- Pipeline: Deterministic generators\n`;
  const results = analyzeImprovements({ strategy, architecture, backlog: '' });
  const drift = results.find((r) => r.id === 'strategic-drift');
  assert.equal(drift, undefined, 'Must not flag drift when bet appears in architecture');
});

test('analyzeImprovements deduplicates by evidence fingerprint', () => {
  // Both decisions and executionModel mention localStorage — should not produce two identical candidates
  const docs = {
    decisions: decisionsWithLocalStorage,
    executionModel: executionModelWithOwnershipRisk,
  };
  const results = analyzeImprovements(docs);
  const evidenceKeys = results.map((r) => r.evidence.toLowerCase().slice(0, 120));
  const uniqueKeys = new Set(evidenceKeys);
  assert.equal(evidenceKeys.length, uniqueKeys.size, 'All candidates must have unique evidence fingerprints');
});

test('analyzeImprovements is deterministic across two calls with identical inputs', () => {
  const docs = {
    decisions: decisionsWithLocalStorage,
    executionModel: executionModelWithOwnershipRisk,
    backlog: '# Backlog\n\n## Prioritized Backlog\n- Refactor legacy state management\n',
  };
  const first = analyzeImprovements(docs);
  const second = analyzeImprovements(docs);
  assert.deepEqual(
    first.map((c) => c.id),
    second.map((c) => c.id),
    'analyzeImprovements must return identical candidate order for identical inputs',
  );
  assert.deepEqual(
    first.map((c) => c.evidence),
    second.map((c) => c.evidence),
    'analyzeImprovements must return identical evidence for identical inputs',
  );
});

test('every improvement candidate has required fields and cites .ai/ evidence', () => {
  const docs = {
    decisions: decisionsWithLocalStorage,
    executionModel: executionModelWithOwnershipRisk,
    backlog: '# Backlog\n\n## Prioritized Backlog\n- Refactor legacy state management\n',
  };
  const results = analyzeImprovements(docs);
  for (const candidate of results) {
    assert.equal(candidate.class, 'improvement', `${candidate.id} must have class:'improvement'`);
    assert.ok(candidate.id, `Candidate must have id`);
    assert.ok(candidate.title, `${candidate.id} must have title`);
    assert.ok(candidate.evidence, `${candidate.id} must have evidence`);
    assert.ok(candidate.reason, `${candidate.id} must have reason`);
    assert.ok(candidate.recommendedAction, `${candidate.id} must have recommendedAction`);
    assert.ok(candidate.source.includes('.ai/') || candidate.source.includes('architecture') || candidate.source.includes('strategy'),
      `${candidate.id} evidence must cite a repository intelligence source`);
  }
});

// ---------------------------------------------------------------------------
// Integration: chooseNextImprovement priority tests
// ---------------------------------------------------------------------------

test('healthy repository with localStorage in decisions prefers improvement over ai-handoff-validation', () => {
  const selected = chooseNextImprovement({
    ...healthyArgs,
    decisions: decisionsWithLocalStorage,
  });
  assert.equal(selected.class, 'improvement', 'Should select an improvement, not maintenance');
  assert.notEqual(selected.id, 'ai-handoff-validation', 'ai-handoff-validation must be suppressed when improvements exist');
  assert.ok(selected.evidence.includes('localStorage'), 'Selected improvement must cite localStorage evidence');
});

test('healthy repository with execution-model ownership risk prefers improvement over maintenance', () => {
  const selected = chooseNextImprovement({
    ...healthyArgs,
    executionModel: executionModelWithOwnershipRisk,
  });
  assert.equal(selected.class, 'improvement');
  assert.notEqual(selected.id, 'ai-handoff-validation');
  assert.notEqual(selected.id, 'validation');
  assert.notEqual(selected.id, 'handoff-readiness');
});

test('validation recommendation is suppressed when a meaningful architectural improvement exists', () => {
  // Even with low validation confidence, improvements win
  const selected = chooseNextImprovement({
    ...healthyArgs,
    quality: { ...healthyQuality, confidence: { score: 40, validationConfidence: 'Low' } },
    decisions: decisionsWithLocalStorage,
  });
  assert.equal(selected.class, 'improvement', 'Improvement must beat validation maintenance');
  assert.notEqual(selected.id, 'validation', 'Validation maintenance must be suppressed');
});

test('maintenance recommendation appears when no improvements exist and health is clean', () => {
  // No architectural docs → no improvements → maintenance
  const selected = chooseNextImprovement({ ...healthyArgs });
  assert.ok(selected.class === 'maintenance' || selected.id === 'ai-handoff-validation',
    'Should fall back to maintenance when no improvements detected');
});

test('maintenance candidate appears in candidate list even when improvements dominate', () => {
  const { candidates } = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    decisions: decisionsWithLocalStorage,
  });
  const hasImprovement = candidates.some((c) => c.class === 'improvement');
  const hasMaintenance = candidates.some((c) => c.class === 'maintenance');
  assert.ok(hasImprovement, 'Candidate list must include improvement');
  assert.ok(hasMaintenance, 'Candidate list must still include maintenance candidates');
  // But improvements must rank first
  assert.equal(candidates[0].class, 'improvement', 'First candidate must be an improvement');
});

test('execution-model risks can become repository improvements and rank first', () => {
  const { selectedIssue, candidates } = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    executionModel: executionModelWithOwnershipRisk,
  });
  assert.equal(selectedIssue.class, 'improvement');
  const improvementIds = candidates.filter((c) => c.class === 'improvement').map((c) => c.id);
  assert.ok(improvementIds.length > 0, 'At least one improvement from execution-model risks');
  assert.ok(improvementIds.some((id) => id.startsWith('ownership-risk') || id.startsWith('exec-model-risk')),
    'Improvement must originate from execution-model analysis');
});

test('identical repositories always produce identical recommendations', () => {
  const docsA = { ...healthyArgs, decisions: decisionsWithLocalStorage, executionModel: executionModelWithOwnershipRisk };
  const docsB = { ...healthyArgs, decisions: decisionsWithLocalStorage, executionModel: executionModelWithOwnershipRisk };
  const a = chooseNextImprovement(docsA);
  const b = chooseNextImprovement(docsB);
  assert.equal(a.id, b.id, 'Same inputs must produce same recommendation id');
  assert.equal(a.title, b.title, 'Same inputs must produce same recommendation title');
  assert.equal(a.class, b.class, 'Same inputs must produce same recommendation class');
});

test('recommendation ordering remains deterministic across multiple calls', () => {
  const args = { ...healthyArgs, decisions: decisionsWithLocalStorage, executionModel: executionModelWithOwnershipRisk };
  const r1 = chooseNextImprovementWithCandidates(args);
  const r2 = chooseNextImprovementWithCandidates(args);
  assert.deepEqual(
    r1.candidates.map((c) => c.id),
    r2.candidates.map((c) => c.id),
    'Candidate order must be identical across repeated calls',
  );
});

test('improvement issues include details with problem/requirements/acceptance for prompt rendering', () => {
  const { selectedIssue } = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    decisions: decisionsWithLocalStorage,
  });
  assert.equal(selectedIssue.class, 'improvement');
  assert.ok(selectedIssue.details, 'Improvement must carry inline details');
  assert.ok(selectedIssue.details.problem, 'details.problem must be present');
  assert.ok(Array.isArray(selectedIssue.details.requirements), 'details.requirements must be array');
  assert.ok(selectedIssue.details.acceptance.length > 0, 'details.acceptance must be non-empty');
});

test('improvement prompt renders with correct title, evidence, and category', () => {
  const { selectedIssue, decisionRanking } = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    decisions: decisionsWithLocalStorage,
  });
  const prompt = renderPrompt({ selectedIssue, decisionRanking });
  assert.match(prompt, new RegExp(selectedIssue.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(prompt, /## Implementation Instructions/);
  assert.match(prompt, /local-first/i);
  assert.match(prompt, /deterministic/i);
  assert.match(prompt, /no LLM calls/i);
});

test('no improvement is produced for a repository with clean decisions and no exec model', () => {
  const cleanDecisions = `# Decisions\n\n## Active Decisions\n- All generators must be deterministic.\n- Use disk-based storage only.\n`;
  const results = analyzeImprovements({
    decisions: cleanDecisions,
    executionModel: executionModelWithoutRisks,
    backlog: '# Backlog\n\n## Prioritized Backlog\n- Add feature A.\n- Fix bug B.\n',
    strategy: `# Strategy\n\n## Current Product Bet\nDeterministic intelligence pipeline.\n`,
    architecture: `# Architecture\n\n## Core Systems\n- Server\n- Client\n\n## Primary Flows\n- User → deterministic pipeline → intelligence\n`,
  });
  // Only skip if architecture uses words matching strategy ("deterministic" appears in both)
  // and no debt/persistence patterns exist
  const improvementIds = results.map((r) => r.id);
  assert.ok(!improvementIds.includes('technical-debt'), 'Normal backlog items must not become debt');
  assert.ok(!improvementIds.some((id) => id.startsWith('exec-model-risk')), 'Clean exec model must not produce risks');
  assert.ok(!improvementIds.some((id) => id.startsWith('implicit-persistence')), 'Clean decisions must not produce persistence risks');
});

test('skipped Xcode validation on Linux suppresses same recommendation for same snapshot and promotes next candidate', () => {
  const contextPackage = '# Context Package\nXcode app snapshot.\n';
  const snapshot = stableContextPackageHash(contextPackage);
  const { candidates } = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    contextPackage,
    validation: '# Validation\n\n## Known Validation Gaps\n- Full simulator/device build requires xcodebuild.\n',
    intelligenceVerification: '# Intelligence Verification\n\n## Findings\n- Document the local environment prerequisite for simulator validation.\n',
    outcomeEntries: [{
      timestamp: '2026-07-01T00:00:00.000Z',
      recommendationId: 'validation-full-simulator-device-build-requires-xcodebuild',
      recommendationTitle: 'Full simulator/device build requires xcodebuild',
      outcome: 'skipped',
      promptQuality: 'worked',
      userNote: 'Linux without xcodebuild/xcrun',
      repositoryIntelligenceSnapshotHash: snapshot,
    }],
  });
  const xcodeCandidate = candidates.find((candidate) => candidate.id === 'validation-full-simulator-device-build-requires-xcodebuild');
  assert.equal(xcodeCandidate, undefined, 'same skipped local-tooling recommendation must be absent from eligible candidates');
  assert.notEqual(candidates[0]?.id, 'validation-full-simulator-device-build-requires-xcodebuild', 'selection must advance to next ranked candidate');
  assert.ok(candidates[0], 'next eligible candidate should be promoted');
  assert.ok(candidates[0].advancementSuppressedCandidates.some((candidate) => candidate.id === 'validation-full-simulator-device-build-requires-xcodebuild'));
});

test('selected issue persists snapshot hashes and recorded unavailable tooling outcome suppresses same validation recommendation', async () => {
  const contextPackage = '# Context Package\nXcode app snapshot.\n';
  const snapshot = stableContextPackageHash(contextPackage);
  const first = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    contextPackage,
    validation: '# Validation\n\n## Known Validation Gaps\n- Full simulator/device build requires xcodebuild.\n',
  });
  assert.equal(first.decisionRanking.selectedIssue.repositoryIntelligenceSnapshotHash, snapshot);
  assert.equal(first.candidates[0].repositoryIntelligenceSnapshotHash, snapshot);

  const repo = await mkdtemp(join(tmpdir(), 'agent-ide-outcome-'));
  try {
    await appendOutcome(repo, {
      recommendationId: first.decisionRanking.selectedIssue.id,
      recommendationTitle: first.decisionRanking.selectedIssue.title,
      repositoryIntelligenceSnapshotHash: first.decisionRanking.selectedIssue.repositoryIntelligenceSnapshotHash,
      outcome: 'skipped',
      promptQuality: 'worked',
      userNote: 'Linux without xcodebuild/xcrun',
      refreshAfterCompletion: true,
    });
    const outcomeEntries = (await readOutcomeEvidence(repo)).entries;
    assert.equal(outcomeEntries[0].repositoryIntelligenceSnapshotHash, snapshot);
    assert.equal(outcomeEntries[0].contextPackageHash, snapshot);

    const refreshed = chooseNextImprovementWithCandidates({
      ...healthyArgs,
      contextPackage,
      validation: '# Validation\n\n## Known Validation Gaps\n- Full simulator/device build requires xcodebuild.\n',
      intelligenceVerification: '# Intelligence Verification\n\n## Findings\n- Document the local environment prerequisite for simulator validation.\n',
      outcomeEntries,
    });
    assert.equal(refreshed.candidates.find((candidate) => candidate.id === first.decisionRanking.selectedIssue.id), undefined);
    assert.ok(refreshed.candidates[0].advancementSuppressedCandidates.some((candidate) => candidate.id === first.decisionRanking.selectedIssue.id));
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});


test('backticked xcodebuild skipped outcome suppresses plain xcodebuild recommendation for same snapshot', () => {
  const contextPackage = '# Context Package\nXcode app snapshot.\n';
  const snapshot = stableContextPackageHash(contextPackage);
  const { candidates } = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    contextPackage,
    validation: '# Validation\n\n## Known Validation Gaps\n- Full simulator/device build: Not run by default; no full xcodebuild.\n',
    intelligenceVerification: '# Intelligence Verification\n\n## Findings\n- Document the local environment prerequisite for simulator validation.\n',
    outcomeEntries: [{
      timestamp: '2026-07-01T00:00:00.000Z',
      recommendationId: 'validation-full-simulator-device-build-not-run-by-default-no-full',
      recommendationTitle: 'Full simulator/device build: Not run by default; no full `xcodebuild`',
      outcome: 'skipped',
      promptQuality: 'worked',
      userNote: 'Linux without xcodebuild/xcrun',
      repositoryIntelligenceSnapshotHash: snapshot,
    }],
  });

  assert.equal(
    candidates.find((candidate) => candidate.title === 'Full simulator/device build: Not run by default; no full xcodebuild'),
    undefined,
    'same unavailable-tooling outcome with normalized title must suppress the plain-title recommendation',
  );
  assert.ok(candidates[0].advancementSuppressedCandidates.some((candidate) => candidate.title === 'Full simulator/device build: Not run by default; no full xcodebuild'));
});

test('different validation titles do not suppress each other for same snapshot', () => {
  const contextPackage = '# Context Package\nXcode app snapshot.\n';
  const snapshot = stableContextPackageHash(contextPackage);
  const { candidates } = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    contextPackage,
    validation: '# Validation\n\n## Known Validation Gaps\n- Full simulator/device build: Not run by default; no full xcodebuild.\n- Document the local environment prerequisite for simulator validation.\n',
    outcomeEntries: [{
      timestamp: '2026-07-01T00:00:00.000Z',
      recommendationId: 'validation-document-the-local-environment-prerequisite-for-simulator-validation',
      recommendationTitle: 'Document the local environment prerequisite for simulator validation',
      outcome: 'skipped',
      promptQuality: 'worked',
      userNote: 'Linux without xcodebuild/xcrun',
      repositoryIntelligenceSnapshotHash: snapshot,
    }],
  });

  assert.ok(
    candidates.some((candidate) => candidate.title === 'Full simulator/device build: Not run by default; no full xcodebuild'),
    'different validation titles must not be suppressed by an unrelated unavailable-tooling skip',
  );
});

test('skipped Xcode validation is not suppressed after repository intelligence snapshot changes', () => {
  const { candidates } = chooseNextImprovementWithCandidates({
    ...healthyArgs,
    contextPackage: '# Context Package\nMeaningfully changed Xcode app snapshot.\n',
    validation: '# Validation\n\n## Known Validation Gaps\n- Full simulator/device build requires xcodebuild.\n',
    outcomeEntries: [{
      timestamp: '2026-07-01T00:00:00.000Z',
      recommendationId: 'validation-full-simulator-device-build-requires-xcodebuild',
      recommendationTitle: 'Full simulator/device build requires xcodebuild',
      outcome: 'skipped',
      promptQuality: 'worked',
      userNote: 'Linux without xcodebuild/xcrun',
      repositoryIntelligenceSnapshotHash: 'different-snapshot',
    }],
  });
  assert.ok(candidates.some((candidate) => candidate.id === 'validation-full-simulator-device-build-requires-xcodebuild'), 'changed snapshot must allow recommendation to reappear');
});
