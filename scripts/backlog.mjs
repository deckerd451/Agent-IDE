import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';

const root = process.cwd();
const aiDir = join(root, '.ai');
const backlogPath = join(aiDir, 'backlog.md');
const manualHeader = '## Manual Backlog';
const maxFiles = 1000;
const ignoredDirectories = new Set(['.git', '.ai', 'node_modules', 'dist', 'build', 'coverage', '.vite']);
const scannableCodeExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.scss',
  '.html',
  '.json',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.kt',
  '.swift',
  '.rb',
  '.php',
]);
const priorityOrder = ['High Priority', 'Medium Priority', 'Low Priority'];
const gapPatterns = [
  /\bknown gaps?\b/i,
  /\bfuture work\b/i,
  /\blimitations?\b/i,
  /\bmissing capabilities?\b/i,
  /\bnot included\b/i,
  /\bintentionally not included\b/i,
  /\bdoes not include\b/i,
];

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readTextIfExists(path) {
  if (!(await pathExists(path))) return '';
  return readFile(path, 'utf8');
}

async function walk(directory, files = []) {
  if (files.length >= maxFiles) return files;

  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= maxFiles) break;
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walk(fullPath, files);
      continue;
    }

    if (entry.isFile()) files.push(relative(root, fullPath));
  }

  return files;
}

function compact(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function titleCase(value) {
  return value
    .replace(/[`*_#[\]()]/g, '')
    .replace(/^[\s:-]+/, '')
    .split(/\s+/)
    .slice(0, 10)
    .map((word) => (word.length <= 3 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ')
    .replace(/[.,:;]+$/, '');
}

function normalizeKey(value) {
  return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function source(path, lineNumber) {
  return lineNumber ? `${path}:${lineNumber}` : path;
}

function classifyPriority(text) {
  if (/\b(fixme|xxx|broken|missing|does not include|not included|limitation|gap)\b/i.test(text)) {
    return 'High Priority';
  }
  if (/\b(todo|future work|planned|next|should|needs?|add|support|no )\b/i.test(text)) {
    return 'Medium Priority';
  }
  return 'Low Priority';
}

function buildItem({ text, source: itemSource, type }) {
  const normalizedText = compact(text.replace(/^(TODO|FIXME|HACK|XXX|NOTE)\b\s*:?\s*/i, ''));
  const fallbackTitle = type === 'comment' ? 'Review Repository Comment' : 'Review Documented Gap';
  const title = titleCase(normalizedText) || fallbackTitle;

  return {
    title,
    source: itemSource,
    reason:
      type === 'comment'
        ? `Repository comment marked this as ${normalizedText || 'work requiring attention'}.`
        : `Repository documentation identifies this gap or future work: ${normalizedText || 'review the source for details'}.`,
    suggestedNextStep:
      type === 'comment'
        ? 'Inspect the referenced code path, decide whether the comment still applies, and convert it into an implementation task or remove it.'
        : 'Validate the documented gap against current behavior, then define the smallest local change that closes it.',
    priority: classifyPriority(`${type} ${normalizedText}`),
    key: normalizeKey(normalizedText),
  };
}

function scanComments(path, content) {
  if (!scannableCodeExtensions.has(extname(path))) return [];

  const commentPattern = /(?:\/\/|#|<!--|\/\*|\*)\s*\b(TODO|FIXME|HACK|XXX|NOTE)\b\s*:?(.*?)(?:-->|\*\/)?$/i;
  return content
    .split('\n')
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => commentPattern.test(line))
    .map(({ line, lineNumber }) => {
      const match = line.match(commentPattern);
      return buildItem({ text: `${match[1]}: ${match[2] ?? ''}`, source: source(path, lineNumber), type: 'comment' });
    });
}

function scanMarkdownGaps(path, content) {
  const lines = content.split('\n');
  const items = [];
  let activeGapHeading = false;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) return;

    if (/^#{1,6}\s+/.test(trimmed)) {
      activeGapHeading = gapPatterns.some((pattern) => pattern.test(trimmed));
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)/);
    const mentionsGap = gapPatterns.some((pattern) => pattern.test(trimmed));
    const isNegativeCapability = /\b(no|not included|does not include|limitation|gap)\b/i.test(trimmed);
    if ((activeGapHeading && bullet) || (bullet && mentionsGap && isNegativeCapability) || (!bullet && mentionsGap && isNegativeCapability && trimmed.length > 30)) {
      items.push(
        buildItem({
          text: bullet ? bullet[1] : trimmed,
          source: source(path, index + 1),
          type: 'document',
        }),
      );
    }
  });

  return items;
}

async function readExistingManualBacklog() {
  if (!(await pathExists(backlogPath))) return `${manualHeader}\n`;
  const current = await readFile(backlogPath, 'utf8');
  const manualMatch = current.match(new RegExp(`^${manualHeader}$`, 'm'));
  if (!manualMatch || manualMatch.index === undefined) return `${manualHeader}\n`;
  return `${current.slice(manualMatch.index).trimEnd()}\n`;
}

function dedupe(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = item.key || normalizeKey(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result.sort((a, b) => a.title.localeCompare(b.title));
}

function formatItems(items) {
  if (items.length === 0) return '- None detected';

  return items
    .map(
      (item) => `- **${item.title}**\n  - Source: ${item.source}\n  - Reason: ${item.reason}\n  - Suggested Next Step: ${item.suggestedNextStep}`,
    )
    .join('\n');
}

function calculateConfidence({ filesScanned, items }) {
  let score = 40;
  if (filesScanned > 0) score += 25;
  if (items.length > 0) score += 20;
  if (items.some((item) => item.source.startsWith('README'))) score += 10;
  if (items.some((item) => item.source.startsWith('.ai/'))) score += 5;
  return `${Math.min(score, 95)}%`;
}

const files = await walk(root);
const manualBacklog = await readExistingManualBacklog();
const allItems = [];
let filesScanned = 0;

for (const file of files) {
  const isReadme = basename(file).toLowerCase().startsWith('readme') && extname(file).toLowerCase() === '.md';
  const shouldScanCode = scannableCodeExtensions.has(extname(file));
  if (!isReadme && !shouldScanCode) continue;

  const content = await readTextIfExists(join(root, file));
  filesScanned += 1;
  allItems.push(...scanComments(file, content));
  if (isReadme) allItems.push(...scanMarkdownGaps(file, content));
}

if (await pathExists(aiDir)) {
  const aiEntries = await readdir(aiDir, { withFileTypes: true });
  for (const entry of aiEntries) {
    if (!entry.isFile() || extname(entry.name) !== '.md' || entry.name === 'backlog.md') continue;
    const file = `.ai/${entry.name}`;
    const content = await readTextIfExists(join(aiDir, entry.name));
    filesScanned += 1;
    allItems.push(...scanMarkdownGaps(file, content));
  }
}

const items = dedupe(allItems);
const grouped = Object.fromEntries(priorityOrder.map((priority) => [priority, items.filter((item) => item.priority === priority)]));
const auditedAt = new Date().toISOString();
const generated = `# Backlog

Last Audit: ${auditedAt}
Confidence: ${calculateConfidence({ filesScanned, items })}

## High Priority
${formatItems(grouped['High Priority'])}

## Medium Priority
${formatItems(grouped['Medium Priority'])}

## Low Priority
${formatItems(grouped['Low Priority'])}

${manualBacklog}`;

await mkdir(aiDir, { recursive: true });
await writeFile(backlogPath, generated);

console.log(`Updated ${relative(root, backlogPath)}.`);
console.log(`Items: ${items.length}`);
