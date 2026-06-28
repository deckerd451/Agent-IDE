import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';

export const outcomeValues = new Set(['implemented', 'partial', 'skipped', 'failed']);
export const promptQualityValues = new Set(['worked', 'needed_clarification', 'missing_context', 'too_broad', 'wrong_recommendation']);

export function hashPrompt(prompt = '') {
  return createHash('sha256').update(String(prompt)).digest('hex').slice(0, 16);
}

export function recommendationIdFor(recommendation = {}, decisionRanking = null) {
  return decisionRanking?.selectedIssue?.id
    ?? String(recommendation.title ?? 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
    ?? 'unknown';
}

async function readOutcomes(aiDir) {
  const raw = await readFile(join(aiDir, 'outcomes.json'), 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return '[]';
    throw error;
  });
  const parsed = JSON.parse(raw || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

function labelOutcome(value) {
  return ({ implemented: 'Implemented', partial: 'Partially implemented', skipped: 'Skipped', failed: 'Failed' })[value] ?? value ?? 'Unknown';
}

function labelQuality(value) {
  return ({ worked: 'Worked without clarification', needed_clarification: 'Needed clarification', missing_context: 'Missing context', too_broad: 'Too broad', wrong_recommendation: 'Wrong recommendation' })[value] ?? value ?? 'Unknown';
}

export function summarizeOutcomes(outcomes = []) {
  const recent = outcomes.slice(-10);
  const successful = recent.filter((entry) => entry.outcome === 'implemented').length;
  const successRate = recent.length ? Math.round((successful / recent.length) * 100) : null;
  const qualityCounts = recent.reduce((counts, entry) => ({ ...counts, [entry.promptQuality]: (counts[entry.promptQuality] ?? 0) + 1 }), {});
  const qualityTrend = recent.length
    ? Object.entries(qualityCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;
  const failedOrSkipped = outcomes.filter((entry) => ['failed', 'skipped'].includes(entry.outcome)).slice(-5);
  const needsSpecificity = outcomes.filter((entry) => ['needed_clarification', 'missing_context', 'too_broad', 'wrong_recommendation'].includes(entry.promptQuality)).slice(-5);
  return { lastOutcome: outcomes.at(-1) ?? null, recentCount: recent.length, successRate, qualityTrend, failedOrSkipped, needsSpecificity };
}

export function renderOutcomesMarkdown(outcomes = []) {
  const summary = summarizeOutcomes(outcomes);
  const last = summary.lastOutcome;
  return [
    '# Outcome Tracking',
    '',
    '## Last Outcome',
    last ? [
      `- Time: ${last.timestamp}`,
      `- Recommendation: ${last.recommendationTitle}`,
      `- Outcome: ${labelOutcome(last.outcome)}`,
      `- Prompt quality: ${labelQuality(last.promptQuality)}`,
      last.userNote ? `- Note: ${last.userNote}` : '- Note: none',
    ].join('\n') : '- No outcomes recorded yet.',
    '',
    '## Recent Recommendation Success Rate',
    summary.successRate === null ? '- No recent outcomes recorded yet.' : `- ${summary.successRate}% implemented (${summary.recentCount} recent outcome${summary.recentCount === 1 ? '' : 's'}).`,
    '',
    '## Prompt Quality Trend',
    summary.qualityTrend ? `- Most common recent prompt quality: ${labelQuality(summary.qualityTrend)}.` : '- No prompt quality trend yet.',
    '',
    '## Failed/Skipped Recommendations',
    summary.failedOrSkipped.length ? summary.failedOrSkipped.map((entry) => `- ${entry.recommendationTitle} — ${labelOutcome(entry.outcome)} (${entry.timestamp})`).join('\n') : '- None recorded.',
    '',
    '## Recommendations Needing Better Prompt Specificity',
    summary.needsSpecificity.length ? summary.needsSpecificity.map((entry) => `- ${entry.recommendationTitle} — ${labelQuality(entry.promptQuality)} (${entry.timestamp})`).join('\n') : '- None recorded.',
    '',
  ].join('\n');
}

export async function readOutcomeEvidence(repositoryPath) {
  const outcomes = await readOutcomes(join(repositoryPath, '.ai'));
  return { entries: outcomes, summary: summarizeOutcomes(outcomes), markdown: renderOutcomesMarkdown(outcomes) };
}

export async function appendOutcome(repositoryPath, input) {
  const aiDir = join(repositoryPath, '.ai');
  await mkdir(aiDir, { recursive: true });
  if (!outcomeValues.has(input.outcome)) throw new Error('Unsupported outcome.');
  if (!promptQualityValues.has(input.promptQuality)) throw new Error('Unsupported prompt quality.');
  const outcomes = await readOutcomes(aiDir);
  const entry = {
    timestamp: new Date().toISOString(),
    repository: basename(repositoryPath),
    recommendationId: input.recommendationId || 'unknown',
    recommendationTitle: input.recommendationTitle || 'Unknown recommendation',
    promptHash: input.promptHash || hashPrompt(input.prompt || ''),
    outcome: input.outcome,
    promptQuality: input.promptQuality,
    userNote: input.userNote || '',
    testsRun: Array.isArray(input.testsRun) ? input.testsRun : [],
    refreshAfterCompletion: Boolean(input.refreshAfterCompletion),
  };
  const next = [...outcomes, entry];
  await writeFile(join(aiDir, 'outcomes.json'), `${JSON.stringify(next, null, 2)}\n`);
  await writeFile(join(aiDir, 'outcomes.md'), renderOutcomesMarkdown(next));
  return { entry, summary: summarizeOutcomes(next), markdown: renderOutcomesMarkdown(next) };
}
