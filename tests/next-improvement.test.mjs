import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { chooseNextImprovement, chooseNextImprovementWithCandidates, generateNextImprovement, renderPrompt } from '../scripts/next-improvement.mjs';


const missingCurrentProductBetStrategyFields = {
  classification: 'Missing',
  percent: 0,
  requiredFields: [
    { key: 'currentProductBet', label: 'Current Product Bet', classification: 'Missing', present: false, canonicalFile: '.ai/goals.md', canonicalSection: '## Manual Strategy Notes', manualUpdate: `- Current Product Bet:
  [Repository owner: describe the primary product hypothesis currently being tested.]`, why: 'This field records the primary product hypothesis currently being tested and is required to strengthen repository strategy quality.' },
  ],
};

const healthyQuality = {
  coverage: { goalsPresent: true, strategyPresent: true, architecturePresent: true, decisionsPresent: true, validationPresent: true, backlogPresent: true, repositoryHealthPresent: true, agentsPresent: true, codePresent: true },
  consistency: { contradictions: [], duplicatedSections: [] },
  canonicalIntelligenceQuality: { score: 92, strategyFields: { classification: 'Present', percent: 100, requiredFields: [] } },
  generatedExportQuality: { score: 94 },
  confidence: { score: 88, validationConfidence: 'High' },
  freshness: { canonicalStaleDocuments: [] },
};

function choice(overrides = {}) {
  return chooseNextImprovement({ health: '# Repository Health\n\n## Risks\n- No repository health risks detected.\n', quality: healthyQuality, backlog: '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n', strategy: '# Strategy\n\n## Strategy Confidence\nHigh\n', contextPackage: '# Context Package\nReady.\n', audit: '', ...overrides });
}

function assertCoherent(selected, expected) {
  const prompt = renderPrompt(selected);
  assert.equal(selected.id, expected.id);
  assert.equal(selected.title, expected.title);
  assert.match(prompt, new RegExp(`# ${expected.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(prompt, new RegExp(`ID: ${expected.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(prompt, new RegExp(`Category: ${expected.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
  assert.match(prompt, expected.evidencePattern);
  assert.match(prompt, expected.problemPattern);
  assert.match(prompt, expected.acceptancePattern);
  return prompt;
}

test('missing manual goals produces coherent manual-goals prompt', () => {
  const selected = choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } });
  const prompt = assertCoherent(selected, {
    id: 'missing-manual-goals',
    title: 'Complete Manual Repository Intent Notes',
    category: 'missing manual goals',
    evidencePattern: /Manual Goals are missing/i,
    problemPattern: /missing populated Manual Goals/i,
    acceptancePattern: /missing Manual Goals fields identified by the deterministic evaluation have been completed/i,
  });
  assert.doesNotMatch(prompt, /severe backlog noise/i);
});

test('backlog noise produces coherent backlog prompt', () => {
  const manyItems = Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n');
  const selected = choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${manyItems}\n` });
  const prompt = assertCoherent(selected, {
    id: 'backlog-noise',
    title: 'Reduce Backlog Noise',
    category: 'backlog filtering bugs',
    evidencePattern: /Backlog contains 26 items/i,
    problemPattern: /backlog contains severe noise/i,
    acceptancePattern: /Backlog noise is removed, merged, or downgraded/i,
  });
  assert.doesNotMatch(prompt, /Fill in `\.ai\/goals\.md`/i);
});

test('strategy gap produces coherent strategy prompt', () => {
  const selected = choice({ quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50, strategyFields: missingCurrentProductBetStrategyFields } }, strategy: '# Strategy\n\n## Strategy Confidence\nLow\n' });
  assertCoherent(selected, {
    id: 'strategy-quality',
    title: 'Add Current Product Bet',
    category: 'fill strategy manual notes',
    evidencePattern: /Missing: Current Product Bet/i,
    problemPattern: /Strategy quality is weak or under-evidenced/i,
    acceptancePattern: /Regenerated strategy no longer reports/i,
  });
});

test('no serious issue produces AI handoff validation prompt', () => {
  const selected = choice();
  const prompt = assertCoherent(selected, {
    id: 'ai-handoff-validation',
    title: 'Run AI Handoff Validation',
    category: 'AI handoff validation',
    evidencePattern: /No serious repository intelligence issue detected/i,
    problemPattern: /No serious repository intelligence issue is detected/i,
    acceptancePattern: /AI handoff validation is documented/i,
  });
  assert.doesNotMatch(prompt, /unless adding or documenting a validation workflow[\s\S]*Update the smallest set of source files/i);
});

test('no prompt contains title/evidence/category mismatch', () => {
  const scenarios = [
    choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } }),
    choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }),
    choice({ quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50, strategyFields: missingCurrentProductBetStrategyFields } }, strategy: '# Strategy\n\n## Strategy Confidence\nLow\n' }),
    choice(),
  ];

  for (const selected of scenarios) {
    const prompt = renderPrompt(selected);
    assert.match(prompt, new RegExp(`# ${selected.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    assert.match(prompt, new RegExp(`Category: ${selected.category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
    assert.match(prompt, new RegExp(selected.evidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    if (selected.id !== 'missing-manual-goals') assert.doesNotMatch(prompt, /Manual Goals are missing|Manual Goals are populated/i);
    if (selected.id !== 'backlog-noise') assert.doesNotMatch(prompt, /Backlog contains \d+ items|Backlog noise is removed/i);
    if (selected.id !== 'strategy-quality') assert.doesNotMatch(prompt, /Strategy Confidence: Low|Strategy intelligence describes/i);
  }
});


test('strategy manual gap does not beat code-fixable backlog issue', () => {
  const manyItems = Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n');
  const selected = choice({
    quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50, strategyFields: missingCurrentProductBetStrategyFields } },
    strategy: '# Strategy\n\n## Strategy Confidence\nLow\n',
    backlog: `# Backlog\n\n## Prioritized Backlog\n${manyItems}\n`,
  });
  assert.equal(selected.id, 'backlog-noise');
  assert.equal(selected.actionability, 'code-fixable');
});

test('missing manual goals is marked manual', () => {
  const selected = choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } });
  assert.equal(selected.actionability, 'manual');
});

test('code-fixable contradiction is selected before manual strategy note', () => {
  const selected = choice({
    quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50 }, consistency: { contradictions: ['Goals contradict strategy.'], duplicatedSections: [] } },
    strategy: '# Strategy\n\n## Strategy Confidence\nLow\n',
  });
  assert.equal(selected.id, 'consistency-cleanup');
  assert.equal(selected.actionability, 'code-fixable');
});

test('manual issue prompt includes manual-task warning', () => {
  const selected = choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } });
  assert.match(renderPrompt(selected), /This is a product-owner decision task, not a Codex implementation task\./);
});

test('no code-fixable issues produces AI handoff validation', () => {
  const selected = choice();
  assert.equal(selected.id, 'ai-handoff-validation');
  assert.equal(selected.actionability, 'validation-experiment');
});

test('prompt includes constraints', () => {
  const prompt = renderPrompt(choice());
  for (const expected of ['local-first', 'deterministic', 'no LLM calls', 'no cloud', 'no telemetry', 'preserve manual sections', 'keep changes small and reviewable']) {
    assert.match(prompt, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
});

test('prompt preserves deterministic/no-cloud/no-LLM language', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  assert.match(prompt, /deterministically from the selected issue/i);
  assert.match(prompt, /no cloud/i);
  assert.match(prompt, /no LLM calls/i);
});

test('implementation package includes complete deterministic lead-in', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  assert.match(prompt, /^# Reduce Backlog Noise\n\n## Implementation Instructions\nImplement this Implementation Package exactly as written\./);
  for (const expected of [
    'Use the cited repository evidence to identify the root cause before making changes.',
    'Keep the implementation narrowly scoped.',
    'Do not broaden scope beyond the selected issue.',
    'Preserve deterministic, local-first behavior.',
    'Preserve manual intelligence sections.',
    'Avoid unrelated refactoring.',
    'Use only repository-local evidence.',
    'Do not make LLM calls, use cloud services, or add telemetry.',
    'Ensure execution and validation are fully reproducible.',
  ]) {
    assert.match(prompt, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('implementation package includes expected improvement and after implementation sections', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  assert.match(prompt, new RegExp('## Expected Repository Improvement\\n- Repository Health should improve\\.\\n- Intelligence Quality should improve\\.\\n- The selected issue should disappear or downgrade\\.\\n- No new contradictions with `\\.ai/goals\\.md` should be introduced\\.'));
  assert.match(prompt, /## After Implementation\n- Refresh Repository Intelligence\.\n- Compare Repository Health before and after\.\n- Compare Intelligence Quality before and after\.\n- Verify whether the selected issue was resolved\.\n- Summarize any newly discovered issues\.\n- Generate the next Implementation Package\./);
});

test('implementation package sections render in deterministic order', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  const headings = [...prompt.matchAll(/^## .+$/gm)].map((match) => match[0]);
  assert.deepEqual(headings, [
    '## Implementation Instructions',
    '## Selected Issue',
    '## Motivation',
    '## Current Evidence',
    '## Problem',
    '## Why This Helps',
    '## Goal',
    '## Requirements',
    '## Acceptance Criteria',
    '## Testing Commands',
    '## Constraints',
    '## Expected Repository Improvement',
    '## After Implementation',
  ]);
});

test('generated implementation packages remain deterministic across repeated renders', () => {
  const selected = choice();
  assert.equal(renderPrompt(selected), renderPrompt(selected));
});

test('manual issue generates Product Decision Package', () => {
  const selected = choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } });
  const prompt = renderPrompt(selected);
  assert.equal(selected.packageType, 'product-decision');
  assert.match(prompt, /## Decision Instructions/);
  assert.match(prompt, /This is a product-owner decision task, not a Codex implementation task\./);
  assert.doesNotMatch(prompt, /Implement this exactly|Implement this Implementation Package exactly as written/);
});

test('missing manual goals package includes suggested Manual Goals text', () => {
  const prompt = renderPrompt(choice({ quality: {
    ...healthyQuality,
    canonicalIntelligenceQuality: { score: 75, fields: { manualGoals: { state: 'Partial', percent: 75, missing: ['Long-term vision'] } } },
    explanations: { completeness: { fields: { manualGoals: {
      requiredFields: [
        { label: 'Product intent', found: true, manualUpdate: '- Product intent: [Repository owner: describe the product purpose this repository should serve.]' },
        { label: 'Current focus', found: true, manualUpdate: '- Current focus: [Repository owner: describe the current product priority.]' },
        { label: 'Success criteria', found: true, manualUpdate: '- Success criteria: [Repository owner: describe how success should be judged.]' },
        { label: 'Long-term vision', found: false, manualUpdate: '- Long-term vision: [Repository owner: describe the long-term vision for this product.]' },
      ],
      computed: { percent: 75 },
      classification: 'Partial',
      missing: ['Long-term vision'],
    } } } },
  } }));
  assert.match(prompt, /`\.ai\/goals\.md` `## Manual Goals`/);
  assert.match(prompt, /Long-term vision: \[Repository owner:/);
  assert.doesNotMatch(prompt, /Product intent: \[Repository owner:/);
  assert.match(prompt, /Do not edit automatically/);
});

test('manual goals suggested update follows shared missing fields and canonical order', () => {
  const fields = [
    { label: 'Product intent', manualUpdate: '- Product intent: [Repository owner: describe the product purpose this repository should serve.]' },
    { label: 'Current focus', manualUpdate: '- Current focus: [Repository owner: describe the current product priority.]' },
    { label: 'Success criteria', manualUpdate: '- Success criteria: [Repository owner: describe how success should be judged.]' },
    { label: 'Long-term vision', manualUpdate: '- Long-term vision: [Repository owner: describe the long-term vision for this product.]' },
  ];
  const cases = [
    ['one missing field', ['Product intent']],
    ['two missing fields', ['Success criteria', 'Long-term vision']],
    ['three missing fields', ['Product intent', 'Success criteria', 'Long-term vision']],
    ['all fields missing', fields.map((field) => field.label)],
    ['no fields missing', []],
  ];
  for (const [, missing] of cases) {
    const prompt = renderPrompt({
      id: 'missing-manual-goals',
      category: 'missing manual goals',
      severity: 'high',
      actionability: 'manual',
      packageType: 'product-decision',
      source: 'Manual Goals Partial.',
      title: 'Complete Manual Repository Intent Notes',
      evidence: 'Manual Goals Partial.',
      reason: 'Manual Goals completeness is below the deterministic threshold.',
      recommendedAction: 'Complete only the incomplete Manual Goals fields in `.ai/goals.md`.',
      completenessExplanation: {
        requiredFields: fields.map((field) => ({ ...field, found: !missing.includes(field.label) })),
        missing,
        computed: { percent: missing.length ? 100 - missing.length * 25 : 100 },
        classification: missing.length ? 'Partial' : 'Complete',
        threshold: 'Complete = 100%.',
      },
    });
    const suggested = prompt.match(/## Suggested Manual Update\n([\s\S]*?)\n\n## Acceptance Criteria/)?.[1] ?? '';
    const labels = [...suggested.matchAll(/^-\s*([^:\n]+):/gm)].map((match) => match[1]);
    assert.deepEqual(labels, fields.map((field) => field.label).filter((label) => missing.includes(label)));
  }
});

test('strategy manual notes package targets canonical goals sections', () => {
  const prompt = renderPrompt(choice({ quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50, strategyFields: missingCurrentProductBetStrategyFields } }, strategy: '# Strategy\n\n## Strategy Confidence\nLow\n' }));
  assert.match(prompt, /## Missing Field\n\nCurrent Product Bet/);
  assert.match(prompt, /## Section\n\n## Manual Strategy Notes/);
  assert.match(prompt, /- Current Product Bet:\n  \[Repository owner:/);
  assert.doesNotMatch(prompt, /`\.ai\/strategy\.md` `## Manual Strategy Notes`/);
});

test('product decision packages never recommend generated artifacts as manual edit targets', () => {
  for (const selected of [
    choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } }),
    choice({ quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50, strategyFields: missingCurrentProductBetStrategyFields } }, strategy: '# Strategy\n\n## Strategy Confidence\nLow\n' }),
  ]) {
    const prompt = renderPrompt(selected);
    assert.equal(selected.packageType, 'product-decision');
    assert.match(prompt, /Repository owner edits: `\.ai\/goals\.md`\nEverything else will be regenerated/);
    assert.doesNotMatch(prompt, /Update \.ai\/(?:strategy|architecture|repository-health|context-package)\.md/i);
    assert.doesNotMatch(prompt, /edit(?:ing)?[^\n]*(?:`?\.ai\/(?:strategy|architecture|repository-health|context-package)\.md`?)/i);
  }
});

test('generated Product Decision Package keeps manual strategy edits on canonical goals', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-product-decision-'));
  await mkdir(join(dir, '.ai'), { recursive: true });
  await writeFile(join(dir, '.ai/goals.md'), '# Goals\n\n## Product Purpose\nRepository intelligence control plane.\n');
  await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n\n## Risks\n- No repository health risks detected.\n');
  await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify({ ...healthyQuality, canonicalIntelligenceQuality: { score: 50 } }, null, 2));
  await writeFile(join(dir, '.ai/intelligence-audit.md'), '# Intelligence Audit\n');
  await writeFile(join(dir, '.ai/backlog.md'), '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n');
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n\n## Strategy Confidence\nLow\n');
  await writeFile(join(dir, '.ai/context-package.md'), '# Context Package\nReady.\n');

  const result = await generateNextImprovement(dir);
  const prompt = await readFile(join(dir, '.ai/next-improvement-prompt.md'), 'utf8');

  assert.equal(result.selectedIssue.id, 'strategy-quality');
  assert.equal(result.selectedIssue.packageType, 'product-decision');
  assert.match(prompt, /Repository owner edits: `\.ai\/goals\.md`\nEverything else will be regenerated/);
  assert.match(prompt, /## Missing Field\n\nCurrent Product Bet/);
  assert.match(prompt, /## Section\n\n## Manual Strategy Notes/);
  assert.doesNotMatch(prompt, /\.ai\/strategy\.md/);
});

test('Nearify acyclic architecture refresh removes stale cyclic dependency recommendation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-nearify-cyclic-refresh-'));
  try {
    await mkdir(join(dir, '.ai'), { recursive: true });
    const nearifyArchitecture = `# Architecture

## Product Thesis
Nearify helps people find nearby friends and events.

## Current Focus
Keep BLE discovery reliable without reintroducing coordinator/peripheral ownership cycles.

## Core Systems
- BLEPeripheral: self-manages by observing coordinator events.
- BLECoordinator: owns scan orchestration and publishes events.
- NearbyDiscovery: turns BLE observations into nearby-person suggestions.

## Primary Flows
- BLECoordinator -> BLEPeripheral
- BLEPeripheral -> NearbyDiscovery

## Invariant
- BLEPeripheral must not hold a direct reference to BLECoordinator.
- The BLE subsystem keeps the dependency graph acyclic.
- This acyclic invariant prevents previously fixed cyclic dependency behavior from returning.
`;
    await writeFile(join(dir, '.ai/goals.md'), '# Goals\n\n## Product Thesis\nNearify helps users discover nearby people and events.\n\n## Current Focus\nKeep nearby discovery reliable.\n\n## Success Criteria\n- Discovery remains reliable.\n\n## Manual Goals\n- Product intent: Nearby social discovery.\n- Current focus: Reliable BLE discovery.\n- Success criteria: Discovery remains reliable.\n- Long-term vision: Safer nearby social coordination.\n');
    await writeFile(join(dir, '.ai/architecture.md'), nearifyArchitecture);
    await writeFile(join(dir, '.ai/decisions.md'), '# Decisions\n\n## Active Decisions\n- BLEPeripheral observes coordinator events instead of storing a coordinator reference.\n- All generated intelligence remains deterministic and local-first.\n');
    await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n\n## Risks\n- No repository health risks detected.\n');
    await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify(healthyQuality, null, 2));
    await writeFile(join(dir, '.ai/intelligence-audit.md'), '# Intelligence Audit\n');
    await writeFile(join(dir, '.ai/backlog.md'), '# Backlog\n\n## Prioritized Backlog\n- Add deterministic refresh regression coverage.\n');
    await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n\n## Strategy Confidence\nHigh\n\n## Current Product Bet\nReliable nearby discovery without coordinator/peripheral ownership cycles.\n');
    await writeFile(join(dir, '.ai/context-package.md'), '# Context Package\nReady.\n');
    await writeFile(join(dir, '.ai/validation.md'), '# Validation\n\n## Commands Run\n- `npm test`\n\n## Confidence\n- High\n');
    await writeFile(join(dir, '.ai/execution-model.md'), '# Execution Model\n\n## Architectural Risks\n- **Cyclic dependency language detected in architecture or decisions**\n  - Category: Coupling\n  - Evidence: .ai/architecture.md\n');

    const result = await generateNextImprovement(dir);
    const executionModel = await readFile(join(dir, '.ai/execution-model.md'), 'utf8');
    const ranking = await readFile(join(dir, '.ai/decision-ranking.json'), 'utf8');
    const prompt = await readFile(join(dir, '.ai/next-improvement-prompt.md'), 'utf8');
    const trace = await readFile(join(dir, '.ai/recommendation-trace.md'), 'utf8');

    assert.doesNotMatch(executionModel, /Cyclic dependency language detected in architecture or decisions/);
    assert.doesNotMatch(ranking, /Resolve Architectural Risk: Cyclic dependency language detected in architecture or decisions/);
    assert.doesNotMatch(prompt, /Resolve Architectural Risk: Cyclic dependency language detected in architecture or decisions/);
    assert.doesNotMatch(trace, /Resolve Architectural Risk: Cyclic dependency language detected in architecture or decisions/);
    assert.notEqual(result.selectedIssue.title, 'Resolve Architectural Risk: Cyclic dependency language detected in architecture or decisions');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('code-fixable issue still generates Implementation Package', () => {
  const prompt = renderPrompt(choice({ backlog: `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n` }));
  assert.match(prompt, /## Implementation Instructions/);
  assert.match(prompt, /Implement this Implementation Package exactly as written\./);
});

test('validation-experiment issue generates clearly labeled validation package', () => {
  const selected = choice();
  const prompt = renderPrompt(selected);
  assert.equal(selected.packageType, 'validation-experiment');
  assert.match(prompt, /## Validation Instructions/);
  assert.match(prompt, /Run this Validation Experiment/);
});

test('manual goals package includes shared Deterministic Evaluation details', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-manual-eval-'));
  await mkdir(join(dir, '.ai'), { recursive: true });
  await writeFile(join(dir, '.ai/goals.md'), '# Goals\n\n## Manual Goals\n- Product intent: Local repository intelligence.\n- Current focus: Deterministic packages.\n');
  await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n\n## Risks\n- Manual Goals Partial (50%). Missing: Success criteria, Long-term vision.\n');
  await writeFile(join(dir, '.ai/intelligence-audit.md'), '# Intelligence Audit\n');
  await writeFile(join(dir, '.ai/backlog.md'), '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n');
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n\n## Strategy Confidence\nHigh\n');
  await writeFile(join(dir, '.ai/context-package.md'), '# Context Package\nReady.\n');
  await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify({
    ...healthyQuality,
    canonicalIntelligenceQuality: { score: 50, fields: { manualGoals: { state: 'Partial', percent: 50, missing: ['Success criteria', 'Long-term vision'] } } },
    explanations: { completeness: { fields: { manualGoals: {
      requiredFields: [
        { label: 'Product intent', found: true, manualUpdate: '- Product intent: [Repository owner: describe the product purpose this repository should serve.]' },
        { label: 'Current focus', found: true, manualUpdate: '- Current focus: [Repository owner: describe the current product priority.]' },
        { label: 'Success criteria', found: false, manualUpdate: '- Success criteria: [Repository owner: describe how success should be judged.]' },
        { label: 'Long-term vision', found: false, manualUpdate: '- Long-term vision: [Repository owner: describe the long-term vision for this product.]' },
      ],
      computed: { percent: 50 },
      classification: 'Partial',
      threshold: 'Missing = 0%; Partial = >0% and <100%; Complete = 100%; Strong = multiple evidence lines for every required field.',
      missing: ['Success criteria', 'Long-term vision'],
    } } } },
  }, null, 2));

  const result = await generateNextImprovement(dir);
  assert.equal(result.selectedIssue.completenessExplanation.classification, 'Partial');
  assert.match(result.prompt, /## Deterministic Evaluation/);
  assert.match(result.prompt, /Evaluated canonical file: \.ai\/goals\.md/);
  assert.match(result.prompt, /Completeness percentage: 50%/);
  assert.match(result.prompt, /Classification: Partial/);
  assert.match(result.prompt, /Product intent/);
  assert.match(result.prompt, /Current focus/);
  assert.match(result.prompt, /Success criteria/);
  assert.match(result.prompt, /Long-term vision/);
  assert.match(result.prompt, /Success criteria: \[Repository owner:/);
  assert.match(result.prompt, /Long-term vision: \[Repository owner:/);
  assert.doesNotMatch(result.prompt, /Product intent: \[Repository owner:/);
  assert.doesNotMatch(result.prompt, /Current focus: \[Repository owner:/);
});

test('missing manual goals explanation renders unavailable warning', () => {
  const prompt = renderPrompt(choice({ quality: { ...healthyQuality, coverage: { ...healthyQuality.coverage, goalsPresent: false } } }));
  assert.match(prompt, /## Deterministic Evaluation/);
  assert.match(prompt, /Explanation unavailable: canonical completeness explanation was not generated\./);
});

test('decision ranking orders all candidates with deterministic priority and improvements', () => {
  const manyItems = Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n');
  const { selectedIssue, candidates, decisionRanking } = chooseNextImprovementWithCandidates({
    health: '# Repository Health\n\n## Risks\n- No repository health risks detected.\n',
    quality: { ...healthyQuality, canonicalIntelligenceQuality: { score: 50 }, consistency: { contradictions: ['Goals contradict strategy.'], duplicatedSections: [] } },
    backlog: `# Backlog\n\n## Prioritized Backlog\n${manyItems}\n`,
    strategy: '# Strategy\n\n## Strategy Confidence\nLow\n',
    contextPackage: '# Context Package\nReady.\n',
    audit: '',
  });
  assert.equal(selectedIssue.id, 'consistency-cleanup');
  assert.deepEqual(candidates.map((candidate) => candidate.rank), [1, 2, 3]);
  assert.deepEqual(candidates.map((candidate) => candidate.id), ['consistency-cleanup', 'backlog-noise', 'strategy-quality']);
  assert.equal(decisionRanking.selectedIssue.id, 'consistency-cleanup');
  assert.equal(decisionRanking.candidates[0].selected, true);
  assert.equal(decisionRanking.candidates[0].expectedImprovement.total, 31);
  assert.match(decisionRanking.selectionExplanation, /ranked #1/);
});

test('generated package and artifact include shared decision ranking', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-decision-ranking-'));
  await mkdir(join(dir, '.ai'), { recursive: true });
  await writeFile(join(dir, '.ai/goals.md'), '# Goals\n');
  await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n\n## Risks\n- No repository health risks detected.\n');
  await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify(healthyQuality, null, 2));
  await writeFile(join(dir, '.ai/intelligence-audit.md'), '# Intelligence Audit\n');
  await writeFile(join(dir, '.ai/backlog.md'), `# Backlog\n\n## Prioritized Backlog\n${Array.from({ length: 26 }, (_, index) => `- Noisy backlog item ${index + 1}`).join('\n')}\n`);
  await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n\n## Strategy Confidence\nHigh\n');
  await writeFile(join(dir, '.ai/context-package.md'), '# Context Package\nReady.\n');

  const result = await generateNextImprovement(dir);
  const ranking = JSON.parse(await readFile(join(dir, '.ai/decision-ranking.json'), 'utf8'));

  assert.equal(ranking.selectedIssue.id, result.selectedIssue.id);
  assert.equal(ranking.candidates[0].selected, true);
  assert.match(result.prompt, /## Decision Ranking/);
  assert.match(result.prompt, /1\. Reduce Backlog Noise \(selected\)/);
  assert.match(result.prompt, /Expected Improvement: \+19 total/);
});

test('regenerating recommendations consumes refreshed intelligence quality and drops stale current-focus contradiction', async () => {
  const { persistControlPlane } = await import('../scripts/server.mjs');
  const repo = await mkdtemp(join(tmpdir(), 'agent-ide-stale-contradiction-'));
  try {
    const ai = join(repo, '.ai');
    await mkdir(join(ai, 'prompts'), { recursive: true });
    const focus = 'Between Events experience: helping users know who to reach out to today when they are not currently at an event.';
    const goals = `# Goals

## Manual Goals
- Product intent: Nearify helps people maintain real-world relationships.
- Current focus: ${focus}
- Success criteria: Users complete timely follow-ups.
- Long-term vision: Become the local-first relationship operating system.

## Manual Strategy Notes
- Current Product Bet: Event-aware follow-up workflows.
- Strategic Differentiator: Local-first recommendations grounded in personal context.
- What Not To Build: Cloud telemetry or broad social networking.
- Strategy Evidence: Repository-local Nearify intelligence fixtures.

## Product Thesis
Nearify helps people maintain real-world relationships.

## Current Focus
${focus}

## Success Criteria
Users complete timely follow-ups.

## Current Product Bet
Event-aware follow-up workflows.

## What Not To Build
Cloud telemetry or broad social networking.
`;
    const strategy = `# Strategy

## Product Thesis
Nearify helps people maintain real-world relationships.

## Current Focus
${focus}

## Current Product Bet
Event-aware follow-up workflows.

## Primary Flows
- Review people to contact today.

## Strategy Confidence
High

Strategy Evidence: Repository-local Nearify intelligence fixtures.
`;
    const architecture = `# Architecture

## Product Thesis
Nearify helps people maintain real-world relationships.

## Current Focus
${focus}

## Core Systems
- Local recommendation engine.

## Primary Flows
- Review people to contact today.
`;
    await Promise.all([
      writeFile(join(ai, 'goals.md'), goals),
      writeFile(join(ai, 'strategy.md'), strategy),
      writeFile(join(ai, 'architecture.md'), architecture),
      writeFile(join(ai, 'repository-health.md'), '# Repository Health\n\n## Risks\n- No repository health risks detected.\n\n## Recommended Next Step\nRun AI Handoff Validation.\n\nConfidence: High\n'),
      writeFile(join(ai, 'context-package.md'), '# Context Package\n\n## Strategy\nStrategy confidence is High because evidence is repository-local.\n\n## Decision Ranking\n- Run AI Handoff Validation\n'),
      writeFile(join(ai, 'backlog.md'), '# Backlog\n\n## Prioritized Backlog\n- Validate local follow-up recommendation quality.\n'),
      writeFile(join(ai, 'decisions.md'), '# Decisions\n\n- Keep Nearify local-first.\n'),
      writeFile(join(ai, 'validation.md'), '# Validation\n\n## Confidence\nHigh\n'),
      writeFile(join(ai, 'agents.md'), '# Agents\n\n- Builder.\n'),
      writeFile(join(ai, 'code.md'), '# Code\n\n- Local app.\n'),
      writeFile(join(ai, 'intelligence-audit.md'), '# Audit\n\nNo contradictions detected.\n'),
      writeFile(join(ai, 'intelligence-verification.json'), JSON.stringify({ score: 100, status: 'Pass', failures: [] })),
      writeFile(join(ai, 'ai-handoff-validation.md'), '# AI Handoff Validation\n\nReady.\n'),
      writeFile(join(ai, 'ai-handoff-validation.json'), JSON.stringify({ overallScore: 100, status: 'Ready', contradictions: [], missingExplanations: [] })),
      writeFile(join(ai, 'decision-ranking.json'), JSON.stringify({ selectedIssue: { id: 'consistency-cleanup', title: 'Clean Up Intelligence Contradictions' }, candidates: [{ id: 'consistency-cleanup', title: 'Clean Up Intelligence Contradictions', rank: 1 }] })),
      writeFile(join(ai, 'active-recommendation.json'), JSON.stringify({ id: 'consistency-cleanup', title: 'Clean Up Intelligence Contradictions' })),
      writeFile(join(ai, 'intelligence-quality.json'), JSON.stringify({ coverage: { goalsPresent: true, strategyPresent: true, architecturePresent: true, decisionsPresent: true, validationPresent: true, backlogPresent: true, repositoryHealthPresent: true, agentsPresent: true, codePresent: true }, canonicalIntelligenceQuality: { score: 92, fields: { manualGoals: { state: 'Complete', percent: 100, missing: [] } }, strategyFields: { classification: 'Present', percent: 100, requiredFields: [] } }, generatedExportQuality: { score: 94 }, consistency: { contradictions: ['Current Focus differs across Goals, Strategy, and Architecture.'], duplicatedSections: [] }, confidence: { score: 88, validationConfidence: 'High' }, freshness: { canonicalStaleDocuments: [] } })),
    ]);
    for (const promptName of ['architect.md', 'builder.md', 'reviewer.md', 'debugger.md']) await writeFile(join(ai, 'prompts', promptName), `# ${promptName}\nReady.\n`);

    const data = await persistControlPlane(repo, null, new Date('2026-06-29T00:00:00.000Z'));
    const quality = JSON.parse(await readFile(join(ai, 'intelligence-quality.json'), 'utf8'));
    const ranking = JSON.parse(await readFile(join(ai, 'decision-ranking.json'), 'utf8'));
    const prompt = await readFile(join(ai, 'next-improvement-prompt.md'), 'utf8');
    const trace = await readFile(join(ai, 'recommendation-trace.md'), 'utf8');
    const active = JSON.parse(await readFile(join(ai, 'active-recommendation.json'), 'utf8'));

    assert.deepEqual(quality.consistency.contradictions, []);
    assert.notEqual(ranking.selectedIssue.id, 'consistency-cleanup');
    assert.doesNotMatch(JSON.stringify(ranking), /Current Focus differs across Goals, Strategy, and Architecture/);
    assert.doesNotMatch(prompt, /Current Focus differs across Goals, Strategy, and Architecture|Clean Up Intelligence Contradictions/);
    assert.doesNotMatch(trace, /Current Focus differs across Goals, Strategy, and Architecture|Clean Up Intelligence Contradictions/);
    assert.equal(active.id, data.recommendation.id);
    assert.notEqual(active.id, 'consistency-cleanup');
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test('validation experiment for Xcode repository uses repository-native validation guidance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agent-ide-nearify-xcode-'));
  try {
    await mkdir(join(dir, '.ai'), { recursive: true });
    await mkdir(join(dir, 'Beacon.xcodeproj'), { recursive: true });
    await writeFile(join(dir, '.ai/goals.md'), '# Goals\n\n## Product Thesis\nNearify helps people discover nearby events.\n\n## Current Product Bet\nValidate the iOS app handoff.\n\n## North Star Metric\nSuccessful local event discovery.\n');
    await writeFile(join(dir, '.ai/repository-health.md'), '# Repository Health\n\nOverall Health: Healthy\nConfidence: High\n\n## Risks\n- No repository health risks detected.\n');
    await writeFile(join(dir, '.ai/intelligence-quality.json'), JSON.stringify(healthyQuality));
    await writeFile(join(dir, '.ai/intelligence-audit.md'), '# Intelligence Audit\n');
    await writeFile(join(dir, '.ai/backlog.md'), '# Backlog\n\n## Prioritized Backlog\n- Useful work.\n');
    await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n\n## Strategy Confidence\nHigh\n');
    await writeFile(join(dir, '.ai/context-package.md'), '# Context Package\nReady.\n');
    await writeFile(join(dir, '.ai/architecture.md'), '# Architecture\n\n## Core Systems\nBeacon.xcodeproj iOS app.\n');
    await writeFile(join(dir, '.ai/decisions.md'), '# Decisions\n');
    await writeFile(join(dir, '.ai/execution-model.md'), '# Execution Model\n');
    await writeFile(join(dir, '.ai/validation.md'), '# Validation\n\n## Xcode Project Validation\n- Xcode project validation metadata detected.\n- `xcodebuild -list -project Beacon.xcodeproj`\n- Scheme: `Beacon`\n- Full simulator/device build: Not run by default; no full xcodebuild.\n');
    await writeFile(join(dir, '.ai/ai-handoff-validation.md'), '# AI Handoff Validation\nReady.\n');
    await writeFile(join(dir, '.ai/intelligence-verification.md'), '# Intelligence Verification\n');

    const result = await generateNextImprovement(dir, { outcomeEntries: [] });
    assert.equal(result.selectedIssue.packageType, 'validation-experiment');
    assert.match(result.prompt, /## Validation Guidance/);
    assert.match(result.prompt, /Validation target: Beacon\.xcodeproj/);
    assert.match(result.prompt, /xcodebuild -list -project Beacon\.xcodeproj/);
    assert.match(result.prompt, /xcodebuild build -project Beacon\.xcodeproj -scheme Beacon -destination 'platform=iOS Simulator,name=<Installed Simulator Name>'/);
    assert.match(result.prompt, /\.ai\/validation\.md/);
    assert.doesNotMatch(result.prompt, /- npm test/);
    assert.doesNotMatch(result.prompt, /- npm run build/);
    assert.equal(result.selectedIssue.validationGuidance.target, 'Beacon.xcodeproj');
    assert.ok(result.selectedIssue.validationGuidance.supportingEvidence.includes('.ai/validation.md'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
