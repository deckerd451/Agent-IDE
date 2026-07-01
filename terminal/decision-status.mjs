#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { createRepositoryDecisionFromArtifacts, emptyRepositoryDecision } from '../src/repository-decision.ts';

async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
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

export async function repositoryIntelligenceStatus(repositoryRoot = process.cwd()) {
  const root = resolve(repositoryRoot);
  const aiDir = join(root, '.ai');
  const [status, activeRecommendation, decisionRanking, quality, aiHandoffValidation, healthMarkdown] = await Promise.all([
    readJson(join(aiDir, 'intelligence-snapshot.json')),
    readJson(join(aiDir, 'active-recommendation.json')),
    readJson(join(aiDir, 'decision-ranking.json')),
    readJson(join(aiDir, 'intelligence-quality.json')),
    readJson(join(aiDir, 'ai-handoff-validation.json')),
    readText(join(aiDir, 'repository-health.md')),
  ]);
  return createRepositoryDecisionFromArtifacts({
    repositoryName: status?.repositoryName ?? basename(root),
    status: status ?? { repositoryName: basename(root) },
    activeRecommendation,
    decisionRanking,
    quality,
    aiHandoffValidation,
    healthMarkdown,
  });
}

export function renderRepositoryIntelligence(status) {
  const lines = ['Repository Intelligence'];
  if (!status?.available) {
    lines.push(`  Decision: ${status?.selectedDecision ?? emptyRepositoryDecision}`);
    return lines.join('\n');
  }
  lines.push(`  Decision:          ${status.selectedDecision}`);
  lines.push(`  Why:               ${status.whyNow || status.decisionSummary}`);
  lines.push(`  Owner action:      ${status.recommendedOwnerAction}`);
  lines.push(`  Package type:      ${status.packageType}`);
  lines.push(`  Confidence:        ${status.confidence}`);
  lines.push(`  Handoff readiness: ${status.handoffReadiness}`);
  lines.push(`  Execution ready:   ${status.executionReady}`);
  lines.push(`  Execution agents:  ${status.executionAgents.join(', ')}`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootArgIndex = process.argv.indexOf('--root');
  const root = rootArgIndex >= 0 ? process.argv[rootArgIndex + 1] : process.cwd();
  const status = await repositoryIntelligenceStatus(root).catch(() => createRepositoryDecisionFromArtifacts({ status: { repositoryName: basename(resolve(root)) } }));
  console.log(renderRepositoryIntelligence(status));
}
