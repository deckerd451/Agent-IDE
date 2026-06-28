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

// Also try subheadings (###) for files that use deeper nesting
function subSectionText(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^###?\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function bullets(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, '').replace(/\s*\(.*?\)\s*$/, '').trim());
}

// Extract all bullets from a markdown doc regardless of section
function allBullets(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => /^[-*]\s+\S/.test(l)).map((l) => l.replace(/^[-*]\s+/, '').replace(/\s*\(.*?\)\s*$/, '').trim());
}

function firstSentence(text) {
  const line = text.split('\n').map((l) => l.trim()).find((l) => l.length > 3 && !/^[#-*]/.test(l)) ?? text.split('\n')[0] ?? '';
  const sentence = line.split(/[.!?]/)[0].trim();
  return sentence.length > 80 ? `${sentence.slice(0, 77)}...` : sentence;
}

function slugId(prefix, title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44);
  return `${prefix}-${slug}`;
}

function isBlank(text) {
  return !text || /^\s*$/.test(text) || /^[-*]\s*(none|missing|n\/a|not defined|tbd)/i.test(text.trim());
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

// ---------------------------------------------------------------------------
// Product-signal candidate extraction (generalizes to any product repository)
// ---------------------------------------------------------------------------

function candidatesFromCurrentFocus(goals) {
  const focus = sectionText(goals, 'Current Focus') || subSectionText(goals, 'Current Focus');
  if (isBlank(focus)) return [];
  const focusText = firstSentence(focus);
  if (!focusText || focusText.length < 4) return [];
  return [{
    id: slugId('pj-focus', focusText),
    category: 'product-focus',
    title: `Instrument and Validate Current Focus: ${focusText}`,
    scores: { productValue: 78, strategic: 90, userImpact: 72, leverage: 80, cost: 78 },
    confidence: 'High',
    evidence: `.ai/goals.md — Current Focus: "${focusText}"`,
    sourceFiles: ['.ai/goals.md', '.ai/strategy.md'],
    whyItMatters: `The declared Current Focus is "${focusText}". Ensuring this focus is instrumented and measurable against the North Star Metric maximizes product signal per development cycle.`,
    whyOutranks: 'Current Focus alignment has higher strategic score than backlog items because it directly addresses the declared product priority.',
  }];
}

function candidatesFromProductBet(strategy) {
  const bet = sectionText(strategy, 'Current Product Bet') || subSectionText(strategy, 'Current Product Bet');
  if (isBlank(bet)) return [];
  const betText = firstSentence(bet);
  if (!betText || betText.length < 4) return [];
  return [{
    id: slugId('pj-bet', betText),
    category: 'product-validation',
    title: `Validate Product Bet: ${betText.slice(0, 55)}`,
    scores: { productValue: 82, strategic: 92, userImpact: 68, leverage: 85, cost: 72 },
    confidence: 'High',
    evidence: `.ai/strategy.md — Current Product Bet: "${betText}"`,
    sourceFiles: ['.ai/strategy.md', '.ai/goals.md'],
    whyItMatters: `The active product bet "${betText}" needs validation evidence. A focused experiment or instrumentation pass confirms or refutes the bet before further investment.`,
    whyOutranks: 'Validating the active product bet has higher leverage than any individual feature — it gates the entire product direction.',
  }];
}

function candidatesFromCurrentExperiment(strategy) {
  const experiment = sectionText(strategy, 'Current Experiment') || subSectionText(strategy, 'Current Experiment');
  if (isBlank(experiment)) return [];
  const expText = firstSentence(experiment);
  if (!expText || expText.length < 4) return [];
  return [{
    id: slugId('pj-experiment', expText),
    category: 'product-validation',
    title: `Complete and Evaluate Current Experiment: ${expText.slice(0, 50)}`,
    scores: { productValue: 75, strategic: 88, userImpact: 65, leverage: 82, cost: 80 },
    confidence: 'High',
    evidence: `.ai/strategy.md — Current Experiment: "${expText}"`,
    sourceFiles: ['.ai/strategy.md'],
    whyItMatters: `An active experiment "${expText}" is underway. Reaching a clear go/no-go decision on this experiment unlocks the next product bet and prevents investment in the wrong direction.`,
    whyOutranks: 'Active experiments have time-value — delayed evaluation reduces signal quality and wastes development cycles.',
  }];
}

function candidatesFromProductThesis(goals, strategy) {
  const thesis = sectionText(goals, 'Product Thesis') || sectionText(strategy, 'Product Thesis');
  if (isBlank(thesis)) return [];
  const thesisText = firstSentence(thesis);
  if (!thesisText || thesisText.length < 8) return [];
  // Only generate a thesis-alignment candidate if no Current Focus candidate was generated
  // (focus is more specific and thus higher value)
  return [{
    id: slugId('pj-thesis', thesisText),
    category: 'strategic-clarity',
    title: `Align Backlog Priorities with Product Thesis: ${thesisText.slice(0, 50)}`,
    scores: { productValue: 70, strategic: 88, userImpact: 60, leverage: 78, cost: 85 },
    confidence: 'Medium',
    evidence: `.ai/goals.md — Product Thesis: "${thesisText}"`,
    sourceFiles: ['.ai/goals.md', '.ai/backlog.md'],
    whyItMatters: `The product thesis "${thesisText}" should be the filter for all backlog prioritization. An explicit alignment pass removes low-thesis-value work from the queue.`,
    whyOutranks: 'Thesis alignment improves the quality of all future recommendations by filtering the input signal.',
  }];
}

function candidatesFromNorthStar(goals) {
  const northStar = sectionText(goals, 'North Star Metric') || sectionText(goals, 'North Star') || subSectionText(goals, 'North Star Metric');
  if (isBlank(northStar)) return [];
  const metric = firstSentence(northStar);
  if (!metric || metric.length < 4) return [];
  return [{
    id: slugId('pj-northstar', metric),
    category: 'product-measurement',
    title: `Instrument North Star Metric: ${metric.slice(0, 55)}`,
    scores: { productValue: 76, strategic: 86, userImpact: 70, leverage: 84, cost: 82 },
    confidence: 'High',
    evidence: `.ai/goals.md — North Star Metric: "${metric}"`,
    sourceFiles: ['.ai/goals.md'],
    whyItMatters: `The declared North Star is "${metric}". Verifying this metric is instrumented and tracked in production ensures the product direction is data-driven.`,
    whyOutranks: 'An uninstrumented North Star Metric means all product judgment is qualitative — instrumenting it enables quantitative prioritization.',
  }];
}

function candidatesFromSuccessDefinition(goals) {
  const success = sectionText(goals, 'Success Definition') || sectionText(goals, 'Success Criteria') || subSectionText(goals, 'Success Definition');
  if (isBlank(success)) return [];
  const successItems = bullets(success).filter((b) => !/none detected/i.test(b));
  if (successItems.length === 0) return [];
  const top = successItems[0];
  return [{
    id: slugId('pj-success', top),
    category: 'product-measurement',
    title: `Verify Success Criteria Are Measurable and Tracked`,
    scores: { productValue: 72, strategic: 84, userImpact: 65, leverage: 76, cost: 86 },
    confidence: 'Medium',
    evidence: `.ai/goals.md — Success Criteria: "${top}"`,
    sourceFiles: ['.ai/goals.md'],
    whyItMatters: `${successItems.length} success criteria are defined. A verification pass confirms each is tracked, measurable, and tied to observable product behavior — not just intentions.`,
    whyOutranks: 'Defined but untracked success criteria produce false confidence. Verification is low-cost with high strategic impact.',
  }];
}

// ---------------------------------------------------------------------------
// Backlog candidate extraction — generalizes across section name variants
// ---------------------------------------------------------------------------

const BACKLOG_SECTION_ALIASES = [
  ['High Priority', 'high'],
  ['High', 'high'],
  ['Priority Items', 'high'],
  ['Medium Priority', 'medium'],
  ['Medium', 'medium'],
  ['Low Priority', 'low'],
  ['Low', 'low'],
  ['Items', 'medium'],
  ['Features', 'medium'],
  ['Enhancements', 'medium'],
  ['Backlog', 'medium'],
];

function candidatesFromBacklog(backlog) {
  const seen = new Set();
  const allItems = [];

  for (const [heading, priority] of BACKLOG_SECTION_ALIASES) {
    const section = sectionText(backlog, heading) || subSectionText(backlog, heading);
    for (const title of bullets(section)) {
      if (!seen.has(title) && !/none detected/i.test(title)) {
        seen.add(title);
        allItems.push({ title, priority });
      }
    }
  }

  // Fallback: if no section-based extraction worked, try all bullets in the doc
  if (allItems.length === 0) {
    for (const title of allBullets(backlog)) {
      if (!seen.has(title) && !/none detected/i.test(title) && title.length > 4) {
        seen.add(title);
        allItems.push({ title, priority: 'medium' });
      }
    }
  }

  return allItems.map((item) => {
    const isHigh = item.priority === 'high';
    const isMedium = item.priority === 'medium';
    const cleanTitle = item.title.replace(/^\*\*(.+)\*\*$/, '$1').replace(/^\*\*/, '').trim();
    const id = slugId('pj-backlog', cleanTitle);
    const baseProductValue = isHigh ? 65 : isMedium ? 52 : 40;
    const baseStrategic = isHigh ? 68 : isMedium ? 60 : 50;
    const baseUserImpact = isHigh ? 60 : isMedium ? 48 : 38;
    const baseLeverage = isHigh ? 70 : isMedium ? 62 : 52;
    const baseCost = isHigh ? 75 : isMedium ? 82 : 88;

    const isValidation = /validation|test|verify/i.test(cleanTitle);
    const isUX = /render|ui|display|visual|markdown|onboard|screen/i.test(cleanTitle);
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

// ---------------------------------------------------------------------------
// Strategic gap detection — fires when signals are ABSENT
// ---------------------------------------------------------------------------

function detectStrategicGaps(goals, strategy) {
  const candidates = [];
  const hasProductBet = /Current Product Bet/i.test(strategy) && !isBlank(sectionText(strategy, 'Current Product Bet'));
  const hasNorthStar = /North Star Metric|North Star/i.test(goals) && !isBlank(sectionText(goals, 'North Star Metric') || sectionText(goals, 'North Star'));
  const hasSuccessCriteria = /Success Criteria|Success Definition/i.test(goals);

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

// ---------------------------------------------------------------------------
// Diagnostics helpers
// ---------------------------------------------------------------------------

function detectSignals(goals, strategy, backlog, architecture) {
  return {
    currentFocus: !isBlank(sectionText(goals, 'Current Focus') || subSectionText(goals, 'Current Focus')),
    productBet: !isBlank(sectionText(strategy, 'Current Product Bet') || subSectionText(strategy, 'Current Product Bet')),
    currentExperiment: !isBlank(sectionText(strategy, 'Current Experiment') || subSectionText(strategy, 'Current Experiment')),
    productThesis: !isBlank(sectionText(goals, 'Product Thesis') || sectionText(strategy, 'Product Thesis')),
    northStarMetric: !isBlank(sectionText(goals, 'North Star Metric') || sectionText(goals, 'North Star') || subSectionText(goals, 'North Star Metric')),
    successDefinition: !isBlank(sectionText(goals, 'Success Definition') || sectionText(goals, 'Success Criteria')),
    backlogItems: candidatesFromBacklog(backlog).length > 0,
    architecture: Boolean(architecture.trim()),
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderMarkdown(ranked, repoJudgmentTitle, inputs, signals) {
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
  if (ranked.length === 0) {
    lines.push('No candidates generated. See Diagnostics below for details.');
  } else {
    lines.push('| Rank | Title | Composite | Product Value | Strategic | User Impact | Leverage | Cost | Confidence |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const c of ranked) {
      lines.push(`| ${c.rank} | ${c.title} | ${c.compositeScore} | ${c.scores.productValue} | ${c.scores.strategic} | ${c.scores.userImpact} | ${c.scores.leverage} | ${c.scores.cost} | ${c.confidence} |`);
    }
  }
  lines.push('');
  lines.push('## Diagnostics');
  lines.push('');
  lines.push('### Source Files Read');
  lines.push('');
  for (const [file, present] of Object.entries(inputs)) {
    lines.push(`- ${file}: ${present ? 'Present' : 'Missing'}`);
  }
  lines.push('');
  lines.push('### Product Signals Detected');
  lines.push('');
  for (const [signal, detected] of Object.entries(signals)) {
    lines.push(`- ${signal}: ${detected ? 'Detected' : 'Not detected'}`);
  }
  lines.push('');
  lines.push('### Candidate Generation Summary');
  lines.push('');
  if (ranked.length === 0) {
    lines.push('Zero candidates were generated. This occurs when:');
    lines.push('- No product signals were found in goals.md, strategy.md, or backlog.md');
    lines.push('- All backlog bullets are marked "None detected"');
    lines.push('- docs/repository-improvement-product-redesign.md is absent');
    lines.push('- North Star Metric, Success Criteria, and Product Bet are all defined (no strategic gaps)');
  } else {
    lines.push(`${ranked.length} candidate(s) generated from: ${[
      signals.currentFocus && 'Current Focus',
      signals.productBet && 'Product Bet',
      signals.currentExperiment && 'Current Experiment',
      signals.productThesis && 'Product Thesis',
      signals.northStarMetric && 'North Star Metric',
      signals.successDefinition && 'Success Definition',
      signals.backlogItems && 'Backlog Items',
    ].filter(Boolean).join(', ') || 'Strategic Gaps (absence of signals)'}.`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderEvaluation(ranked, inputs, signals) {
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
  lines.push('## Product Signals Detected');
  lines.push('');
  for (const [signal, detected] of Object.entries(signals)) {
    lines.push(`- ${signal}: ${detected ? 'Detected' : 'Not detected'}`);
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
  const [goals, strategy, backlog, decisions, executionModel, repositoryHealth, architecture, contextPackage, redesignDoc, decisionRankingRaw] = await Promise.all([
    readAiText(repositoryPath, 'goals.md'),
    readAiText(repositoryPath, 'strategy.md'),
    readAiText(repositoryPath, 'backlog.md'),
    readAiText(repositoryPath, 'decisions.md'),
    readAiText(repositoryPath, 'execution-model.md'),
    readAiText(repositoryPath, 'repository-health.md'),
    readAiText(repositoryPath, 'architecture.md'),
    readAiText(repositoryPath, 'context-package.md'),
    readDocsText(repositoryPath, 'repository-improvement-product-redesign.md'),
    readAiText(repositoryPath, 'decision-ranking.json'),
  ]);

  const decisionRanking = (() => { try { return JSON.parse(decisionRankingRaw); } catch { return null; } })();
  const activeRepoJudgmentTitle = decisionRanking?.candidates?.[0]?.title ?? 'Not available';

  const inputs = {
    '.ai/goals.md': Boolean(goals.trim()),
    '.ai/strategy.md': Boolean(strategy.trim()),
    '.ai/backlog.md': Boolean(backlog.trim()),
    '.ai/architecture.md': Boolean(architecture.trim()),
    '.ai/context-package.md': Boolean(contextPackage.trim()),
    '.ai/decisions.md': Boolean(decisions.trim()),
    '.ai/execution-model.md': Boolean(executionModel.trim()),
    '.ai/repository-health.md': Boolean(repositoryHealth.trim()),
    '.ai/decision-ranking.json': Boolean(decisionRankingRaw.trim()),
    'docs/repository-improvement-product-redesign.md': Boolean(redesignDoc.trim()),
  };

  const signals = detectSignals(goals, strategy, backlog, architecture);

  // Collect candidates from all sources, in decreasing product-value order
  const candidates = [];

  // From product redesign doc (highest product value — Agent IDE only)
  if (redesignDoc.trim()) {
    candidates.push(...REDESIGN_CANDIDATES);
  }

  // From positive product signals present in the repository
  candidates.push(...candidatesFromCurrentFocus(goals));
  candidates.push(...candidatesFromProductBet(strategy));
  candidates.push(...candidatesFromCurrentExperiment(strategy));
  candidates.push(...candidatesFromNorthStar(goals));
  candidates.push(...candidatesFromSuccessDefinition(goals));

  // Product thesis only if no more specific signals found (avoid duplicate thesis coverage)
  if (!signals.currentFocus && !signals.productBet) {
    candidates.push(...candidatesFromProductThesis(goals, strategy));
  }

  // From strategic gaps (fires when signals are ABSENT)
  candidates.push(...detectStrategicGaps(goals, strategy));

  // From backlog (lower product value, maintenance-oriented)
  candidates.push(...candidatesFromBacklog(backlog));

  // Deduplicate by id (first occurrence wins — higher value sources are pushed first)
  const seen = new Set();
  const unique = candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // Rank all candidates by composite score
  const ranked = rankCandidates(unique);

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

  const md = renderMarkdown(ranked, activeRepoJudgmentTitle, inputs, signals);
  const evaluation = renderEvaluation(ranked, inputs, signals);

  await mkdir(join(repositoryPath, '.ai'), { recursive: true });
  await Promise.all([
    writeFile(join(repositoryPath, '.ai', 'product-judgment.json'), JSON.stringify(json, null, 2), 'utf8'),
    writeFile(join(repositoryPath, '.ai', 'product-judgment.md'), md, 'utf8'),
    writeFile(join(repositoryPath, '.ai', 'product-judgment-evaluation.md'), evaluation, 'utf8'),
  ]);

  return json;
}
