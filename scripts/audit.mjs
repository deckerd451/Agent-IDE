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
  const candidates = [
    ...firstSentences(readme, 2),
    ...bulletsUnderHeading(aiDocuments['goals.md'] ?? '', 'Active', 2),
  ];

  if (candidates.length > 0) {
    return unique(candidates).slice(0, 3);
  }

  return [
    `Low confidence: this appears to be ${packageJson?.name ? `the ${packageJson.name} repository` : 'a software repository'}, but no README or goals text was available to explain the product purpose.`,
  ];
}

function inferCoreSystems({ folders, files, dependencies, scripts, aiDocuments }) {
  const systems = [];

  if (files.some((file) => file.startsWith('src/')) || folders.includes('src/')) {
    systems.push('Application shell: source files under `src/` provide the runnable user interface or main application code.');
  }

  if (dependencies.includes('react')) {
    systems.push('React UI: React and React DOM render the local interface.');
  }

  if (dependencies.includes('vite')) {
    systems.push('Vite toolchain: Vite provides local development, preview, and production bundling workflows.');
  }

  if (folders.includes('scripts/')) {
    systems.push('Repository automation: scripts under `scripts/` initialize and audit local repository-understanding files.');
  }

  const aiFiles = Object.entries(aiDocuments).filter(([, content]) => content.trim().length > 0);
  if (aiFiles.length > 0) {
    systems.push('`.ai/` knowledge contract: markdown documents hold local goals, architecture, backlog, decisions, validation, agent planning, and code notes.');
  }

  if (Object.keys(scripts).length > 0) {
    systems.push('Package workflows: npm scripts expose the main local commands for development, validation, initialization, and audit.');
  }

  return systems;
}

function inferPrimaryFlows({ dependencies, scripts, aiDocuments }) {
  const flows = [];

  if ((aiDocuments['code.md'] ?? '').includes('src/App.tsx')) {
    flows.push('Section metadata selects a `.ai/*.md` file, and the React application renders that markdown as the active repository-understanding tab.');
  } else if (dependencies.includes('react')) {
    flows.push('Local source files feed the React application, which renders the repository-facing interface.');
  }

  if (scripts.audit) {
    flows.push('`npm run audit` scans local repository signals and rewrites `.ai/architecture.md` while preserving the manual notes section.');
  }

  if (scripts['init:ai']) {
    flows.push('`npm run init:ai` creates missing starter `.ai/` markdown files without overwriting existing notes.');
  }

  if (scripts.build) {
    flows.push('`npm run build` runs the configured production validation/build pipeline.');
  }

  return flows;
}

function inferCurrentFocus(readme, aiDocuments) {
  return unique([
    ...bulletsUnderHeading(readme, 'Current scope', 4),
    ...bulletsUnderHeading(aiDocuments['goals.md'] ?? '', 'Active', 3),
    ...bulletsUnderHeading(aiDocuments['backlog.md'] ?? '', 'Next', 3),
  ]).slice(0, 7);
}

function inferKeyCommands(scripts) {
  return Object.entries(scripts).map(([name, command]) => `\`npm run ${name}\` — ${command}`);
}

function inferKnownGaps(readme, aiDocuments) {
  return unique([
    ...bulletsUnderHeading(aiDocuments['validation.md'] ?? '', 'Gaps', 6),
    ...bulletsUnderHeading(aiDocuments['goals.md'] ?? '', 'Deferred', 6),
    ...bulletsAfterLabel(readme, 'Intentionally not included:', 10),
  ]).slice(0, 10);
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
const primaryFlows = inferPrimaryFlows({ dependencies, scripts, aiDocuments });
const currentFocus = inferCurrentFocus(readme, aiDocuments);
const keyCommands = inferKeyCommands(scripts);
const knownGaps = inferKnownGaps(readme, aiDocuments);
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
${formatList(productThesis)}

## Core Systems
${formatList(coreSystems)}

## Primary Flows
${formatList(primaryFlows)}

## Current Focus
${formatList(currentFocus)}

## Key Commands
${formatList(keyCommands)}

## Known Gaps
${formatList(knownGaps)}

## Repository Structure

### Languages
${formatList(languages)}

### Folders
${formatList(folders)}

### Files
${formatList(majorFiles)}

### Dependencies
${formatList(dependencies)}

${manualNotes}`;

await mkdir(aiDir, { recursive: true });
await writeFile(architecturePath, generated);

console.log(`Updated ${relative(root, architecturePath)}.`);
console.log(`Confidence: ${confidence}`);
