import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const actionableHeadingPatterns = [
  /\bknown gaps?\b/i,
  /\bgaps?\b/i,
  /\bfuture work\b/i,
  /\bnext work\b/i,
  /\blimitations?\b/i,
  /\bmissing capabilities?\b/i,
  /\bmanual backlog\b/i,
  /\btodos?\b/i,
  /\bfixmes?\b/i,
  /^build$/i,
  /^roadmap$/i,
  /\bfuture work\b/i,
  /\bimplementation recommendations?\b/i,
  /\brecommendations?\b/i,
];
const nonGoalHeadingPatterns = [
  /\bintentionally not included\b/i,
  /\bnot included\b/i,
  /\bnon-goals?\b/i,
  /\bout of scope\b/i,
];
const ignoredAlwaysPatterns = [
  /\bllm (calls?|integration)\b/i,
  /\bagent execution\b/i,
  /\breal agents?\b/i,
];
const ignoredQualityPatterns = [
  /^none detected\.?$/i,
  /^no (?:validation )?gaps? detected\b/i,
  /^no deterministic validation commands were detected\.?$/i,
  /^confidence:?\s*\d+%?\.?$/i,
  /\bconfidence (?:score|level|message)\b/i,
  /\b(?:validation|build|tests?|lint|typecheck|check) (?:passed|succeeded|successful|completed successfully)\b/i,
  /\b(?:success|successful|passed):?\s*(?:validation|build|tests?|lint|typecheck|check)\b/i,
  /\bdetected (?:npm |package |validation )?scripts?\b/i,
  /\bscripts? was detected\b/i,
  /\b(?:npm run|yarn|pnpm|bun) \w[\w:-]*(?:\s*(?:->|was detected|detected)|\s*->\s*generated)\b/i,
  /\blast (?:audit|validation|updated):\b/i,
  /^(?:status|exit code|duration|output summary):\b/i,
  /^generated (?:summary|backlog|architecture|validation|decisions?)\b/i,
  /\bgenerated (?:summary|by|from deterministic|architecture metadata)\b/i,
  /\brepository structure\b/i,
  /\bmajor (?:areas|files)\b/i,
  /\bdependencies\b/i,
  /^version-controlled `?\.ai\/\*\.md`? files\b/i,
];

const implementationRecommendationPatterns = [
  /\b(?:implement|add|build|create|extract|support|generate|export|package|link|document|validate|filter|improve|replace|remove|refactor|introduce|enable|wire|persist|surface)\b/i,
  /\b(?:should|needs?|must)\s+(?:implement|add|build|create|extract|support|generate|export|package|link|document|validate|filter|improve|replace|remove|refactor|introduce|enable|wire|persist|surface)\b/i,
];

const ignoredNonGoalPatterns = [
  /\bauth(entication)?\b/i,
  /\bdatabase(s)?\b/i,
  /\bcode editor\b/i,
  /\bcode editing\b/i,
  /\bllm (calls?|integration)\b/i,
  /\breal agents?\b/i,
  /\bagent execution\b/i,
  /\bthis prototype does not include\b/i,
  /\bdoes not include\b/i,
  /\bnot included\b/i,
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
    .replace(/\s+(so|for|as|without|that|to make)\b.*$/i, '')
    .replace(/[`*_#[\]()]/g, '')
    .replace(/^[\s:-]+/, '')
    .split(/\s+/)
    .slice(0, 10)
    .map((word) => (word.length <= 3 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ')
    .replace(/[.,:;]+$/, '');
}


function stripTrailingNoise(value) {
  return value
    .replace(/\b(yet|currently|today|now)\b[.!?]*$/i, '')
    .replace(/[.!?]+$/g, '')
    .trim();
}

function actionableText(value) {
  const cleaned = stripTrailingNoise(
    compact(value)
      .replace(/^[-*]\s+/, '')
      .replace(/^this prototype does not include\s+/i, '')
      .replace(/^no\s+/i, '')
      .replace(/^missing\s+/i, '')
      .replace(/^lacks?\s+/i, '')
      .replace(/^without\s+/i, ''),
  );

  if (!cleaned) return '';
  if (/^(add|improve|create|extract|support|generate|export|package|link|document|validate|filter)\b/i.test(cleaned)) {
    return cleaned;
  }

  return `Add ${cleaned}`;
}

function isQualityNoise(text) {
  const normalized = compact(text.replace(/^[-*]\s+/, '').replace(/^\*+|\*+$/g, ''));
  if (!normalized) return true;
  return ignoredQualityPatterns.some((pattern) => pattern.test(normalized));
}

function isIgnoredNonGoal(text, context) {
  if (isQualityNoise(text)) return true;
  if (ignoredAlwaysPatterns.some((pattern) => pattern.test(text))) return true;
  if (context === 'known-gap' || context === 'manual-backlog') return false;
  return ignoredNonGoalPatterns.some((pattern) => pattern.test(text));
}

function isActionableRecommendation(text, context) {
  if (context === 'manual-backlog' || context === 'known-gap') return true;
  if (/\b(?:todo|fixme|build|roadmap|known gaps?|future work)\b/i.test(context)) return true;
  return implementationRecommendationPatterns.some((pattern) => pattern.test(text));
}

function normalizeKey(value) {
  return compact(value)
    .toLowerCase()
    .replace(/`[^`]+`/g, ' ')
    .replace(/\b(?:add|build|create|implement|support|enable|improve|refactor|the|a|an|to|for|from|with|that|should|needs?|must|manual|backlog|todo|fixme)\b/g, ' ')
    .replace(/\b(?:feature|task|work|item|capability|implementation)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function buildItem({ text, source: itemSource, type, context = 'document' }) {
  const normalizedText = compact(text.replace(/^(TODO|FIXME|HACK|XXX|NOTE)\b\s*:?\s*/i, ''));
  const sourceText = stripTrailingNoise(normalizedText);
  const taskText = type === 'document' ? actionableText(sourceText) : sourceText;
  const fallbackTitle = type === 'comment' ? 'Review Repository Comment' : 'Review Documented Gap';
  const title = titleCase(taskText) || fallbackTitle;

  return {
    title,
    source: itemSource,
    reason:
      type === 'comment'
        ? `Repository comment marked this as ${sourceText || 'work requiring attention'}.`
        : `Repository documentation identifies actionable follow-up work from: ${sourceText || 'review the source for details'}.`,
    suggestedNextStep:
      type === 'comment'
        ? 'Inspect the referenced code path, decide whether the comment still applies, and convert it into an implementation task or remove it.'
        : `Define the smallest local, deterministic change needed to ${taskText.toLowerCase() || 'close this gap'}.`,
    priority: classifyPriority(`${context} ${sourceText} ${taskText}`),
    key: normalizeKey(taskText || sourceText),
  };
}

function scanComments(path, content) {
  if (!scannableCodeExtensions.has(extname(path))) return [];

  const commentPattern = /(?:\/\/|(?<!#)#|<!--|\/\*|\*)\s*\b(TODO|FIXME|HACK|XXX|NOTE)\b\s*:?(.*?)(?:-->|\*\/)?$/i;
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
  let activeContext = null;
  let activeTopLevelHeading = '';

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) return;

    if (/^#{1,6}\s+/.test(trimmed)) {
      const headingText = trimmed.replace(/^#{1,6}\s+/, '');
      if (/^#{1,2}\s+/.test(trimmed)) activeTopLevelHeading = headingText;

      if (nonGoalHeadingPatterns.some((pattern) => pattern.test(headingText))) {
        activeContext = 'non-goal';
        return;
      }

      if (/\bknown gaps?\b/i.test(headingText) || /\bgaps?\b/i.test(headingText)) {
        activeContext = 'known-gap';
        return;
      }

      if (/\bmanual backlog\b/i.test(headingText)) {
        activeContext = 'manual-backlog';
        return;
      }

      if (actionableHeadingPatterns.some((pattern) => pattern.test(headingText))) {
        activeContext = headingText.toLowerCase();
        return;
      }

      activeContext = null;
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)/);
    if (!bullet || !activeContext || activeContext === 'non-goal') return;

    const text = bullet[1];
    const context = activeContext;
    if (isIgnoredNonGoal(text, context)) return;
    if (!isActionableRecommendation(text, context)) return;
    if (/^implemented now:?$/i.test(activeTopLevelHeading) || /^implemented now:?$/i.test(text)) return;

    items.push(
      buildItem({
        text,
        source: source(path, index + 1),
        type: 'document',
        context,
      }),
    );
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

async function main() {
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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

export {
  actionableText,
  buildItem,
  dedupe,
  isQualityNoise,
  normalizeKey,
  scanComments,
  scanMarkdownGaps,
};
