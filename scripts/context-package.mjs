import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const sourceFiles = {
  goals: 'goals.md',
  architecture: 'architecture.md',
  decisions: 'decisions.md',
  strategy: 'strategy.md',
  validation: 'validation.md',
  backlog: 'backlog.md',
  health: 'repository-health.md',
  next: 'next-improvement-prompt.md',
};

async function readAiFile(aiDir, fileName) {
  return readFile(join(aiDir, fileName), 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return `# ${fileName}\n\n- Missing. Run Refresh Intelligence to generate this file.`;
    throw error;
  });
}

async function readAiJson(aiDir, fileName) {
  const text = await readFile(join(aiDir, fileName), 'utf8').catch((error) => error?.code === 'ENOENT' ? '' : Promise.reject(error));
  if (!text.trim()) return null;
  return JSON.parse(text);
}

function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() || '- No generated content available yet.';
}

function firstMatchingSection(markdown, headings) {
  for (const heading of headings) {
    const content = extractSection(markdown, heading);
    if (!content.startsWith('- No generated content')) return content;
  }
  return '- No generated content available yet.';
}

function formatExpectedImprovement(value) {
  if (!value || typeof value !== 'object') return 'unknown';
  const entries = Object.entries(value).map(([key, amount]) => `${key}: ${amount}`);
  return entries.length ? entries.join(', ') : 'unknown';
}

export function renderDecisionRanking(ranking) {
  if (!ranking?.candidates?.length) return '- No decision ranking available. Run Next Improvement to generate `.ai/decision-ranking.json`.';
  const selected = ranking.selectedIssue ?? ranking.candidates.find((candidate) => candidate.selected) ?? ranking.candidates[0];
  const selectedCandidate = ranking.candidates.find((candidate) => candidate.id === selected?.id) ?? selected;
  const lines = [
    `Selected Issue: ${selectedCandidate?.title ?? selected?.title ?? 'Unknown'}`,
    `Selected Issue ID: ${selectedCandidate?.id ?? selected?.id ?? 'Unknown'}`,
    `Package Type/Actionability: ${selectedCandidate?.packageType ?? selectedCandidate?.actionability ?? 'Unknown'}`,
    `Priority Score: ${selectedCandidate?.priorityScore ?? selectedCandidate?.priority ?? 'Unknown'}`,
    `Expected Improvement: ${formatExpectedImprovement(selectedCandidate?.expectedImprovement)}`,
    `Deterministic Selection Explanation: ${ranking.selectionExplanation ?? ranking.explanation?.reason ?? selectedCandidate?.explanation?.reason ?? 'Ranked candidates are sorted by deterministic repository-local scoring; rank #1 is selected.'}`,
    '',
    'Ranked Candidates:',
    ...ranking.candidates.map((candidate) => [
      `${candidate.rank ?? '?'}. ${candidate.title ?? 'Untitled'} (${candidate.id ?? 'unknown-id'})`,
      `  - selected: ${candidate.selected ? 'yes' : 'no'}`,
      `  - package type/actionability: ${candidate.packageType ?? candidate.actionability ?? 'Unknown'}`,
      `  - priority score: ${candidate.priorityScore ?? candidate.priority ?? 'Unknown'}`,
      `  - expected improvement: ${formatExpectedImprovement(candidate.expectedImprovement)}`,
      candidate.reason ? `  - reason: ${candidate.reason}` : null,
      candidate.recommendedAction ? `  - recommended action: ${candidate.recommendedAction}` : null,
    ].filter(Boolean).join('\n')),
    '',
    'Selection Rules:',
    ...((ranking.scoringRules ?? ranking.explanation?.scoringRules ?? ['Rank candidates deterministically using repository-local evidence and select rank #1.']).map((rule) => `- ${rule}`)),
  ];
  if ((ranking.tieBreaking ?? ranking.explanation?.tieBreaking)?.length) {
    lines.push('', 'Tie Breakers:', ...((ranking.tieBreaking ?? ranking.explanation.tieBreaking).map((rule) => `- ${rule}`)));
  }
  return lines.join('\n');
}


function renderProductIntelligenceSection(pi) {
  if (!pi || pi.productIntelligenceState === 'blocked') {
    return 'Product Intelligence not available. Run `node scripts/product-intelligence.mjs`.';
  }
  return [
    `**Product Thesis:** ${pi.productThesis?.text ?? 'Not defined'}`,
    `**Current Product Bet:** ${pi.currentProductBet?.text ?? 'Not defined'}`,
    `**Repository Alignment:** ${pi.repositoryAlignment?.verdict}`,
    `**Highest-Leverage Milestone:** ${pi.highestLeverageMilestone?.text ?? 'Not derived'}`,
    pi.strategicRecommendation ? `**Strategic Gap:** ${pi.strategicRecommendation.gap}` : '',
  ].filter(Boolean).join('\n');
}

export async function generateContextPackage(repositoryPath = process.cwd()) {
  const aiDir = join(repositoryPath, '.ai');
  const outputPath = join(aiDir, 'context-package.md');
  const docs = Object.fromEntries(
    await Promise.all(Object.entries(sourceFiles).map(async ([key, fileName]) => [key, await readAiFile(aiDir, fileName)])),
  );
  const ranking = await readAiJson(aiDir, 'decision-ranking.json');
  const pi = await readAiJson(aiDir, 'product-intelligence.json');
  const outcomes = await readAiFile(aiDir, 'outcomes.md');

  const content = [
    '# Context Package',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Product Thesis',
    firstMatchingSection(docs.goals, ['Product Purpose', 'Product Thesis']),
    '',
    '## Current Focus',
    firstMatchingSection(docs.goals, ['Current Focus']),
    '',
    '## Canonical Intelligence Ownership',
    'Human-owned source of truth: `.ai/goals.md`. Generated artifacts are regenerated from canonical intelligence and are not manual editing targets.',
    '',
    '## Strategy',
    [
      firstMatchingSection(docs.strategy, ['North Star Metric']),
      firstMatchingSection(docs.strategy, ['Strategic Differentiator']),
      firstMatchingSection(docs.strategy, ['Current Product Bet']),
      firstMatchingSection(docs.strategy, ['What Not To Build']),
      firstMatchingSection(docs.strategy, ['Success Definition']),
      `Strategy Confidence: ${firstMatchingSection(docs.strategy, ['Strategy Confidence'])}`,
      `Strategy Evidence Sources:\n${firstMatchingSection(docs.strategy, ['Strategy Evidence Sources'])}`,
    ].join('\n\n'),
    '',
    '## Core Systems',
    firstMatchingSection(docs.architecture, ['Core Systems', 'Primary Flows', 'Implementation Entry Points']),
    '',
    '## Key Decisions',
    firstMatchingSection(docs.decisions, ['Active Decisions', 'Key Decisions', 'Manual Decisions']),
    '',
    '## Decision Ranking',
    renderDecisionRanking(ranking),
    '',
    '## Product Intelligence',
    renderProductIntelligenceSection(pi),
    '',
    '## Highest-Priority Issue',
    firstMatchingSection(docs.next, ['Selected Issue']),
    '',
    '## Next Implementation Step',
    firstMatchingSection(docs.next, ['Goal', 'Decision Needed', 'Experiment', 'Current Evidence']),
    '',
    '## Validation Summary',
    [
      firstMatchingSection(docs.validation, ['Overall Status', 'Confidence']),
      firstMatchingSection(docs.validation, ['Commands Run', 'Known Validation Gaps']),
    ].join('\n\n'),
    '',
    '## Current Backlog',
    firstMatchingSection(docs.backlog, ['Prioritized Backlog', 'Current Backlog', 'Manual Backlog']),
    '',
    '## Repository Health Summary',
    [
      firstMatchingSection(docs.health, ['Intelligence Completeness']),
      firstMatchingSection(docs.health, ['Quality Signals']),
      firstMatchingSection(docs.health, ['Risks']),
      firstMatchingSection(docs.health, ['Recommended Next Step']),
    ].join('\n\n'),
    '',
    '## Outcome Evidence',
    outcomes,
    '',
    '## Confidence Explanation',
    'Confidence is derived from repository-local canonical, independent, and generated evidence lineage. See Repository Health Evidence Lineage and Intelligence Quality confidence fields for the deterministic calculation.',
    '',
  ].join('\n');

  await mkdir(aiDir, { recursive: true });
  await writeFile(outputPath, content);
  return outputPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = await generateContextPackage(resolve(process.argv[2] ?? process.cwd()));
  console.log(`Wrote ${outputPath}`);
}
