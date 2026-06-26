import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { evaluateCanonicalCompleteness, formatCompletenessState } from './canonical-completeness.mjs';
import { synthesizeEvidenceFromDocs } from './evidence-synthesis.mjs';
import { persistEvidenceLineage, confidenceFromEvidence } from './evidence-lineage.mjs';
import { explainHealth } from './intelligence-explanations.mjs';

const root = process.cwd();
const aiDir = join(root, '.ai');
const outputPath = join(aiDir, 'repository-health.md');
const manualHeader = '## Manual Health Notes';

const requiredFiles = [
  ['Goals', 'goals.md'],
  ['Architecture', 'architecture.md'],
  ['Strategy', 'strategy.md'],
  ['Backlog', 'backlog.md'],
  ['Decisions', 'decisions.md'],
  ['Validation', 'validation.md'],
  ['Agents', 'agents.md'],
  ['Code', 'code.md'],
  ['Architect Prompt', 'prompts/architect.md'],
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

async function readIfExists(path) {
  const exists = await pathExists(path);
  if (!exists) return '';
  return readFile(path, 'utf8');
}

async function readStrategyEvidenceDocs() {
  const docsDir = join(root, 'docs');
  const readme = await readIfExists(join(root, 'README.md'));
  const productDocs = [];
  if (await pathExists(docsDir)) {
    const entries = await readdir(docsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /(?:STRATEGY|PRODUCT|ROADMAP|VISION)/i.test(entry.name)) productDocs.push(await readFile(join(docsDir, entry.name), 'utf8'));
    }
  }
  return [readme, ...productDocs].filter((text) => text.trim());
}

async function readAiFile(fileName) {
  const path = join(aiDir, fileName);
  const exists = await pathExists(path);
  if (!exists) return { exists, text: '' };
  return { exists, text: await readFile(path, 'utf8') };
}

async function readExistingManualNotes() {
  if (!(await pathExists(outputPath))) return `${manualHeader}\n`;
  const current = await readFile(outputPath, 'utf8');
  const manualIndex = current.indexOf(manualHeader);
  if (manualIndex === -1) return `${manualHeader}\n`;
  return `${current.slice(manualIndex).trimEnd()}\n`;
}

function sectionText(text, header) {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function hasSectionText(text, header) {
  return Boolean(sectionText(text, header));
}

function strategyValue(text, header) {
  return sectionText(text, header)
    .split('\n')
    .filter((line) => !/^Evidence:/i.test(line.trim()))
    .join('\n')
    .trim();
}


const leakageTerms = ['relationship memory', 'encounters', 'overlap', 'reconnect', 'follow-ups'];
const strategyFieldLeakageHeaders = ['Product Thesis', 'Strategic Differentiator', 'Current Product Bet', 'Current Experiment', 'What Not To Build', 'Success Definition'];

function containsImplementationDetail(value) {
  return /(?:\b(?:strategy|audit|health|backlog|prompt|context-package|validate-intel|server)\.mjs\b|(?:^|[\s`])\.ai\/|README\.md|docs\/|package\.json|npm run|node scripts\/|generator|deterministic(?:ally)?|reads? files?|writes? outputs?|markdown parsing|file scanning|repository scanning|script behavior|pipeline|derive strategic|local Node server|Vite UI)/i.test(value);
}


function detectImplementationLeakage(strategy) {
  return strategyFieldLeakageHeaders.filter((header) => containsImplementationDetail(strategyValue(strategy, header)));
}

function detectStrategyLeakage(strategy, evidenceDocs) {
  const evidence = evidenceDocs.join('\n');
  return leakageTerms.filter((term) => {
    const strategyPattern = new RegExp(term.replace('-', '[- ]?'), 'i');
    if (!strategyPattern.test(strategy)) return false;
    const evidencePattern = term === 'encounters' ? /encounters?|real-world encounters?/i : strategyPattern;
    return !evidencePattern.test(evidence);
  });
}

function strategyConfidenceValue(strategy, leakage) {
  const explicit = strategyValue(strategy, 'Strategy Confidence');
  if (explicit && !/- Not detected yet\./i.test(explicit)) return explicit.split('\n')[0].trim();
  if (leakage.length) return 'Low';
  const evidenceCount = (strategy.match(/^Evidence:/gim) ?? []).length;
  if (evidenceCount >= 5) return 'High';
  if (evidenceCount >= 3) return 'Medium';
  return 'Low';
}

function normalizeComparable(value) {
  return value
    .replace(/^[-*]\s+/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isHeadingOnly(value) {
  const cleaned = value.trim();
  const withoutMarkdownMarker = cleaned.replace(/^#+\s*/, '').trim();
  if (/^(success definition|success criteria|strategy success definition|current experiment|strategic differentiator|product thesis)$/i.test(withoutMarkdownMarker)) return true;
  return /^#+\s+\S/.test(cleaned) && !/\n/.test(cleaned);
}

function isMissingStrategyValue(text, header) {
  const value = strategyValue(text, header);
  return !value || /- Not detected yet\./i.test(value) || isHeadingOnly(value);
}

function detectsBacklogNoise(text) {
  const backlogItems = (text.match(/^## (?:High|Medium|Low) Priority\s*([\s\S]*?)(?=^##\s+|(?![\s\S]))/gim) ?? [])
    .join('\n')
    .split('\n')
    .filter((line) => /^-\s+(?!None detected\b)/i.test(line.trim()))
    .join('\n');
  const noisePatterns = [
    /No validation gaps detected from package scripts\.?/i,
    /No deterministic validation commands were detected\.?/i,
    /Last (?:audit|validation|updated):/i,
    /Generated (?:summary|backlog|architecture|validation|decision)/i,
    /Validation (?:passed|succeeded|completed successfully)/i,
  ];
  return noisePatterns.some((pattern) => pattern.test(backlogItems));
}

function detectsValidationCommands(text) {
  const commandsRun = text.match(/^## Commands Run\s*([\s\S]*?)(?=^##\s+|(?![\s\S]))/im)?.[1] ?? '';
  return /`npm run [^`]+`/.test(commandsRun) && !/-\s+None\b/i.test(commandsRun);
}

function detectsXcodeValidationMetadata(text) {
  const xcodeSection = text.match(/^## Xcode Project Validation\s*([\s\S]*?)(?=^##\s+|(?![\s\S]))/im)?.[1] ?? '';
  return /Xcode project validation metadata detected/i.test(xcodeSection) || /`xcodebuild -list -project [^`]+`/.test(xcodeSection);
}

function validationConfidence(text) {
  const match = text.match(/^## Confidence\s*\n-\s*(Low|Medium|High)\b/im);
  return match?.[1] ?? 'Unknown';
}

function formatCompleteness(docs, canonicalCompleteness, evidenceSynthesis) {
  const rows = requiredFiles.map(([label, fileName]) => `- ${label}: ${docs[fileName].exists ? 'Present' : 'Missing'}`);
  rows.push('', '### Canonical Intelligence', `- Overall: ${formatCompletenessState(canonicalCompleteness)}`);
  for (const item of Object.values(canonicalCompleteness.fields)) {
    rows.push(`- ${item.label}: ${formatCompletenessState(item)}`);
    if (item.missing?.length) rows.push(`  - Missing: ${item.missing.join(', ')}`);
  }
  rows.push('', '### Evidence Synthesis', `- Evidence Synthesis: ${evidenceSynthesis.strength}`, `- Canonical fields supported by repository evidence: ${evidenceSynthesis.supportedFields} / ${evidenceSynthesis.missingFields}`);
  return rows.join('\n');
}

function calculateOverallHealth(risks) {
  if (risks.length === 0) return 'Healthy';
  if (risks.length <= 2) return 'Needs Attention';
  return 'At Risk';
}

function calculateConfidence(docs, signals, risks) {
  const presentCount = requiredFiles.filter(([, fileName]) => docs[fileName].exists).length;
  if (presentCount === requiredFiles.length && signals.productThesis && signals.currentFocus && signals.coreSystems && risks.length <= 1) return 'High';
  if (presentCount >= 6) return 'Medium';
  return 'Low';
}

function recommendationFor(risks) {
  if (risks.includes('No deterministic validation commands detected')) return 'Add or expose a deterministic validation script such as `npm run build` or `npm test`, then run `npm run validate:intel` and `npm run health` again.';
  if (risks.includes('Validation has low confidence')) return 'Strengthen validation coverage with additional deterministic scripts, then refresh validation and repository health.';
  if (risks.some((risk) => risk.startsWith('Strategy missing')) || risks.includes('Strategy missing')) return 'Update the appropriate manual section of `.ai/goals.md`, then run `npm run strategy` and `npm run health` again.';
  const manualRisk = risks.find((risk) => risk.startsWith('Manual Goals '));
  if (manualRisk) return `${manualRisk} Update only the incomplete canonical fields in .ai/goals.md.`;
  if (risks.includes('Architecture has no product thesis')) return 'Run `npm run audit` after documenting repository purpose in README or `.ai/goals.md`.';
  if (risks.includes('Architecture has no current focus')) return 'Add a current focus to `.ai/goals.md`, then rerun architecture and health generation.';
  if (risks.includes('Backlog is empty')) return 'Add explicit future work or task-marker comments, then run `npm run backlog` and `npm run health` again.';
  if (risks.includes('Backlog contains possible noise')) return 'Review `.ai/backlog.md`, remove validation/status noise, then rerun `npm run backlog` and `npm run health`.';
  if (risks.some((risk) => risk.startsWith('Missing intelligence file:'))) return 'Run Refresh Intelligence or the missing generator commands to recreate absent `.ai/` artifacts.';
  return 'Keep the intelligence layer current by running Refresh Intelligence after meaningful repository changes.';
}

const entries = await Promise.all(requiredFiles.map(async ([, fileName]) => [fileName, await readAiFile(fileName)]));
const docs = Object.fromEntries(entries);
const manualNotes = await readExistingManualNotes();
const strategyEvidenceDocs = await readStrategyEvidenceDocs();

const architecture = docs['architecture.md'].text;
const goals = docs['goals.md'].text;
const backlog = docs['backlog.md'].text;
const validation = docs['validation.md'].text;
const strategy = docs['strategy.md'].text;

const canonicalCompleteness = evaluateCanonicalCompleteness(goals);
const evidenceDocsForSynthesis = { 'README.md': await readIfExists(join(root, 'README.md')), '.ai/goals.md': goals, '.ai/strategy.md': strategy, '.ai/decisions.md': docs['decisions.md'].text, '.ai/context-package.md': docs['context-package.md']?.text ?? '', '.ai/architecture.md': architecture, '.ai/validation.md': validation, '.ai/repository-health.md': docs['repository-health.md']?.text ?? '' };
const evidenceSynthesis = synthesizeEvidenceFromDocs(evidenceDocsForSynthesis, goals);
const evidenceLineage = await persistEvidenceLineage(root, Object.keys(evidenceDocsForSynthesis));
const manualGoalsCompleteness = canonicalCompleteness.fields.manualGoals;

const signals = {
  productThesis: /Product Thesis/i.test(architecture),
  currentFocus: /Current Focus/i.test(architecture),
  coreSystems: /Core Systems/i.test(architecture),
  strategyPresent: docs['strategy.md'].exists,
  northStarMetric: !isMissingStrategyValue(strategy, 'North Star Metric'),
  strategicDifferentiator: !isMissingStrategyValue(strategy, 'Strategic Differentiator'),
  currentProductBet: !isMissingStrategyValue(strategy, 'Current Product Bet'),
  currentExperiment: !isMissingStrategyValue(strategy, 'Current Experiment'),
  whatNotToBuild: !isMissingStrategyValue(strategy, 'What Not To Build'),
  successDefinition: !isMissingStrategyValue(strategy, 'Success Definition'),
  evidenceLines: /Evidence:/i.test(architecture) || /Evidence\)/i.test(architecture),
  backlogNoise: detectsBacklogNoise(backlog),
  validationCommands: detectsValidationCommands(validation),
  xcodeValidationMetadata: detectsXcodeValidationMetadata(validation),
  manualSections: /^## Manual /im.test(goals),
};

const productThesisValue = strategyValue(strategy, 'Product Thesis') || sectionText(architecture, 'Product Thesis');
const differentiatorValue = strategyValue(strategy, 'Strategic Differentiator');
const successDefinitionValue = strategyValue(strategy, 'Success Definition');
const currentExperimentValue = strategyValue(strategy, 'Current Experiment');
const hasCurrentFocusContent = hasSectionText(goals, 'Current Focus') || hasSectionText(architecture, 'Current Focus');
const leakage = signals.strategyPresent ? detectStrategyLeakage(strategy, [goals, architecture, docs['decisions.md'].text, ...strategyEvidenceDocs]) : [];
const implementationLeakage = signals.strategyPresent ? detectImplementationLeakage(strategy) : [];
const strategyConfidence = signals.strategyPresent ? strategyConfidenceValue(strategy, [...leakage, ...implementationLeakage]) : 'Low';
const strategyQualityWarnings = [];
if (signals.strategyPresent && (!differentiatorValue || normalizeComparable(differentiatorValue) === normalizeComparable(productThesisValue))) strategyQualityWarnings.push('Missing differentiator warning');
if (signals.strategyPresent && hasCurrentFocusContent && !currentExperimentValue) strategyQualityWarnings.push('Missing experiment warning');
if (signals.strategyPresent && (!successDefinitionValue || isHeadingOnly(successDefinitionValue))) strategyQualityWarnings.push('Weak success definition warning');
if (leakage.length) strategyQualityWarnings.push(`Strategy Leakage warning: strategy mentions ${leakage.join(', ')} without supporting goals/docs/architecture evidence`);
if (implementationLeakage.length) strategyQualityWarnings.push(`Implementation Leakage Warning: strategy fields contain implementation-level details in ${implementationLeakage.join(', ')}`);
const strategyQualityScore = signals.strategyPresent
  ? Math.max(0, 100 - (strategyQualityWarnings.length * 25) - (['North Star Metric', 'Current Product Bet', 'What Not To Build'].filter((header) => isMissingStrategyValue(strategy, header)).length * 10))
  : 0;

const risks = [];
for (const [label, fileName] of requiredFiles) {
  if (!docs[fileName].exists) risks.push(`Missing intelligence file: ${label}`);
}
if (validationConfidence(validation) === 'Low') risks.push('Validation has low confidence');
if (!signals.validationCommands && !signals.xcodeValidationMetadata) risks.push('No deterministic validation commands detected');
if (docs['backlog.md'].exists && !backlog.trim().replace(/^#.*$/m, '').trim()) risks.push('Backlog is empty');
if (signals.backlogNoise) risks.push('Backlog contains possible noise');
if (!signals.productThesis) risks.push('Architecture has no product thesis');
if (!signals.currentFocus) risks.push('Architecture has no current focus');
if (manualGoalsCompleteness.state !== 'Complete' && manualGoalsCompleteness.state !== 'Strong') {
  const missing = manualGoalsCompleteness.missing.length ? ` Missing: ${manualGoalsCompleteness.missing.join(', ')}.` : '';
  risks.push(`Manual Goals ${manualGoalsCompleteness.state} (${manualGoalsCompleteness.percent}%).${missing}`);
}
if (!signals.strategyPresent) risks.push('Strategy missing');
if (signals.strategyPresent && !signals.northStarMetric) risks.push('Strategy missing North Star Metric');
if (signals.strategyPresent && !signals.strategicDifferentiator) risks.push('Strategy missing Strategic Differentiator');
if (signals.strategyPresent && !signals.currentProductBet) risks.push('Strategy missing Current Product Bet');
if (signals.strategyPresent && !signals.currentExperiment && hasCurrentFocusContent) risks.push('Strategy missing Current Experiment');
if (signals.strategyPresent && !signals.whatNotToBuild) risks.push('Strategy missing What Not To Build');
if (signals.strategyPresent && !signals.successDefinition) risks.push('Strategy missing Success Definition');
risks.push(...strategyQualityWarnings);

const overallHealth = calculateOverallHealth(risks);
const confidence = confidenceFromEvidence(evidenceLineage.sources).confidence;
const healthExplanations = explainHealth({ risks, canonicalCompleteness });

const content = [
  '# Repository Health',
  '',
  `Last Audit: ${new Date().toISOString()}`,
  `Overall Health: ${overallHealth}`,
  `Confidence: ${confidence}`,
  '',
  '## Intelligence Completeness',
  formatCompleteness(docs, canonicalCompleteness, evidenceSynthesis),
  '',
  '## Evidence Lineage',
  `- Canonical Sources: ${evidenceLineage.categories.Canonical.map((item) => item.group).join(', ') || 'None'}`,
  `- Independent Evidence: ${evidenceLineage.categories.Independent.map((item) => item.group).join(', ') || 'None'}`,
  `- Generated Evidence: ${evidenceLineage.categories.Generated.map((item) => item.group).join(', ') || 'None'}`,
  '- Confidence calculation: Canonical and independent evidence groups increase confidence; generated confirmations verify consistency but do not increase confidence.',
  '- Evidence ancestry: Generated artifacts descend from canonical owner intent plus independent repository evidence.',
  '',
  '## Quality Signals',
  `- Product thesis ${signals.productThesis ? 'present' : 'missing'}`,
  `- Current focus ${signals.currentFocus ? 'present' : 'missing'}`,
  `- Core systems ${signals.coreSystems ? 'present' : 'missing'}`,
  `- Strategy ${signals.strategyPresent ? 'present' : 'missing'}`,
  `- North Star Metric ${signals.northStarMetric ? 'present' : 'missing'}`,
  `- Strategic Differentiator ${signals.strategicDifferentiator ? 'present' : 'missing'}`,
  `- Current Product Bet ${signals.currentProductBet ? 'present' : 'missing'}`,
  `- Current Experiment ${signals.currentExperiment ? 'present' : 'missing'}`,
  `- What Not To Build ${signals.whatNotToBuild ? 'present' : 'missing'}`,
  `- Success Definition ${signals.successDefinition ? 'present' : 'missing'}`,
  `- Strategy quality score ${strategyQualityScore}/100`,
  `- Product Signal Quality ${strategyQualityScore >= 80 && !implementationLeakage.length ? 'strong' : strategyQualityScore >= 50 ? 'mixed' : 'weak'}`,
  `- Strategy leakage ${leakage.length ? 'detected' : 'not detected'}`,
  `- Implementation Leakage Warning ${implementationLeakage.length ? `detected in ${implementationLeakage.join(', ')}` : 'not detected'}`,
  `- Strategy confidence ${strategyConfidence}`,
  `- Evidence lines ${signals.evidenceLines ? 'present' : 'missing'}`,
  `- Backlog noise ${signals.backlogNoise ? 'detected' : 'not detected'}`,
  `- Validation commands ${signals.validationCommands ? 'detected' : 'not detected'}`,
  `- Validation confidence ${validationConfidence(validation)}`,
  `- Xcode validation metadata ${signals.xcodeValidationMetadata ? 'detected' : 'not detected'}`,
  `- Canonical editing target .ai/goals.md`,
  `- Manual sections ${signals.manualSections ? 'preserved in canonical goals' : 'not detected in canonical goals'}`,
  `- Canonical Intelligence ${canonicalCompleteness.state} (${canonicalCompleteness.score}%)`,
  `- Manual Goals ${manualGoalsCompleteness.state} (${manualGoalsCompleteness.percent}%)`,
  `- Evidence Synthesis ${evidenceSynthesis.strength}`,
  `- Canonical fields supported by repository evidence ${evidenceSynthesis.supportedFields} / ${evidenceSynthesis.missingFields}`,
  '- Generated artifacts are regenerated, not manually edited.',
  '',
  '## Risks',
  risks.length ? risks.map((risk) => `- ${risk}`).join('\n') : '- No repository health risks detected.',
  '',
  '## Repository Intelligence Explanation',
  [...Object.values(evidenceSynthesis.fields).filter((field) => field.missing && field.suggestedWording).map((field) => [
    `### Evidence Synthesis: ${field.label}`,
    `- Sources: ${field.evidence.map((item) => item.source).join('; ')}`,
    `- Confidence: ${field.confidence}`,
    `- Independent evidence: ${field.confidenceCalculation?.independentGroups?.join(', ') || 'None'}`,
    `- Generated confirmations: ${field.confidenceCalculation?.generatedConfirmations?.join(', ') || 'None'}`,
    `- Suggested Canonical Wording: ${field.suggestedWording}`,
    `- Selection rule: ${field.selectionRule}`,
  ].join('\n')), ...(healthExplanations.length ? healthExplanations.map((item) => [
    `### Finding: ${item.finding}`,
    `- Rule: ${item.rule}`,
    `- Computed: ${item.computed}`,
    `- Threshold: ${item.threshold}`,
    `- Result: ${item.result}`,
    `- Evidence: ${item.evidence.join('; ')}`,
  ].join('\n')) : ['- No repository health findings require explanation.'])].join('\n\n'),
  '',
  '## Recommended Next Step',
  recommendationFor(risks),
  '',
  manualNotes,
].join('\n');

await mkdir(aiDir, { recursive: true });
await writeFile(outputPath, content);
console.log(`Wrote ${outputPath}`);
