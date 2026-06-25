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

function sanitizeManualNotes(value) {
  const lines = value.trimEnd().split('\n');
  return lines.map((line, index) => {
    if (index === 0) return manualHeader;
    return line.replace(/^##(\s+)/, '###$1');
  }).join('\n') + '\n';
}

async function readManualNotes() {
  if (!(await exists(outputPath))) return `${manualHeader}\n`;
  const current = await readFile(outputPath, 'utf8');
  const index = current.indexOf(manualHeader);
  return index === -1 ? `${manualHeader}\n` : sanitizeManualNotes(current.slice(index));
}

function compact(value) { return value.replace(/\s+/g, ' ').trim(); }

function section(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$\\n?([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function cleanSectionValue(value, { preserveBullets = false } = {}) {
  return value
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      return preserveBullets ? trimmed : trimmed.replace(/^[-*]\s+/, '').trim();
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

function withoutEvidence(value) {
  return value
    .split('\n')
    .filter((line) => !/^Evidence:/i.test(line.trim()))
    .join('\n')
    .trim();
}

function normalizeComparable(value) {
  return compact(withoutEvidence(value).replace(/^[-*]\s+/gm, '').replace(/^#+\s+/gm, '')).toLowerCase();
}

function isHeadingOnly(value) {
  const cleaned = withoutEvidence(value).trim();
  const withoutMarkdownMarker = cleaned.replace(/^#+\s*/, '').trim();
  if (/^(success definition|success criteria|strategy success definition|current experiment|strategic differentiator|product thesis)$/i.test(withoutMarkdownMarker)) return true;
  return /^#+\s+\S/.test(cleaned) && !/\n/.test(cleaned);
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

function containsImplementationDetail(value) {
  return /(?:\b(?:strategy|audit|health|backlog|prompt|context-package|validate-intel|server)\.mjs\b|(?:^|[\s`])\.ai\/|README\.md|docs\/|package\.json|npm run|node scripts\/|generator|deterministic(?:ally)?|reads? files?|writes? outputs?|markdown parsing|file scanning|repository scanning|script behavior|pipeline|derive strategic|local Node server|Vite UI)/i.test(value);
}

function explicitValue(sources, heading, options = {}) {
  const headingOptions = heading === 'Success Definition' || heading === 'Success Criteria'
    ? { preserveBullets: true, ...options }
    : options;
  for (const source of sources) {
    const value = cleanSectionValue(section(source.text, heading), headingOptions);
    if (value && !isHeadingOnly(value) && (options.allowImplementation || !containsImplementationDetail(value))) return { value, evidence: source.name };
  }
  return null;
}

function successCriteriaValue(sources) {
  return explicitValue(sources.filter((source) => source.name === '.ai/goals.md'), 'Success Criteria')
    ?? explicitValue(sources, 'Success Criteria')
    ?? explicitValue(sources, 'Success Definition');
}

function matchLine(sources, patterns, { allowImplementation = false } = {}) {
  for (const source of sources) {
    const lines = source.text.split('\n').map((line) => line.trim()).filter(Boolean);
    for (const pattern of patterns) {
      const hit = lines.find((line) => pattern.test(line));
      if (hit) {
        const value = hit.replace(/^[-*]\s+/, '');
        if (!isHeadingOnly(value) && (allowImplementation || !containsImplementationDetail(value))) return { value, evidence: source.name };
      }
    }
  }
  return null;
}

function beliefFromFocus(currentFocus, priorities) {
  const focus = currentFocus.value.replace(/[.?]$/, '');
  const priorityText = priorities?.value ? ` through ${priorities.value.replace(/\n/g, '; ').replace(/[.?]$/, '')}` : '';
  return { value: `The team is testing whether ${focus.toLowerCase()} can create clearer product value${priorityText}.`, evidence: [currentFocus.evidence, priorities?.evidence].filter(Boolean).join(', ') };
}

function inferCurrentProductBet(sources) {
  const explicit = explicitValue(sources, 'Current Product Bet') ?? explicitValue(sources, 'Product Bet');
  if (explicit) return explicit;
  const currentFocus = explicitValue(sources, 'Current Focus', { allowImplementation: true });
  if (!currentFocus) return null;
  return currentFocus;
}

function inferCurrentExperiment(sources) {
  const currentFocus = explicitValue(sources, 'Current Focus');
  if (!currentFocus) return null;
  const priorities = explicitValue(sources, 'Current Priorities') ?? explicitValue(sources, 'Priorities');
  const text = `${currentFocus.value} ${priorities?.value ?? ''}`;
  if (/reconnect|reach out|follow[- ]?up|between events|relationship/i.test(text)) {
    return { value: 'Can the system reliably identify who a user should reconnect with today?', evidence: [currentFocus.evidence, priorities?.evidence].filter(Boolean).join(', ') };
  }
  if (/onboard|activation|first run|setup/i.test(text)) {
    return { value: 'Can the system reliably guide a user to initial value during onboarding?', evidence: [currentFocus.evidence, priorities?.evidence].filter(Boolean).join(', ') };
  }
  if (/search|discover|find/i.test(text)) {
    return { value: 'Can the system reliably help a user find the next valuable action?', evidence: [currentFocus.evidence, priorities?.evidence].filter(Boolean).join(', ') };
  }
  return { value: `Can the system reliably deliver the current focus: ${currentFocus.value.replace(/[.?]$/, '')}?`, evidence: [currentFocus.evidence, priorities?.evidence].filter(Boolean).join(', ') };
}

function relationshipEvidence(sources) {
  const all = sources.map((source) => source.text).join('\n');
  const evidenceNames = sources.filter((source) => /relationship memory|encounter evidence|real-world overlap/i.test(source.text)).map((source) => source.name);
  if (/relationship memory/i.test(all) && /encounter evidence/i.test(all) && /real-world overlap/i.test(all)) {
    return { value: 'Relationship memory anchored in encounter evidence and real-world overlap.', evidence: [...new Set(evidenceNames)].join(', ') };
  }
  return matchLine(sources, [/relationship memory/i, /encounter evidence/i, /real-world overlap/i, /physically grounded relationship graph/i, /follow-up intelligence/i, /real-world encounters?/i]);
}

function repositoryIntelligenceDifferentiator(sources) {
  const all = sources.map((source) => source.text).join('\n');
  if (/repository intelligence/i.test(all) && /(?:assistant handoffs?|AI context|context package|coding agents?|developer workflow|repository understanding)/i.test(all)) {
    const evidence = sources
      .filter((source) => /repository intelligence|assistant handoffs?|AI context|context package|coding agents?|developer workflow|repository understanding/i.test(source.text))
      .map((source) => source.name);
    return {
      value: 'Repository intelligence that turns repository understanding into reusable AI context for developer workflows.',
      evidence: [...new Set(evidence)].join(', '),
    };
  }
  return null;
}

function inferStrategicDifferentiator(sources, productThesis) {
  const candidates = [
    explicitValue(sources, 'Strategic Differentiator'),
    explicitValue(sources, 'Unique Value'),
    explicitValue(sources, 'Product Purpose'),
    repositoryIntelligenceDifferentiator(sources),
    relationshipEvidence(sources),
    matchLine(sources, [/competitive advantage/i, /unique advantage/i, /differentiator/i, /moat/i, /repository intelligence/i, /developer workflow/i, /reusable AI context/i, /repository understanding/i]),
  ].filter(Boolean);
  const thesis = normalizeComparable(productThesis?.value ?? '');
  return candidates.find((candidate) => normalizeComparable(candidate.value) !== thesis) ?? null;
}


const leakageTerms = ['relationship memory', 'encounters', 'overlap', 'reconnect', 'follow-ups'];
const strategyFieldLeakageHeaders = ['Product Thesis', 'Strategic Differentiator', 'Current Product Bet', 'Current Experiment', 'What Not To Build', 'Success Definition'];

function evidenceSourceText(sources) {
  return sources
    .filter((source) => /^(\.ai\/(?:goals|architecture|decisions)\.md|README\.md|docs\/)/.test(source.name))
    .map((source) => source.text)
    .join('\n');
}

function detectImplementationLeakage(inferredFields) {
  return inferredFields
    .filter(({ heading }) => strategyFieldLeakageHeaders.includes(heading))
    .filter(({ inferred }) => containsImplementationDetail(inferred.value))
    .map(({ heading }) => heading);
}

function detectStrategyLeakage(strategyText, sources) {
  const evidence = evidenceSourceText(sources);
  return leakageTerms.filter((term) => {
    const strategyPattern = new RegExp(term.replace('-', '[- ]?'), 'i');
    if (!strategyPattern.test(strategyText)) return false;
    const evidencePattern = term === 'encounters' ? /encounters?|real-world encounters?/i : strategyPattern;
    return !evidencePattern.test(evidence);
  });
}

function strategyConfidence(inferredFields, leakageTermsFound) {
  if (leakageTermsFound.length) return 'Low';
  const detected = inferredFields.filter((field) => field.inferred.value && !/- Not detected yet\./i.test(field.inferred.value));
  if (detected.length >= 5 && detected.every((field) => field.inferred.evidence)) return 'High';
  if (detected.length >= 3) return 'Medium';
  return 'Low';
}

function inferField(field, sources) {
  if (field === 'Success Definition') {
    const success = successCriteriaValue(sources);
    if (success) return success;
  }

  if (field === 'Strategic Differentiator') {
    const productThesis = explicitValue(sources, 'Product Thesis', { allowImplementation: true }) ?? explicitValue(sources, 'Product Purpose', { allowImplementation: true });
    const differentiator = inferStrategicDifferentiator(sources, productThesis);
    if (differentiator) return differentiator;
  }

  if (field === 'Current Product Bet') {
    const bet = inferCurrentProductBet(sources);
    if (bet) return bet;
  }

  if (field === 'Current Experiment') {
    const experiment = inferCurrentExperiment(sources);
    if (experiment) return experiment;
  }

  const explicit = explicitValue(sources, field, { allowImplementation: field === 'Product Thesis' || field === 'What Not To Build' });
  if (explicit && (field !== 'Strategic Differentiator' || normalizeComparable(explicit.value) !== normalizeComparable(explicitValue(sources, 'Product Thesis')?.value ?? ''))) return explicit;

  const patterns = {
    'North Star Metric': [/north star/i, /follow[- ]?ups? completed/i, /primary metric/i],
    'Strategic Differentiator': [/strategic differentiator/i, /differentiator/i, /relationship memory/i],
    'Current Product Bet': [/current product bet/i, /strategic bet/i, /belief/i, /hypothesis/i, /between events/i],
    'Current Experiment': [/current experiment/i, /experiment/i],
    'What Not To Build': [/what not to build/i, /do not build/i, /not primarily/i, /primarily an event app/i],
    'Success Definition': [/success definition/i, /success criteria/i, /reach out to today/i],
  };
  const matched = matchLine(sources, patterns[field] ?? []);
  if (matched && !/^\*\*Strategy\*\* surfaces the product thesis/i.test(matched.value)) return matched;

  if (field === 'Product Thesis') {
    const architectureThesis = explicitValue(sources, 'Product Thesis', { allowImplementation: true }) ?? explicitValue(sources, 'Product Purpose', { allowImplementation: true });
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
const inferredFields = headings.map((heading) => ({ heading, inferred: inferField(heading, sources) }));
const strategyBody = inferredFields.flatMap(({ heading, inferred }) => [`## ${heading}`, inferred.value, inferred.evidence ? `\nEvidence: ${inferred.evidence}` : '']).join('\n');
const leakage = detectStrategyLeakage(strategyBody, sources);
const implementationLeakage = detectImplementationLeakage(inferredFields);
const confidence = strategyConfidence(inferredFields, [...leakage, ...implementationLeakage]);
const evidenceSources = [...new Set(inferredFields.map(({ inferred }) => inferred.evidence).filter(Boolean).flatMap((evidence) => evidence.split(',').map((item) => item.trim()).filter(Boolean)))];
const sections = [
  strategyBody,
  '## Strategy Confidence',
  confidence,
  '## Strategy Evidence Sources',
  evidenceSources.length ? evidenceSources.map((source) => `- ${source}`).join('\n') : '- No strategy evidence sources detected.',
  '## Strategy Warnings',
  leakage.length ? `- Strategy Leakage warning: strategy mentions ${leakage.join(', ')} without supporting goals/docs/architecture evidence.` : '- No strategy leakage detected.',
  implementationLeakage.length ? `- Implementation Leakage Warning: strategy fields contain implementation-level details in ${implementationLeakage.join(', ')}.` : '- No implementation leakage detected.',
];

const content = ['# Strategy', '', ...sections, manualNotes].join('\n').replace(/\n{3,}/g, '\n\n');
await mkdir(aiDir, { recursive: true });
await writeFile(outputPath, content.endsWith('\n') ? content : `${content}\n`);
console.log(`Wrote ${outputPath}`);
