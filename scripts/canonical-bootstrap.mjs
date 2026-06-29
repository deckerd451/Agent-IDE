import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export const canonicalIntelligenceArtifacts = ['.ai/goals.md'];

async function exists(path) {
  return access(path).then(() => true).catch((error) => error?.code === 'ENOENT' ? false : Promise.reject(error));
}

function firstPackageScript(packageJson, preferred) {
  const scripts = packageJson?.scripts ?? {};
  return preferred.find((name) => scripts[name]) ?? Object.keys(scripts).sort()[0] ?? '';
}

async function readJsonFile(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

async function readOptional(path) {
  return readFile(path, 'utf8').catch((error) => error?.code === 'ENOENT' ? '' : Promise.reject(error));
}

function titleFromReadme(readme) {
  return readme.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
}

function firstUsefulReadmeLine(readme) {
  return readme.split('\n').map((line) => line.trim()).find((line) => line && !line.startsWith('#') && !/^[-*]\s*$/.test(line)) ?? '';
}

export async function canonicalStatus(repositoryPath, filePath = '.ai/goals.md') {
  const present = await exists(join(repositoryPath, filePath));
  return { filePath, state: present ? 'existing' : 'missing', exists: present };
}

export async function renderCanonicalGoalsTemplate(repositoryPath) {
  const [pkg, readme, architecture] = await Promise.all([
    readJsonFile(join(repositoryPath, 'package.json')),
    readOptional(join(repositoryPath, 'README.md')),
    readOptional(join(repositoryPath, '.ai', 'architecture.md')),
  ]);
  const repositoryName = pkg?.name ?? titleFromReadme(readme) ?? basename(repositoryPath);
  const purposeEvidence = pkg?.description ?? firstUsefulReadmeLine(readme) ?? 'Repository-local purpose evidence was not detected.';
  const validationScript = firstPackageScript(pkg, ['test', 'build', 'lint']);
  const architectureEvidence = architecture.trim() ? '.ai/architecture.md exists and should be used as repository-local architecture evidence during refresh.' : 'No existing .ai/architecture.md was detected before bootstrap.';
  return `# Goals

## Product Purpose
${purposeEvidence}

## Product Thesis
[Repository owner: describe the product thesis for ${repositoryName}.]

## Current Focus
[Repository owner: describe the current focus.]

## Current Product Bet
[Repository owner: describe the primary product hypothesis currently being tested.]

## Strategic Bet
[Repository owner: describe the strategic bet.]

## Product Differentiator
[Repository owner: describe what should make this repository distinct.]

## Long-Term Vision
[Repository owner: describe the long-term vision.]

## Manual Goals
- Product intent: [Repository owner: confirm the intended product outcome.]
- Current focus: [Repository owner: confirm the current focus.]
- Success criteria: ${validationScript ? `Local \`npm run ${validationScript}\` remains a useful validation signal; replace or expand with owner-defined success criteria.` : '[Repository owner: define success criteria.]'}
- Long-term vision: [Repository owner: confirm the long-term vision.]

## Manual Strategy Notes
- Current Product Bet:
  [Repository owner: replace this placeholder with the actual current product bet.]
- North Star Metric:
  [Repository owner: define the primary success metric.]
- Strategic Differentiator:
  [Repository owner: define the differentiator.]
- Success Definition:
  [Repository owner: define what success means.]

## Success Criteria
- [Repository owner: define acceptance and validation criteria.]

## What Not To Build
- [Repository owner: define explicit non-goals.]

## Bootstrap Evidence
- Generated deterministically from repository-local files only.
- Repository name: ${repositoryName}
- Purpose evidence: ${purposeEvidence}
- Validation evidence: ${validationScript ? `package.json script \`${validationScript}\`` : 'No package.json validation script detected.'}
- Architecture evidence: ${architectureEvidence}
`;
}

export async function bootstrapCanonicalIntelligence(repositoryPath, filePath = '.ai/goals.md') {
  if (filePath !== '.ai/goals.md') throw new Error(`Unsupported canonical bootstrap target: ${filePath}`);
  const status = await canonicalStatus(repositoryPath, filePath);
  if (status.exists) return { ...status, bootstrapped: false, markdown: '' };
  const target = join(repositoryPath, filePath);
  const markdown = await renderCanonicalGoalsTemplate(repositoryPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, markdown, { flag: 'wx' });
  return { ...status, bootstrapped: true, markdown };
}
