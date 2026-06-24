import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const aiDir = join(root, '.ai');
const outputPath = join(aiDir, 'strategy.md');
const manualHeader = '## Manual Strategy Notes';
const headings = [
  'Product Thesis',
  'North Star Metric',
  'Strategic Differentiator',
  'Current Product Bet',
  'Current Experiment',
  'What Not To Build',
  'Success Definition',
];

async function exists(path) {
  try { await stat(path); return true; } catch (error) { if (error?.code === 'ENOENT') return false; throw error; }
}

async function readIfExists(path) {
  return (await exists(path)) ? readFile(path, 'utf8') : '';
}

async function readManualNotes() {
  if (!(await exists(outputPath))) return `${manualHeader}\n`;
  const current = await readFile(outputPath, 'utf8');
  const index = current.indexOf(manualHeader);
  return index === -1 ? `${manualHeader}\n` : `${current.slice(index).trimEnd()}\n`;
}

function compact(value) { return value.replace(/\s+/g, ' ').trim(); }

function section(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function cleanSectionValue(value) {
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function firstSentence(markdown) {
  const text = compact(markdown.replace(/```[\s\S]*?```/g, '').replace(/^#+\s+.*$/gm, '').replace(/^[-*]\s+/gm, ''));
  return text.match(/^[^.!?]+[.!?]/)?.[0] ?? text.slice(0, 220);
}

async function strategyDocs() {
  const docsDir = join(root, 'docs');
  if (!(await exists(docsDir))) return {};
  const entries = await readdir(docsDir, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isFile() && /(?:STRATEGY|PRODUCT|ROADMAP|VISION)/i.test(entry.name))
    .map((entry) => join(docsDir, entry.name));
  return Object.fromEntries(await Promise.all(matches.map(async (path) => [relative(root, path), await readFile(path, 'utf8')])));
}

function explicitValue(sources, heading) {
  for (const source of sources) {
    const value = cleanSectionValue(section(source.text, heading));
    if (value) return { value, evidence: source.name };
  }
  return null;
}

function matchLine(sources, patterns) {
  for (const source of sources) {
    const lines = source.text.split('\n').map((line) => line.trim()).filter(Boolean);
    for (const pattern of patterns) {
      const hit = lines.find((line) => pattern.test(line));
      if (hit) return { value: hit.replace(/^[-*]\s+/, ''), evidence: source.name };
    }
  }
  return null;
}

function inferNearify(sources, field) {
  const all = sources.map((source) => source.text).join('\n');
  if (!/Nearify/i.test(all)) return null;
  const hasFollowUps = /follow[- ]?ups?/i.test(all);
  const hasBetweenEvents = /between events/i.test(all);
  const hasRelationshipMemory = /relationship memory|relationship context|real-world relationships?|real-world encounters?|encounter/i.test(all);
  if (field === 'North Star Metric' && hasFollowUps) return 'Follow-Ups Completed';
  if (field === 'Strategic Differentiator' && hasRelationshipMemory) return 'Relationship memory from real-world encounters.';
  if (field === 'Current Product Bet' && hasBetweenEvents) return 'Between Events experience.';
  if (field === 'What Not To Build' && /event app|events?/i.test(all)) return 'Do not treat Nearify as primarily an event app.';
  if (field === 'Success Definition' && (hasFollowUps || /reach out/i.test(all))) return 'User knows who to reach out to today and completes more follow-ups.';
  return null;
}

function inferField(field, sources) {
  const explicit = explicitValue(sources, field);
  if (explicit) return explicit;

  const patterns = {
    'North Star Metric': [/north star/i, /follow[- ]?ups? completed/i, /primary metric/i],
    'Strategic Differentiator': [/strategic differentiator/i, /differentiator/i, /relationship memory/i],
    'Current Product Bet': [/current product bet/i, /strategic bet/i, /between events/i],
    'Current Experiment': [/current experiment/i, /experiment/i],
    'What Not To Build': [/what not to build/i, /do not build/i, /not primarily/i, /primarily an event app/i],
    'Success Definition': [/success definition/i, /success criteria/i, /reach out to today/i],
  };
  const matched = matchLine(sources, patterns[field] ?? []);
  if (matched) return matched;

  const nearify = inferNearify(sources, field);
  if (nearify) return { value: nearify, evidence: 'deterministic Nearify product signals' };

  if (field === 'Product Thesis') {
    const architectureThesis = explicitValue(sources, 'Product Thesis') ?? explicitValue(sources, 'Product Purpose');
    if (architectureThesis) return architectureThesis;
    const readme = sources.find((source) => source.name === 'README.md');
    const sentence = readme ? firstSentence(readme.text) : '';
    if (sentence) return { value: sentence, evidence: 'README.md' };
  }

  return { value: '- Not detected yet.', evidence: '' };
}

const docs = await strategyDocs();
const sources = [
  { name: '.ai/goals.md', text: await readIfExists(join(aiDir, 'goals.md')) },
  { name: '.ai/architecture.md', text: await readIfExists(join(aiDir, 'architecture.md')) },
  { name: '.ai/decisions.md', text: await readIfExists(join(aiDir, 'decisions.md')) },
  { name: 'README.md', text: await readIfExists(join(root, 'README.md')) },
  ...Object.entries(docs).map(([name, text]) => ({ name, text })),
].filter((source) => source.text.trim());

const manualNotes = await readManualNotes();
const sections = headings.flatMap((heading) => {
  const inferred = inferField(heading, sources);
  return [`## ${heading}`, inferred.value, inferred.evidence ? `\nEvidence: ${inferred.evidence}` : ''];
});

const content = ['# Strategy', '', ...sections, manualNotes].join('\n').replace(/\n{3,}/g, '\n\n');
await mkdir(aiDir, { recursive: true });
await writeFile(outputPath, content.endsWith('\n') ? content : `${content}\n`);
console.log(`Wrote ${outputPath}`);
