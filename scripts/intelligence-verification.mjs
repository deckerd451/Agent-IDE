import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalManualGoalsUpdateLines, canonicalManualGoalsSuggestedUpdate } from './canonical-completeness.mjs';
import { classifyEvidenceSource, confidenceFromEvidence } from './evidence-lineage.mjs';

export const expectedVerifiedArtifacts = [
  'strategy.md',
  'architecture.md',
  'backlog.md',
  'validation.md',
  'decisions.md',
  'repository-health.md',
  'context-package.md',
  'next-improvement-prompt.md',
  'intelligence-quality.json',
  'intelligence-history.json',
  'intelligence-snapshot.json',
  'intelligence-diff.json',
  'intelligence-timeline.json',
  'intelligence-explanations.json',
  'prompts/architect.md',
  'prompts/builder.md',
  'prompts/reviewer.md',
  'prompts/debugger.md',
];

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function statusFromFailures(failures) {
  return failures.length ? 'Failed' : 'Verified';
}

function normalizeManualUpdateLine(value) {
  return value.replace(/^```(?:md)?\s*$/i, '').replace(/^```$/i, '').trim();
}

function suggestedManualUpdateLabels(suggestedManualUpdate, explanationManual) {
  const canonicalLines = new Map((explanationManual?.requiredFields ?? [])
    .filter((field) => field.label && field.manualUpdate)
    .map((field) => [normalizeManualUpdateLine(field.manualUpdate), field.label]));
  const labels = new Set();
  for (const rawLine of suggestedManualUpdate.split('\n')) {
    const line = normalizeManualUpdateLine(rawLine);
    if (!line) continue;
    const exactLabel = canonicalLines.get(line);
    if (exactLabel) labels.add(exactLabel);
  }
  return labels;
}

function productDecisionManualUpdateMismatch(explanationManual, suggestedManualUpdate) {
  const missingFields = explanationManual?.missing ?? [];
  const missing = new Set(missingFields);
  const expectedLines = canonicalManualGoalsUpdateLines(explanationManual).map(normalizeManualUpdateLine);
  const suggested = suggestedManualUpdateLabels(suggestedManualUpdate, explanationManual);
  const omitted = missingFields.filter((field) => !suggested.has(field));
  const incorrectlySuggested = [...suggested].filter((field) => !missing.has(field));
  const expectedNoUpdates = canonicalManualGoalsSuggestedUpdate(explanationManual);
  const trimmed = suggestedManualUpdate.trim();
  if (missing.size === 0 && trimmed === expectedNoUpdates) return null;
  if (missing.size > 0 && expectedLines.length === missing.size && omitted.length === 0 && incorrectlySuggested.length === 0 && [...suggested].length === missing.size) return null;
  return `Product Decision Package contradiction: Suggested Manual Update does not match canonical completeness evaluation. Canonical missing fields: ${missingFields.length ? missingFields.join(', ') : 'none'}. Suggested Manual Update fields: ${suggested.size ? [...suggested].join(', ') : 'none'}. Omitted missing fields: ${omitted.length ? omitted.join(', ') : 'none'}. Incorrectly suggested completed fields: ${incorrectlySuggested.length ? incorrectlySuggested.join(', ') : 'none'}.`;
}

function crossCheck(name, failures) {
  return { check: name, status: statusFromFailures(failures), failures };
}

export async function readVerification(repositoryPath) {
  return JSON.parse(await readFile(join(repositoryPath, '.ai', 'intelligence-verification.json'), 'utf8').catch(() => 'null'));
}

export async function verifyIntelligence(repositoryPath, options = {}) {
  const aiDir = join(repositoryPath, '.ai');
  const now = options.now ?? new Date();
  const refreshStartedAt = options.refreshStartedAt ? new Date(options.refreshStartedAt) : null;
  const previous = options.previousVerification ?? await readVerification(repositoryPath);
  const displayedContents = options.displayedContents ?? {};
  const expectedArtifacts = options.expectedArtifacts ?? expectedVerifiedArtifacts;
  const artifacts = [];

  for (const artifact of expectedArtifacts) {
    const path = join(aiDir, artifact);
    const failures = [];
    let exists = true;
    let content = '';
    let stats = null;
    try {
      [content, stats] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
    } catch (error) {
      if (error?.code === 'ENOENT') exists = false;
      else throw error;
    }

    const generatedHash = exists ? sha256(content) : null;
    const displayedContent = Object.prototype.hasOwnProperty.call(displayedContents, artifact) ? displayedContents[artifact] : content;
    const displayedHash = exists ? sha256(displayedContent ?? '') : null;
    const generatedAt = stats?.mtime ? stats.mtime.toISOString() : null;
    const previousArtifact = previous?.artifacts?.find((item) => item.artifact === artifact);

    if (!exists) failures.push('Expected artifact missing.');
    if (exists && refreshStartedAt && stats.mtime < refreshStartedAt) failures.push('Artifact timestamp is older than refresh start.');
    if (exists && generatedHash !== displayedHash) failures.push('Displayed hash differs from generated hash.');
    if (exists && options.requireChangedArtifacts?.includes(artifact) && previousArtifact?.generatedHash === generatedHash && refreshStartedAt) failures.push('Refresh completed but artifact hash is unchanged.');

    artifacts.push({
      artifact,
      generatedAt,
      generatedHash,
      displayedHash,
      status: statusFromFailures(failures),
      failures,
    });
  }

  const failures = artifacts.flatMap((item) => item.failures.map((failure) => `${item.artifact}: ${failure}`));
  const crossChecks = [];

  const [health, qualityText, packageText, explanationText, rankingText] = await Promise.all([
    readFile(join(aiDir, 'repository-health.md'), 'utf8').catch(() => ''),
    readFile(join(aiDir, 'intelligence-quality.json'), 'utf8').catch(() => ''),
    readFile(join(aiDir, 'next-improvement-prompt.md'), 'utf8').catch(() => ''),
    readFile(join(aiDir, 'intelligence-explanations.json'), 'utf8').catch(() => ''),
    readFile(join(aiDir, 'decision-ranking.json'), 'utf8').catch(() => ''),
  ]);
  const quality = qualityText ? JSON.parse(qualityText) : null;
  const explanations = explanationText ? JSON.parse(explanationText) : null;
  const decisionRanking = rankingText ? JSON.parse(rankingText) : null;
  const lineage = JSON.parse(await readFile(join(aiDir, 'evidence-lineage.json'), 'utf8').catch(() => 'null'));
  const synthesisPersisted = JSON.parse(await readFile(join(aiDir, 'evidence-synthesis.json'), 'utf8').catch(() => 'null'));
  if (lineage?.sources?.length) {
    for (const item of lineage.sources) {
      const actual = classifyEvidenceSource(item.file);
      if (actual !== item.category) failures.push(`Evidence lineage mismatch: ${item.file} persisted as ${item.category} but canonical classifier returns ${actual}.`);
    }
    const generatedIndependent = lineage.sources.filter((item) => classifyEvidenceSource(item.file) === 'Generated' && item.category !== 'Generated');
    if (generatedIndependent.length) failures.push(`Evidence lineage invalid: generated artifacts counted as independent evidence (${generatedIndependent.map((item) => item.file).join(', ')}).`);
  }
  const healthManual = health.match(/^-\s*Manual Goals:\s*(Missing|Partial|Complete|Strong)\s*\((\d+)%\)/im);
  const qualityManual = quality?.canonicalIntelligenceQuality?.fields?.manualGoals;
  if (healthManual && qualityManual && (healthManual[1] !== qualityManual.state || Number(healthManual[2]) !== Number(qualityManual.percent))) {
    failures.push(`Canonical completeness mismatch: Repository Health Manual Goals ${healthManual[1]} (${healthManual[2]}%) vs Intelligence Quality ${qualityManual.state} (${qualityManual.percent}%).`);
  }
  if (qualityManual && Number(qualityManual.percent) >= 100 && /Manual Goals.*(?:partially complete|incomplete|below the deterministic threshold|manual goals completeness)/i.test(packageText)) {
    failures.push('Product Decision Package contradicts Manual Goals completeness threshold.');
  }
  const explanationManual = explanations?.completeness?.fields?.manualGoals;
  if (qualityManual && explanationManual && (qualityManual.state !== explanationManual.classification || Number(qualityManual.percent) !== Number(explanationManual.computed?.percent))) {
    failures.push(`Explanation contradiction: Manual Goals ${explanationManual.classification} (${explanationManual.computed?.percent}%) vs Intelligence Quality ${qualityManual.state} (${qualityManual.percent}%).`);
  }


  const evidenceSynthesis = quality?.canonicalIntelligenceQuality?.evidenceSynthesis;
  const explanationSynthesis = explanations?.evidenceSynthesis;
  if (evidenceSynthesis && explanationSynthesis) {
    const qualityConfidence = quality?.confidence?.lineageConfidence;
    if (qualityConfidence && lineage?.sources?.length) {
      const expectedConfidence = confidenceFromEvidence(lineage.sources);
      if (qualityConfidence.confidence !== expectedConfidence.confidence || Number(qualityConfidence.independentGroupCount) !== Number(expectedConfidence.independentGroupCount)) failures.push('Confidence calculation mismatch: Intelligence Quality differs from Evidence Lineage.');
      const healthConfidence = health.match(/^Confidence:\s*(.+)$/im)?.[1]?.trim();
      if (healthConfidence && healthConfidence !== expectedConfidence.confidence) failures.push('Confidence calculation mismatch: Repository Health differs from Evidence Lineage.');
    }
    if (synthesisPersisted && JSON.stringify(synthesisPersisted.fields ?? {}) !== JSON.stringify(evidenceSynthesis.fields ?? {})) failures.push('Evidence Synthesis mismatch: persisted synthesis differs from Intelligence Quality.');
    if (evidenceSynthesis.strength !== explanationSynthesis.strength || Number(evidenceSynthesis.supportedFields) !== Number(explanationSynthesis.supportedFields)) failures.push('Evidence Synthesis mismatch: Intelligence Quality and Intelligence Explanations differ.');
    for (const [key, field] of Object.entries(evidenceSynthesis.fields ?? {})) {
      const explanationField = explanationSynthesis.fields?.[key];
      if (!explanationField) failures.push(`Evidence Synthesis mismatch: missing explanation field ${field.label}.`);
      if (field.suggestedWording && explanationField?.suggestedWording !== field.suggestedWording) failures.push(`Evidence Synthesis mismatch: suggested wording differs for ${field.label}.`);
      if (field.suggestedWording && !(field.evidence ?? []).some((item) => item.wording === field.suggestedWording)) failures.push(`Evidence Synthesis invalid: suggested wording does not exactly match evidence for ${field.label}.`);
      if (field.confidence && explanationField?.confidence && field.confidence !== explanationField.confidence) failures.push(`Evidence Synthesis mismatch: confidence differs for ${field.label}.`);
      if (field.suggestedWording && packageText.includes(`
${field.label}
`) && !packageText.includes(field.suggestedWording)) failures.push(`Evidence Synthesis mismatch: Product Decision Package omitted selected wording for ${field.label}.`);
      if (field.suggestedWording && decisionRanking?.candidates?.some((candidate) => candidate.id === 'missing-manual-goals') && decisionRanking.candidates.find((candidate) => candidate.id === 'missing-manual-goals')?.evidenceSynthesis) {
        const rankingField = decisionRanking.candidates.find((candidate) => candidate.id === 'missing-manual-goals')?.evidenceSynthesis?.fields?.[key];
        if (rankingField?.suggestedWording && rankingField.suggestedWording !== field.suggestedWording) failures.push(`Evidence Synthesis mismatch: Decision Ranking differs for ${field.label}.`);
      }
    }
  }

  if (/## Selected Issue/i.test(packageText) && !decisionRanking?.candidates?.length) {
    failures.push('Decision ranking missing or empty.');
  } else if (decisionRanking?.candidates?.length) {
    const sorted = decisionRanking.candidates.slice().sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    const highest = sorted[0];
    const selected = decisionRanking.candidates.find((candidate) => candidate.selected);
    if (!selected) failures.push('Decision ranking has no selected candidate.');
    if (selected && highest && selected.id !== highest.id) failures.push('Decision ranking contradiction: selected issue is not rank #1.');
    if (decisionRanking.selectedIssue?.id && highest?.id && decisionRanking.selectedIssue.id !== highest.id) failures.push('Decision ranking contradiction: selectedIssue does not match rank #1 candidate.');
    if (highest?.title && packageText && !packageText.includes(highest.title)) failures.push('Package contradiction: generated package does not reference the rank #1 selected issue.');
    if (explanations?.decisionRanking?.selected?.id && highest?.id && explanations.decisionRanking.selected.id !== highest.id) failures.push('Explanation contradiction: decision ranking explanation selected issue differs from decision-ranking.json.');
    const packageRankingTitles = [...packageText.matchAll(/^\d+\.\s+(.+?)(?:\s+\(selected\))?$/gm)].map((match) => match[1]);
    if (packageRankingTitles.length && packageRankingTitles.join('|') !== sorted.map((issue) => issue.title).join('|')) failures.push('Package contradiction: Decision Ranking section order differs from decision-ranking.json.');
  }

  if (packageText && explanations?.recommendation?.selected?.title && !packageText.includes(explanations.recommendation.selected.title)) {
    failures.push('Explanation contradiction: selected recommendation is not referenced by generated package.');
  }
  if (/^- Package Type: product-decision$/im.test(packageText) && /^- ID: missing-manual-goals$/im.test(packageText)) {
    if (!explanationManual) failures.push('Product Decision Package warning: canonical completeness explanation was not generated.');
    if (!/## Deterministic Evaluation/i.test(packageText)) failures.push('Product Decision Package missing Deterministic Evaluation section.');
    if (explanationManual) {
      const packagePercent = packageText.match(/Completeness percentage:\s*(\d+)%/i)?.[1];
      const packageClassification = packageText.match(/Classification:\s*(Missing|Partial|Complete|Strong)/i)?.[1];
      if (packagePercent && Number(packagePercent) !== Number(explanationManual.computed?.percent)) failures.push(`Product Decision Package explanation mismatch: package Manual Goals ${packagePercent}% vs explanation ${explanationManual.computed?.percent}%.`);
      if (packageClassification && packageClassification !== explanationManual.classification) failures.push(`Product Decision Package explanation mismatch: package Manual Goals ${packageClassification} vs explanation ${explanationManual.classification}.`);
      for (const missing of explanationManual.missing ?? []) {
        if (!packageText.includes(missing)) failures.push(`Product Decision Package explanation mismatch: missing field not shown: ${missing}.`);
      }
      const suggestedManualUpdate = mdSection(packageText, 'Suggested Manual Update');
      const mismatch = productDecisionManualUpdateMismatch(explanationManual, suggestedManualUpdate);
      if (mismatch) failures.push(mismatch);
    }
  }
  const crossFailures = failures.filter((failure) => !artifacts.some((item) => failure.startsWith(`${item.artifact}: `)));
  if (crossFailures.length) crossChecks.push(crossCheck('Cross-artifact consistency', crossFailures));
  const verifiedCount = artifacts.filter((item) => item.status === 'Verified').length + crossChecks.filter((item) => item.status === 'Verified').length;
  const verificationRows = artifacts.length + crossChecks.length;
  const score = verificationRows ? Math.round((verifiedCount / verificationRows) * 100) : 100;
  const metadata = {
    schemaVersion: 1,
    verifiedAt: now.toISOString(),
    refreshStartedAt: refreshStartedAt?.toISOString() ?? null,
    status: statusFromFailures(failures),
    score,
    failureCount: failures.length,
    failureReason: failures[0] ?? null,
    summary: failures.length ? `${failures.length} verification failure${failures.length === 1 ? '' : 's'} detected.` : 'All displayed intelligence verified.',
    failures,
    artifacts,
    crossChecks,
  };

  if (options.persist !== false) {
    await mkdir(aiDir, { recursive: true });
    await writeFile(join(aiDir, 'intelligence-verification.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  }
  return metadata;
}
