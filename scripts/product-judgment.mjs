/**
 * Product Judgment Model — Shadow Mode
 *
 * Generates product-value-focused improvement candidates from repository intelligence.
 * Runs in shadow mode: does NOT affect active Work Queue recommendation.
 * Outputs: .ai/product-judgment.json, .ai/product-judgment.md, .ai/product-judgment-evaluation.md
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const PRODUCT_JUDGMENT_SCHEMA_VERSION = 1;
export const PRODUCT_JUDGMENT_SHADOW_MODE = true;

// Scoring weights (must sum to 1.0)
const WEIGHTS = { productValue: 0.30, strategic: 0.25, userImpact: 0.20, leverage: 0.15, cost: 0.10 };

export function computeCompositeScore(scores) {
  return Math.round(
    WEIGHTS.productValue * scores.productValue +
    WEIGHTS.strategic * scores.strategic +
    WEIGHTS.userImpact * scores.userImpact +
    WEIGHTS.leverage * scores.leverage +
    WEIGHTS.cost * scores.cost,
  );
}

function readAiText(repositoryPath, file) {
  return readFile(join(repositoryPath, '.ai', file), 'utf8').catch((e) => (e?.code === 'ENOENT' ? '' : Promise.reject(e)));
}

function readDocsText(repositoryPath, file) {
  return readFile(join(repositoryPath, 'docs', file), 'utf8').catch((e) => (e?.code === 'ENOENT' ? '' : Promise.reject(e)));
}

function sectionText(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function bullets(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, '').replace(/\s*\(.*?\)\s*$/, '').trim());
}

// ---------------------------------------------------------------------------
// Candidate templates — deterministic scores per product-value category
// ---------------------------------------------------------------------------

const REDESIGN_CANDIDATES = [
  {
    id: 'pj-improvement-loop',
    category: 'product-experience',
    title: 'Implement Focused Improvement Loop UX',
    scores: { productValue: 95, strategic: 92, userImpact: 90, leverage: 88, cost: 55 },
    confidence: 'High',
    evidence: 'docs/repository-improvement-product-redesign.md — explicit product vision: "Open Agent IDE → see the next best improvement → generate one prompt → implement → validate → refresh → repeat"',
    sourceFiles: ['src/App.tsx', 'src/workflow.ts', 'scripts/next-improvement.mjs'],
    whyItMatters: 'Transforms Agent IDE from a repository-intelligence browser into a focused improvement operating system. Every user visit answers one question: what is the single highest-impact improvement and what happens next?',
    whyOutranks: 'Addresses the primary user journey end-to-end. All other product opportunities are components or downstream effects of this loop.',
  },
  {
    id: 'pj-auto-compose-prompt',
    category: 'product-experience',
    title: 'Auto-compose Single Implementation Prompt from All Intelligence',
    scores: { productValue: 85, strategic: 88, userImpact: 82, leverage: 85, cost: 65 },
    confidence: 'High',
    evidence: 'docs/repository-improvement-product-redesign.md — "Agent IDE composes one complete implementation prompt from all internal intelligence."',
    sourceFiles: ['scripts/next-improvement.mjs', 'scripts/context-package.mjs', 'src/App.tsx'],
    whyItMatters: 'Users never need to know what a context package, builder prompt, or architect prompt is. One complete prompt encapsulates all intelligence needed to execute the improvement.',
    whyOutranks: 'Directly reduces the cognitive burden of the improvement loop. Lower-ranked candidates improve subsystems rather than the central user interaction.',
  },
  {
    id: 'pj-simplify-navigation',
    category: 'information-architecture',
    title: 'Collapse Primary Navigation to Improvement Loop Only',
    scores: { productValue: 80, strategic: 85, userImpact: 78, leverage: 75, cost: 68 },
    confidence: 'High',
    evidence: 'docs/repository-improvement-product-redesign.md — "Screens that should be removed from normal usage" and "UI elements that should become Advanced"',
    sourceFiles: ['src/App.tsx'],
    whyItMatters: 'Eliminates decision fatigue. The owner sees one recommendation, one rationale, one button. Repository Health, Context Package, Validation, Verification, and Prompt Center move to Advanced.',
    whyOutranks: 'Reducing navigation complexity has higher product leverage than adding features to existing surfaces.',
  },
  {
    id: 'pj-automate-post-implementation',
    category: 'product-experience',
    title: 'Automate Post-Implementation Validation and Refresh',
    scores: { productValue: 78, strategic: 80, userImpact: 75, leverage: 80, cost: 60 },
    confidence: 'Medium',
    evidence: 'docs/repository-improvement-product-redesign.md — "Validation & Refresh — automatically handle the post-implementation loop"',
    sourceFiles: ['scripts/server.mjs', 'src/App.tsx', 'src/workflow.ts'],
    whyItMatters: 'After implementation, the owner clicks one button. Validation, refresh, and next-improvement selection happen automatically. The loop closes without manual steps.',
    whyOutranks: 'Automates the most repetitive part of the improvement loop. Backlog-only items below this threshold do not change the core loop.',
  },
];

function candidatesFromBacklog(backlog) {
  const highPrioritySection = sectionText(backlog, 'High Priority');
  const mediumSection = sectionText(backlog, 'Medium Priority');
  const highItems = bullets(highPrioritySection);
  const mediumItems = bullets(mediumSection);

  const allItems = [
    ...highItems.map((title) => ({ title, priority: 'high' })),
    ...mediumItems.map((title) => ({ title, priority: 'medium' })),
  ].filter((item) => !/none detected/i.test(item.title));

  return allItems.map((item, i) => {
    const isHighPriority = item.priority === 'high';
    const cleanTitle = item.title.replace(/^\*\*(.+)\*\*$/, '$1').replace(/^\*\*/, '').trim();
    const id = `pj-backlog-${i + 1}`;
    const baseProductValue = isHighPriority ? 65 : 52;
    const baseStrategic = isHighPriority ? 68 : 60;
    const baseUserImpact = isHighPriority ? 60 : 48;
    const baseLeverage = isHighPriority ? 70 : 62;
    const baseCost = isHighPriority ? 75 : 82;

    const isValidation = /validation|test|verify/i.test(cleanTitle);
    const isUX = /render|ui|display|visual|markdown/i.test(cleanTitle);
    const pvBoost = isUX ? 6 : isValidation ? 4 : 0;
    const uiBoost = isUX ? 8 : 0;

    const scores = {
      productValue: Math.min(100, baseProductValue + pvBoost),
      strategic: baseStrategic,
      userImpact: Math.min(100, baseUserImpact + uiBoost),
      leverage: baseLeverage,
      cost: baseCost,
    };

    return {
      id,
      category: 'backlog',
      title: cleanTitle,
      scores,
      confidence: 'Medium',
      evidence: `.ai/backlog.md — ${item.priority} priority backlog item`,
      sourceFiles: [],
      whyItMatters: `Addresses a known repository owner priority: ${cleanTitle}. Listed as ${item.priority} priority in .ai/backlog.md.`,
      whyOutranks: 'Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.',
    };
  });
}

function detectStrategicGaps(goals, strategy) {
  const candidates = [];
  const hasProductBet = /Current Product Bet/i.test(strategy) && !/Missing/i.test(sectionText(strategy, 'Current Product Bet'));
  const hasNorthStar = /North Star Metric/i.test(goals);
  const hasSuccessCriteria = /Success Criteria/i.test(goals);

  if (!hasProductBet) {
    candidates.push({
      id: 'pj-product-bet',
      category: 'strategic-clarity',
      title: 'Define and Record Current Product Bet in Strategy',
      scores: { productValue: 60, strategic: 88, userImpact: 40, leverage: 72, cost: 90 },
      confidence: 'High',
      evidence: '.ai/strategy.md — Current Product Bet is missing or incomplete',
      sourceFiles: ['.ai/goals.md'],
      whyItMatters: 'Without a declared product bet, the improvement engine cannot prioritize by expected product outcome. Recording the bet enables all downstream judgment to align with it.',
      whyOutranks: 'Higher strategic alignment score than most backlog items. Missing strategy hurts all subsequent recommendation quality.',
    });
  }

  if (!hasNorthStar || !hasSuccessCriteria) {
    candidates.push({
      id: 'pj-success-metrics',
      category: 'strategic-clarity',
      title: 'Clarify Measurable North Star Metric and Success Criteria',
      scores: { productValue: 58, strategic: 85, userImpact: 42, leverage: 70, cost: 92 },
      confidence: 'Medium',
      evidence: '.ai/goals.md — North star metric or success criteria incomplete',
      sourceFiles: ['.ai/goals.md'],
      whyItMatters: 'Measurable criteria allow the Product Judgment Model to score candidates against actual product outcomes rather than proxy indicators.',
      whyOutranks: 'Outranks cosmetic improvements because it enables higher-quality judgment for all future candidates.',
    });
  }

  return candidates;
}

function rankCandidates(candidates) {
  return candidates
    .map((c) => ({ ...c, compositeScore: computeCompositeScore(c.scores) }))
    .sort((a, b) => {
      const scoreDiff = b.compositeScore - a.compositeScore;
      if (scoreDiff !== 0) return scoreDiff;
      const pvDiff = b.scores.productValue - a.scores.productValue;
      if (pvDiff !== 0) return pvDiff;
      return a.id.localeCompare(b.id);
    })
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

function renderMarkdown(ranked, repoJudgmentTitle) {
  const lines = [];
  lines.push('# Product Judgment — Shadow Mode');
  lines.push('');
  lines.push('> **Shadow Mode**: This artifact does not affect the active Work Queue recommendation.');
  lines.push('> Generated deterministically from repository intelligence. No LLM, no randomness.');
  lines.push('');
  lines.push(`Generated: ${new Date(0).toISOString()}`);
  lines.push('');
  lines.push('## Active Repository Judgment Recommendation');
  lines.push('');
  lines.push(`- Active: **${repoJudgmentTitle || 'Not available'}**`);
  lines.push(`- Source: .ai/decision-ranking.json (Repository Judgment — unchanged)`);
  lines.push('');
  lines.push('## Top Product Judgment Recommendation');
  lines.push('');
  const top = ranked[0];
  if (!top) {
    lines.push('No product judgment candidates generated.');
  } else {
    lines.push(`**${top.title}**`);
    lines.push('');
    lines.push(`- Composite Score: ${top.compositeScore}/100`);
    lines.push(`- Product Value: ${top.scores.productValue}/100`);
    lines.push(`- Strategic Alignment: ${top.scores.strategic}/100`);
    lines.push(`- User Impact: ${top.scores.userImpact}/100`);
    lines.push(`- Leverage: ${top.scores.leverage}/100`);
    lines.push(`- Implementation Cost: ${top.scores.cost}/100 (higher = cheaper)`);
    lines.push(`- Confidence: ${top.confidence}`);
    lines.push('');
    lines.push(`**Why it matters:** ${top.whyItMatters}`);
    lines.push('');
    lines.push(`**Evidence:** ${top.evidence}`);
    lines.push('');
  }
  lines.push('## All Product Judgment Candidates');
  lines.push('');
  lines.push('| Rank | Title | Composite | Product Value | Strategic | User Impact | Leverage | Cost | Confidence |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const c of ranked) {
    lines.push(`| ${c.rank} | ${c.title} | ${c.compositeScore} | ${c.scores.productValue} | ${c.scores.strategic} | ${c.scores.userImpact} | ${c.scores.leverage} | ${c.scores.cost} | ${c.confidence} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderEvaluation(ranked, inputs) {
  const lines = [];
  lines.push('# Product Judgment Evaluation — Shadow Mode');
  lines.push('');
  lines.push('> **Shadow Mode**: Does not affect active Work Queue recommendation.');
  lines.push('');
  lines.push(`Generated: ${new Date(0).toISOString()}`);
  lines.push('');
  lines.push('## Scoring Methodology');
  lines.push('');
  lines.push('Each candidate is scored on five dimensions (0–100 each):');
  lines.push('');
  lines.push('| Dimension | Weight | Description |');
  lines.push('|---|---|---|');
  lines.push('| Product Value | 30% | Direct user-visible improvement |');
  lines.push('| Strategic Alignment | 25% | Alignment with .ai/goals.md product thesis |');
  lines.push('| User Impact | 20% | Number and depth of users affected |');
  lines.push('| Leverage | 15% | Unlocks future improvements |');
  lines.push('| Implementation Cost | 10% | Inverse of implementation effort |');
  lines.push('');
  lines.push('Composite = 0.30×PV + 0.25×SA + 0.20×UI + 0.15×LV + 0.10×IC');
  lines.push('');
  lines.push('## Inputs');
  lines.push('');
  for (const [file, present] of Object.entries(inputs)) {
    lines.push(`- ${file}: ${present ? 'Present' : 'Missing'}`);
  }
  lines.push('');
  lines.push('## Candidate Evaluations');
  lines.push('');
  for (const c of ranked) {
    lines.push(`### ${c.rank}. ${c.title}`);
    lines.push('');
    lines.push(`- **ID**: ${c.id}`);
    lines.push(`- **Category**: ${c.category}`);
    lines.push(`- **Composite Score**: ${c.compositeScore}/100`);
    lines.push(`- **Product Value**: ${c.scores.productValue}/100`);
    lines.push(`- **Strategic Alignment**: ${c.scores.strategic}/100`);
    lines.push(`- **User Impact**: ${c.scores.userImpact}/100`);
    lines.push(`- **Leverage**: ${c.scores.leverage}/100`);
    lines.push(`- **Implementation Cost**: ${c.scores.cost}/100`);
    lines.push(`- **Confidence**: ${c.confidence}`);
    lines.push(`- **Evidence**: ${c.evidence}`);
    lines.push(`- **Source Files**: ${c.sourceFiles.length ? c.sourceFiles.join(', ') : 'None specified'}`);
    lines.push(`- **Why It Matters**: ${c.whyItMatters}`);
    lines.push(`- **Why It Outranks Lower Candidates**: ${c.whyOutranks}`);
    lines.push('');
  }
  return lines.join('\n');
}

export async function generateProductJudgment(repositoryPath) {
  const [goals, strategy, backlog, decisions, executionModel, repositoryHealth, redesignDoc, decisionRankingRaw] = await Promise.all([
    readAiText(repositoryPath, 'goals.md'),
    readAiText(repositoryPath, 'strategy.md'),
    readAiText(repositoryPath, 'backlog.md'),
    readAiText(repositoryPath, 'decisions.md'),
    readAiText(repositoryPath, 'execution-model.md'),
    readAiText(repositoryPath, 'repository-health.md'),
    readDocsText(repositoryPath, 'repository-improvement-product-redesign.md'),
    readAiText(repositoryPath, 'decision-ranking.json'),
  ]);

  const decisionRanking = decisionRankingRaw ? JSON.parse(decisionRankingRaw).catch?.(() => null) ?? (() => { try { return JSON.parse(decisionRankingRaw); } catch { return null; } })() : null;
  const activeRepoJudgmentTitle = decisionRanking?.candidates?.[0]?.title ?? 'Not available';

  const inputs = {
    '.ai/goals.md': Boolean(goals.trim()),
    '.ai/strategy.md': Boolean(strategy.trim()),
    '.ai/backlog.md': Boolean(backlog.trim()),
    '.ai/decisions.md': Boolean(decisions.trim()),
    '.ai/execution-model.md': Boolean(executionModel.trim()),
    '.ai/repository-health.md': Boolean(repositoryHealth.trim()),
    '.ai/decision-ranking.json': Boolean(decisionRankingRaw.trim()),
    'docs/repository-improvement-product-redesign.md': Boolean(redesignDoc.trim()),
  };

  // Collect candidates from all sources
  const candidates = [];

  // From product redesign doc (highest product value)
  if (redesignDoc.trim()) {
    candidates.push(...REDESIGN_CANDIDATES);
  }

  // From strategic gaps
  candidates.push(...detectStrategicGaps(goals, strategy));

  // From backlog (lower product value, maintenance-oriented)
  candidates.push(...candidatesFromBacklog(backlog));

  // Rank all candidates by composite score
  const ranked = rankCandidates(candidates);

  const generatedAt = '1970-01-01T00:00:00.000Z';

  const json = {
    schemaVersion: PRODUCT_JUDGMENT_SCHEMA_VERSION,
    shadowMode: PRODUCT_JUDGMENT_SHADOW_MODE,
    generatedAt,
    activeRepositoryJudgmentTitle: activeRepoJudgmentTitle,
    scoringWeights: WEIGHTS,
    candidateCount: ranked.length,
    candidates: ranked.map((c) => ({
      rank: c.rank,
      id: c.id,
      title: c.title,
      category: c.category,
      compositeScore: c.compositeScore,
      scores: c.scores,
      confidence: c.confidence,
      evidence: c.evidence,
      sourceFiles: c.sourceFiles,
      whyItMatters: c.whyItMatters,
      whyOutranks: c.whyOutranks,
    })),
  };

  const md = renderMarkdown(ranked, activeRepoJudgmentTitle);
  const evaluation = renderEvaluation(ranked, inputs);

  await mkdir(join(repositoryPath, '.ai'), { recursive: true });
  await Promise.all([
    writeFile(join(repositoryPath, '.ai', 'product-judgment.json'), JSON.stringify(json, null, 2), 'utf8'),
    writeFile(join(repositoryPath, '.ai', 'product-judgment.md'), md, 'utf8'),
    writeFile(join(repositoryPath, '.ai', 'product-judgment-evaluation.md'), evaluation, 'utf8'),
  ]);

  return json;
}
