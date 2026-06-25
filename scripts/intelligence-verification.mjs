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
  'prompts/architect.md',
  'prompts/builder.md',
  'prompts/reviewer.md',
  'prompts/debugger.md',
];

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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
