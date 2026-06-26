import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
      const missing = new Set(explanationManual.missing ?? []);
      const suggestedManualUpdate = mdSection(packageText, 'Suggested Manual Update');
      const suggestedLabels = new Set([...suggestedManualUpdate.matchAll(/^-\s*([^:\n]+):/gm)].map((match) => match[1].trim()));
      for (const field of explanationManual.requiredFields ?? []) {
        if (suggestedLabels.has(field.label) && !missing.has(field.label)) failures.push(`Product Decision Package manual update mismatch: ${field.label} suggested but deterministic evaluation marks it complete.`);
        if (missing.has(field.label) && field.manualUpdate && !suggestedManualUpdate.includes(field.manualUpdate)) failures.push(`Product Decision Package manual update mismatch: missing field not suggested: ${field.label}.`);
      }
    }
  }
  const verifiedCount = artifacts.filter((item) => item.status === 'Verified').length;
  const score = artifacts.length ? Math.round((verifiedCount / artifacts.length) * 100) : 100;
  const metadata = {
    schemaVersion: 1,
    verifiedAt: now.toISOString(),
    refreshStartedAt: refreshStartedAt?.toISOString() ?? null,
    status: statusFromFailures(failures),
    score,
    summary: failures.length ? `${failures.length} verification failure${failures.length === 1 ? '' : 's'} detected.` : 'All displayed intelligence verified.',
    failures,
    artifacts,
  };

  if (options.persist !== false) {
    await mkdir(aiDir, { recursive: true });
    await writeFile(join(aiDir, 'intelligence-verification.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  }
  return metadata;
}
