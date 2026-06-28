import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { generateProductJudgment, computeCompositeScore, PRODUCT_JUDGMENT_SHADOW_MODE } from '../scripts/product-judgment.mjs';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

async function makeRepo(aiFiles = {}, docsFiles = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'pj-test-'));
  const aiDir = join(dir, '.ai');
  const docsDir = join(dir, 'docs');
  await mkdir(aiDir, { recursive: true });
  await mkdir(docsDir, { recursive: true });
  for (const [name, content] of Object.entries(aiFiles)) {
    await writeFile(join(aiDir, name), content, 'utf8');
  }
  for (const [name, content] of Object.entries(docsFiles)) {
    await writeFile(join(docsDir, name), content, 'utf8');
  }
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const minimalAi = {
  'goals.md': '# Goals\n\n## Product Thesis\nAgent IDE makes repository understanding the primary developer interface.\n\n## North Star Metric\nRepository handoff readiness is Ready.\n\n## Success Criteria\n- Control Plane reports repository handoff readiness as Ready.\n',
  'strategy.md': '# Strategy\n\n## Product Thesis\nAgent IDE makes repository understanding the primary developer interface.\n\n## Current Product Bet\nMissing\n',
  'backlog.md': '# Backlog\n\n## High Priority\n- None detected\n\n## Medium Priority\n- **Add Backlog Quality Filtering**\n  - Source: README.md\n- **Improve Markdown Rendering**\n  - Source: README.md\n',
  'decisions.md': '# Decisions\n\n## Active Decisions\n- All generators must be deterministic.\n',
  'execution-model.md': '# Execution Model\n\n## Architectural Risks\n- No architectural risks detected from available intelligence.\n',
  'repository-health.md': '# Repository Health\n\n## Risks\n- No risks detected.\n',
  'decision-ranking.json': JSON.stringify({
    schemaVersion: 1,
    candidates: [{ rank: 1, id: 'ai-handoff-validation', class: 'maintenance', title: 'Run AI Handoff Validation', priorityScore: 10 }],
  }),
};

const redesignDoc = `# Repository Improvement Product Redesign

## New product philosophy

Agent IDE should behave like an autonomous senior engineering lead.

Open Agent IDE → see the next best improvement → generate one prompt → implement → validate → refresh → repeat
`;

// ---------------------------------------------------------------------------
// Product Judgment artifacts are deterministic
// ---------------------------------------------------------------------------

test('generateProductJudgment produces identical output on repeated calls with same inputs', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, { 'repository-improvement-product-redesign.md': redesignDoc });
  try {
    await generateProductJudgment(dir);
    const first = await readFile(join(dir, '.ai', 'product-judgment.json'), 'utf8');
    await generateProductJudgment(dir);
    const second = await readFile(join(dir, '.ai', 'product-judgment.json'), 'utf8');
    assert.equal(first, second, 'product-judgment.json must be byte-for-byte identical across calls with same inputs');
  } finally {
    await cleanup();
  }
});

test('generateProductJudgment produces all three output artifacts', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateProductJudgment(dir);
    const json = await readFile(join(dir, '.ai', 'product-judgment.json'), 'utf8');
    const md = await readFile(join(dir, '.ai', 'product-judgment.md'), 'utf8');
    const evaluation = await readFile(join(dir, '.ai', 'product-judgment-evaluation.md'), 'utf8');
    assert.ok(json.length > 0, 'product-judgment.json must be written');
    assert.ok(md.length > 0, 'product-judgment.md must be written');
    assert.ok(evaluation.length > 0, 'product-judgment-evaluation.md must be written');
    assert.ok(md.includes('Shadow Mode'), 'product-judgment.md must be labeled Shadow Mode');
    assert.ok(evaluation.includes('Shadow Mode'), 'product-judgment-evaluation.md must be labeled Shadow Mode');
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Product Judgment does not affect active Work Queue recommendation
// ---------------------------------------------------------------------------

test('generateProductJudgment does not modify decision-ranking.json', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    const before = await readFile(join(dir, '.ai', 'decision-ranking.json'), 'utf8');
    await generateProductJudgment(dir);
    const after = await readFile(join(dir, '.ai', 'decision-ranking.json'), 'utf8');
    assert.equal(before, after, 'decision-ranking.json must not be modified by generateProductJudgment');
  } finally {
    await cleanup();
  }
});

test('product-judgment.json shadowMode field is always true', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    const result = await generateProductJudgment(dir);
    assert.equal(result.shadowMode, true, 'shadowMode must be true');
    assert.equal(PRODUCT_JUDGMENT_SHADOW_MODE, true, 'PRODUCT_JUDGMENT_SHADOW_MODE export must be true');
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Product Judgment card appears when artifacts exist
// ---------------------------------------------------------------------------

test('ProductJudgmentShadowCard component is defined in App.tsx', () => {
  assert.ok(appSource.includes('function ProductJudgmentShadowCard'), 'ProductJudgmentShadowCard must be defined');
  assert.ok(appSource.includes('aria-label="Product Judgment Shadow Recommendation"'), 'shadow card must have correct aria-label');
  assert.ok(appSource.includes("Shadow Mode · Product Judgment"), 'shadow card must show Shadow Mode label');
  assert.ok(appSource.includes('<ProductJudgmentShadowCard data={data}'), 'shadow card must be rendered in dashboard');
});

test('ProductJudgmentShadowCard returns null when productJudgment is absent', () => {
  const fnMatch = appSource.match(/function ProductJudgmentShadowCard[\s\S]*?(?=\nfunction )/)?.[0] ?? '';
  assert.ok(fnMatch.includes('if (!pj || !pj.candidates?.length) return null'), 'must guard against missing productJudgment');
});

// ---------------------------------------------------------------------------
// Missing Product Judgment artifacts do not break Control Plane
// ---------------------------------------------------------------------------

test('generateProductJudgment succeeds with minimal inputs (no redesign doc, no backlog items)', async () => {
  const { dir, cleanup } = await makeRepo({
    'goals.md': '# Goals\n## Product Thesis\nTest.\n',
    'strategy.md': '# Strategy\n',
    'backlog.md': '# Backlog\n## High Priority\n- None detected\n## Medium Priority\n- None detected\n',
    'decisions.md': '',
    'execution-model.md': '',
    'repository-health.md': '',
    'decision-ranking.json': '{"schemaVersion":1,"candidates":[]}',
  });
  try {
    const result = await generateProductJudgment(dir);
    assert.ok(result, 'must return a result');
    assert.ok(Array.isArray(result.candidates), 'candidates must be an array');
    assert.equal(result.shadowMode, true);
  } finally {
    await cleanup();
  }
});

test('generateProductJudgment with completely empty inputs still writes artifacts without throwing', async () => {
  const { dir, cleanup } = await makeRepo({});
  try {
    const result = await generateProductJudgment(dir);
    assert.ok(result, 'must return a result even with empty inputs');
    assert.equal(result.shadowMode, true);
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Product Judgment ranks using product-value fields, not backlog title order
// ---------------------------------------------------------------------------

test('computeCompositeScore uses weighted formula: 0.30×PV + 0.25×SA + 0.20×UI + 0.15×LV + 0.10×IC', () => {
  const scores = { productValue: 100, strategic: 100, userImpact: 100, leverage: 100, cost: 100 };
  assert.equal(computeCompositeScore(scores), 100, 'all 100 must produce composite 100');

  const mixed = { productValue: 80, strategic: 60, userImpact: 40, leverage: 20, cost: 0 };
  const expected = Math.round(0.30 * 80 + 0.25 * 60 + 0.20 * 40 + 0.15 * 20 + 0.10 * 0);
  assert.equal(computeCompositeScore(mixed), expected, 'composite must match weighted formula');
});

test('Product Judgment ranks redesign candidates above backlog-only candidates', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, { 'repository-improvement-product-redesign.md': redesignDoc });
  try {
    const result = await generateProductJudgment(dir);
    assert.ok(result.candidates.length >= 2, 'must have at least 2 candidates');
    const top = result.candidates[0];
    const backlogCandidates = result.candidates.filter((c) => c.category === 'backlog');
    assert.ok(backlogCandidates.length > 0, 'must have at least one backlog candidate');
    assert.ok(top.category !== 'backlog', `top candidate should not be a backlog item, got category: ${top.category}`);
    assert.ok(top.compositeScore > backlogCandidates[0].compositeScore, `top candidate composite ${top.compositeScore} must exceed top backlog composite ${backlogCandidates[0].compositeScore}`);
  } finally {
    await cleanup();
  }
});

test('backlog candidates are ranked by composite score not title alphabetical order', async () => {
  const { dir, cleanup } = await makeRepo({
    ...minimalAi,
    'backlog.md': '# Backlog\n\n## High Priority\n- **Zebra Feature**\n  - Source: README.md\n\n## Medium Priority\n- **Alpha Feature**\n  - Source: README.md\n',
    'decision-ranking.json': '{"schemaVersion":1,"candidates":[]}',
  });
  try {
    const result = await generateProductJudgment(dir);
    const backlogCandidates = result.candidates.filter((c) => c.category === 'backlog');
    if (backlogCandidates.length >= 2) {
      // High priority must outrank medium priority (not alphabetical)
      const zebra = backlogCandidates.find((c) => c.title.includes('Zebra'));
      const alpha = backlogCandidates.find((c) => c.title.includes('Alpha'));
      if (zebra && alpha) {
        assert.ok(zebra.rank < alpha.rank, 'high priority Zebra must outrank medium priority Alpha (not alphabetical)');
      }
    }
  } finally {
    await cleanup();
  }
});

test('all product judgment candidates have required fields', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, { 'repository-improvement-product-redesign.md': redesignDoc });
  try {
    const result = await generateProductJudgment(dir);
    for (const c of result.candidates) {
      assert.ok(c.id, `candidate must have id: ${JSON.stringify(c)}`);
      assert.ok(c.title, `candidate must have title`);
      assert.ok(c.category, `candidate must have category`);
      assert.ok(typeof c.compositeScore === 'number', `candidate must have compositeScore`);
      assert.ok(typeof c.scores.productValue === 'number', `candidate must have scores.productValue`);
      assert.ok(typeof c.scores.strategic === 'number', `candidate must have scores.strategic`);
      assert.ok(typeof c.scores.userImpact === 'number', `candidate must have scores.userImpact`);
      assert.ok(typeof c.scores.leverage === 'number', `candidate must have scores.leverage`);
      assert.ok(typeof c.scores.cost === 'number', `candidate must have scores.cost`);
      assert.ok(c.confidence, `candidate must have confidence`);
      assert.ok(c.evidence, `candidate must have evidence`);
      assert.ok(Array.isArray(c.sourceFiles), `candidate must have sourceFiles array`);
      assert.ok(c.whyItMatters, `candidate must have whyItMatters`);
      assert.ok(c.whyOutranks, `candidate must have whyOutranks`);
    }
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Product signal extraction — generalizes to product/app repositories
// ---------------------------------------------------------------------------

test('repository with Current Focus produces at least one product-focus candidate', async () => {
  const { dir, cleanup } = await makeRepo({
    'goals.md': '# Goals\n\n## Product Thesis\nHelp users find nearby friends.\n\n## Current Focus\nImproving the friend discovery onboarding flow to reduce drop-off at step 2.\n\n## North Star Metric\nWeekly active social connections per user.\n\n## Success Criteria\n- 60% of new users complete friend discovery in first session\n',
    'strategy.md': '# Strategy\n\n## Current Product Bet\nSimplifying onboarding will double 7-day retention.\n',
    'backlog.md': '# Backlog\n\n## High Priority\n- None detected\n\n## Medium Priority\n- None detected\n',
    'decisions.md': '',
    'execution-model.md': '',
    'repository-health.md': '',
    'decision-ranking.json': '{"schemaVersion":1,"candidates":[]}',
  });
  try {
    const result = await generateProductJudgment(dir);
    assert.ok(result.candidates.length >= 1, 'must produce at least one candidate from product signals');
    const focusCandidates = result.candidates.filter((c) => c.category === 'product-focus');
    assert.ok(focusCandidates.length >= 1, 'must produce at least one product-focus candidate from Current Focus');
    assert.ok(focusCandidates[0].evidence.includes('Current Focus'), 'evidence must reference Current Focus');
  } finally {
    await cleanup();
  }
});

test('repository with Current Product Bet produces at least one product-validation candidate', async () => {
  const { dir, cleanup } = await makeRepo({
    'goals.md': '# Goals\n\n## Product Thesis\nHelp users find nearby events.\n\n## North Star Metric\nEvents attended per active user per month.\n',
    'strategy.md': '# Strategy\n\n## Current Product Bet\nShowing proximity-ranked events increases attendance by 40%.\n\n## Current Experiment\nRunning A/B test on proximity sort vs. chronological sort in event feed.\n',
    'backlog.md': '# Backlog\n\n## High Priority\n- None detected\n\n## Medium Priority\n- None detected\n',
    'decisions.md': '',
    'execution-model.md': '',
    'repository-health.md': '',
    'decision-ranking.json': '{"schemaVersion":1,"candidates":[]}',
  });
  try {
    const result = await generateProductJudgment(dir);
    assert.ok(result.candidates.length >= 1, 'must produce candidates from product signals');
    const betCandidates = result.candidates.filter((c) => c.category === 'product-validation');
    assert.ok(betCandidates.length >= 1, 'must produce at least one product-validation candidate from Current Product Bet or Current Experiment');
  } finally {
    await cleanup();
  }
});

test('repository with backlog items in non-standard section names produces backlog candidates', async () => {
  const { dir, cleanup } = await makeRepo({
    'goals.md': '# Goals\n',
    'strategy.md': '# Strategy\n',
    'backlog.md': '# Backlog\n\n## Features\n- Add push notifications for nearby activity\n- Improve map clustering performance\n',
    'decisions.md': '',
    'execution-model.md': '',
    'repository-health.md': '',
    'decision-ranking.json': '{"schemaVersion":1,"candidates":[]}',
  });
  try {
    const result = await generateProductJudgment(dir);
    const backlogCandidates = result.candidates.filter((c) => c.category === 'backlog');
    assert.ok(backlogCandidates.length >= 1, 'must produce backlog candidates from non-standard section headings');
  } finally {
    await cleanup();
  }
});

test('repository without any product signals produces zero product-signal candidates but may produce strategic-gap candidates', async () => {
  const { dir, cleanup } = await makeRepo({
    'goals.md': '# Goals\n',
    'strategy.md': '# Strategy\n',
    'backlog.md': '# Backlog\n\n## High Priority\n- None detected\n\n## Medium Priority\n- None detected\n',
    'decisions.md': '',
    'execution-model.md': '',
    'repository-health.md': '',
    'decision-ranking.json': '{"schemaVersion":1,"candidates":[]}',
  });
  try {
    const result = await generateProductJudgment(dir);
    const productSignalCategories = ['product-focus', 'product-validation', 'product-measurement', 'backlog'];
    const signalCandidates = result.candidates.filter((c) => productSignalCategories.includes(c.category));
    assert.equal(signalCandidates.length, 0, 'empty signals must produce zero product-signal candidates');
    // Strategic gap candidates are expected when signals are absent
    const gapCandidates = result.candidates.filter((c) => c.category === 'strategic-clarity');
    assert.ok(gapCandidates.length >= 1, 'missing product bet should still produce strategic-gap candidate');
  } finally {
    await cleanup();
  }
});

test('candidate IDs are deterministic: same input produces same IDs across multiple calls', async () => {
  const { dir, cleanup } = await makeRepo({
    'goals.md': '# Goals\n\n## Current Focus\nImproving onboarding completion rate.\n\n## North Star Metric\nWeekly retained users.\n',
    'strategy.md': '# Strategy\n\n## Current Product Bet\nSimplified onboarding doubles retention.\n',
    'backlog.md': '# Backlog\n\n## High Priority\n- Add social login support\n',
    'decisions.md': '',
    'execution-model.md': '',
    'repository-health.md': '',
    'decision-ranking.json': '{"schemaVersion":1,"candidates":[]}',
  });
  try {
    const first = await generateProductJudgment(dir);
    const second = await generateProductJudgment(dir);
    const firstIds = first.candidates.map((c) => c.id).sort();
    const secondIds = second.candidates.map((c) => c.id).sort();
    assert.deepEqual(firstIds, secondIds, 'candidate IDs must be identical across repeated calls with same input');
  } finally {
    await cleanup();
  }
});

test('product-judgment.md includes diagnostics with source files and detected signals', async () => {
  const { dir, cleanup } = await makeRepo({
    'goals.md': '# Goals\n\n## Current Focus\nUser retention.\n',
    'strategy.md': '# Strategy\n\n## Current Product Bet\nRetention feature drives growth.\n',
    'backlog.md': '# Backlog\n',
    'decisions.md': '',
    'execution-model.md': '',
    'repository-health.md': '',
    'decision-ranking.json': '{"schemaVersion":1,"candidates":[]}',
  });
  try {
    await generateProductJudgment(dir);
    const md = await readFile(join(dir, '.ai', 'product-judgment.md'), 'utf8');
    assert.ok(md.includes('Source Files Read'), 'diagnostics must list source files read');
    assert.ok(md.includes('Product Signals Detected'), 'diagnostics must list detected signals');
    assert.ok(md.includes('currentFocus'), 'diagnostics must include currentFocus signal');
    assert.ok(md.includes('productBet'), 'diagnostics must include productBet signal');
  } finally {
    await cleanup();
  }
});
