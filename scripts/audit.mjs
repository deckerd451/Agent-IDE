import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';

const root = process.cwd();
const aiDir = join(root, '.ai');
const architecturePath = join(aiDir, 'architecture.md');
const manualHeader = '## Manual Notes';
const ignoredDirectories = new Set(['.git', '.ai', 'node_modules', 'dist', 'build', 'coverage', '.vite']);
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
  return [...new Set(items.map(compact).filter(Boolean))];
}

function firstSentences(markdown, count = 2) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');
  const paragraphs = withoutCode
    .split(/\n{2,}/)
    .filter((paragraph) => !paragraph.includes('\n- '))
    .map((paragraph) => compact(paragraph.replace(/^#+\s+/gm, '')))
    .filter((paragraph) => paragraph.length > 40);

  return paragraphs.slice(0, count);
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

async function readAiDocuments() {
  const entries = await Promise.all(
    sectionDocuments.map(async (fileName) => [fileName, await readTextIfExists(join(aiDir, fileName))]),
  );

  return Object.fromEntries(entries);
}

function inferProductThesis(readme, aiDocuments, packageJson) {
  const candidates = unique([
    ...firstSentences(readme, 2),
    ...bulletsUnderHeading(aiDocuments['goals.md'] ?? '', 'Active', 2),
  ]);

  if (candidates.length > 0) {
    const thesis = candidates[0].replace(/:$/, '.');
    if (thesis.includes('Agent IDE is a prototype developer environment')) {
      return 'Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.';
    }
    return thesis;
  }

  return `This appears to be ${packageJson?.name ? `the ${packageJson.name} repository` : 'a software repository'}, but no README or goals text was available to explain the product purpose.`;
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

function inferCoreSystems({ files, dependencies, scripts, aiDocuments }) {
  return [
    `Dashboard UI: ${describeDashboardUi({ dependencies, files })}`,
    `Repository Intelligence Contract: ${describeRepositoryIntelligenceContract(aiDocuments)}`,
    `Local Audit Engine: ${describeLocalAuditEngine({ scripts, files })}`,
  ];
}

function inferPrimaryFlows({ scripts }) {
  return [
    'Repository -> .ai files -> Dashboard',
    scripts['init:ai']
      ? 'npm run init:ai -> starter intelligence files'
      : 'Initializer command -> starter intelligence files',
    scripts.audit
      ? 'npm run audit -> generated architecture.md'
      : 'Audit command -> generated architecture.md',
  ];
}

function inferCurrentFocus(readme, aiDocuments) {
  const candidates = unique([
    ...bulletsUnderHeading(aiDocuments['goals.md'] ?? '', 'Active', 1),
    ...bulletsUnderHeading(aiDocuments['backlog.md'] ?? '', 'Next', 2),
  ]);

  if (candidates.length === 0) {
    return 'The repository is currently evolving toward clearer local repository understanding and deterministic project intelligence.';
  }

  const [activeGoal, ...nextWork] = candidates.map((candidate) => candidate.replace(/\.$/, ''));
  const normalizedGoal = activeGoal.startsWith('Make ')
    ? `making ${activeGoal.slice('Make '.length)}`
    : activeGoal.replace(/^./, (letter) => letter.toLowerCase());
  const focus = `The repository is currently evolving toward ${normalizedGoal}`;
  if (nextWork.length === 0) {
    return `${focus}.`;
  }

  const normalizedNextWork = nextWork.map((candidate) => candidate.replace(/^./, (letter) => letter.toLowerCase()));
  return `${focus}, with near-term work to ${normalizedNextWork.join(' and ')}.`;
}

function inferKeyCommands(scripts) {
  return ['dev', 'build', 'init:ai', 'audit']
    .filter((name) => scripts[name])
    .map((name) => `npm run ${name}`);
}

function inferKnownGaps() {
  return [
    'No LLM integration',
    'No agent execution',
    'No validation generation',
    'No backlog generation',
    'No packaged CLI',
  ];
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

const [files, folders, { dependencies, scripts, packageJson }, manualNotes, readme, aiDocuments] = await Promise.all([
  walk(root),
  detectMajorFolders(),
  detectPackageJson(),
  readExistingManualNotes(),
  readTextIfExists(join(root, 'README.md')),
  readAiDocuments(),
]);

const majorFiles = detectMajorFiles(files);
const languages = detectLanguages(files);
const productThesis = inferProductThesis(readme, aiDocuments, packageJson);
const coreSystems = inferCoreSystems({ folders, files, dependencies, scripts, aiDocuments });
const primaryFlows = inferPrimaryFlows({ scripts });
const currentFocus = inferCurrentFocus(readme, aiDocuments);
const keyCommands = inferKeyCommands(scripts);
const knownGaps = inferKnownGaps();
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
${productThesis}

## Core Systems
${formatList(coreSystems)}

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
