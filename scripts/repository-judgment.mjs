import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const repositoryJudgmentInputs = [
  '.ai/goals.md',
  '.ai/strategy.md',
  '.ai/architecture.md',
  '.ai/backlog.md',
  '.ai/decisions.md',
  '.ai/execution-model.md',
  '.ai/repository-health.md',
  'docs/repository-judgment-engine-rfc.md',
];

const categoryWeights = {
  'product-capability': { impact: 90, effort: 65, urgency: 58, leverage: 68 },
  'ux-improvement': { impact: 78, effort: 72, urgency: 50, leverage: 58 },
  'workflow-simplification': { impact: 74, effort: 70, urgency: 54, leverage: 82 },
  'automation-opportunity': { impact: 68, effort: 75, urgency: 52, leverage: 86 },
  'developer-experience': { impact: 66, effort: 78, urgency: 48, leverage: 80 },
  testing: { impact: 62, effort: 74, urgency: 56, leverage: 76 },
  onboarding: { impact: 58, effort: 82, urgency: 42, leverage: 72 },
  'missing-documentation': { impact: 54, effort: 88, urgency: 38, leverage: 66 },
  maintainability: { impact: 60, effort: 68, urgency: 44, leverage: 74 },
  'technical-debt': { impact: 56, effort: 65, urgency: 46, leverage: 70 },
  performance: { impact: 70, effort: 55, urgency: 50, leverage: 62 },
  'platform-expansion': { impact: 72, effort: 45, urgency: 40, leverage: 70 },
  'strategic-alignment': { impact: 64, effort: 72, urgency: 45, leverage: 75 },
};

function stableHash(value = '') {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  return hash.toString(16).padStart(8, '0').slice(0, 8);
}

function slug(value = '') {
  return value.toLowerCase().replace(/`[^`]*`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'candidate';
}

async function readText(repositoryPath, relativePath) {
  const path = relativePath.startsWith('.ai/') ? join(repositoryPath, relativePath) : join(repositoryPath, relativePath);
  return readFile(path, 'utf8').catch((error) => error?.code === 'ENOENT' ? '' : Promise.reject(error));
}

function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function bulletItems(markdown) {
  return markdown.split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\S/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line && !/^(none|none detected|no .*detected|not detected|generated placeholder|tbd|todo)$/i.test(line));
}

function sourceEvidence(sourceFile, text, sourceSection = '') {
  return { sourceFile, sourceSection, text };
}

function classifyCategory(text, fallback = 'product-capability') {
  const lower = text.toLowerCase();
  if (/capability|feature|user-visible|product/.test(lower)) return 'product-capability';
  if (/test|coverage|fixture|snapshot|validation command/.test(lower)) return 'testing';
  if (/doc|readme|guide|explain|reference|rfc/.test(lower)) return 'missing-documentation';
  if (/onboard|setup|getting started|first run/.test(lower)) return 'onboarding';
  if (/automat|script|ci|generate|refresh/.test(lower)) return 'automation-opportunity';
  if (/workflow|step|queue|handoff|loop|manual/.test(lower)) return 'workflow-simplification';
  if (/ux|ui|screen|empty state|loading|copy|accessib|keyboard|focus/.test(lower)) return 'ux-improvement';
  if (/performance|latency|speed|bundle|cache|memory/.test(lower)) return 'performance';
  if (/platform|adapter|integration|browser|runtime/.test(lower)) return 'platform-expansion';
  if (/maintain|refactor|duplicate|debt|cleanup|complex/.test(lower)) return lower.includes('debt') ? 'technical-debt' : 'maintainability';
  if (/developer|devex|local|debug|error/.test(lower)) return 'developer-experience';
  if (/strategy|goal|north star|success criteria/.test(lower)) return 'strategic-alignment';
  return fallback;
}

function scoreCandidate({ category, evidenceCount, sourceCount, healthyRepository }) {
  const base = categoryWeights[category] ?? categoryWeights['product-capability'];
  const evidenceBoost = Math.min(10, evidenceCount * 3 + sourceCount * 2);
  const healthBoost = healthyRepository && !['testing', 'missing-documentation'].includes(category) ? 4 : 0;
  const impactScore = Math.min(100, base.impact + evidenceBoost + healthBoost);
  const effortScore = Math.max(10, Math.min(100, base.effort - Math.max(0, evidenceCount - 2) * 3));
  const urgencyScore = Math.min(100, base.urgency + evidenceBoost);
  const leverageScore = Math.min(100, base.leverage + sourceCount * 3);
  const confidence = Math.min(0.95, 0.55 + evidenceCount * 0.08 + sourceCount * 0.04);
  const totalScore = Number((impactScore * 0.34 + effortScore * 0.12 + urgencyScore * 0.18 + leverageScore * 0.24 + confidence * 100 * 0.12).toFixed(2));
  return { confidence: Number(confidence.toFixed(2)), impactScore, effortScore, urgencyScore, leverageScore, totalScore };
}

function makeCandidate({ title, category, evidence, whyItMatters, healthyRepository }) {
  const sourceFiles = [...new Set(evidence.map((item) => item.sourceFile))].sort();
  const identity = `${category}|${title}|${evidence.map((item) => `${item.sourceFile}:${item.sourceSection}:${item.text}`).join('|')}`;
  const scores = scoreCandidate({ category, evidenceCount: evidence.length, sourceCount: sourceFiles.length, healthyRepository });
  return {
    id: `shadow-${category}-${slug(title)}-${stableHash(identity)}`,
    title,
    category,
    evidence,
    sourceFiles,
    confidence: scores.confidence,
    impactScore: scores.impactScore,
    effortScore: scores.effortScore,
    urgencyScore: scores.urgencyScore,
    leverageScore: scores.leverageScore,
    totalScore: scores.totalScore,
    whyItMatters,
    whyItIsNotYetSelected: 'Shadow Mode only: this candidate is generated for Repository Judgment Engine v2 evaluation and does not influence Work Queue recommendation ranking, next-improvement ranking, implementation package generation, or UI behavior.',
  };
}

function meaningfulLines(markdown, sectionName) {
  return bulletItems(mdSection(markdown, sectionName) || markdown).slice(0, 8);
}

function buildCandidates(docs) {
  const health = docs['.ai/repository-health.md'] ?? '';
  const healthyRepository = /No repository health risks detected/i.test(health) || !/##\s+Risks[\s\S]*[-*]\s+(?!No repository health risks detected)/i.test(health);
  const candidates = [];

  const backlogItems = meaningfulLines(docs['.ai/backlog.md'] ?? '', 'Prioritized Backlog')
    .concat(meaningfulLines(docs['.ai/backlog.md'] ?? '', 'Current Backlog'));
  for (const item of [...new Set(backlogItems)].slice(0, 10)) {
    const category = classifyCategory(item, 'product-capability');
    candidates.push(makeCandidate({
      title: item.replace(/[.!]$/, ''),
      category,
      evidence: [sourceEvidence('.ai/backlog.md', item, 'Backlog')],
      whyItMatters: 'Backlog evidence names focused future work that can create repository value once the shadow judgment engine becomes authoritative.',
      healthyRepository,
    }));
  }

  for (const section of ['Current Product Bet', 'Strategic Bet', 'Success Definition', 'North Star Metric']) {
    const text = mdSection(docs['.ai/strategy.md'] ?? '', section) || mdSection(docs['.ai/goals.md'] ?? '', section);
    const first = text.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).find(Boolean);
    if (first && !/^(missing|not detected|unknown|tbd|todo)$/i.test(first)) {
      candidates.push(makeCandidate({
        title: `Advance strategy: ${first}`.slice(0, 120),
        category: classifyCategory(first, 'strategic-alignment'),
        evidence: [sourceEvidence(text === mdSection(docs['.ai/strategy.md'] ?? '', section) ? '.ai/strategy.md' : '.ai/goals.md', first, section)],
        whyItMatters: 'Strategy evidence identifies repository-local intent that can prioritize future product improvements beyond health remediation.',
        healthyRepository,
      }));
    }
  }

  const executionItems = bulletItems(docs['.ai/execution-model.md'] ?? '').filter((item) => /manual|workflow|command|automation|validation|handoff|refresh/i.test(item)).slice(0, 6);
  for (const item of executionItems) {
    const category = classifyCategory(item, 'workflow-simplification');
    candidates.push(makeCandidate({
      title: item.replace(/[.!]$/, '').slice(0, 120),
      category,
      evidence: [sourceEvidence('.ai/execution-model.md', item, 'Execution Model')],
      whyItMatters: 'Execution-model evidence can reveal workflow improvements that compound future repository changes.',
      healthyRepository,
    }));
  }

  const architectureItems = bulletItems(docs['.ai/architecture.md'] ?? '').filter((item) => /duplicate|boundary|module|platform|performance|maintain|workflow|ui|api|command/i.test(item)).slice(0, 6);
  for (const item of architectureItems) {
    const category = classifyCategory(item, 'maintainability');
    candidates.push(makeCandidate({
      title: item.replace(/[.!]$/, '').slice(0, 120),
      category,
      evidence: [sourceEvidence('.ai/architecture.md', item, 'Architecture')],
      whyItMatters: 'Architecture evidence identifies structural opportunities that can improve future implementation leverage.',
      healthyRepository,
    }));
  }

  const decisionItems = bulletItems(docs['.ai/decisions.md'] ?? '').filter((item) => /decision|consequence|follow|future|tradeoff|manual|automate|platform/i.test(item)).slice(0, 6);
  for (const item of decisionItems) {
    const category = classifyCategory(item, 'strategic-alignment');
    candidates.push(makeCandidate({
      title: item.replace(/[.!]$/, '').slice(0, 120),
      category,
      evidence: [sourceEvidence('.ai/decisions.md', item, 'Decisions')],
      whyItMatters: 'Decision records capture accepted tradeoffs and future work that the judgment engine can turn into buildable improvements.',
      healthyRepository,
    }));
  }

  const byId = new Map();
  for (const candidate of candidates) {
    if (candidate.evidence.length > 0) byId.set(candidate.id, candidate);
  }
  return [...byId.values()].sort((a, b) => b.totalScore - a.totalScore || a.id.localeCompare(b.id));
}

export function renderRepositoryJudgmentMarkdown(judgment) {
  const lines = [
    '# Repository Judgment (Shadow Mode)',
    '',
    '> Shadow Mode: this artifact is generated for Repository Judgment Engine v2 evaluation only. It does not affect the Work Queue recommendation, next-improvement ranking, implementation package generation, or UI behavior.',
    '',
    `Generated: ${judgment.generatedAt}`,
    `Mode: ${judgment.mode}`,
    `Candidate count: ${judgment.candidates.length}`,
    '',
    '## Inputs',
    '',
    ...judgment.inputs.map((input) => `- ${input}`),
    '',
    '## Selection Status',
    '',
    '- No candidate in this artifact is selected by the current product.',
    '- Current recommendation ranking remains owned by `.ai/decision-ranking.json` and `.ai/next-improvement-prompt.md`.',
    '- This artifact exists to make future value-ranking candidates auditable before they become authoritative.',
    '',
    '## Shadow Candidates',
    '',
  ];

  if (!judgment.candidates.length) {
    lines.push('- No evidence-backed product-improvement candidates were generated from the configured inputs.');
  }

  judgment.candidates.forEach((candidate, index) => {
    lines.push(`### ${index + 1}. ${candidate.title}`);
    lines.push('');
    lines.push(`- ID: ${candidate.id}`);
    lines.push(`- Category: ${candidate.category}`);
    lines.push(`- Confidence: ${candidate.confidence}`);
    lines.push(`- Impact score: ${candidate.impactScore}`);
    lines.push(`- Effort score: ${candidate.effortScore}`);
    lines.push(`- Urgency score: ${candidate.urgencyScore}`);
    lines.push(`- Leverage score: ${candidate.leverageScore}`);
    lines.push(`- Total score: ${candidate.totalScore}`);
    lines.push(`- Source files: ${candidate.sourceFiles.join(', ')}`);
    lines.push(`- Why it matters: ${candidate.whyItMatters}`);
    lines.push(`- Why it is not yet selected: ${candidate.whyItIsNotYetSelected}`);
    lines.push('- Evidence:');
    for (const item of candidate.evidence) lines.push(`  - ${item.sourceFile}${item.sourceSection ? ` (${item.sourceSection})` : ''}: ${item.text}`);
    lines.push('');
  });

  return `${lines.join('\n').trimEnd()}\n`;
}

export async function generateRepositoryJudgment(repositoryPath = process.cwd()) {
  const resolved = resolve(repositoryPath);
  const docs = Object.fromEntries(await Promise.all(repositoryJudgmentInputs.map(async (input) => [input, await readText(resolved, input)])));
  const candidates = buildCandidates(docs);
  const judgment = {
    schemaVersion: 1,
    mode: 'shadow',
    generatedAt: new Date(0).toISOString(),
    inputs: repositoryJudgmentInputs,
    candidates,
    selectedCandidate: null,
    selectionPolicy: 'Shadow Mode only. Current Work Queue, next-improvement ranking, and implementation package generation remain unchanged.',
  };
  await mkdir(join(resolved, '.ai'), { recursive: true });
  await writeFile(join(resolved, '.ai', 'repository-judgment.json'), `${JSON.stringify(judgment, null, 2)}\n`);
  await writeFile(join(resolved, '.ai', 'repository-judgment.md'), renderRepositoryJudgmentMarkdown(judgment));
  return judgment;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const judgment = await generateRepositoryJudgment(process.cwd());
  console.log(`Generated .ai/repository-judgment.json and .ai/repository-judgment.md with ${judgment.candidates.length} shadow candidate(s).`);
}
