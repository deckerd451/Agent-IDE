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

async function detectDependencies() {
  const packageJsonPath = join(root, 'package.json');
  if (!(await pathExists(packageJsonPath))) {
    return [];
  }

  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  return [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ].sort((a, b) => a.localeCompare(b));
}

function buildSummary({ languages, folders, files, dependencies }) {
  const appType = dependencies.includes('vite') && dependencies.includes('react')
    ? 'a local Vite and React application'
    : 'a local software repository';
  const primaryLanguage = languages.includes('TypeScript') ? 'TypeScript' : languages[0] ?? 'the detected source files';
  const folderText = folders.length > 0 ? ` Key areas include ${folders.slice(0, 5).join(', ')}.` : '';
  const fileText = files.length > 0 ? ` Important root files include ${files.slice(0, 5).join(', ')}.` : '';

  return `This repository appears to be ${appType} built primarily with ${primaryLanguage}.${folderText}${fileText} Dependencies are declared in package.json and the audit is generated locally without LLM calls.`;
}

function calculateConfidence({ languages, folders, files, dependencies }) {
  let score = 45;
  if (languages.length > 0) score += 15;
  if (folders.length > 0) score += 10;
  if (files.includes('package.json')) score += 10;
  if (dependencies.length > 0) score += 15;
  if (files.length > 3) score += 5;
  return `${Math.min(score, 95)}%`;
}

const [files, folders, dependencies, manualNotes] = await Promise.all([
  walk(root),
  detectMajorFolders(),
  detectDependencies(),
  readExistingManualNotes(),
]);

const majorFiles = detectMajorFiles(files);
const languages = detectLanguages(files);
const confidence = calculateConfidence({ languages, folders, files: majorFiles, dependencies });
const summary = buildSummary({ languages, folders, files: majorFiles, dependencies });
const auditedAt = new Date().toISOString();

const generated = `# Architecture

Last Audit: ${auditedAt}
Confidence: ${confidence}

Languages:
${formatList(languages)}

Major Areas:
${formatList(folders)}

Major Files:
${formatList(majorFiles)}

Dependencies:
${formatList(dependencies)}

Repository Summary:
${summary}

${manualNotes}`;

await mkdir(aiDir, { recursive: true });
await writeFile(architecturePath, generated);

console.log(`Updated ${relative(root, architecturePath)}.`);
console.log(`Confidence: ${confidence}`);
