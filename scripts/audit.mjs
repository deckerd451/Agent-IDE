import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const aiDir = join(root, '.ai');
const architecturePath = join(aiDir, 'architecture.md');
const manualHeader = '## Manual Notes';
const ignoredDirectories = new Set(['.git', '.ai', 'node_modules', 'dist', 'build', 'coverage', '.vite', 'DerivedData', '.build']);
const maxFiles = 1000;

const languageByExtension = new Map([
  ['.ts', 'TypeScript'],
  ['.tsx', 'TypeScript'],
  ['.js', 'JavaScript'],
  ['.jsx', 'JavaScript'],
  ['.mjs', 'JavaScript'],
  ['.cjs', 'JavaScript'],
  ['.json', 'JSON'],
  ['.css', 'CSS'],
  ['.scss', 'CSS'],
  ['.html', 'HTML'],
  ['.md', 'Markdown'],
  ['.py', 'Python'],
  ['.rs', 'Rust'],
  ['.go', 'Go'],
  ['.java', 'Java'],
  ['.kt', 'Kotlin'],
  ['.swift', 'Swift'],
  ['.rb', 'Ruby'],
  ['.php', 'PHP'],
]);

const importantFileNames = new Set([
  'package.json',
  'vite.config.ts',
  'vite.config.js',
  'tsconfig.json',
  'tsconfig.app.json',
  'README.md',
  'index.html',
]);

const sectionDocuments = [
  'goals.md',
  'architecture.md',
  'backlog.md',
  'decisions.md',
  'validation.md',
  'agents.md',
  'code.md',
];

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function readTextIfExists(path) {
  if (!(await pathExists(path))) {
    return '';
  }

  return readFile(path, 'utf8');
}

async function walk(directory, files = []) {
  if (files.length >= maxFiles) {
    return files;
  }

  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= maxFiles) {
      break;
    }

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        await walk(join(directory, entry.name), files);
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(relative(root, join(directory, entry.name)));
    }
  }

  return files;
}

async function readExistingManualNotes() {
  if (!(await pathExists(architecturePath))) {
    return `${manualHeader}\n`;
  }

  const current = await readFile(architecturePath, 'utf8');
  const manualIndex = current.indexOf(manualHeader);
  if (manualIndex === -1) {
    return `${manualHeader}\n`;
  }

  return current.slice(manualIndex).trimEnd() + '\n';
}

function formatList(items) {
  if (items.length === 0) {
    return '- None detected';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function compact(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean).map(compact).filter(Boolean))];
}

function firstSentences(markdown, count = 2) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '').replace(/^#+\s+.*$/gm, '');
  const paragraphs = withoutCode
    .split(/\n{2,}/)
    .filter((paragraph) => !paragraph.includes('\n- '))
    .map((paragraph) => compact(paragraph))
    .filter((paragraph) => paragraph.length > 40);

  return paragraphs.slice(0, count);
}

const productThesisForbiddenSentencePattern =
  /\b(SELECT policy|table|rows|SQL|RLS|Supabase|audit|ambiguity|optimize|quality|best opportunity|policy|diagnosis|bug|issue|root cause|regression|fix|error|failure|implementation|architecture only|no code|no UI|status:|no code implementation|no ui changes|no behavior changes|implementation note|validation only|audit only)\b/i;

const productThesisExcludedFilePattern = /(^|[/_-])(DIAGNOSIS|AUDIT|VALIDATION|BUG|FIX|REPORT)([/_.-]|$)/i;
const productThesisPreferredFilePattern = /^(README\.md|\.ai\/goals\.md|docs\/.*(ROADMAP|VISION|PRODUCT|STRATEGY).*\.md)$/i;
const productThesisLocalFeaturePattern = /\b(feature|engine|pipeline|surface|diagnostic|diagnosis|audit|policy|bug)\b/i;
const productThesisRepositoryScopePattern = /\b(repository|application|app|product|platform|users|people|relationships|connections)\b/i;

function isProductThesisNoise(value) {
  return productThesisForbiddenSentencePattern.test(value);
}

function isProductThesisBroadEnough(value) {
  if (isProductThesisNoise(value)) {
    return false;
  }

  return !productThesisLocalFeaturePattern.test(value) || productThesisRepositoryScopePattern.test(value);
}

function isProductThesisExcludedSource(source) {
  return productThesisExcludedFilePattern.test(source);
}

function isProductThesisPreferredSource(source) {
  return productThesisPreferredFilePattern.test(source);
}

function productThesisCandidates(markdown, source, count = 2) {
  if (isProductThesisExcludedSource(source)) {
    return [];
  }

  return firstSentences(markdown, count)
    .map((candidate) => candidate.replace(/^[-*]\s+/, ''))
    .filter((candidate) => isProductThesisBroadEnough(candidate))
    .map((candidate) => ({ text: candidate, source, preferred: isProductThesisPreferredSource(source) }));
}

function relationshipApplicationThesis(coreSystems) {
  const systemNames = new Set(coreSystems.map((system) => system.name));
  const hasRelationshipWorkflow =
    systemNames.has('Follow-Up Engine') &&
    systemNames.has('Event Presence') &&
    systemNames.has('Notification Pipeline');
  const hasApplicationSurface =
    systemNames.has('Decision Surface') ||
    systemNames.has('Domain Models') ||
    systemNames.has('People/Profile Surfaces');

  if (!hasRelationshipWorkflow || !hasApplicationSurface) {
    return null;
  }

  return {
    thesis:
      'This repository appears to support a relationship-oriented iOS application that uses event presence, relationship context, follow-up workflows, decision surfaces, and notifications to help users act on real-world connections.',
    evidence: formatEvidence(coreSystems.flatMap((system) => system.sources)),
  };
}

function bulletsUnderHeading(markdown, heading, limit = 5) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`);
  if (start === -1) {
    return [];
  }

  const bullets = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) {
      break;
    }
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
    }
  }

  return bullets.slice(0, limit);
}

function headings(markdown, limit = 12) {
  return markdown
    .split('\n')
    .map((line) => line.match(/^#{1,3}\s+(.+)/)?.[1])
    .filter(Boolean)
    .map(compact)
    .slice(0, limit);
}

function titleCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function bulletsAfterLabel(markdown, label, limit = 8) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim().toLowerCase() === label.toLowerCase());
  if (start === -1) {
    return [];
  }

  const bullets = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ') || (!line.startsWith('- ') && line.trim() !== '')) {
      break;
    }
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2));
    }
  }

  return bullets.slice(0, limit);
}

function detectLanguages(files) {
  const detected = new Set();
  for (const file of files) {
    const language = languageByExtension.get(extname(file));
    if (language) {
      detected.add(language);
    }
  }

  if (files.some((file) => file.endsWith('.tsx') || file.endsWith('.jsx'))) {
    detected.add('React');
  }

  return [...detected].sort((a, b) => a.localeCompare(b));
}

async function detectMajorFolders() {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !ignoredDirectories.has(entry.name))
    .map((entry) => `${entry.name}/`)
    .sort((a, b) => a.localeCompare(b));
}

function detectMajorFiles(files) {
  return files
    .filter((file) => !file.includes('/') && importantFileNames.has(basename(file)))
    .sort((a, b) => a.localeCompare(b));
}

async function detectPackageJson() {
  const packageJsonPath = join(root, 'package.json');
  if (!(await pathExists(packageJsonPath))) {
    return { dependencies: [], scripts: {}, packageJson: null };
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  return {
    dependencies: [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ].sort((a, b) => a.localeCompare(b)),
    scripts: packageJson.scripts ?? {},
    packageJson,
  };
}

async function readDocuments(paths) {
  const entries = await Promise.all(paths.map(async (fileName) => [fileName, await readTextIfExists(join(root, fileName))]));
  return Object.fromEntries(entries.filter(([, content]) => content.trim()));
}

async function readAiDocuments() {
  const entries = await Promise.all(
    sectionDocuments.map(async (fileName) => [fileName, await readTextIfExists(join(aiDir, fileName))]),
  );

  return Object.fromEntries(entries);
}

function formatEvidence(sources) {
  const filtered = unique(sources).slice(0, 8);
  return filtered.length > 0 ? filtered.join(', ') : 'No explicit evidence detected';
}

function inferProductThesis(readme, aiDocuments, packageJson, docs, files, coreSystems) {
  if (isAgentIdeRepository({ packageJson, readme, files })) {
    return {
      thesis:
        'Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.',
      evidence: formatEvidence(['README.md', '.ai/goals.md', 'scripts/audit.mjs']),
    };
  }

  const projectFiles = files.filter((file) => /\.(xcodeproj|xcworkspace)$/.test(file));
  const candidates = [
    ...productThesisCandidates(aiDocuments['goals.md'] ?? '', '.ai/goals.md', 3),
    ...productThesisCandidates(readme, 'README.md', 3),
    ...Object.entries(docs)
      .filter(([docPath]) => isProductThesisPreferredSource(docPath))
      .flatMap(([docPath, doc]) => productThesisCandidates(doc, docPath, 2)),
  ];
  const seen = new Set();
  const uniqueCandidates = candidates.filter((candidate) => {
    const key = compact(candidate.text).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const productOrientedCandidates = uniqueCandidates.filter((candidate) => candidate.preferred);
  const inferredRelationshipThesis = relationshipApplicationThesis(coreSystems);
  if (productOrientedCandidates.length > 0) {
    const selected = productOrientedCandidates[0];
    const thesis = selected.text.replace(/:$/, '.');
    if (thesis.includes('Agent IDE is a prototype developer environment')) {
      return {
        thesis:
          'Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.',
        evidence: formatEvidence([selected.source]),
      };
    }
    return { thesis, evidence: formatEvidence([selected.source]) };
  }

  if (inferredRelationshipThesis) {
    return inferredRelationshipThesis;
  }

  if (coreSystems.length > 0) {
    const systemList = coreSystems
      .slice(0, 4)
      .map((system) => system.name.toLowerCase())
      .join(', ');
    return {
      thesis: `This repository appears to support a product centered on ${systemList}, inferred from dominant domain systems in the local code and documentation.`,
      evidence: formatEvidence(coreSystems.flatMap((system) => system.sources)),
    };
  }

  const projectName = packageJson?.name ?? projectFiles.map((file) => basename(file, extname(file))).sort()[0];
  return {
    thesis: `This appears to be ${projectName ? `the ${projectName} repository` : 'a software repository'}, but no README, docs, goals, or dominant domain-system text was available to explain the product purpose.`,
    evidence: formatEvidence(projectFiles),
  };
}

function describeDashboardUi({ dependencies, files }) {
  if (dependencies.includes('react') && files.some((file) => file.startsWith('src/'))) {
    return 'React/Vite interface that makes repository-understanding markdown the primary navigation surface instead of a file tree.';
  }

  return 'Local user interface layer for presenting repository context.';
}

function describeRepositoryIntelligenceContract(aiDocuments) {
  const populatedDocuments = Object.entries(aiDocuments).filter(([, content]) => content.trim().length > 0).length;
  if (populatedDocuments > 0) {
    return 'Version-controlled `.ai/*.md` files that define goals, architecture, backlog, decisions, validation, agent constraints, and code notes.';
  }

  return 'Plain markdown files under `.ai/` that serve as the local repository-understanding contract.';
}

function describeLocalAuditEngine({ scripts, files }) {
  if (scripts.audit && files.includes('scripts/audit.mjs')) {
    return '`scripts/audit.mjs` deterministically scans local repository signals and regenerates `.ai/architecture.md` without LLM calls.';
  }

  return 'Local deterministic audit workflow for generating architecture understanding from repository files.';
}

function isAgentIdeRepository({ packageJson, readme, files }) {
  return packageJson?.name === 'agent-ide' || (readme.includes('Agent IDE') && files.includes('scripts/audit.mjs'));
}

const architectureSignals = [
  { pattern: /relationship|memory/i, name: 'Relationship Memory' },
  { pattern: /follow.?up/i, name: 'Follow-Up Engine' },
  { pattern: /event|presence/i, name: 'Event Presence' },
  { pattern: /decision|dashboard|surface/i, name: 'Decision Surface' },
  { pattern: /notification|push/i, name: 'Notification Pipeline' },
  { pattern: /people|person|profile|contact/i, name: 'People/Profile Surfaces' },
  { pattern: /auth|login|session/i, name: 'Authentication' },
  { pattern: /navigation|router|coordinator/i, name: 'Navigation' },
  { pattern: /persist|storage|database|cache|store/i, name: 'Persistence' },
  { pattern: /service|client|api/i, name: 'Service Layer' },
  { pattern: /view|screen|page/i, name: 'User Interface Views' },
  { pattern: /model|entity|schema/i, name: 'Domain Models' },
  { pattern: /manager|controller/i, name: 'Managers/Controllers' },
];

function evidenceLabel(source) {
  return source.replace(/^docs\//, 'docs/');
}

function sourceSymbolNames(sourceText) {
  const matches = [...sourceText.matchAll(/\b(?:class|struct|enum|protocol|interface|type|function|const)\s+([A-Z][A-Za-z0-9_]+)/g)];
  return matches.map((match) => match[1]).slice(0, 20);
}

function collectSystemEvidence({ files, docs, sourceDocuments }) {
  const evidence = new Map();
  const add = (name, source) => {
    if (!evidence.has(name)) evidence.set(name, new Set());
    evidence.get(name).add(evidenceLabel(source));
  };

  for (const folder of unique(files.filter((file) => file.includes('/')).map((file) => `${file.split('/')[0]}/`))) {
    for (const signal of architectureSignals) if (signal.pattern.test(folder)) add(signal.name, folder);
  }

  for (const file of files) {
    if (!/\.(swift|ts|tsx|js|jsx|md)$/.test(file)) continue;
    const readable = titleCase(basename(file, extname(file)));
    for (const signal of architectureSignals) if (signal.pattern.test(readable) || signal.pattern.test(file)) add(signal.name, file);
  }

  for (const [file, content] of Object.entries(sourceDocuments)) {
    for (const symbol of sourceSymbolNames(content)) {
      const readable = titleCase(symbol);
      for (const signal of architectureSignals) if (signal.pattern.test(readable)) add(signal.name, `${file}:${symbol}`);
    }
  }

  for (const [docPath, content] of Object.entries(docs)) {
    for (const heading of headings(content, 20)) {
      for (const signal of architectureSignals) if (signal.pattern.test(heading)) add(signal.name, `${docPath}#${heading}`);
    }
  }

  return [...evidence.entries()]
    .map(([name, sources]) => ({ name, sources: [...sources].sort((a, b) => a.localeCompare(b)).slice(0, 5) }))
    .sort((a, b) => b.sources.length - a.sources.length || a.name.localeCompare(b.name))
    .slice(0, 8);
}

function formatCoreSystems(systems) {
  if (systems.length === 0) return '- None detected';
  return systems.map((system) => `- ${system.name}: Inferred from target repository structure and naming.\n  Evidence: ${system.sources.join(', ')}`).join('\n');
}

function inferCoreSystems({ folders, files, dependencies, scripts, aiDocuments, docs, sourceDocuments, packageJson, readme }) {
  if (isAgentIdeRepository({ packageJson, readme, files })) {
    return [
      { name: 'Dashboard UI', sources: ['src/App.tsx', 'src/sections.ts', 'package.json'] },
      { name: 'Repository Intelligence Contract', sources: ['.ai/*.md', 'scripts/init-ai.mjs', 'README.md'] },
      { name: 'Local Audit Engine', sources: ['scripts/audit.mjs', 'package.json'] },
    ];
  }

  const inferred = collectSystemEvidence({ files, docs: { ...docs, 'README.md': readme, '.ai/goals.md': aiDocuments['goals.md'] ?? '' }, sourceDocuments });
  if (inferred.length > 0) return inferred;

  return folders.slice(0, 6).map((folder) => ({
    name: titleCase(folder.replace(/\/$/, '')),
    sources: [folder],
  }));
}

function inferPrimaryFlows({ scripts, coreSystems, packageJson, readme, files }) {
  if (isAgentIdeRepository({ packageJson, readme, files })) {
    return [
      'Repository -> .ai files -> Dashboard',
      scripts['init:ai'] ? 'npm run init:ai -> starter intelligence files' : 'Initializer command -> starter intelligence files',
      scripts.audit ? 'npm run audit -> generated architecture.md' : 'Audit command -> generated architecture.md',
      scripts.backlog ? 'npm run backlog -> generated backlog.md' : 'Backlog command -> generated backlog.md',
    ];
  }

  const names = coreSystems.map((system) => system.name);
  return unique([
    names.includes('Authentication') && 'Authentication -> Session -> Protected Surfaces',
    names.includes('Persistence') && 'Domain Models -> Persistence -> User Interface Views',
    names.includes('Notification Pipeline') && 'Domain Events -> Notification Pipeline -> User Attention',
    names.includes('Event Presence') && 'Events -> Presence State -> People/Profile Surfaces',
    names.includes('Follow-Up Engine') && 'Relationship Memory -> Follow-Up Engine -> Notification Pipeline',
    names.length >= 2 && `${names[0]} -> ${names[1]}`,
  ]).slice(0, 5);
}

function inferCurrentFocus(readme, aiDocuments, packageJson, files) {
  const candidates = unique([
    ...bulletsUnderHeading(aiDocuments['goals.md'] ?? '', 'Active', 1),
    ...bulletsUnderHeading(aiDocuments['backlog.md'] ?? '', 'Next', 2),
  ]);

  if (candidates.length === 0) {
    const projectName = packageJson?.name ?? files.find((file) => /\.(xcodeproj|xcworkspace)$/.test(file))?.replace(/\.(xcodeproj|xcworkspace)$/, '');
    return projectName ? `The repository is currently evolving the ${projectName} product described by its local code and project structure.` : 'No explicit current focus was detected from local goals or backlog notes.';
  }

  const [activeGoal, ...nextWork] = candidates.map((candidate) => candidate.replace(/\.$/, ''));
  const normalizedGoal = activeGoal.startsWith('Make ')
    ? `making ${activeGoal.slice('Make '.length)}`
    : activeGoal.match(/^(Improve|Build|Add|Create|Support|Enable|Detect)\b/)
      ? `${activeGoal.charAt(0).toLowerCase()}${activeGoal.slice(1)}`
      : activeGoal.replace(/^./, (letter) => letter.toLowerCase());
  const focus = `The repository is currently focused on ${normalizedGoal}`;
  if (nextWork.length === 0) {
    return `${focus}.`;
  }

  const normalizedNextWork = nextWork.map((candidate) => candidate.replace(/^./, (letter) => letter.toLowerCase()));
  return `${focus}, with near-term work to ${normalizedNextWork.join(' and ')}.`;
}

function inferKeyCommands(scripts) {
  return ['dev', 'build', 'init:ai', 'audit', 'backlog']
    .filter((name) => scripts[name])
    .map((name) => `npm run ${name}`);
}

function inferKnownGaps(readme, aiDocuments, packageJson, files) {
  if (isAgentIdeRepository({ packageJson, readme, files })) {
    return ['No LLM integration', 'No agent execution', 'No validation generation', 'No packaged CLI'];
  }

  return unique([
    ...bulletsUnderHeading(aiDocuments['backlog.md'] ?? '', 'Known Gaps', 6),
    ...bulletsAfterLabel(readme, 'Known gaps', 6),
    ...bulletsAfterLabel(readme, 'Limitations', 6),
  ]).slice(0, 6);
}

function calculateConfidence({ readme, aiDocuments, packageJson, languages, folders, dependencies, flows }) {
  let score = 20;
  if (readme.trim()) score += 25;
  if ((aiDocuments['goals.md'] ?? '').trim()) score += 15;
  if ((aiDocuments['backlog.md'] ?? '').trim()) score += 10;
  if ((aiDocuments['validation.md'] ?? '').trim()) score += 5;
  if (packageJson) score += 10;
  if (languages.length > 0) score += 5;
  if (folders.length > 0) score += 5;
  if (dependencies.length > 0) score += 5;
  if (flows.length > 0) score += 5;

  return Math.min(score, 95);
}

async function main() {
const [files, folders, { dependencies, scripts, packageJson }, manualNotes, readme, aiDocuments] = await Promise.all([
  walk(root),
  detectMajorFolders(),
  detectPackageJson(),
  readExistingManualNotes(),
  readTextIfExists(join(root, 'README.md')),
  readAiDocuments(),
]);

const docPaths = files.filter((file) => file.startsWith('docs/') && file.endsWith('.md'));
const docs = await readDocuments(docPaths);
const sourcePaths = files.filter((file) => /\.(swift|ts|tsx|js|jsx)$/.test(file)).slice(0, 200);
const sourceDocuments = await readDocuments(sourcePaths);
const majorFiles = detectMajorFiles(files);
const languages = detectLanguages(files);
const coreSystems = inferCoreSystems({ folders, files, dependencies, scripts, aiDocuments, docs, sourceDocuments, packageJson, readme });
const productThesis = inferProductThesis(readme, aiDocuments, packageJson, docs, files, coreSystems);
const primaryFlows = inferPrimaryFlows({ scripts, coreSystems, packageJson, readme, files });
const currentFocus = inferCurrentFocus(readme, aiDocuments, packageJson, files);
const keyCommands = inferKeyCommands(scripts);
const knownGaps = inferKnownGaps(readme, aiDocuments, packageJson, files);
const confidenceScore = calculateConfidence({
  readme,
  aiDocuments,
  packageJson,
  languages,
  folders,
  dependencies,
  flows: primaryFlows,
});
const confidence = `${confidenceScore}%`;
const confidenceNote =
  confidenceScore < 70
    ? '\nLow confidence: the repository did not provide enough README, `.ai/`, package, or structure signals to infer repository understanding reliably.\n'
    : '';
const auditedAt = new Date().toISOString();

const generated = `# Architecture

Last Audit: ${auditedAt}
Confidence: ${confidence}
${confidenceNote}
## Product Thesis
${productThesis.thesis}

Product Thesis Evidence:
${productThesis.evidence}

## Core Systems
${formatCoreSystems(coreSystems)}

## Primary Flows
${formatList(primaryFlows)}

## Current Focus
${currentFocus}

## Key Commands
${formatList(keyCommands)}

## Known Gaps
${formatList(knownGaps)}

## Repository Structure

### Languages
${formatList(languages)}

### Major Areas
${formatList(folders)}

### Major Files
${formatList(majorFiles)}

### Dependencies
${formatList(dependencies)}

${manualNotes}`;

await mkdir(aiDir, { recursive: true });
await writeFile(architecturePath, generated);

console.log(`Updated ${relative(root, architecturePath)}.`);
console.log(`Confidence: ${confidence}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

export {
  inferProductThesis,
  productThesisCandidates,
  isProductThesisNoise,
  isProductThesisBroadEnough,
  isProductThesisExcludedSource,
  isProductThesisPreferredSource,
};
