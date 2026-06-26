import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

export const lineageCategories = ['Canonical', 'Independent', 'Generated'];

export const generatedPatterns = [
  /^\.ai\/(?:strategy|context-package|repository-health|intelligence-quality|intelligence-history|intelligence-snapshot|intelligence-diff|intelligence-timeline|intelligence-verification|intelligence-explanations|decision-ranking|next-improvement-prompt|evidence-synthesis|evidence-lineage)\.(?:md|json)$/i,
  /^\.ai\/prompts\//i,
  /^\.ai\/(?:exports|snapshots|timeline|diff)\//i,
];

export function normalizeEvidencePath(file = '') {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function classifyEvidenceSource(file = '') {
  const normalized = normalizeEvidencePath(file);
  if (/^\.ai\/goals\.md$/i.test(normalized) || /^goals\.md$/i.test(normalized)) return 'Canonical';
  if (/^README(?:\.md)?$/i.test(normalized) || /^README\.md$/i.test(normalized)) return 'Canonical';
  if (generatedPatterns.some((pattern) => pattern.test(normalized))) return 'Generated';
  if (/^\.ai\/(?:architecture|validation|decisions|backlog|agents|code|intelligence-audit)\.md$/i.test(normalized)) return 'Independent';
  if (/^(?:docs|documentation|architecture|decisions|decision-logs|adr|validation)\//i.test(normalized)) return 'Independent';
  if (/\.md$/i.test(normalized)) return 'Independent';
  return 'Independent';
}

export function evidenceGroupName(file = '') {
  const normalized = normalizeEvidencePath(file);
  if (/^\.ai\/goals\.md$|^goals\.md$/i.test(normalized)) return 'Goals';
  if (/^README(?:\.md)?$/i.test(normalized)) return 'README';
  if (/decisions/i.test(normalized)) return 'Decision Log';
  if (/architecture/i.test(normalized)) return 'Architecture';
  if (/validation/i.test(normalized)) return 'Validation';
  if (/strategy/i.test(normalized)) return 'Strategy';
  if (/context-package/i.test(normalized)) return 'Context Package';
  if (/repository-health/i.test(normalized)) return 'Repository Health';
  const base = basename(normalized).replace(/\.(md|json)$/i, '').replace(/-/g, ' ');
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildLineageModel(sources = []) {
  const seen = new Map();
  for (const source of sources) {
    const file = normalizeEvidencePath(typeof source === 'string' ? source : source.file ?? source.source ?? '');
    if (!file) continue;
    const category = classifyEvidenceSource(file);
    const group = evidenceGroupName(file);
    seen.set(file, { file, category, group, ancestry: category === 'Generated' ? 'Generated descendant of canonical and independent repository intelligence.' : 'Repository-local source.' });
  }
  const items = [...seen.values()].sort((a, b) => a.category.localeCompare(b.category) || a.group.localeCompare(b.group) || a.file.localeCompare(b.file));
  const byCategory = Object.fromEntries(lineageCategories.map((category) => [category, items.filter((item) => item.category === category)]));
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), categories: byCategory, sources: items };
}

export function confidenceFromEvidence(items = []) {
  const independentGroups = new Set(items.filter((item) => item.category !== 'Generated').map((item) => item.group));
  const generatedGroups = new Set(items.filter((item) => item.category === 'Generated').map((item) => item.group));
  const count = independentGroups.size;
  const confidence = count >= 3 ? 'High' : count === 2 ? 'Medium' : count === 1 ? 'Low' : 'None';
  return { confidence, independentGroups: [...independentGroups].sort(), generatedConfirmations: [...generatedGroups].sort(), independentGroupCount: count, generatedConfirmationCount: generatedGroups.size, rule: 'Confidence is based only on canonical plus independent evidence groups; generated confirmations verify consistency but do not increase confidence.' };
}

export async function persistEvidenceLineage(repositoryPath = process.cwd(), sources = []) {
  const model = buildLineageModel(sources.length ? sources : ['.ai/goals.md','README.md','.ai/architecture.md','.ai/validation.md','.ai/decisions.md','.ai/strategy.md','.ai/context-package.md','.ai/repository-health.md','.ai/prompts/architect.md']);
  await mkdir(join(repositoryPath, '.ai'), { recursive: true });
  await writeFile(join(repositoryPath, '.ai/evidence-lineage.json'), `${JSON.stringify(model, null, 2)}\n`);
  return model;
}

export async function readEvidenceLineage(repositoryPath = process.cwd()) {
  return JSON.parse(await readFile(join(repositoryPath, '.ai/evidence-lineage.json'), 'utf8').catch(() => 'null'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await persistEvidenceLineage(process.cwd());
  console.log('Wrote .ai/evidence-lineage.json');
}
