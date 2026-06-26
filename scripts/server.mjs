import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { persistQuality } from './intelligence-quality.mjs';
import { verifyIntelligence } from './intelligence-verification.mjs';
import { evaluateCanonicalCompleteness } from './canonical-completeness.mjs';
import { generateNextImprovement } from './next-improvement.mjs';
import { explainCompleteness, explainQuality, explainCompletenessSynchronization, explainEvidenceSynthesis, persistIntelligenceExplanations, readIntelligenceExplanations } from './intelligence-explanations.mjs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const port = Number(process.env.AGENT_IDE_PORT ?? 5174);

const allowedIntelligenceFiles = new Set(['goals.md', 'architecture.md', 'strategy.md', 'backlog.md', 'decisions.md', 'validation.md', 'agents.md', 'code.md', 'repository-health.md', 'context-package.md', 'next-improvement-prompt.md', 'intelligence-quality.json', 'intelligence-history.json', 'intelligence-verification.json', 'intelligence-explanations.json', 'decision-ranking.json', 'prompts/architect.md', 'prompts/builder.md', 'prompts/reviewer.md', 'prompts/debugger.md']);

const baselineFiles = {
  'goals.md': `# Goals

## Product Purpose

## Product Thesis

## Current Focus

## Current Product Bet

## Strategic Bet

## Product Differentiator

## Long-Term Vision

## Manual Goals

## Manual Strategy Notes

## Success Criteria

## What Not To Build
`,
  'strategy.md': `# Strategy

## Product Thesis

## North Star Metric

## Strategic Differentiator

## Current Product Bet

## Current Experiment

## What Not To Build

## Success Definition

`,
  'agents.md': `# Agents
## Current Status
No autonomous agents run in this repository.

## Intended Roles
- Architect
- Builder
- Reviewer
- Debugger

## Operating Constraints
- Use repository intelligence before editing code.
- Preserve local-first, reviewable changes.
`,
  'code.md': `# Code
## Implementation Entry Points
Generated placeholder. Use this file to record important code entry points.

## Notes
Code should be interpreted through Goals, Architecture, Decisions, Backlog, and Validation.
`,
};

const baselineStep = { id: 'baseline-files', label: 'Baseline Files' };

const generatorSteps = [
  { id: 'architecture', label: 'Architecture', command: ['node', [join(appRoot, 'scripts/audit.mjs')]] },
  { id: 'backlog', label: 'Backlog', command: ['node', [join(appRoot, 'scripts/backlog.mjs')]] },
  { id: 'validation', label: 'Validation', command: ['node', [join(appRoot, 'scripts/validate-intel.mjs')]] },
  { id: 'decisions', label: 'Decisions', command: ['node', [join(appRoot, 'scripts/decisions.mjs')]] },
  { id: 'strategy', label: 'Strategy', command: ['node', [join(appRoot, 'scripts/strategy.mjs')]] },
  ...['architect', 'builder', 'reviewer', 'debugger'].map((role) => ({
    id: `prompts:${role}`,
    label: `Prompts (${role})`,
    command: ['node', [join(appRoot, 'scripts/prompt.mjs'), role]],
  })),
  { id: 'repository-health', label: 'Repository Health', command: ['node', [join(appRoot, 'scripts/health.mjs')]] },
  { id: 'context-package', label: 'Context Package', command: ['node', [join(appRoot, 'scripts/context-package.mjs')]] },
];


const controlFiles = ['decision-ranking.json', 'goals.md', 'architecture.md', 'strategy.md', 'backlog.md', 'decisions.md', 'validation.md', 'repository-health.md', 'context-package.md', 'next-improvement-prompt.md', 'prompts/architect.md', 'prompts/builder.md', 'prompts/reviewer.md', 'prompts/debugger.md'];

async function readAiText(repositoryPath, fileName) {
  return readFile(join(repositoryPath, '.ai', fileName), 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return '';
    throw error;
  });
}

function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function firstLine(value, fallback = 'Unknown') {
  return value.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).find(Boolean) ?? fallback;
}

function metricFromHealth(health, label) {
  return health.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'))?.[1]?.trim() ?? 'Unknown';
}

function qualitySignal(health, label) {
  const match = health.match(new RegExp(`^-\\s*${label}\\s+(.+)$`, 'im'));
  return match?.[1]?.trim() ?? 'Unknown';
}

function completenessScore(health) {
  const canonical = health.match(/^-\s*Overall:\s*(Missing|Partial|Complete|Strong)\s*\((\d+)%\)/im);
  if (canonical) return `${canonical[1]} (${canonical[2]}%)`;
  const section = mdSection(health, 'Intelligence Completeness');
  const rows = [...section.matchAll(/^-\s+[^:]+:\s+(Present|Missing)/gim)];
  if (!rows.length) return 'Unknown';
  const present = rows.filter((row) => row[1].toLowerCase() === 'present').length;
  return `${present}/${rows.length} present`;
}

function topBacklogItem(backlog) {
  const prioritized = mdSection(backlog, 'Prioritized Backlog') || mdSection(backlog, 'Current Backlog') || mdSection(backlog, 'Manual Backlog') || backlog;
  return prioritized.split('\n').map((line) => line.trim()).find((line) => /^[-*]\s+/.test(line))?.replace(/^[-*]\s+/, '').trim() ?? '';
}


function riskPriority(risk) {
  if (/Missing intelligence file|Architecture has no product thesis|Architecture has no current focus|Strategy missing$/i.test(risk)) return 1;
  if (/No deterministic validation commands|Validation has low confidence/i.test(risk)) return 2;
  if (/Strategy missing|warning|leakage/i.test(risk)) return 3;
  if (/Backlog contains possible noise/i.test(risk)) return 5;
  return 4;
}

function criticalRisks(risks) {
  return risks.filter((risk) => riskPriority(risk) <= 3);
}

function auditRecommendation(health) {
  const firstRisk = riskItems(health).sort((a, b) => riskPriority(a) - riskPriority(b))[0];
  if (!firstRisk || riskPriority(firstRisk) >= 5) return '';
  return `Resolve audit finding: ${firstRisk}`;
}


function hasMeaningfulSection(markdown, heading) {
  const value = mdSection(markdown, heading);
  const line = firstLine(value, '');
  return Boolean(line) && !/^(?:not detected yet|missing|none detected|generated placeholder|tbd|todo)$/i.test(line) && !/low confidence/i.test(line);
}

function intelligenceState(markdown, heading) {
  const value = firstLine(mdSection(markdown, heading), '');
  if (!value || /Not detected yet|missing|low confidence|none detected/i.test(value)) return 'Missing';
  if (/partial|metadata detected|not run by default/i.test(value)) return 'Partial';
  if (/warning|needs attention|mixed|weak|low confidence/i.test(value)) return 'Needs Attention';
  return 'Present';
}

function productThesisState(docs) {
  return ['goals.md', 'strategy.md', 'architecture.md'].some((file) => hasMeaningfulSection(docs[file] ?? '', 'Product Thesis') || hasMeaningfulSection(docs[file] ?? '', 'Product Purpose')) ? 'Present' : 'Needs Attention';
}

function validationState(docs) {
  const validation = docs['validation.md'] ?? '';
  if (!validation.trim()) return 'Missing';
  const commandsRun = mdSection(validation, 'Commands Run');
  const hasCommand = /`(?:npm run|npm test|pnpm|yarn|cargo|swift|xcodebuild)\b[^`]*`/i.test(commandsRun) && !/-\s+None\b/i.test(commandsRun);
  if (hasCommand) return 'Present';
  const hasXcodeMetadata = /Xcode project validation metadata detected/i.test(validation) || /`xcodebuild -list -(?:project|workspace) [^`]+`/i.test(validation);
  const hasValidationMetadata = /##\s+(?:Xcode Project Validation|Results|Known Validation Gaps|Last Validation)\b/i.test(validation);
  if (hasXcodeMetadata || hasValidationMetadata) return 'Partial';
  return 'Missing';
}

function qualityState(health, signalLabel) {
  const signal = qualitySignal(health, signalLabel).toLowerCase();
  if (!signal || signal === 'unknown' || /missing|not detected|weak|low/.test(signal)) return 'Missing';
  if (/mixed|warning|detected/.test(signal)) return 'Needs Attention';
  return 'Present';
}

function riskItems(health) {
  const risks = mdSection(health, 'Risks');
  return risks.split('\n').map((line) => line.trim()).filter((line) => /^[-*]\s+/.test(line) && !/No repository health risks/i.test(line)).map((line) => line.replace(/^[-*]\s+/, ''));
}

function understandingSummary(docs) {
  const health = docs['repository-health.md'] ?? '';
  const canonical = evaluateCanonicalCompleteness(docs['goals.md'] ?? '');
  const strategy = docs['strategy.md'] ?? '';
  const architecture = docs['architecture.md'] ?? '';
  const validation = docs['validation.md'] ?? '';
  const decisions = docs['decisions.md'] ?? '';
  return [
    { label: 'Canonical Intelligence', state: `${canonical.state} ${canonical.score}%`, source: '.ai/goals.md' },
    { label: 'Manual Goals', state: `${canonical.fields.manualGoals.state} ${canonical.fields.manualGoals.percent}%`, source: '.ai/goals.md' },
    { label: 'Product Thesis', state: productThesisState(docs), source: '.ai/goals.md' },
    { label: 'Current Focus', state: intelligenceState(docs['goals.md'] ?? '', 'Current Focus') === 'Present' ? 'Present' : intelligenceState(architecture, 'Current Focus'), source: '.ai/goals.md' },
    { label: 'Strategy', state: qualityState(health, 'Strategy quality score'), source: '.ai/repository-health.md' },
    { label: 'Architecture', state: qualityState(health, 'Core systems'), source: '.ai/architecture.md' },
    { label: 'Validation', state: validationState(docs), source: '.ai/validation.md' },
    { label: 'Decisions', state: mdSection(decisions, 'Active Decisions') || decisions.trim().length > 20 ? 'Present' : 'Missing', source: '.ai/decisions.md' },
  ];
}

function unknownSummary(docs) {
  const health = docs['repository-health.md'] ?? '';
  return riskItems(health).map((risk) => ({ label: risk, source: '.ai/repository-health.md#Risks' }));
}

function recommendationKind(recommendation, health) {
  if (auditRecommendation(health)) return 'Intelligence Audit recommendation';
  if (recommendation && recommendation !== 'Refresh repository intelligence to generate a recommended next step.') return 'Repository Health recommendation';
  return 'Highest-priority Backlog item';
}

function recommendationDetails(docs) {
  const health = docs['repository-health.md'] ?? '';
  const backlog = docs['backlog.md'] ?? '';
  const healthRecommendation = firstLine(mdSection(health, 'Recommended Next Step'), '');
  const backlogItem = topBacklogItem(backlog);
  const risks = riskItems(health);
  const lowPriorityOnly = risks.length > 0 && criticalRisks(risks).length === 0;
  const title = auditRecommendation(health) || (lowPriorityOnly ? 'Run an AI handoff test.' : healthRecommendation) || backlogItem || 'Refresh repository intelligence';
  const kind = recommendationKind(title, health);
  const evidenceSource = kind === 'Highest-priority Backlog item' ? '.ai/backlog.md' : '.ai/repository-health.md';
  const whyItMatters = kind === 'Intelligence Audit recommendation'
    ? 'The intelligence layer has a known gap or weak signal; resolving it makes future handoffs safer.'
    : kind === 'Repository Health recommendation'
      ? 'Repository health is the deterministic summary of readiness, confidence, and known risks.'
      : 'The backlog is the next deterministic source of implementation work when audit and health are clear.';
  return {
    title,
    explanation: `${kind}: ${title}`,
    whyItMatters,
    evidenceSource,
    prompt: [
      'You are the Builder for this repository.',
      `Implement the following recommendation: ${title}`,
      `Why it matters: ${whyItMatters}`,
      `Evidence source: ${evidenceSource}`,
      'Use the repository intelligence files as source of truth. Preserve deterministic, local-first behavior. Do not call LLMs, cloud services, or telemetry.',
    ].join('\n'),
  };
}

function summarizeSnapshot(docs, repositoryPath = process.cwd()) {
  const health = docs['repository-health.md'] ?? '';
  const strategy = docs['strategy.md'] ?? '';
  const validation = docs['validation.md'] ?? '';
  const backlog = docs['backlog.md'] ?? '';
  const healthRecommendation = firstLine(mdSection(health, 'Recommended Next Step'), '');
  const risks = riskItems(health);
  const lowPriorityOnly = risks.length > 0 && criticalRisks(risks).length === 0;
  const recommendedNextStep = auditRecommendation(health) || (lowPriorityOnly ? 'Run an AI handoff test.' : healthRecommendation) || topBacklogItem(backlog) || 'Refresh repository intelligence to generate a recommended next step.';
  return {
    timestamp: new Date().toISOString(),
    repositoryName: basename(repositoryPath),
    overallHealth: metricFromHealth(health, 'Overall Health'),
    intelligenceCompleteness: completenessScore(health),
    strategyQuality: qualitySignal(health, 'Strategy quality score'),
    productSignalQuality: qualitySignal(health, 'Product Signal Quality'),
    repositoryHandoffReadiness: productThesisState(docs) === 'Present' && hasMeaningfulSection(strategy, 'Current Product Bet') && hasMeaningfulSection(docs['architecture.md'] ?? '', 'Core Systems') && docs['context-package.md'] && criticalRisks(risks).length === 0 ? 'Ready' : 'Needs Attention',
    lastRefresh: metricFromHealth(health, 'Last Audit'),
    currentConfidence: metricFromHealth(health, 'Confidence'),
    strategyConfidence: qualitySignal(health, 'Strategy confidence') || firstLine(mdSection(strategy, 'Strategy Confidence'), 'Unknown'),
    validationConfidence: firstLine(mdSection(validation, 'Confidence'), 'Unknown'),
    recommendedNextStep,
    sections: {
      strategy: ['Product Thesis', 'North Star Metric', 'Strategic Differentiator', 'Current Product Bet', 'Current Experiment', 'What Not To Build', 'Success Definition'].map((h) => `${h}: ${firstLine(mdSection(strategy, h), '')}`).join('\n'),
      architecture: ['Product Thesis', 'Current Focus', 'Core Systems', 'Primary Flows'].map((h) => `${h}: ${firstLine(mdSection(docs['architecture.md'] ?? '', h), '')}`).join('\n'),
      backlog: (mdSection(backlog, 'Prioritized Backlog') || mdSection(backlog, 'Current Backlog') || backlog).split('\n').filter((line) => /^[-*]\s+/.test(line.trim())).map((line) => line.trim()).join('\n'),
      decisions: (mdSection(docs['decisions.md'] ?? '', 'Active Decisions') || docs['decisions.md'] || '').split('\n').filter((line) => /^[-*]\s+/.test(line.trim())).map((line) => line.trim()).join('\n'),
      validation: `${firstLine(mdSection(validation, 'Overall Status'), '')}\n${firstLine(mdSection(validation, 'Confidence'), '')}`,
      healthScore: `${metricFromHealth(health, 'Overall Health')} / ${metricFromHealth(health, 'Confidence')}`,
    },
  };
}

function lineSet(value) { return new Set(value.split('\n').map((line) => line.trim()).filter(Boolean)); }
function setDiff(next, previous) { return [...next].filter((item) => !previous.has(item)); }
function diffSnapshots(previous, current) {
  if (!previous) return { summary: 'No previous intelligence snapshot was available; this refresh established the baseline.', strategyChanges: [], architectureChanges: [], backlogAdditions: [], backlogRemovals: [], decisionAdditions: [], validationChanges: [], healthScoreChanges: [] };
  const diffSection = (key) => setDiff(lineSet(current.sections[key]), lineSet(previous.sections[key]));
  const backlogPrevious = lineSet(previous.sections.backlog);
  const backlogCurrent = lineSet(current.sections.backlog);
  const result = {
    summary: 'No material intelligence changes detected.',
    strategyChanges: diffSection('strategy'),
    architectureChanges: diffSection('architecture'),
    backlogAdditions: setDiff(backlogCurrent, backlogPrevious),
    backlogRemovals: setDiff(backlogPrevious, backlogCurrent),
    decisionAdditions: diffSection('decisions'),
    validationChanges: diffSection('validation'),
    healthScoreChanges: previous.sections.healthScore === current.sections.healthScore ? [] : [`${previous.sections.healthScore} → ${current.sections.healthScore}`],
  };
  const count = Object.entries(result).filter(([, value]) => Array.isArray(value)).reduce((sum, [, value]) => sum + value.length, 0);
  if (count) result.summary = `${count} deterministic intelligence change${count === 1 ? '' : 's'} detected since the previous refresh.`;
  return result;
}

function evidenceItems(docs) {
  const items = [];
  for (const [file, content] of Object.entries(docs)) {
    const lines = content.split('\n');
    let section = 'Document';
    lines.forEach((line, index) => {
      const heading = line.match(/^##\s+(.+)$/);
      if (heading) section = heading[1].trim();
      const evidence = line.match(/Evidence(?:\s+Sources?)?:\s*(.+)$/i);
      if (evidence) {
        items.push({ file, section, line: index + 1, evidence: evidence[1].trim(), confidence: /confidence/i.test(section) ? firstLine(line) : 'Evidence-backed' });
      }
    });
  }
  return items;
}


function promptEvidenceValue(prompt, label, fallback = '') {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^-\\s*${escaped}:\\s*(.+)$`, 'im');
  const section = mdSection(prompt, 'Current Evidence');
  const selectedIssue = mdSection(prompt, 'Selected Issue');
  const match = section.match(pattern) ?? selectedIssue.match(pattern) ?? prompt.match(pattern);
  return match?.[1]?.trim() ?? fallback;
}


function handoffPackages(docs) {
  return {
    context: docs['context-package.md'] ?? '',
    architect: docs['prompts/architect.md'] ?? '',
    builder: docs['next-improvement-prompt.md'] ?? docs['prompts/builder.md'] ?? '',
    roleBuilder: docs['prompts/builder.md'] ?? '',
    reviewer: docs['prompts/reviewer.md'] ?? '',
    debugger: docs['prompts/debugger.md'] ?? '',
  };
}

async function readControlPlane(repositoryPath) {
  const docs = Object.fromEntries(await Promise.all(controlFiles.map(async (file) => [file, await readAiText(repositoryPath, file)])));
  const aiDir = join(repositoryPath, '.ai');
  const snapshot = summarizeSnapshot(docs, repositoryPath);
  const savedDiff = JSON.parse(await readFile(join(aiDir, 'intelligence-diff.json'), 'utf8').catch(() => 'null'));
  const quality = JSON.parse(await readFile(join(aiDir, 'intelligence-quality.json'), 'utf8').catch(() => 'null'));
  const verification = await verifyIntelligence(repositoryPath, { displayedContents: docs, persist: false });
  const qualityHistory = JSON.parse(await readFile(join(aiDir, 'intelligence-history.json'), 'utf8').catch(() => '[]'));
  const explanations = await readIntelligenceExplanations(repositoryPath);
  const decisionRanking = JSON.parse(await readFile(join(aiDir, 'decision-ranking.json'), 'utf8').catch(() => 'null'));
  const timeline = JSON.parse(await readFile(join(aiDir, 'intelligence-timeline.json'), 'utf8').catch(() => '[]'));
  const recommendation = docs['next-improvement-prompt.md']?.trim()
    ? { title: firstLine(docs['next-improvement-prompt.md'].replace(/^#\s*/, ''), snapshot.recommendedNextStep), actionability: promptEvidenceValue(docs['next-improvement-prompt.md'], 'Actionability', 'Not classified.'), packageType: promptEvidenceValue(docs['next-improvement-prompt.md'], 'Package Type', 'implementation'), explanation: promptEvidenceValue(docs['next-improvement-prompt.md'], 'Source risk/recommendation', 'See generated prompt.'), whyItMatters: promptEvidenceValue(docs['next-improvement-prompt.md'], 'Reason', 'Generated from Control Plane intelligence.'), evidenceSource: '.ai/next-improvement-prompt.md', prompt: docs['next-improvement-prompt.md'] }
    : recommendationDetails(docs);
  return { status: snapshot, decisionRanking, understanding: understandingSummary(docs), unknowns: unknownSummary(docs), recommendation, diff: savedDiff ?? diffSnapshots(null, snapshot), quality, qualityHistory, verification, explanations, evidence: evidenceItems(docs), packages: handoffPackages(docs), timeline };
}

async function persistControlPlane(repositoryPath, previousSnapshot, refreshStartedAt = new Date()) {
  const data = await readControlPlane(repositoryPath);
  data.diff = diffSnapshots(previousSnapshot, data.status);
  const timelinePath = join(repositoryPath, '.ai', 'intelligence-timeline.json');
  const timeline = JSON.parse(await readFile(timelinePath, 'utf8').catch(() => '[]'));
  timeline.push({ timestamp: data.status.timestamp, repositoryHealth: data.status.overallHealth, strategyQuality: data.status.strategyQuality, confidence: data.status.currentConfidence, recommendation: data.status.recommendedNextStep });
  await writeFile(join(repositoryPath, '.ai', 'intelligence-snapshot.json'), JSON.stringify(data.status, null, 2));
  await writeFile(join(repositoryPath, '.ai', 'intelligence-diff.json'), JSON.stringify(data.diff, null, 2));
  await writeFile(timelinePath, JSON.stringify(timeline.slice(-100), null, 2));
  const nextImprovement = await generateNextImprovement(repositoryPath);
  data.recommendation = {
    title: nextImprovement.choice.title,
    actionability: nextImprovement.choice.actionability,
    packageType: nextImprovement.choice.packageType,
    explanation: `Source risk/recommendation: ${nextImprovement.choice.source}`,
    whyItMatters: nextImprovement.choice.reason,
    evidenceSource: '.ai/next-improvement-prompt.md',
    prompt: nextImprovement.prompt,
  };
  data.packages.builder = nextImprovement.prompt;
  await persistQuality(repositoryPath);
  data.verification = await verifyIntelligence(repositoryPath, { refreshStartedAt });
  const qualityResult = await persistQuality(repositoryPath);
  data.quality = qualityResult.snapshot;
  data.qualityHistory = qualityResult.history;
  data.decisionRanking = nextImprovement.decisionRanking;
  const goalsMarkdown = await readAiText(repositoryPath, 'goals.md');
  data.explanations = { completeness: explainCompleteness(goalsMarkdown), evidenceSynthesis: explainEvidenceSynthesis(data.quality?.canonicalIntelligenceQuality?.evidenceSynthesis), quality: explainQuality(data.quality), recommendation: nextImprovement.explanation, decisionRanking: nextImprovement.decisionRanking.explanation, completenessSynchronization: explainCompletenessSynchronization({ completeness: evaluateCanonicalCompleteness(goalsMarkdown) }) };
  await persistIntelligenceExplanations(repositoryPath, data.explanations);
  data.verification = await verifyIntelligence(repositoryPath, { refreshStartedAt });
  return data;
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function validateRepositoryPath(repositoryPath) {
  if (!repositoryPath || typeof repositoryPath !== 'string') {
    throw new Error('Repository path is required.');
  }
  const resolvedPath = resolve(repositoryPath);
  const stats = await stat(resolvedPath).catch((error) => {
    if (error?.code === 'ENOENT') throw new Error(`Path does not exist: ${resolvedPath}`);
    throw error;
  });
  if (!stats.isDirectory()) throw new Error(`Path is not a directory: ${resolvedPath}`);
  return resolvedPath;
}

function runStep(step, cwd) {
  return new Promise((resolveStep) => {
    const startedAt = Date.now();
    const [command, args] = step.command;
    const child = spawn(command, args, { cwd, shell: false, env: { ...process.env, CI: process.env.CI ?? 'true' } });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('close', (exitCode) => {
      resolveStep({
        id: step.id,
        label: step.label,
        exitCode: exitCode ?? 1,
        durationMs: Date.now() - startedAt,
        output: output.trim(),
      });
    });
  });
}

function writeEvent(response, event) {
  response.write(`${JSON.stringify(event)}\n`);
}

async function ensureBaselineFiles(repositoryPath) {
  const startedAt = Date.now();
  const aiDir = join(repositoryPath, '.ai');
  const created = [];
  const preserved = [];

  await mkdir(aiDir, { recursive: true });

  for (const [fileName, content] of Object.entries(baselineFiles)) {
    try {
      await writeFile(join(aiDir, fileName), content, { flag: 'wx' });
      created.push(fileName);
    } catch (error) {
      if (error?.code === 'EEXIST') {
        preserved.push(fileName);
        continue;
      }
      throw error;
    }
  }

  const details = [
    created.length ? `Created: ${created.join(', ')}` : 'Created: none',
    preserved.length ? `Preserved existing: ${preserved.join(', ')}` : 'Preserved existing: none',
  ];

  return {
    id: baselineStep.id,
    label: baselineStep.label,
    exitCode: 0,
    durationMs: Date.now() - startedAt,
    output: details.join('\n'),
  };
}

async function handleRefresh(request, response) {
  const { repositoryPath } = await readJson(request);
  const resolvedPath = await validateRepositoryPath(repositoryPath);
  await mkdir(join(resolvedPath, '.ai'), { recursive: true });
  const previousSnapshot = JSON.parse(await readFile(join(resolvedPath, '.ai', 'intelligence-snapshot.json'), 'utf8').catch(() => 'null'));

  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  const startedAt = Date.now();
  writeEvent(response, { type: 'started', repositoryPath: resolvedPath, total: generatorSteps.length + 2 });

  const results = [];
  writeEvent(response, { type: 'step-started', id: baselineStep.id, label: baselineStep.label });
  const baselineResult = await ensureBaselineFiles(resolvedPath);
  results.push(baselineResult);
  writeEvent(response, { type: 'step-finished', ...baselineResult });
  for (const step of generatorSteps) {
    writeEvent(response, { type: 'step-started', id: step.id, label: step.label });
    const result = await runStep(step, resolvedPath);
    results.push(result);
    writeEvent(response, { type: 'step-finished', ...result });
  }

  const failed = results.filter((result) => result.exitCode !== 0);
  if (failed.length === 0) {
    writeEvent(response, { type: 'step-started', id: 'verification', label: 'Intelligence Verification' });
    await persistControlPlane(resolvedPath, previousSnapshot, new Date(startedAt));
    writeEvent(response, { type: 'step-finished', id: 'verification', label: 'Intelligence Verification', exitCode: 0, durationMs: Date.now() - startedAt, output: 'Generated .ai/intelligence-verification.json' });
  }
  writeEvent(response, {
    type: failed.length === 0 ? 'success' : 'failure',
    repositoryPath: resolvedPath,
    aiPath: join(resolvedPath, '.ai'),
    results,
    summary: failed.length === 0 ? 'Repository intelligence refreshed.' : `${failed.length} generator(s) failed.`,
  });
  response.end();
}

async function handleFile(request, response, url) {
  const repositoryPath = url.searchParams.get('repositoryPath');
  const file = url.searchParams.get('file');
  if (!file || !allowedIntelligenceFiles.has(file)) return sendJson(response, 400, { error: 'Unsupported file.' });

  const resolvedPath = await validateRepositoryPath(repositoryPath);
  const sourcePath = join(resolvedPath, '.ai', file);
  const content = await readFile(sourcePath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });

  sendJson(response, 200, {
    repositoryPath: resolvedPath,
    file,
    sourcePath,
    exists: content !== null,
    content: content ?? '',
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') return sendJson(response, 204, {});
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (request.method === 'POST' && url.pathname === '/api/repository/refresh') return handleRefresh(request, response);
    if (request.method === 'GET' && url.pathname === '/api/repository/file') return handleFile(request, response, url);
    if (request.method === 'GET' && url.pathname === '/api/repository/control-plane') {
      const resolvedPath = await validateRepositoryPath(url.searchParams.get('repositoryPath'));
      return sendJson(response, 200, await readControlPlane(resolvedPath));
    }
    if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { ok: true });
    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(port, () => {
    console.log(`Agent IDE local server listening on http://localhost:${port}`);
  });
}

export { summarizeSnapshot, understandingSummary, recommendationDetails, validationState, productThesisState, readControlPlane, persistControlPlane };
