import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const aiDir = join(root, '.ai');
const decisionsPath = join(aiDir, 'decisions.md');
const manualHeader = '## Manual Decisions';

const inputFiles = [
  'README.md',
  '.ai/architecture.md',
  '.ai/backlog.md',
  'package.json',
];

const candidateDecisions = [
  {
    title: 'Repository understanding is primary',
    keywords: [/repository understanding/i, /primary (developer )?(interface|surface)/i, /instead of the file tree/i],
    context: 'The README and architecture describe Agent IDE as a developer environment where repository understanding is the primary interface rather than the file tree.',
    reason: 'Starting from goals, architecture, backlog, decisions, validation, agents, and code notes gives humans and automation the context needed before changing implementation details.',
    consequences: 'The UI and generation scripts should prioritize repository context surfaces, and feature work should preserve the dashboard-oriented understanding workflow.',
  },
  {
    title: '.ai/goals.md is canonical repository intent',
    keywords: [/\.ai\//i, /plain markdown/i, /version-controlled/i, /repository memory/i, /repository-understanding sections/i],
    context: 'The repository intelligence contract separates human-owned `.ai/goals.md` from generated `.ai/` artifacts.',
    reason: 'Plain markdown keeps repository-owner intent local and reviewable while deterministic generators rebuild derived context for humans and future automation.',
    consequences: 'Repository owners should edit `.ai/goals.md`; generated intelligence should be regenerated from that canonical source and remain diffable.',
  },
  {
    title: 'Local-first before cloud',
    keywords: [/local-first/i, /local Vite/i, /local-only/i, /local deterministic/i, /repository-local/i, /without calling/i],
    context: 'The documented scope emphasizes a local Vite app, repository-local `.ai/` files, and local npm scripts for intelligence generation.',
    reason: 'Local-first workflows keep the prototype simple, inspectable, and usable without external services while the repository-understanding contract matures.',
    consequences: 'New intelligence commands should read local files, write local markdown, avoid cloud dependencies, and remain safe to run from the repository checkout.',
  },
  {
    title: 'No LLM dependency in core intelligence generation',
    keywords: [/without (calling )?an? LLM/i, /LLM calls/i, /No LLM integration/i, /does not call an LLM/i],
    context: 'README and architecture repeatedly state that audit, backlog, validation, and prompt generation do not call an LLM, and LLM integration is intentionally out of scope.',
    reason: 'Core repository intelligence should be reproducible and understandable from checked-in source material instead of depending on model availability or hidden inference.',
    consequences: 'Generation scripts must not call LLM APIs, should document deterministic inputs, and should treat future LLM features as optional layers rather than core requirements.',
  },
  {
    title: 'Deterministic generation preferred over inference',
    keywords: [/deterministic/i, /scans local/i, /safe local/i, /does not execute agents/i, /known gaps/i],
    context: 'Existing commands derive architecture, backlog, validation, and prompts from explicit local repository signals such as README content, `.ai/` documents, package scripts, source structure, comments, and dependencies.',
    reason: 'Deterministic generation makes repository intelligence auditable, repeatable, and suitable for version control review.',
    consequences: 'Decision generation should use transparent heuristics, avoid opaque summarization, preserve manual decisions, and prefer stable output over speculative conclusions.',
  },
  {
    title: 'Decisions explain why rather than what to build next',
    keywords: [/Decisions/i, /why they were made/i, /Backlog/i, /future work/i, /Suggested Next Step/i],
    context: 'The README distinguishes decisions from backlog by describing decisions as technical tradeoffs and why they were made, while backlog captures future work items.',
    reason: 'Separating rationale from tasks prevents decision records from becoming another task list and keeps architectural intent visible.',
    consequences: 'Generated decision records should include context, reason, and consequences, and should not duplicate backlog items or suggested next steps.',
  },
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

async function readPackageJson() {
  const text = await readTextIfExists(join(root, 'package.json'));
  if (!text.trim()) return { text: '', packageJson: null };
  return { text, packageJson: JSON.parse(text) };
}

async function readExistingManualDecisions() {
  if (!(await pathExists(decisionsPath))) return `${manualHeader}\n`;
  const current = await readFile(decisionsPath, 'utf8');
  const manualIndex = current.indexOf(manualHeader);
  if (manualIndex === -1) return `${manualHeader}\n`;
  return current.slice(manualIndex).trimEnd() + '\n';
}

function compact(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeDecisionKey(value) {
  return compact(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractManualDecisionKeys(manualDecisions) {
  const keys = new Set();
  const headingPattern = /^###\s+(.+)$/gm;
  for (const match of manualDecisions.matchAll(headingPattern)) {
    keys.add(normalizeDecisionKey(match[1]));
  }

  const bulletPattern = /^-\s+(?:Decision:\s*)?(.+)$/gim;
  for (const match of manualDecisions.matchAll(bulletPattern)) {
    keys.add(normalizeDecisionKey(match[1]));
  }

  return keys;
}

function hasEvidence(decision, corpus) {
  return decision.keywords.some((pattern) => pattern.test(corpus));
}

function formatDecision(decision) {
  return `### ${decision.title}\n\nContext:\n${decision.context}\n\nReason:\n${decision.reason}\n\nConsequences:\n${decision.consequences}`;
}

function calculateConfidence({ readme, architecture, backlog, packageJson, decisions }) {
  let score = 20;
  if (readme.trim()) score += 25;
  if (architecture.trim()) score += 20;
  if (backlog.trim()) score += 10;
  if (packageJson) score += 10;
  if (decisions.length >= 3) score += 15;
  return Math.min(score, 95);
}

const [readme, architecture, backlog, manualDecisions, { text: packageText, packageJson }] = await Promise.all([
  readTextIfExists(join(root, 'README.md')),
  readTextIfExists(join(aiDir, 'architecture.md')),
  readTextIfExists(join(aiDir, 'backlog.md')),
  readExistingManualDecisions(),
  readPackageJson(),
]);

const corpus = [readme, architecture, backlog, packageText].join('\n\n');
const manualKeys = extractManualDecisionKeys(manualDecisions);
const seenKeys = new Set(manualKeys);
const activeDecisions = [];

for (const decision of candidateDecisions) {
  const key = normalizeDecisionKey(decision.title);
  if (seenKeys.has(key) || !hasEvidence(decision, corpus)) continue;
  seenKeys.add(key);
  activeDecisions.push(decision);
}

const confidence = `${calculateConfidence({ readme, architecture, backlog, packageJson, decisions: activeDecisions })}%`;
const auditedAt = new Date().toISOString();
const activeContent = activeDecisions.length > 0
  ? activeDecisions.map(formatDecision).join('\n\n')
  : 'No active decisions could be inferred from the configured local inputs.';

const generated = `# Decisions\n\nLast Audit: ${auditedAt}\nConfidence: ${confidence}\n\n## Active Decisions\n\n${activeContent}\n\n${manualDecisions}`;

await mkdir(aiDir, { recursive: true });
await writeFile(decisionsPath, generated);

console.log(`Updated ${relative(root, decisionsPath)}.`);
console.log(`Inputs: ${inputFiles.join(', ')}`);
console.log(`Active decisions: ${activeDecisions.length}`);
console.log(`Confidence: ${confidence}`);
