#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const executionAgents = ['Claude', 'Codex', 'ChatGPT', 'Gemini', 'Generic'];
const emptyDecision = 'Not available — refresh repository intelligence in Agent IDE.';

async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    return '';
  }
}

async function readJson(path) {
  const text = await readText(path);
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function selectedRankingCandidate(ranking) {
  if (!ranking || typeof ranking !== 'object') return null;
  const candidates = Array.isArray(ranking.candidates) ? ranking.candidates : [];
  const selected = ranking.selectedIssue ?? candidates.find((candidate) => candidate?.selected) ?? candidates[0] ?? null;
  if (!selected) return null;
  return candidates.find((candidate) => clean(candidate?.id) && candidate.id === selected.id) ?? selected;
}

function firstValue(...values) {
  for (const value of values) {
    const normalized = clean(value);
    if (normalized) return normalized;
  }
  return '';
}

function formatConfidence(activeRecommendation, selectedCandidate, quality) {
  const confidence = firstValue(
    activeRecommendation?.confidence,
    selectedCandidate?.confidence,
    quality?.confidence?.lineageConfidence?.confidence,
    quality?.confidence?.validationConfidence,
  );
  if (confidence) return confidence;
  if (typeof quality?.confidence?.score === 'number') return `${quality.confidence.score}/100`;
  return 'Unknown';
}

function formatHandoffReadiness(validation, healthMarkdown) {
  const direct = firstValue(validation?.status, validation?.readiness, validation?.handoffReadiness);
  if (direct && typeof validation?.overallScore === 'number') return `${direct} (${validation.overallScore}/100)`;
  if (direct) return direct;
  if (typeof validation?.overallScore === 'number') return `${validation.overallScore}/100`;
  const healthMatch = healthMarkdown.match(/(?:repository\s+handoff\s+readiness|handoff\s+readiness)\s*[:\-]\s*(.+)$/im);
  return clean(healthMatch?.[1]) || 'Unknown';
}

export async function repositoryIntelligenceStatus(repositoryRoot = process.cwd()) {
  const aiDir = join(resolve(repositoryRoot), '.ai');
  const [activeRecommendation, ranking, quality, validation, healthMarkdown] = await Promise.all([
    readJson(join(aiDir, 'active-recommendation.json')),
    readJson(join(aiDir, 'decision-ranking.json')),
    readJson(join(aiDir, 'intelligence-quality.json')),
    readJson(join(aiDir, 'ai-handoff-validation.json')),
    readText(join(aiDir, 'repository-health.md')),
  ]);
  const selectedCandidate = selectedRankingCandidate(ranking);
  const decision = firstValue(
    activeRecommendation?.displayTitle,
    activeRecommendation?.title,
    selectedCandidate?.displayTitle,
    selectedCandidate?.title,
    ranking?.selectedIssue?.title,
  );

  if (!decision) {
    return { available: false, decision: emptyDecision, agents: executionAgents };
  }

  return {
    available: true,
    decision,
    packageType: firstValue(activeRecommendation?.packageType, selectedCandidate?.packageType, selectedCandidate?.actionability) || 'Unknown',
    confidence: formatConfidence(activeRecommendation, selectedCandidate, quality),
    handoffReadiness: formatHandoffReadiness(validation, healthMarkdown),
    agents: executionAgents,
  };
}

export function renderRepositoryIntelligence(status) {
  const lines = ['Repository Intelligence'];
  if (!status?.available) {
    lines.push(`  Decision: ${status?.decision ?? emptyDecision}`);
    return lines.join('\n');
  }
  lines.push(`  Decision:          ${status.decision}`);
  lines.push(`  Package type:      ${status.packageType}`);
  lines.push(`  Confidence:        ${status.confidence}`);
  lines.push(`  Handoff readiness: ${status.handoffReadiness}`);
  lines.push(`  Execution agents:  ${status.agents.join(', ')}`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootArgIndex = process.argv.indexOf('--root');
  const root = rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : process.cwd();
  const status = await repositoryIntelligenceStatus(root).catch(() => ({ available: false, decision: emptyDecision, agents: executionAgents }));
  console.log(renderRepositoryIntelligence(status));
}
