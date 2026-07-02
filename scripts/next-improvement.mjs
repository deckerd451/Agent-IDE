import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { explainDecisionRanking, explainRecommendation, renderExplanationMarkdown } from './intelligence-explanations.mjs';
import { canonicalManualGoalsSuggestedUpdate, evaluateCanonicalStrategyCompleteness } from './canonical-completeness.mjs';
import { renderSynthesisMarkdown } from './evidence-synthesis.mjs';
import { analyzeImprovements, analyzeImprovementsWithTrace } from './improvement-analyzer.mjs';
import { readOutcomeEvidence } from './outcomes.mjs';
import { generateProductIntelligence } from './product-intelligence.mjs';
import { generateExecutionModel } from './execution-model.mjs';
import { bootstrapCanonicalIntelligence, canonicalStatus } from './canonical-bootstrap.mjs';
import { persistQuality } from './intelligence-quality.mjs';
import { detectRepositoryProfile, isNpmValidationCandidate, isXcodeValidationCandidate } from './repository-validation.mjs';

const requiredFiles = ['goals.md','repository-health.md','intelligence-quality.json','intelligence-audit.md','backlog.md','strategy.md','context-package.md','architecture.md','decisions.md','execution-model.md','validation.md','ai-handoff-validation.md','intelligence-verification.md'];

export function contextSnapshotHash(value = '') {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  return `djb2-${hash.toString(16).padStart(8, '0')}`;
}

export function stableContextPackageHash(value = '') {
  const normalized = value.replace(/^Generated:.*$/m, '').trim();
  return normalized ? contextSnapshotHash(normalized) : undefined;
}

function completedValidationMatches(record, { repositoryPath, workflowKey, selectedIssueId, contextPackageHash }) {
  return record?.repositoryPath === repositoryPath
    && record?.workflowKey === workflowKey
    && record?.selectedIssueId === selectedIssueId
    && record?.contextPackageHash === contextPackageHash;
}

function upToDateIssue(contextPackageHash) {
  return selectedIssue({ id: 'repository-up-to-date', category: 'repository status', severity: 'low', actionability: 'validation-experiment', source: 'Validation completed for this intelligence snapshot.', title: 'Repository is up to date', evidence: `Validation completed for this intelligence snapshot.${contextPackageHash ? ` Context package hash: ${contextPackageHash}.` : ''}`, reason: 'No high-priority improvement detected. Refresh after repository changes to generate the next recommendation.', recommendedAction: 'Refresh after repository changes to generate the next recommendation.' });
}

const constraints = ['local-first','deterministic','no LLM calls','no cloud','no telemetry','preserve manual sections','keep changes small and reviewable'];

async function readText(repositoryPath, file) {
  return readFile(join(repositoryPath, '.ai', file), 'utf8').catch((error) => error?.code === 'ENOENT' ? '' : Promise.reject(error));
}
async function readJson(repositoryPath, file) {
  const text = await readText(repositoryPath, file);
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function collectValidationEvidence(repositoryPath) {
  const evidence = { files: [], packageScripts: {}, validationMarkdown: '' };
  async function walk(relativeDir = '') {
    const absoluteDir = join(repositoryPath, relativeDir);
    const entries = await readdir(absoluteDir, { withFileTypes: true }).catch((error) => {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return [];
      throw error;
    });
    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (['.git', 'node_modules', 'DerivedData'].includes(entry.name)) continue;
        if (/\.(?:xcodeproj|xcworkspace)$/.test(entry.name)) evidence.files.push(relativePath.replaceAll('\\', '/'));
        else if (relativePath === '.ai' || !relativePath.startsWith('.ai/')) await walk(relativePath);
      } else if (entry.isFile()) {
        if (relativePath === 'package.json') {
          const parsed = await readFile(join(repositoryPath, relativePath), 'utf8').then((text) => JSON.parse(text)).catch(() => null);
          evidence.packageScripts = parsed?.scripts && typeof parsed.scripts === 'object' ? parsed.scripts : {};
        }
      }
    }
  }
  await walk('');
  evidence.validationMarkdown = await readFile(join(repositoryPath, '.ai', 'validation.md'), 'utf8').catch(() => '');
  if (evidence.validationMarkdown.trim()) evidence.files.push('.ai/validation.md');
  return { ...evidence, files: [...new Set(evidence.files)].sort() };
}

function firstXcodeTarget(files = []) {
  return files.find((file) => file.endsWith('.xcworkspace')) ?? files.find((file) => file.endsWith('.xcodeproj')) ?? null;
}

function schemesFromValidationMarkdown(validationMarkdown = '') {
  const schemes = [];
  const addScheme = (value) => {
    const scheme = value?.trim().replace(/^[`'"-]+/, '').replace(/[`'".,;:]+$/g, '').trim();
    if (scheme && !/[<>]/.test(scheme) && /^[A-Za-z0-9_. -]{1,80}$/.test(scheme)) schemes.push(scheme);
  };
  for (const match of validationMarkdown.matchAll(/(?:^|\n)\s*(?:[-*]\s*)?(?:shared\s+)?schemes?\s*[:=]\s*([^\n]+)/gi)) {
    for (const value of match[1].split(/,|\s{2,}/)) addScheme(value);
  }
  for (const match of validationMarkdown.matchAll(/-scheme\s+['"]?([^'"\n\s]+)/gi)) addScheme(match[1]);
  for (const match of validationMarkdown.matchAll(/(?:schemes?|targets?)\s+(?:include|detected|available|named)\s+`?([A-Za-z0-9_. -]+?)`?(?:[.;\n]|$)/gi)) addScheme(match[1]);
  return [...new Set(schemes)].sort((a, b) => a.localeCompare(b));
}

function schemeFromValidationMarkdown(validationMarkdown = '') {
  return schemesFromValidationMarkdown(validationMarkdown)[0] ?? null;
}

function validationGuidanceFromEvidence(evidence) {
  const target = firstXcodeTarget(evidence.files);
  const hasXcodeEvidence = Boolean(target) || /xcodebuild\s+-list|Xcode Project Validation|\.xcodeproj|\.xcworkspace/i.test(evidence.validationMarkdown || '');
  const commands = [];
  if (hasXcodeEvidence && target) {
    const flag = target.endsWith('.xcworkspace') ? '-workspace' : '-project';
    const scheme = schemeFromValidationMarkdown(evidence.validationMarkdown) ?? '<Scheme>';
    const listTargets = evidence.files.filter((file) => file.endsWith('.xcodeproj') || file.endsWith('.xcworkspace'));
    for (const listTarget of listTargets) commands.push(`xcodebuild -list ${listTarget.endsWith('.xcworkspace') ? '-workspace' : '-project'} ${listTarget}`);
    commands.push(`xcodebuild build ${flag} ${target} -scheme ${scheme} -destination 'platform=iOS Simulator,name=<Installed Simulator Name>'`);
  }
  if (!hasXcodeEvidence) {
    if (typeof evidence.packageScripts?.test === 'string') commands.push('npm test');
    if (typeof evidence.packageScripts?.build === 'string') commands.push('npm run build');
  }
  return {
    target: target ?? (hasXcodeEvidence ? '<Xcode project or workspace>' : 'Repository validation scripts'),
    commands,
    supportingEvidence: evidence.files.filter((file) => file !== target),
    expectedArtifact: hasXcodeEvidence ? '.ai/validation.md entry with xcodebuild -list output and the simulator/device build result or skipped reason.' : '.ai/validation.md entry with command output and pass/fail status.',
    notes: hasXcodeEvidence && target ? [schemesFromValidationMarkdown(evidence.validationMarkdown).length > 1 ? `Multiple schemes were detected; selected ${schemeFromValidationMarkdown(evidence.validationMarkdown)} by stable alphabetical sort.` : '', schemeFromValidationMarkdown(evidence.validationMarkdown) ? '' : 'Fill in <Scheme> from the xcodebuild -list output.', 'Fill in <Installed Simulator Name> with an installed iOS Simulator name. Do not run xcodebuild automatically.'].filter(Boolean) : [],
  };
}

function renderValidationGuidance(guidance = {}) {
  const commands = guidance.commands?.length ? guidance.commands.map((command) => `- ${command}`).join('\n') : '- No deterministic repository-native validation command was detected.';
  const supportingEvidence = guidance.supportingEvidence?.length ? guidance.supportingEvidence.map((file) => `- ${file}`).join('\n') : '- None detected.';
  const notes = guidance.notes?.length ? `\n\n### Placeholders\n${guidance.notes.map((note) => `- ${note}`).join('\n')}` : '';
  return `## Validation Guidance\n- Validation target: ${guidance.target ?? 'Repository validation target not detected.'}\n- Expected validation artifact: ${guidance.expectedArtifact ?? '.ai/validation.md entry with local validation results.'}\n\n### Suggested Commands\n${commands}\n\n### Supporting Evidence\n${supportingEvidence}${notes}\n`;
}

function manualGoalsCompletenessExplanation(quality) {
  return quality?.explanations?.completeness?.fields?.manualGoals ?? null;
}
function strategyCompletenessExplanation(quality, goals = '') {
  return quality?.canonicalIntelligenceQuality?.strategyFields ?? evaluateCanonicalStrategyCompleteness(goals);
}
function firstMissingStrategyField(strategyCompleteness) {
  return (strategyCompleteness?.requiredFields ?? []).find((field) => !field.optional && !field.present) ?? null;
}
function strategyEvidenceForField(selected) {
  const synthesisField = selected.strategyEvidenceSynthesis?.fields?.[selected.strategyField?.key];
  const lineage = synthesisField?.lineage;
  return {
    synthesisField,
    supportingEvidence: synthesisField?.allEvidence?.length ? synthesisField.allEvidence : synthesisField?.evidence ?? [],
    confidence: synthesisField?.confidence ?? 'None',
    lineage,
  };
}
function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}
function bullets(text) { return text.split('\n').map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, '').trim()); }
function firstLine(text, fallback = 'Not detected') { return text.split('\n').map((l) => l.replace(/^[-*]\s+/, '').trim()).find(Boolean) ?? fallback; }
function healthRisks(health) { return bullets(mdSection(health, 'Risks')).filter((r) => !/no .*risks/i.test(r)); }
function healthRecommendation(health) { return firstLine(mdSection(health, 'Recommended Next Step'), 'No repository-health recommendation detected.'); }
function backlogCount(backlog) { return bullets(mdSection(backlog, 'Prioritized Backlog') || mdSection(backlog, 'Current Backlog') || mdSection(backlog, 'Manual Backlog') || backlog).length; }
function score(value, fallback = 100) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }


function outcomeMatchesRecommendation(entry, issue) {
  return entry?.recommendationId === issue?.id || entry?.recommendationTitle === issue?.title;
}

function completedWorkedOutcomeFor(issue, outcomeEntries = []) {
  return outcomeEntries.slice().reverse().find((entry) => entry?.outcome === 'implemented'
    && entry?.promptQuality === 'worked'
    && outcomeMatchesRecommendation(entry, issue));
}

function isValidationCandidate(issue = {}) {
  const text = [issue.id, issue.kind, issue.class, issue.category, issue.actionability, issue.packageType, issue.title, issue.recommendedAction].filter(Boolean).join(' ');
  return /(?:^|[-_\s])validation(?:[-_\s]|$)|validation-experiment|handoff validation|xcodebuild|simulator/i.test(text);
}

function outcomeNoteText(entry = {}) {
  return [entry.userNote, entry.note, entry.reason, entry.outcomeNote].filter(Boolean).join(' ');
}

export function isAlreadyValidatedWrongRecommendationOutcome(entry = {}) {
  if (entry.outcome !== 'skipped' || entry.promptQuality !== 'wrong_recommendation') return false;
  const note = outcomeNoteText(entry);
  const saysAlready = /\b(?:already|previous(?:ly)?|prior|existing)\b/i.test(note);
  const saysSatisfied = /\b(?:validated|validation|satisf(?:y|ies|ied)|covered|proved|completed|terminal|evidence)\b/i.test(note);
  const citesRecommendation = /\b(?:recommendation|candidate|prompt|outcome|evidence)\b/i.test(note);
  return saysAlready && saysSatisfied && citesRecommendation;
}

function alreadyValidatedWrongRecommendationOutcomeFor(issue, outcomeEntries = []) {
  if (!isValidationCandidate(issue)) return null;
  return outcomeEntries.slice().reverse().find((entry) => outcomeMatchesRecommendation(entry, issue)
    && isAlreadyValidatedWrongRecommendationOutcome(entry));
}

export function isUnavailableLocalToolingOutcome(entry = {}) {
  const note = outcomeNoteText(entry);
  const skippedOrBlocked = entry.outcome === 'skipped' || entry.outcome === 'blocked' || /\b(?:skipped|blocked)\b/i.test(note);
  if (!skippedOrBlocked) return false;
  return /\b(?:unavailable|not available|missing|not installed|not found|absent|without|requires?\s+(?:macos|xcode|local environment|tooling)|linux\s+without|cannot\s+run)\b/i.test(note)
    && /\b(?:xcodebuild|xcrun|xcode|simulator|device|tooling|local environment|macos|linux)\b/i.test(note);
}

export function isIrrelevantRepositoryTypeOutcome(entry = {}) {
  const note = outcomeNoteText(entry);
  if (entry.outcome !== 'skipped') return false;
  const saysIrrelevant = /\b(?:irrelevant|inappropriate|not\s+appropriate|not\s+applicable|not\s+relevant|wrong\s+(?:repository|repo)\s+type|does\s+not\s+apply)\b/i.test(note);
  const citesRepositoryType = /\b(?:repository|repo|project|app|xcode|ios|android|mobile|swift|kotlin|gradle|maven|cargo|rust|python|package\.json|npm|primary\s+build\s+system)\b/i.test(note);
  return saysIrrelevant && citesRepositoryType;
}

function sameRepositoryIntelligenceSnapshot(entry = {}, issue = {}) {
  const issueSnapshot = issue.repositoryIntelligenceSnapshotHash ?? issue.contextPackageHash ?? issue.snapshotHash;
  const entrySnapshot = entry.repositoryIntelligenceSnapshotHash ?? entry.contextPackageHash ?? entry.snapshotHash;
  if (issueSnapshot && entrySnapshot) return issueSnapshot === entrySnapshot;
  return Boolean(issueSnapshot || entrySnapshot) ? false : true;
}

function unavailableToolingOutcomeFor(issue, outcomeEntries = []) {
  return outcomeEntries.slice().reverse().find((entry) => {
    if (!outcomeMatchesRecommendation(entry, issue) || !isUnavailableLocalToolingOutcome(entry)) return false;
    const issueSnapshot = issue?.repositoryIntelligenceSnapshotHash ?? issue?.contextPackageHash ?? issue?.snapshotHash;
    const entrySnapshot = entry?.repositoryIntelligenceSnapshotHash ?? entry?.contextPackageHash ?? entry?.snapshotHash;
    if (issueSnapshot && !entrySnapshot) return true;
    return sameRepositoryIntelligenceSnapshot(entry, issue);
  });
}

function irrelevantRepositoryTypeOutcomeFor(issue, outcomeEntries = []) {
  return outcomeEntries.slice().reverse().find((entry) => outcomeMatchesRecommendation(entry, issue)
    && isIrrelevantRepositoryTypeOutcome(entry)
    && sameRepositoryIntelligenceSnapshot(entry, issue));
}


export function isRepositoryConfigurationBlockedValidationOutcome(entry = {}) {
  const note = outcomeNoteText(entry);
  const status = String(entry.outcome ?? '').toLowerCase();
  const attemptedButTerminal = status === 'failed' || status === 'blocked' || status === 'skipped' || /\b(?:failed|blocked|skipped|cannot\s+run|could\s+not\s+run|unavailable)\b/i.test(note);
  if (!attemptedButTerminal) return false;
  const xcodeSchemeMissingTestAction = /xcodebuild:\s*error:\s*Scheme\s+[^\n]+?\s+is\s+not\s+currently\s+configured\s+for\s+the\s+test\s+action\.?/i.test(note);
  const xcodeTestActionNotConfigured = /\bxcodebuild\b[\s\S]{0,240}\b(?:scheme|test\s+action)\b[\s\S]{0,240}\bnot\s+(?:currently\s+)?configured\b[\s\S]{0,240}\b(?:test\s+action|scheme)\b/i.test(note);
  const absentRepoValidationConfig = /\b(?:required\s+)?(?:repo|repository|project)\s+configuration\s+(?:is\s+)?(?:absent|missing|not\s+present|unavailable)\b/i.test(note)
    || /\b(?:no|missing|absent)\s+(?:test\s+target|test\s+action|configured\s+test\s+action|validation\s+configuration|validation\s+command|test\s+scheme)\b/i.test(note)
    || /\b(?:scheme|target)\b[\s\S]{0,160}\b(?:does\s+not\s+have|lacks|missing|without)\b[\s\S]{0,160}\b(?:test\s+action|test\s+target|tests?)\b/i.test(note);
  return xcodeSchemeMissingTestAction || xcodeTestActionNotConfigured || absentRepoValidationConfig;
}

function repositoryConfigurationBlockedOutcomeFor(issue, outcomeEntries = []) {
  if (!isValidationCandidate(issue)) return null;
  return outcomeEntries.slice().reverse().find((entry) => outcomeMatchesRecommendation(entry, issue)
    && isRepositoryConfigurationBlockedValidationOutcome(entry)
    && sameRepositoryIntelligenceSnapshot(entry, issue));
}

function deterministicRetentionEvidence(issue) {
  const text = [issue?.evidence, issue?.source, issue?.reason, issue?.recommendedAction].filter(Boolean).join(' ');
  const incompletePatterns = [
    /\bmissing\b/i,
    /\bincomplete\b/i,
    /\bnot\s+(?:implemented|resolved|complete|present)\b/i,
    /\bfailed?\b/i,
    /\bfailing\b/i,
    /\bcontradiction\b/i,
    /\bduplicate\b/i,
    /\blow confidence\b/i,
    /\bweak\b/i,
    /\brisk\b/i,
    /\bgap\b/i,
    /exceeding the .*threshold/i,
  ];
  const matched = incompletePatterns.find((pattern) => pattern.test(text));
  if (!matched) return '';
  return `deterministic repository evidence still reports incomplete work: ${issue.evidence || issue.source || issue.reason}`;
}

export function applyRecommendationAdvancement(candidates = [], outcomeEntries = []) {
  const evaluated = candidates.map((candidate) => {
    const unavailableToolingOutcome = unavailableToolingOutcomeFor(candidate, outcomeEntries);
    if (unavailableToolingOutcome) {
      return { ...candidate, advancement: { state: 'environment-suppressed', reason: `Suppressed for this repository intelligence snapshot because a skipped/blocked outcome recorded unavailable local tooling: ${unavailableToolingOutcome.userNote || unavailableToolingOutcome.note || 'no note provided'}.`, outcomeTimestamp: unavailableToolingOutcome.timestamp } };
    }
    const repositoryConfigurationBlockedOutcome = repositoryConfigurationBlockedOutcomeFor(candidate, outcomeEntries);
    if (repositoryConfigurationBlockedOutcome) {
      return { ...candidate, advancement: { state: 'repository-configuration-blocked', reason: `Suppressed for this repository intelligence snapshot because validation terminally failed due to missing repository configuration: ${repositoryConfigurationBlockedOutcome.userNote || repositoryConfigurationBlockedOutcome.note || repositoryConfigurationBlockedOutcome.reason || 'no note provided'}.`, outcomeTimestamp: repositoryConfigurationBlockedOutcome.timestamp } };
    }
    const irrelevantRepositoryTypeOutcome = irrelevantRepositoryTypeOutcomeFor(candidate, outcomeEntries);
    if (irrelevantRepositoryTypeOutcome) {
      return { ...candidate, advancement: { state: 'repository-type-suppressed', reason: `Suppressed for this repository intelligence snapshot because a skipped outcome recorded that this recommendation is inappropriate for the repository type: ${irrelevantRepositoryTypeOutcome.userNote || irrelevantRepositoryTypeOutcome.note || 'no note provided'}.`, outcomeTimestamp: irrelevantRepositoryTypeOutcome.timestamp } };
    }
    const alreadyValidatedOutcome = alreadyValidatedWrongRecommendationOutcomeFor(candidate, outcomeEntries);
    if (alreadyValidatedOutcome) {
      return { ...candidate, advancement: { state: 'satisfied', reason: `Satisfied by skipped + wrong-recommendation outcome recorded at ${alreadyValidatedOutcome.timestamp ?? 'unknown time'} because the note says prior evidence already validated this recommendation: ${alreadyValidatedOutcome.userNote || alreadyValidatedOutcome.note || 'no note provided'}.`, outcomeTimestamp: alreadyValidatedOutcome.timestamp } };
    }
    const outcome = completedWorkedOutcomeFor(candidate, outcomeEntries);
    if (!outcome) return { ...candidate, advancement: { state: 'eligible', reason: 'No terminal validation evidence, implemented + worked outcome, unavailable-tooling skip, or repository-configuration-blocked validation outcome matched this recommendation for this snapshot.' } };
    if (isValidationCandidate(candidate)) {
      return { ...candidate, advancement: { state: 'satisfied', reason: `Satisfied by implemented + worked validation outcome recorded at ${outcome.timestamp ?? 'unknown time'}; completed validation evidence is terminal for this candidate.`, outcomeTimestamp: outcome.timestamp } };
    }
    const retentionEvidence = deterministicRetentionEvidence(candidate);
    if (retentionEvidence) {
      const reason = `Retained despite implemented outcome because ${retentionEvidence}.`;
      return { ...candidate, advancement: { state: 'retained', reason, outcomeTimestamp: outcome.timestamp }, retentionReason: reason };
    }
    return { ...candidate, advancement: { state: 'satisfied', reason: `Satisfied by implemented + worked outcome recorded at ${outcome.timestamp ?? 'unknown time'}; no deterministic incomplete evidence remains.`, outcomeTimestamp: outcome.timestamp } };
  });
  const suppressingStates = new Set(['satisfied', 'environment-suppressed', 'repository-type-suppressed', 'repository-configuration-blocked']);
  const unsuppressed = evaluated.filter((candidate) => !suppressingStates.has(candidate.advancement?.state));
  const suppressed = evaluated.filter((item) => suppressingStates.has(item.advancement?.state)).map((item) => ({ id: item.id, title: item.title, reason: item.advancement.reason }));
  if (unsuppressed.length > 0) return unsuppressed.map((candidate) => ({ ...candidate, advancementSuppressedCandidates: suppressed }));
  if (evaluated.length > 0) {
    return [{
      ...selectedIssue({ id: 'no-eligible-next-improvement', category: 'repository status', severity: 'low', actionability: 'validation-experiment', source: 'No eligible next improvement found.', title: 'No eligible next improvement found.', evidence: 'No eligible next improvement found.', reason: 'All deterministic candidates were suppressed by completed outcomes, same-snapshot unavailable-tooling skips, or repository-configuration-blocked validation outcomes and no incomplete evidence remains.', recommendedAction: 'Refresh after repository changes or add actionable repository intelligence.' }),
      advancement: { state: 'empty', reason: 'No eligible next improvement found.' },
      advancementSuppressedCandidates: suppressed,
    }];
  }
  return [];
}


function slugify(value = '') {
  return String(value).toLowerCase().replace(/`[^`]*`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'item';
}

const expansionSourcePriority = {
  backlog: 64,
  strategy: 60,
  'repository-health': 56,
  validation: 52,
  'ai-handoff-validation': 48,
  'intelligence-verification': 44,
};

function isActionableCandidateLine(line = '') {
  const text = line.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
  if (text.length < 8) return false;
  if (/^(none|no\s+(?:current|known|eligible|failed|missing)|n\/a)\b/i.test(text)) return false;
  if (/^Suggested Next Step\s*:/i.test(text)) return true;
  return /\b(?:add|build|fix|improve|implement|restore|reduce|remove|merge|downgrade|update|refresh|validate|document|complete|resolve|remediate|address|create|wire|surface|extract|rank|filter|select|test|run|missing|failed|incomplete|partial|gap|weakness|risk|todo|action)\b/i.test(text);
}


function hasRepositoryLocalActionEvidence(text = '') {
  const value = String(text);
  return /`[^`]+`/.test(value)
    || /(?:^|[\s(])(?:\.?[\w-]+\/)+(?:[\w.-]+)(?=$|[\s),.;:])/.test(value)
    || /\b[\w.-]+\.(?:mjs|js|ts|tsx|jsx|json|md|yml|yaml|toml|rs|py|go|java|kt|swift|css|html)\b/.test(value)
    || (/\b(?:[A-Za-z_$][\w$]*\.)?[A-Za-z_$][\w$]*(?:\(\)|#\w+|::\w+)\b/.test(value) && /\b(?:function|method|class|symbol|component|hook|script|command)\b/i.test(value))
    || /\b(?:npm|pnpm|yarn|node|python|pytest|cargo|go test|make)\s+(?:run\s+)?[\w:./-]+\b/i.test(value)
    || /\b(?:manual field|manual section|owner field|product thesis|current product bet|highest-risk assumption|success criteria|what not to build)\b/i.test(value);
}

function isVagueSuggestedNextStep(text = '') {
  const value = String(text).trim();
  if (!/^Suggested Next Step\s*:/i.test(value)) return false;
  if (hasRepositoryLocalActionEvidence(value)) return false;
  return /\b(?:inspect|review|decide|determine|consider|clarify|investigate|assess)\b/i.test(value);
}

function actionFromText(text = '') {
  const cleaned = text.replace(/\s+/g, ' ').trim().replace(/[.;:]$/, '');
  return cleaned.length > 140 ? `${cleaned.slice(0, 137).trim()}...` : cleaned;
}

function titleFromCandidateText(text = '', fallback = 'Improve Repository Intelligence') {
  const cleaned = actionFromText(text).replace(/^\[[ x-]\]\s*/i, '').replace(/^\w+\s*:\s*/, '');
  const withoutDiagnostic = cleaned.replace(/^Repository documentation identifies actionable follow-up work from:\s*/i, '');
  const withoutPrefix = withoutDiagnostic.replace(/^(?:todo|action|next|gap|weakness|remediation|failed|missing|partial)\s*[:—-]\s*/i, '');
  const words = withoutPrefix.split(/\s+/).slice(0, 10).join(' ');
  return words ? words.replace(/^./, (c) => c.toUpperCase()) : fallback;
}

function candidateExpansionIssue({ sourceKey, sourceFile, index, text, section, priorityOffset = 0 }) {
  const action = actionFromText(text);
  const title = titleFromCandidateText(action);
  const vagueSuggestedNextStep = isVagueSuggestedNextStep(action);
  const priority = vagueSuggestedNextStep ? 5 : (expansionSourcePriority[sourceKey] ?? 40) - index + priorityOffset;
  const issue = selectedIssue({
    id: `${sourceKey}-${slugify(title)}`,
    category: vagueSuggestedNextStep ? `${sourceFile} needs clarification` : `${sourceFile} candidate expansion`,
    severity: vagueSuggestedNextStep ? 'low' : /\b(?:failed|missing|critical|blocker|broken)\b/i.test(action) ? 'high' : 'medium',
    actionability: vagueSuggestedNextStep ? 'manual' : /\b(?:decide|product bet|strategy|owner)\b/i.test(`${section} ${action}`) ? 'manual' : /\b(?:validate|validation|test|dry run|failed|missing)\b/i.test(`${sourceKey} ${section} ${action}`) ? 'validation-experiment' : 'code-fixable',
    source: `${sourceFile}${section ? ` ${section}` : ''}`,
    title,
    evidence: vagueSuggestedNextStep ? `Original backlog text preserved for comparison: ${action}` : action,
    reason: vagueSuggestedNextStep ? `Candidate expansion downgraded this ${sourceFile} fragment because it lacks a concrete target, file path, symbol, validation command, or explicit manual field.` : `Candidate expansion selected this actionable item from ${sourceFile}${section ? ` (${section})` : ''}.`,
    recommendedAction: vagueSuggestedNextStep ? 'Clarify the missing repository-local evidence before promoting this backlog fragment.' : action,
  });
  return vagueSuggestedNextStep ? { ...issue, priority, vagueBacklogFragment: true, nonActionableReason: 'Missing concrete target, file path, symbol, validation command, or explicit manual field.', packageType: 'task-clarification' } : { ...issue, priority };
}

function linesFromMarkdown(markdown = '') {
  const candidates = [];
  let section = '';
  for (const raw of markdown.split('\n')) {
    const heading = raw.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (heading) section = heading[2].trim();
    const line = raw.trim();
    if (/^(?:[-*]|\d+[.)])\s+/.test(line) && isActionableCandidateLine(line)) candidates.push({ text: line.replace(/^(?:[-*]|\d+[.)])\s+/, '').trim(), section });
  }
  return candidates;
}

function limitedExpansion(sourceKey, sourceFile, markdown, sectionPatterns = []) {
  const lines = linesFromMarkdown(markdown).filter((item) => !sectionPatterns.length || sectionPatterns.some((pattern) => pattern.test(item.section)) || sectionPatterns.some((pattern) => pattern.test(item.text)));
  const seen = new Set();
  return lines.filter((item) => {
    const key = slugify(item.text);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8).map((item, index) => candidateExpansionIssue({ sourceKey, sourceFile, index, text: item.text, section: item.section }));
}

function isDescriptiveValidationMetadataLine(text = '') {
  const normalized = String(text).replace(/^(?:[-*]|\d+[.)])\s+/, '').trim();
  return /^(?:Repository type|Primary build system|Primary language|Target validation status)\s*:/i.test(normalized);
}

function repositoryAwareValidationCandidates(validation = '') {
  const profile = detectRepositoryProfile({ validationMarkdown: validation });
  const explicitPrimaryBuildSystem = /Primary build system:\s*Xcode/i.test(validation);
  const candidates = limitedExpansion('validation', '.ai/validation.md', validation, [/failed|missing|gap|validation|known/i])
    .filter((candidate) => !isDescriptiveValidationMetadataLine(candidate.evidence) && !isDescriptiveValidationMetadataLine(candidate.recommendedAction) && !isDescriptiveValidationMetadataLine(candidate.title));
  return candidates
    .filter((candidate) => {
      const text = recommendationText(candidate);
      if (explicitPrimaryBuildSystem && profile.primaryBuildSystem === 'Xcode' && !profile.packageJsonIsPrimary && isNpmValidationCandidate(text) && !isXcodeValidationCandidate(text)) return false;
      return true;
    })
    .map((candidate) => {
      const text = recommendationText(candidate);
      if (explicitPrimaryBuildSystem && profile.primaryBuildSystem === 'Xcode' && isXcodeValidationCandidate(text)) return { ...candidate, repositoryProfile: profile, priority: (candidate.priority ?? 0) + 12 };
      return { ...candidate, repositoryProfile: profile };
    });
}

export function expandRecommendationCandidates({ backlog = '', strategy = '', health = '', validation = '', aiHandoffValidation = '', intelligenceVerification = '' } = {}) {
  return [
    ...limitedExpansion('backlog', '.ai/backlog.md', backlog, [/backlog|prioritized|current|manual|future|known|implementation/i]),
    ...limitedExpansion('strategy', '.ai/strategy.md', strategy, [/current product bet|next strategic moves|strategic moves|strategy|bet/i]),
    ...limitedExpansion('repository-health', '.ai/repository-health.md', health, [/weakness|remediation|risk|recommended next step|gap/i]),
    ...repositoryAwareValidationCandidates(validation),
    ...limitedExpansion('ai-handoff-validation', '.ai/ai-handoff-validation.md', aiHandoffValidation, [/incomplete|partial|gap|missing|handoff/i]),
    ...limitedExpansion('intelligence-verification', '.ai/intelligence-verification.md', intelligenceVerification, [/verification|gap|failed|missing/i]),
  ];
}


function recommendationText(issue = {}) {
  return [issue.title, issue.evidence, issue.reason, issue.recommendedAction, issue.source, issue.category].filter(Boolean).join(' ');
}

function isStrategicOrVagueRecommendation(issue = {}) {
  const text = recommendationText(issue);
  return /\b(?:advance strategy|strategic observation|repository handoff readiness|handoff readiness is ready|reports .* ready|control plane reports|readiness signal|repository state|ready for promotion|promotion readiness|north star|product bet)\b/i.test(text)
    || (/\bready\b/i.test(text) && /\b(?:handoff|control plane|repository|promotion)\b/i.test(text) && !/\b(?:add|build|fix|implement|update|expand|extract|surface|wire|test|document|resolve|remove|reduce|create)\b/i.test(issue.title ?? ''));
}

function hasConcreteEngineeringVerb(issue = {}) {
  return /\b(?:add|build|fix|implement|update|expand|extract|surface|wire|test|document|resolve|remove|reduce|create|restore|simplify|validate|refactor|move|merge|establish|investigate|improve|remediate|address|complete|rank|filter|select|run)\b/i.test([issue.title, issue.recommendedAction].filter(Boolean).join(' '));
}

function listEvidence(issue = {}) {
  return [issue.evidence, issue.reason, issue.source].filter(Boolean).map((text) => String(text).trim()).filter(Boolean);
}

function engineeringTaskDetails(task) {
  return {
    problem: task.rootCause,
    requirements: [
      `Implementation target: ${task.implementationTarget}`,
      `Use likely files or artifact sources: ${task.likelyFiles.join(', ')}.`,
      'Keep the change deterministic, local-first, and covered by tests.',
      ...task.nonGoals.map((item) => `Non-goal: ${item}`),
    ],
    acceptance: task.acceptanceCriteria,
  };
}

export function compileEngineeringTask(selected = {}) {
  const evidence = listEvidence(selected);
  const originalRecommendation = {
    id: selected.id,
    title: selected.title,
    evidence: selected.evidence,
    reason: selected.reason,
    recommendedAction: selected.recommendedAction,
    source: selected.source,
  };
  const makeTask = (status, fields) => ({ schemaVersion: 1, status, originalRecommendation, ...fields });

  const exemptTypedTask = ['product-decision', 'validation-experiment'].includes(selected.packageType) || ['repository-up-to-date', 'missing-manual-goals', 'strategy-quality', 'ai-handoff-validation'].includes(selected.id);
  if (exemptTypedTask) {
    const title = selected.title ?? 'Implement selected recommendation';
    return makeTask('preserved', {
      title,
      rootCause: selected.reason || selected.evidence || 'The selected recommendation is already assigned to a concrete non-implementation workflow.',
      implementationTarget: selected.recommendedAction || title,
      likelyFiles: selected.affectedFiles?.length ? selected.affectedFiles : ['repository files cited by Current Evidence'],
      deterministicEvidence: evidence.length ? evidence : ['Selected recommendation includes typed workflow evidence.'],
      acceptanceCriteria: selected.details?.acceptance?.length ? selected.details.acceptance : ['The typed recommendation is handled by its existing deterministic workflow.'],
      nonGoals: ['Do not broaden scope beyond the selected recommendation.', 'Do not change Repository Judgment promotion thresholds.'],
      clarification: null,
    });
  }

  if (!isStrategicOrVagueRecommendation(selected) && hasConcreteEngineeringVerb(selected)) {
    const title = selected.title ?? 'Implement selected recommendation';
    return makeTask('preserved', {
      title,
      rootCause: selected.reason || selected.evidence || 'The selected recommendation is already concrete and implementation-ready.',
      implementationTarget: selected.recommendedAction || title,
      likelyFiles: selected.affectedFiles?.length ? selected.affectedFiles : ['repository files cited by Current Evidence'],
      deterministicEvidence: evidence.length ? evidence : ['Selected recommendation includes a concrete engineering action.'],
      acceptanceCriteria: selected.details?.acceptance?.length ? selected.details.acceptance : ['The concrete recommendation is implemented as selected.', 'The selected issue is resolved or downgraded after refresh.'],
      nonGoals: ['Do not broaden scope beyond the selected recommendation.', 'Do not change Repository Judgment promotion thresholds.'],
      clarification: null,
    });
  }

  if (/\b(?:control plane reports repository handoff readiness as ready|handoff readiness is ready|repository handoff readiness.*ready)\b/i.test(recommendationText(selected))) {
    return makeTask('compiled', {
      title: 'Expand deterministic recommendation candidate extraction after handoff readiness is Ready',
      rootCause: 'Repository handoff readiness is a state signal, not an implementation task; after readiness is Ready, the recommendation system needs deterministic extraction of buildable candidate work instead of passing the readiness observation through.',
      implementationTarget: 'Add deterministic Engineering Task Compilation or candidate extraction behavior so readiness observations produce concrete implementation tasks or are blocked for clarification.',
      likelyFiles: ['scripts/next-improvement.mjs', 'scripts/repository-judgment.mjs', 'src/App.tsx', 'tests/next-improvement.test.mjs', 'tests/recommendation-candidate-expansion.test.mjs'],
      deterministicEvidence: evidence.length ? evidence : ['Selected recommendation reports repository handoff readiness as Ready.'],
      acceptanceCriteria: ['Readiness observations are not passed directly into implementation prompts.', 'The generated prompt names a concrete engineering objective.', 'Generated artifacts preserve both the original recommendation and compiled engineering task.', 'The Do Next card can display the compiled task title.'],
      nonGoals: ['Do not change Repository Judgment promotion thresholds.', 'Do not add LLM calls, cloud services, telemetry, or non-local dependencies.', 'Do not rewrite unrelated recommendation ranking rules.'],
      clarification: null,
    });
  }

  if (isStrategicOrVagueRecommendation(selected)) {
    return makeTask('blocked', {
      title: 'Recommendation requires task clarification.',
      rootCause: 'The selected recommendation is a strategic observation, repository state, readiness signal, or vague intent rather than an implementation-ready task.',
      implementationTarget: 'Clarify the missing repository-local evidence before generating an implementation prompt.',
      likelyFiles: ['.ai/backlog.md', '.ai/strategy.md', '.ai/architecture.md', '.ai/execution-model.md', '.ai/repository-health.md'],
      deterministicEvidence: evidence,
      acceptanceCriteria: ['A concrete implementation target is identified before prompt generation.', 'The prompt remains blocked until deterministic evidence names files, behavior, and acceptance criteria.'],
      nonGoals: ['Do not generate a vague implementation prompt.', 'Do not infer hidden product intent without repository-local evidence.'],
      clarification: 'Missing deterministic evidence: an actionable implementation target, likely files to change, root cause, and acceptance criteria tied to repository-local artifacts.',
    });
  }

  return makeTask('blocked', {
    title: 'Recommendation requires task clarification.',
    rootCause: 'The recommendation does not contain a concrete engineering verb or enough deterministic evidence to derive a safe local task.',
    implementationTarget: 'Provide repository-local evidence that names the behavior or artifact to change.',
    likelyFiles: ['.ai/backlog.md', '.ai/strategy.md', '.ai/architecture.md', '.ai/execution-model.md', '.ai/repository-health.md'],
    deterministicEvidence: evidence,
    acceptanceCriteria: ['A concrete engineering objective is available before implementation prompt generation.'],
    nonGoals: ['Do not generate a vague implementation prompt.'],
    clarification: 'Missing deterministic evidence: concrete action, implementation target, likely files, and acceptance criteria.',
  });
}

function issueFromEngineeringTask(selected, engineeringTask) {
  if (engineeringTask.status === 'preserved') return { ...selected, engineeringTask, originalSelectedRecommendation: engineeringTask.originalRecommendation };
  return {
    ...selected,
    title: engineeringTask.title,
    evidence: engineeringTask.deterministicEvidence.join(' '),
    source: engineeringTask.deterministicEvidence[0] ?? selected.source,
    reason: engineeringTask.rootCause,
    recommendedAction: engineeringTask.implementationTarget,
    packageType: engineeringTask.status === 'blocked' ? 'task-clarification' : 'implementation',
    actionability: engineeringTask.status === 'blocked' ? 'manual' : 'code-fixable',
    details: engineeringTaskDetails(engineeringTask),
    affectedFiles: engineeringTask.likelyFiles,
    engineeringTask,
    originalSelectedRecommendation: engineeringTask.originalRecommendation,
  };
}

function packageTypeForActionability(actionability) {
  if (actionability === 'manual') return 'product-decision';
  if (actionability === 'validation-experiment') return 'validation-experiment';
  return 'implementation';
}

function selectedIssue({ id, category, severity = 'high', actionability, source, title, evidence, reason, recommendedAction }) {
  const resolvedActionability = actionability ?? issueActionability(id, source);
  return { id, kind: id, class: 'maintenance', category, severity, actionability: resolvedActionability, packageType: packageTypeForActionability(resolvedActionability), source, title, evidence: evidence || source, reason, recommendedAction };
}

function issueActionability(id, source = '') {
  if (id === 'missing-manual-goals' || id === 'strategy-quality') return 'manual';
  if (id === 'ai-handoff-validation') return 'validation-experiment';
  if (id === 'stale-intelligence' && /manual|product owner|repository intent notes/i.test(source)) return 'manual';
  return 'code-fixable';
}

function actionabilityRank(issue) {
  if (issue.severity === 'critical') return 0;
  if (issue.actionability === 'code-fixable') return 1;
  if (issue.actionability === 'manual') return 2;
  return 3;
}

function severityRank(issue) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[issue.severity] ?? 4;
}



const basePriorityById = { 'canonical-bootstrap': 110, 'consistency-cleanup': 98, 'missing-intelligence': 95, validation: 86, 'handoff-readiness': 84, 'backlog-noise': 82, 'missing-manual-goals': 74, 'strategy-quality': 72, 'stale-intelligence': 55, 'ai-handoff-validation': 10 };
const improvementById = {
  'canonical-bootstrap': { repositoryHealth: 12, canonicalCompleteness: 18, quality: 10, verification: 6, handoffReadiness: 8 },
  'missing-manual-goals': { repositoryHealth: 8, canonicalCompleteness: 12, quality: 4, verification: 0, handoffReadiness: 4 },
  'missing-intelligence': { repositoryHealth: 10, canonicalCompleteness: 10, quality: 8, verification: 6, handoffReadiness: 6 },
  'consistency-cleanup': { repositoryHealth: 9, canonicalCompleteness: 0, quality: 10, verification: 5, handoffReadiness: 7 },
  validation: { repositoryHealth: 7, canonicalCompleteness: 0, quality: 5, verification: 10, handoffReadiness: 5 },
  'handoff-readiness': { repositoryHealth: 6, canonicalCompleteness: 0, quality: 5, verification: 3, handoffReadiness: 10 },
  'backlog-noise': { repositoryHealth: 6, canonicalCompleteness: 0, quality: 5, verification: 2, handoffReadiness: 6 },
  'strategy-quality': { repositoryHealth: 7, canonicalCompleteness: 8, quality: 7, verification: 0, handoffReadiness: 5 },
  'stale-intelligence': { repositoryHealth: 5, canonicalCompleteness: 3, quality: 4, verification: 2, handoffReadiness: 4 },
  'ai-handoff-validation': { repositoryHealth: 2, canonicalCompleteness: 0, quality: 2, verification: 4, handoffReadiness: 3 },
};

export function issuePriority(issue) {
  const base = issue?.priority ?? basePriorityById[issue?.id] ?? 40;
  const severityBoost = { critical: 8, high: 4, medium: 2, low: 0 }[issue?.severity] ?? 0;
  const actionabilityBoost = { 'code-fixable': 4, manual: 2, 'validation-experiment': 0 }[issue?.actionability] ?? 0;
  return Math.min(100, base + severityBoost + actionabilityBoost);
}

export function expectedRepositoryImprovement(issue) {
  if (issue?.expectedImprovementValues) {
    const base = issue.expectedImprovementValues;
    return { ...base, total: Object.values(base).reduce((sum, value) => sum + value, 0) };
  }
  const base = improvementById[issue?.id] ?? { repositoryHealth: 3, canonicalCompleteness: 0, quality: 2, verification: 1, handoffReadiness: 2 };
  return { ...base, total: Object.values(base).reduce((sum, value) => sum + value, 0) };
}

function classRank(issue) {
  // Repository improvements always rank above repository maintenance
  return issue?.class === 'improvement' ? 0 : 1;
}

function compareCandidates(a, b) {
  return classRank(a) - classRank(b) || b.priorityScore - a.priorityScore || b.expectedImprovement.total - a.expectedImprovement.total || actionabilityRank(a) - actionabilityRank(b) || severityRank(a) - severityRank(b) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

export function buildDecisionRanking(issues) {
  const enriched = issues.map((issue) => ({
    ...issue,
    priorityScore: issuePriority(issue),
    priority: issuePriority(issue),
    expectedImprovement: expectedRepositoryImprovement(issue),
  })).sort(compareCandidates).map((issue, index) => ({ ...issue, rank: index + 1, selected: index === 0 }));
  const rankedSelectedIssue = enriched[0];
  const engineeringTask = rankedSelectedIssue ? compileEngineeringTask(rankedSelectedIssue) : null;
  const selectedIssue = rankedSelectedIssue && engineeringTask ? issueFromEngineeringTask(rankedSelectedIssue, engineeringTask) : rankedSelectedIssue;
  if (selectedIssue && enriched[0]) enriched[0] = { ...enriched[0], ...selectedIssue, rank: 1, selected: true };
  return {
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    engineeringTask,
    originalSelectedRecommendation: engineeringTask?.originalRecommendation ?? null,
    scoringRules: [
      'Priority score = issue base priority + severity boost + actionability boost, capped at 100.',
      'Expected improvement is a deterministic repository-local lookup by issue type.',
      'Ordering ties break by expected improvement total, actionability, severity, title, then issue ID.',
    ],
    tieBreaking: ['priorityScore desc', 'expectedImprovement.total desc', 'actionability rank asc', 'severity rank asc', 'title asc', 'id asc'],
    candidates: enriched,
    selectedIssue: selectedIssue ? {
      id: selectedIssue.id,
      title: selectedIssue.title,
      rank: selectedIssue.rank,
      priorityScore: selectedIssue.priorityScore,
      advancement: selectedIssue.advancement,
      repositoryIntelligenceSnapshotHash: selectedIssue.repositoryIntelligenceSnapshotHash,
      contextPackageHash: selectedIssue.contextPackageHash,
      snapshotHash: selectedIssue.snapshotHash,
    } : null,
    advancement: { suppressedCandidates: enriched.flatMap((issue) => issue.advancementSuppressedCandidates ?? []), selected: selectedIssue?.advancement ?? null },
    selectionExplanation: selectedIssue ? `${selectedIssue.title} is ranked #1 with priority ${selectedIssue.priorityScore} and total expected improvement +${selectedIssue.expectedImprovement.total}.${engineeringTask?.status === 'compiled' ? ` Engineering task compiled from original recommendation: ${engineeringTask.originalRecommendation.title}.` : ''}${engineeringTask?.status === 'blocked' ? ' Recommendation requires task clarification before implementation.' : ''}${selectedIssue.advancement?.reason ? ` Advancement: ${selectedIssue.advancement.reason}` : ''}` : 'No candidate issue generated.',
  };
}

const issueDetails = {
  'canonical-bootstrap': {
    problem: 'The repository is missing the canonical `.ai/goals.md` owner-intent contract, so generated intelligence cannot enter the repository-intelligence-first workflow safely.',
    requirements: ['Create `.ai/goals.md` from deterministic repository-local evidence only.', 'Preserve placeholder/manual sections for repository-owner input.', 'Refresh generated intelligence after the canonical file is created.'],
    acceptance: ['`.ai/goals.md` exists before any recommendation asks the owner to edit it.', 'The generated template contains manual placeholders where owner judgment is required.', 'Repository intelligence can be refreshed and the next recommendation targets existing canonical intelligence or implementation work.'],
  },
  'missing-manual-goals': {
    problem: 'The repository has missing populated Manual Goals or incomplete Manual Goals fields, so generated intelligence cannot reliably identify all required product intent fields or the safest next implementation target.',
    requirements: ['Update only the incomplete Manual Goals fields identified by the deterministic evaluation.', 'Base the entry on repository-local evidence only.', 'Do not rewrite unrelated manual sections or generated intelligence artifacts.'],
    acceptance: ['The missing Manual Goals fields identified by the deterministic evaluation have been completed.', 'Generated intelligence can be refreshed from \`.ai/goals.md\` without mixing Manual Goals with backlog, strategy, validation, or handoff issues.', 'Manual sections in \`.ai/goals.md\` remain intact.'],
  },
  'backlog-noise': {
    problem: 'The backlog contains severe noise that obscures the highest-leverage implementation work and makes generated implementation packages harder to trust.',
    requirements: ['Review the backlog items cited in Current Evidence.', 'Remove, merge, or downgrade noisy backlog items so the backlog emphasizes actionable high-leverage work.', 'Do not change Manual Goals, strategy, validation, or AI handoff content unless directly required by the backlog cleanup.'],
    acceptance: ['Backlog noise is removed, merged, or downgraded with evidence.', 'The highest-priority backlog items remain actionable and repository-specific.', 'Manual sections remain intact.'],
  },
  'strategy-quality': {
    problem: 'Strategy quality is weak or under-evidenced, reducing confidence that the next implementation task matches repository intent.',
    requirements: ['Update the appropriate manual strategy section of \`.ai/goals.md\` using repository-local evidence.', 'Clarify product intent, current focus, strategic bet, differentiator, or success criteria without editing generated artifacts.', 'Keep the manual update deterministic and reviewable.'],
    acceptance: ['\`.ai/goals.md\` describes repository intent and current focus with evidence-backed owner intent.', 'Regenerated strategy no longer reports a weak, missing, or unknown strategy gap.', 'Generated artifacts remain untouched as manual editing surfaces.'],
  },
  validation: {
    problem: 'Validation confidence is weak or missing, so generated implementation work lacks clear deterministic checks.',
    requirements: ['Identify the strongest deterministic local validation commands available in this repository.', 'Update validation intelligence so confidence reflects real commands and known gaps.', 'Keep validation safe for local execution.'],
    acceptance: ['Validation intelligence lists deterministic local checks and known gaps.', 'Validation confidence is evidence-backed and no longer mismatched with the selected issue.', 'Manual sections remain intact.'],
  },
  'ai-handoff-validation': {
    problem: 'No serious repository intelligence issue is detected, so the safest next step is validating that the generated AI handoff package is usable as-is.',
    requirements: ['Run a local AI handoff dry run using the generated context package and prompts as static inputs.', 'Document whether the package contains enough context for an outside builder to choose safe first edits.', 'Do not request code changes unless adding or documenting a validation workflow.'],
    acceptance: ['AI handoff validation is documented with deterministic local evidence.', 'Any missing context or acceptance-test gaps are recorded in the appropriate manual section of \`.ai/goals.md\`.', 'No unrelated code changes are requested.'],
  },
  'repository-up-to-date': {
    problem: 'Validation completed for this intelligence snapshot, and no high-priority improvement is currently detected.',
    requirements: ['Do not rerun the same validation experiment for the same context package.', 'Refresh after repository changes to generate the next recommendation.'],
    acceptance: ['The completed validation stays suppressed for this intelligence snapshot.', 'A materially changed context package can surface a new validation recommendation.'],
  },
  'missing-intelligence': {
    problem: 'Repository intelligence is missing, preventing generated prompts and handoffs from relying on the `.ai/goals.md` source of truth and generated context.',
    requirements: ['Restore only the missing intelligence named in Current Evidence.', 'Use repository-local evidence and preserve existing manual sections.', 'Do not mix this work with backlog, strategy, validation, or handoff issues.'],
    acceptance: ['The missing intelligence is restored or explicitly documented.', 'Generated intelligence can be refreshed without introducing contradictions.', 'Manual sections remain intact.'],
  },
  'consistency-cleanup': {
    problem: 'Repository intelligence contains contradictions or duplicate sections that make generated implementation packages ambiguous.',
    requirements: ['Find the contradictory or duplicate intelligence sections named in Current Evidence.', 'Choose one evidence-backed wording and apply it consistently.', 'Do not rewrite unrelated manual notes or generated sections.'],
    acceptance: ['Contradictory or duplicate repository intelligence is resolved with evidence.', 'Generated intelligence can be refreshed without reintroducing the mismatch.', 'Manual sections remain intact.'],
  },
  'handoff-readiness': {
    problem: 'The generated AI handoff package is incomplete or low quality, so outside builders may lack enough context for safe implementation work.',
    requirements: ['Improve only the generated handoff context cited in Current Evidence.', 'Preserve manual sections and keep updates local-first.', 'Do not mix handoff readiness with backlog or strategy cleanup.'],
    acceptance: ['The handoff package includes complete repository-specific context.', 'Generated export quality is evidence-backed.', 'Manual sections remain intact.'],
  },
  'stale-intelligence': {
    problem: 'Canonical `.ai/goals.md` owner intent is stale and may point builders at outdated goals, risks, or validation.',
    requirements: ['Refresh only the stale `.ai/goals.md` owner intent cited in Current Evidence.', 'Use current repository-local evidence.', 'Avoid unrelated backlog, strategy, validation, or handoff changes.'],
    acceptance: ['The stale intelligence is refreshed or documented with evidence.', 'Generated intelligence can be refreshed without stale warnings.', 'Manual sections remain intact.'],
  },
  'architectural-improvement': {
    problem: 'An architectural improvement opportunity was identified from deterministic repository intelligence analysis.',
    requirements: ['Investigate the evidence cited before making any changes.', 'Apply only the improvement described in Recommended Action.', 'Keep the change narrowly scoped.', 'Preserve all manual intelligence sections.'],
    acceptance: ['The cited architectural issue is resolved or documented as accepted.', 'No new architectural risks are introduced.', 'Manual sections remain intact.'],
  },
};

export function chooseNextImprovement({ health = '', quality = null, audit = '', backlog = '', strategy = '', contextPackage = '', goals = '', architecture = '', decisions = '', executionModel = '' }) {
  return chooseNextImprovementWithCandidates({ health, quality, audit, backlog, strategy, contextPackage, goals, architecture, decisions, executionModel }).selectedIssue;
}

export function chooseNextImprovementWithCandidates({ health = '', quality = null, audit = '', backlog = '', strategy = '', contextPackage = '', goals = '', repositoryPath = '', validationCompletions = [], outcomeEntries = [], architecture = '', decisions = '', executionModel = '', validation = '', aiHandoffValidation = '', intelligenceVerification = '' }) {
  // --- Repository Improvement Analysis ---
  // Improvements must dominate maintenance recommendations.
  const analyzerCandidates = analyzeImprovements({ architecture, decisions, executionModel, backlog, strategy });
  const expandedCandidates = expandRecommendationCandidates({ backlog, strategy, health, validation, aiHandoffValidation, intelligenceVerification });
  const improvementCandidates = [...analyzerCandidates, ...expandedCandidates];
  const risks = healthRisks(health);
  const issues = [];
  const canonicalGoalsMissing = Boolean(repositoryPath) && !goals?.trim() && quality?.coverage?.goalsPresent !== true;
  if (canonicalGoalsMissing) {
    issues.push(selectedIssue({ id: 'canonical-bootstrap', category: 'intelligence bootstrap', severity: 'critical', actionability: 'manual', source: 'Canonical intelligence file .ai/goals.md is missing.', title: 'Create Missing Canonical Intelligence', evidence: 'Canonical intelligence file .ai/goals.md does not exist.', reason: 'The Control Plane must bootstrap the canonical repository-intent contract before recommending edits to canonical intelligence.', recommendedAction: 'Create .ai/goals.md using the deterministic repository-local bootstrap template, then refresh repository intelligence.' }));
  }
  const coverage = quality?.coverage ?? {};
  const missingCanonical = ['goalsPresent','strategyPresent','architecturePresent','decisionsPresent','validationPresent','backlogPresent','repositoryHealthPresent','agentsPresent','codePresent'].find((key) => coverage[key] === false);
  const manualCompleteness = quality?.canonicalIntelligenceQuality?.fields?.manualGoals;
  const manualGoalsRisk = risks.find((r) => /manual goals.*(?:missing|partial|\d+%)/i.test(r));
  const manualNeedsDecision = !canonicalGoalsMissing && (coverage.goalsPresent === false || (manualCompleteness && Number(manualCompleteness.percent) < 100) || manualGoalsRisk);
  if (manualNeedsDecision) {
    const missing = manualCompleteness?.missing?.length ? ` Missing: ${manualCompleteness.missing.join(', ')}.` : '';
    const evidence = manualGoalsRisk ?? (manualCompleteness ? `Manual Goals are ${manualCompleteness.state} (${manualCompleteness.percent}%).${missing}` : 'Manual Goals are missing from \`.ai/goals.md\`.');
    issues.push({ ...selectedIssue({ id: 'missing-manual-goals', category: 'missing manual goals', severity: 'high', actionability: 'manual', source: evidence, title: 'Complete Manual Repository Intent Notes', evidence, reason: `Manual Goals completeness is below the deterministic threshold.${missing}`, recommendedAction: `Complete only the incomplete Manual Goals fields in \`.ai/goals.md\`.${missing}` }), completenessExplanation: manualGoalsCompletenessExplanation(quality), evidenceSynthesis: quality?.canonicalIntelligenceQuality?.evidenceSynthesis });
  }
  if (missingCanonical || risks.some((r) => /missing intelligence file|architecture has no/i.test(r))) {
    const risk = risks.find((r) => /missing intelligence file|architecture has no/i.test(r)) ?? `Missing repository intelligence: ${missingCanonical?.replace(/Present$/, '')}`;
    if (missingCanonical !== 'goalsPresent') issues.push(selectedIssue({ id: 'missing-intelligence', category: 'missing intelligence', severity: 'high', source: risk, title: 'Restore Missing Intelligence', evidence: risk, reason: '`.ai/goals.md` is the source of truth for generated prompts and handoffs.', recommendedAction: 'Restore the missing intelligence named in Current Evidence.' }));
  }
  const contradictions = quality?.consistency?.contradictions ?? [];
  const duplicates = quality?.consistency?.duplicatedSections ?? [];
  const auditContradictionLine = audit.split('\n').find((line) => /(?:contradiction|duplicate canonical)/i.test(line) && !/\bno\s+(?:known\s+)?contradictions?\b|no duplicate/i.test(line));
  if (contradictions.length || duplicates.length || auditContradictionLine) {
    const source = contradictions[0] ?? duplicates[0] ?? firstLine(auditContradictionLine ?? audit);
    issues.push(selectedIssue({ id: 'consistency-cleanup', category: contradictions.length || /contradiction/i.test(source) ? 'contradiction normalization' : 'duplicate generated sections', severity: 'high', actionability: 'code-fixable', source, title: 'Clean Up Intelligence Contradictions', evidence: source, reason: 'Conflicting repository intelligence makes the next implementation package unsafe and ambiguous.', recommendedAction: 'Resolve only the contradiction or duplicate intelligence section cited in Current Evidence.' }));
  }
  const strategyCompleteness = strategyCompletenessExplanation(quality, goals);
  const missingStrategyField = firstMissingStrategyField(strategyCompleteness);
  const strategyScore = score(quality?.canonicalIntelligenceQuality?.score);
  const strategyConfidence = firstLine(mdSection(strategy, 'Strategy Confidence'), 'Unknown');
  if (missingStrategyField && (strategyScore < 70 || /low|weak|unknown|missing/i.test(strategyConfidence) || /strategy.*(?:weak|missing|warning|leakage)/i.test(risks.join('\n')))) {
    const field = missingStrategyField;
    const evidence = /low|weak|unknown|missing/i.test(strategyConfidence) ? `Strategy Confidence: ${strategyConfidence}` : healthRecommendation(health);
    issues.push({ ...selectedIssue({ id: 'strategy-quality', category: 'fill strategy manual notes', severity: 'medium', actionability: 'manual', source: `${evidence} Missing: ${field.label}.`, title: `Add ${field.label}`, evidence: `${evidence} Missing: ${field.label}.`, reason: `${field.label} is ${field.classification ?? 'Missing'} in .ai/goals.md. ${field.why}`, recommendedAction: `Add ${field.label} to .ai/goals.md under ${field.canonicalSection}.` }), strategyField: field, strategyCompleteness, strategyEvidenceSynthesis: quality?.canonicalIntelligenceQuality?.evidenceSynthesis });
  }
  const validationConfidence = quality?.confidence?.validationConfidence ?? '';
  if (score(quality?.confidence?.score) < 55 || /low|weak|unknown|missing/i.test(validationConfidence) || risks.some((r) => /validation.*(?:low|weak|no deterministic|missing)/i.test(r))) {
    const evidence = validationConfidence || healthRecommendation(health);
    issues.push(selectedIssue({ id: 'validation', category: 'validation detector gaps', severity: 'medium', actionability: 'code-fixable', source: evidence, title: 'Improve Validation Confidence', evidence, reason: 'Implementation packages should be backed by known local checks that prove changes still work.', recommendedAction: 'Update validation intelligence with deterministic local checks and known gaps.' }));
  }
  const handoffReady = Boolean(contextPackage.trim()) && score(quality?.generatedExportQuality?.score) >= 70;
  if (!handoffReady) issues.push(selectedIssue({ id: 'handoff-readiness', category: 'AI handoff readiness', severity: 'medium', actionability: 'code-fixable', source: '.ai/context-package.md or generated export quality is weak.', title: 'Improve AI Handoff Readiness', evidence: '.ai/context-package.md or generated export quality is weak.', reason: 'Assistant handoffs need complete generated context before implementation work begins.', recommendedAction: 'Improve the generated handoff package cited in Current Evidence.' }));
  const stale = quality?.freshness?.canonicalStaleDocuments ?? [];
  if (stale.length) issues.push(selectedIssue({ id: 'stale-intelligence', category: 'stale intelligence', severity: 'medium', source: stale[0], title: 'Refresh Stale Intelligence', evidence: stale[0], reason: 'Stale `.ai/goals.md` owner intent can point builders at outdated goals, risks, or validation.', recommendedAction: 'Refresh the stale repository intelligence cited in Current Evidence.' }));
  const backlogRisk = risks.find((r) => /backlog.*noise|severe backlog noise/i.test(r));
  if (backlogCount(backlog) > 25 || backlogRisk) {
    const evidence = backlogRisk ?? `Backlog contains ${backlogCount(backlog)} items, exceeding the noise threshold of 25.`;
    issues.push(selectedIssue({ id: 'backlog-noise', category: 'backlog filtering bugs', severity: 'medium', actionability: 'code-fixable', source: evidence, title: 'Reduce Backlog Noise', evidence, reason: 'A noisy backlog hides the highest-leverage next implementation work.', recommendedAction: 'Remove, merge, or downgrade noisy backlog items.' }));
  }
  const contextHash = stableContextPackageHash(contextPackage);
  const validationWorkflowKey = 'Validation:validation-experiment:Run AI Handoff Validation';
  const validationAlreadyCompleted = validationCompletions.some((record) => completedValidationMatches(record, { repositoryPath, workflowKey: validationWorkflowKey, selectedIssueId: 'ai-handoff-validation', contextPackageHash: contextHash }));
  // Merge: improvements always appear first (enforced by classRank comparator).
  // Maintenance fallback only when there are no improvements and health is stable.
  const includeMaintenanceFallback = issues.length > 0 || analyzerCandidates.length > 0 || improvementCandidates.length === 0;
  const maintenanceIssues = issues.length ? issues : (!includeMaintenanceFallback ? [] : (validationAlreadyCompleted
    ? [upToDateIssue(contextHash)]
    : [selectedIssue({ id: 'ai-handoff-validation', category: 'AI handoff validation', severity: 'low', actionability: 'validation-experiment', source: 'No serious repository intelligence issue detected.', title: 'Run AI Handoff Validation', evidence: 'No serious repository intelligence issue detected.', reason: 'When the control plane is healthy, validate that a fresh assistant can use the handoff package successfully.', recommendedAction: 'Run and document a local AI handoff validation dry run.' })]));
  const candidates = applyRecommendationAdvancement([...improvementCandidates, ...maintenanceIssues].map((candidate) => ({ ...candidate, repositoryIntelligenceSnapshotHash: contextHash })), outcomeEntries);
  const decisionRanking = buildDecisionRanking(candidates);
  return { selectedIssue: decisionRanking.candidates[0], candidates: decisionRanking.candidates, decisionRanking };
}


function suggestedManualUpdate(selected) {
  if (selected.id === 'canonical-bootstrap') return 'Agent IDE creates the initial `.ai/goals.md` template deterministically from repository-local evidence. Repository owner placeholders remain bracketed for later review.';
  if (selected.id === 'missing-manual-goals') {
    const explanation = selected.completenessExplanation;
    if (!explanation) return 'Canonical completeness explanation unavailable. Regenerate repository intelligence before accepting a Manual Goals update so only deterministically missing fields are suggested.';
    const suggested = canonicalManualGoalsSuggestedUpdate(explanation);
    if (suggested === 'No Manual Goals fields require updates.') return suggested;
    return [
      'Add text like the following under `.ai/goals.md` `## Manual Goals`:',
      '',
      '```md',
      suggested,
      '```',
      '',
      'Do not edit automatically. The repository owner should review, accept, or edit this text before saving it.',
    ].join('\n');
  }
  if (selected.id === 'strategy-quality') {
    const field = selected.strategyField;
    return [
      '## File',
      '',
      field?.canonicalFile ?? '.ai/goals.md',
      '',
      '## Section',
      '',
      field?.canonicalSection ?? '## Manual Strategy Notes',
      '',
      '## Missing Field',
      '',
      field?.label ?? 'Current Product Bet',
      '',
      '## Why This Field Matters',
      '',
      field?.why ?? 'This field is required to strengthen repository strategy quality.',
      '',
      '## Suggested Canonical Structure',
      '',
      '```md',
      field?.manualUpdate ?? '- Current Product Bet:\n  [Repository owner: describe the primary product hypothesis currently being tested.]',
      '```',
      '',
      'Do not invent repository strategy. The repository owner should replace the bracketed placeholder with actual owner intent before saving it.',
    ].join('\n');
  }
  return 'Record the product-owner decision in the appropriate manual section of `.ai/goals.md`. Do not edit generated artifacts. Do not edit automatically; the repository owner should review, accept, or edit the final text.';
}


function suggestedCanonicalWording(selected) {
  const suggestedFields = Object.values(selected.evidenceSynthesis?.fields ?? {}).filter((field) => field.missing && field.suggestedWording);
  if (!suggestedFields.length) return '';
  return ['## Suggested Canonical Wording', '', suggestedFields.map(renderSynthesisMarkdown).join('\n\n---\n\n'), ''].join('\n');
}

function renderList(items, empty = 'None detected.') {
  return items?.length ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`;
}

function renderStrategyDeterministicEvaluation(selected) {
  if (selected.id !== 'strategy-quality') return '';
  const field = selected.strategyField;
  const completeness = selected.strategyCompleteness;
  const evidence = strategyEvidenceForField(selected);
  const support = evidence.supportingEvidence ?? [];
  const lineageSources = evidence.lineage?.sources ?? [];
  return [
    '## Deterministic Strategy Field Evaluation',
    '',
    `- Evaluated canonical file: ${field?.canonicalFile ?? '.ai/goals.md'}`,
    `- Evaluated section: ${field?.canonicalSection ?? '## Manual Strategy Notes'}`,
    `- Missing strategy field: ${field?.label ?? 'Current Product Bet'}`,
    `- Field classification: ${field?.classification ?? 'Missing'}`,
    `- Strategy completeness classification: ${completeness?.classification ?? 'Unknown'} (${completeness?.percent ?? 'Unknown'}%)`,
    `- Canonical owner source: ${field?.canonicalFile ?? '.ai/goals.md'} ${field?.canonicalSection ?? '## Manual Strategy Notes'}`,
    `- Evidence confidence: ${evidence.confidence}`,
    `- Rule threshold: ${completeness?.threshold ?? 'Unknown'}`,
    '',
    '## Supporting Repository Evidence',
    '',
    support.length ? support.map((item) => `- ${item.source ?? item.file}: ${item.heading}${item.wording ? ` — ${item.wording}` : ''}`).join('\n') : '- No repository-local supporting evidence detected for this exact field. The task is still deterministic because the canonical field is missing from the owner source.',
    '',
    '## Evidence Lineage',
    '',
    lineageSources.length ? lineageSources.map((item) => `- ${item.group}: ${item.file} (${item.category})`).join('\n') : '- No supporting lineage sources detected.',
  ].join('\n');
}

function renderManualGoalsDeterministicEvaluation(selected) {
  if (selected.id !== 'missing-manual-goals') return '';
  const explanation = selected.completenessExplanation;
  if (!explanation) return '## Deterministic Evaluation\n\nExplanation unavailable: canonical completeness explanation was not generated.';
  const requiredFields = (explanation.requiredFields ?? []).map((field) => field.label);
  const detectedFields = (explanation.requiredFields ?? []).filter((field) => field.found).map((field) => field.label);
  const missingFields = explanation.missing ?? (explanation.requiredFields ?? []).filter((field) => !field.found).map((field) => field.label);
  return [
    '## Deterministic Evaluation',
    '',
    '- Evaluated canonical file: .ai/goals.md',
    '- Evaluated section: ## Manual Goals',
    '- Required fields:',
    renderList(requiredFields),
    '- Detected fields:',
    renderList(detectedFields),
    '- Missing fields:',
    renderList(missingFields, 'None.'),
    `- Completeness percentage: ${explanation.computed?.percent ?? 'Unknown'}%`,
    `- Classification: ${explanation.classification ?? 'Unknown'}`,
    `- Rule threshold: ${explanation.threshold ?? 'Unknown'}`,
    `- Why this issue was selected: ${selected.reason}`,
  ].join('\n');
}

function renderSelectedIssue(selected) {
  return `- ID: ${selected.id}\n- Category: ${selected.category}\n- Severity: ${selected.severity}\n- Actionability: ${selected.actionability}\n- Package Type: ${selected.packageType ?? packageTypeForActionability(selected.actionability)}\n- Source: ${selected.source}\n- Title: ${selected.title}\n- Evidence: ${selected.evidence}\n- Reason: ${selected.reason}\n- Recommended Action: ${selected.recommendedAction}`;
}

function renderDecisionRanking(ranking) {
  if (!ranking?.candidates?.length) return '';
  return ['## Decision Ranking', '', `Selected issue: ${ranking.selectedIssue?.title ?? 'None'}`, `Selection explanation: ${ranking.selectionExplanation}`, '', ...ranking.candidates.map((issue) => [`${issue.rank}. ${issue.title}${issue.selected ? ' (selected)' : ''}`, `   - ID: ${issue.id}`, `   - Priority: ${issue.priorityScore}`, `   - Expected Improvement: +${issue.expectedImprovement.total} total (+${issue.expectedImprovement.repositoryHealth} Repository Health, +${issue.expectedImprovement.canonicalCompleteness} Canonical Completeness, +${issue.expectedImprovement.quality} Quality, +${issue.expectedImprovement.verification} Verification, +${issue.expectedImprovement.handoffReadiness} Handoff Readiness)`, `   - Reason: ${issue.reason}`, `   - Evidence: ${issue.evidence}`].join('\n')), ''].join('\n');
}

function renderAffectedFiles(selected) {
  if (!selected.affectedFiles?.length) return '';
  return `\n## Affected Files\n${selected.affectedFiles.map((f) => `- \`${f}\``).join('\n')}\n`;
}


function renderEngineeringTask(task) {
  if (!task) return '';
  if (task.status === 'preserved') {
    const originalTitle = task.originalRecommendation?.title;
    if (!originalTitle || originalTitle === task.title) return '';
    return `## Original Repository Judgment Recommendation
- Title: ${originalTitle}`;
  }
  return `## Engineering Task Compilation
- Status: ${task.status}
- Compiled task title: ${task.title}
- Root cause: ${task.rootCause}
- Implementation target: ${task.implementationTarget}
- Likely files or artifact sources:
${task.likelyFiles.map((item) => `  - ${item}`).join('\n')}
- Deterministic evidence:
${(task.deterministicEvidence.length ? task.deterministicEvidence : ['No deterministic evidence available.']).map((item) => `  - ${item}`).join('\n')}
- Concrete acceptance criteria:
${task.acceptanceCriteria.map((item) => `  - ${item}`).join('\n')}
- Explicit non-goals:
${task.nonGoals.map((item) => `  - ${item}`).join('\n')}
${task.clarification ? `- Clarification: ${task.clarification}\n` : ''}
## Original Repository Judgment Recommendation
- Title: ${task.originalRecommendation?.title ?? 'Unknown'}`;
}


function renderStrategicContext(pi) {
  if (!pi || pi.productIntelligenceState === 'blocked') return '';
  const lines = [
    '## Strategic Context',
    '',
    `**Product Thesis:** ${pi.productThesis?.text ?? 'Not defined'}`,
    `**Current Product Bet:** ${pi.currentProductBet?.text ?? 'Not defined'}`,
    `**Repository Alignment:** ${pi.repositoryAlignment?.verdict} — ${pi.repositoryAlignment?.explanation}`,
    `**Highest-Leverage Milestone:** ${pi.highestLeverageMilestone?.text ?? 'Not derived'}`,
  ];
  if (pi.strategicRecommendation) {
    lines.push('');
    lines.push('## Strategic Gap');
    lines.push('');
    lines.push(pi.strategicRecommendation.gap);
    lines.push('');
    lines.push(`Alternative direction: ${pi.strategicRecommendation.alternativeDirection}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderTaskClarificationPackage(selected, ranking) {
  const task = selected.engineeringTask;
  return `# Recommendation requires task clarification.

The selected recommendation was not converted into an implementation prompt because it is not a concrete engineering task.

${renderEngineeringTask(task)}

## Selected Issue
${renderSelectedIssue(selected)}

${renderDecisionRanking(ranking)}## Missing Evidence
${task?.clarification ?? 'Missing deterministic evidence for a concrete implementation target.'}

## Required Before Implementation
- Provide a concrete engineering objective.
- Identify likely files or artifact sources.
- Provide deterministic evidence and acceptance criteria.
- Regenerate the next improvement package after clarification.
`;
}

function renderImplementationPackage(selected, details, ranking, productIntelligence = null) {
  const isArchitecturalImprovement = selected.class === 'improvement';
  const traceRef = isArchitecturalImprovement ? '\n\n> Trace: `.ai/recommendation-trace.md` — full reasoning pipeline for this recommendation.' : '';
  return `# ${selected.title}\n\n## Implementation Instructions\nImplement this Implementation Package exactly as written.\nUse the cited repository evidence to identify the root cause before making changes.\nKeep the implementation narrowly scoped.\nDo not broaden scope beyond the selected issue.\nPreserve deterministic, local-first behavior.\nPreserve manual intelligence sections.\nAvoid unrelated refactoring.\nUse only repository-local evidence.\nDo not make LLM calls, use cloud services, or add telemetry.\nEnsure execution and validation are fully reproducible.${traceRef}\n\n${renderStrategicContext(productIntelligence)}## Selected Issue\n${renderSelectedIssue(selected)}\n\n${renderEngineeringTask(selected.engineeringTask)}\n\n${renderExplanationMarkdown(selected.explanation)}\n\n${renderDecisionRanking(ranking)}## Motivation\nAgent IDE should close the loop from repository intelligence to one safe next builder task. This Implementation Package was generated deterministically from the selected issue above.\n\n## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n${renderAffectedFiles(selected)}\n## Problem\n${details.problem}\n\n## Why This Helps\n${selected.engineeringTask?.rootCause || selected.engineeringTask?.implementationTarget || details.problem}\n\n## Goal\n${selected.engineeringTask?.title || selected.title || selected.recommendedAction}\n\n## Requirements\n${details.requirements.map((item) => `- ${item}`).join('\n')}\n\n## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n- The final diff is small, deterministic, and reviewable.\n\n## Testing Commands\n- npm test\n- npm run build\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n\n## Expected Repository Improvement\n- Repository Health should improve.\n- Intelligence Quality should improve.\n- The selected issue should disappear or downgrade.\n- No new contradictions with \`.ai/goals.md\` should be introduced.\n\n## After Implementation\n- Refresh Repository Intelligence.\n- Compare Repository Health before and after.\n- Compare Intelligence Quality before and after.\n- Verify whether the selected issue was resolved.\n- Summarize any newly discovered issues.\n- Generate the next Implementation Package.\n`;
}

function renderProductDecisionPackage(selected, details, ranking, productIntelligence = null) {
  if (selected.id === 'canonical-bootstrap') return `# ${selected.title}

## Decision Instructions
This is an intelligence bootstrap task, not implementation work.
Agent IDE detected that the canonical owner-intent file is missing before rendering execution guidance.
Create Missing Canonical Intelligence writes only a deterministic local template to \`.ai/goals.md\`; generated artifacts are refreshed afterward.

## Selected Issue
${renderSelectedIssue(selected)}

${renderDecisionRanking(ranking)}## Execution Guidance
- Recommended action type: intelligence bootstrap.
- Existing canonical intelligence: Missing.
- Missing canonical intelligence: \`.ai/goals.md\`.
- Template source: repository-local files only. No LLM calls, cloud service, embeddings, or telemetry.
- Repository-owner decision fields remain bracketed placeholders for later review.

## Acceptance Criteria
${details.acceptance.map((item) => `- ${item}`).join('\n')}
- After creation, refresh repository intelligence and generate the next recommendation normally.

## Constraints
${constraints.map((item) => `- ${item}`).join('\n')}
`;
  return `# ${selected.title}\n\n## Decision Instructions\nThis is a product-owner decision task, not a Codex implementation task.\nUse repository-local evidence to decide or record the missing product, strategy, or manual-intelligence information.\nDo not send this package to Codex as implementation work.\nDo not edit files automatically; the repository owner should review, accept, or edit the suggested manual update in \`.ai/goals.md\`.
Repository owner edits: \`.ai/goals.md\`
Everything else will be regenerated.\n\n${renderStrategicContext(productIntelligence)}## Selected Issue\n${renderSelectedIssue(selected)}\n\n${renderExplanationMarkdown(selected.explanation)}\n\n${renderDecisionRanking(ranking)}${renderManualGoalsDeterministicEvaluation(selected)}${renderStrategyDeterministicEvaluation(selected)}\n\n## Why Human Judgment Is Required\n${details.problem}\n\n${selected.reason} This requires repository-owner judgment about intent, strategy, priorities, or manual notes rather than a deterministic code fix.\n\n## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n\n## Decision Needed\n${selected.recommendedAction}\n\n## Suggested Manual Update\n${suggestedManualUpdate(selected)}\n\n${suggestedCanonicalWording(selected)}## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n${selected.id === 'missing-manual-goals' ? '- Suggested Manual Update exactly matches the canonical Deterministic Evaluation missing fields.\n' : ''}- The repository owner reviews the suggested manual text.\n- The repository owner accepts, edits, or rejects the suggested text based on actual product intent.\n- Any accepted decision is recorded in the correct manual section of \`.ai/goals.md\`.\n- No manual work is labeled as Codex implementation work.\n\n## After Decision\n- Refresh Repository Intelligence.\n- Compare Repository Health before and after.\n- Compare Intelligence Quality before and after.\n- Verify whether the selected manual issue was resolved or downgraded.\n- Generate the next correctly typed package.\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n`;
}

function renderValidationPackage(selected, details, ranking, productIntelligence = null) {
  return `# ${selected.title}\n\n## Validation Instructions\nRun this Validation Experiment as a deterministic local check.\nUse the cited repository evidence to validate handoff quality without broadening scope.\nDo not make product-owner decisions, LLM calls, cloud calls, or telemetry changes.\n\n${renderStrategicContext(productIntelligence)}## Selected Issue\n${renderSelectedIssue(selected)}\n\n${renderExplanationMarkdown(selected.explanation)}\n\n${renderDecisionRanking(ranking)}## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n\n## Experiment\n${details.problem}\n\n## Requirements\n${details.requirements.map((item) => `- ${item}`).join('\n')}\n\n## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n- The validation result is deterministic, local-first, and reviewable.\n\n${renderValidationGuidance(selected.validationGuidance)}\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n\n## After Validation\n- Refresh Repository Intelligence.\n- Record any gaps in the appropriate manual section of \`.ai/goals.md\`.\n- Generate the next correctly typed package.\n`;
}

export function renderPrompt(choice, productIntelligence = null) {
  const selected = choice.selectedIssue ?? choice;
  selected.packageType ??= packageTypeForActionability(selected.actionability);
  const details = selected.details ?? issueDetails[selected.id] ?? issueDetails[selected.kind] ?? issueDetails['missing-intelligence'];
  const ranking = choice.decisionRanking ?? selected.decisionRanking;
  if (selected.packageType === 'task-clarification') return renderTaskClarificationPackage(selected, ranking);
  if (selected.packageType === 'product-decision') return renderProductDecisionPackage(selected, details, ranking, productIntelligence);
  if (selected.packageType === 'validation-experiment') return renderValidationPackage(selected, details, ranking, productIntelligence);
  return renderImplementationPackage(selected, details, ranking, productIntelligence);
}

function renderRecommendationTrace({ stages, improvementCandidates, maintenanceIssues, allCandidates, decisionRanking, filesRead, docs, generatorFailures = [] }) {
  const lines = [];
  lines.push('# Recommendation Trace');
  lines.push('');
  lines.push('Deterministic pipeline trace. Generated by generateNextImprovement. No LLM, no randomness.');
  lines.push('');

  // Generator Failures
  if (generatorFailures.length > 0) {
    lines.push('## Non-Critical Generator Failures');
    lines.push('');
    lines.push('These generators failed but did not block recommendation generation (non-critical).');
    lines.push('');
    for (const f of generatorFailures) {
      lines.push(`- **${f.label ?? f.id}** (id: ${f.id}, exit: ${f.exitCode})`);
      if (f.output) lines.push(`  - Output: ${f.output.slice(0, 200).replace(/\n/g, ' ')}`);
    }
    lines.push('');
  }

  // Files Read table
  lines.push('## Files Read');
  lines.push('');
  lines.push('| File | Present | Size (chars) |');
  lines.push('|---|---|---|');
  for (const file of filesRead) {
    const key = file.replace('.md', '').replace('.json', '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const docKey = { repository_health: 'health', intelligence_quality: 'quality', intelligence_audit: 'audit', context_package: 'contextPackage', execution_model: 'executionModel' }[key] ?? key;
    const content = typeof docs[docKey] === 'string' ? docs[docKey] : (docs[docKey] ? JSON.stringify(docs[docKey]) : '');
    const present = Boolean(content && content.trim());
    lines.push(`| .ai/${file} | ${present ? 'Yes' : 'No'} | ${content.length} |`);
  }
  lines.push('');

  // Per-Stage Analysis
  lines.push('## Improvement Analyzer — Stage Results');
  lines.push('');
  lines.push('Each stage runs a deterministic pattern matcher against one or more .ai/ files.');
  lines.push('');
  for (const s of stages) {
    lines.push(`### ${s.stage}`);
    lines.push('');
    lines.push(`- Input file: ${s.inputFile}`);
    lines.push(`- Input present: ${s.inputPresent ? 'Yes' : 'No'}`);
    lines.push(`- Input size: ${s.inputSize} chars`);
    lines.push(`- Candidates produced: ${s.candidatesProduced}`);
    lines.push(`- Result: ${s.candidatesProduced > 0 ? `${s.candidatesProduced} candidate(s) produced` : `0 candidates — ${s.rejectionReason}`}`);
    lines.push('');
  }

  // Improvement Candidates
  lines.push('## Improvement Candidates');
  lines.push('');
  if (improvementCandidates.length === 0) {
    lines.push('- None produced. All 6 analyzer stages returned 0 candidates.');
  } else {
    for (const c of improvementCandidates) {
      lines.push(`- **${c.id}** (priority ${c.priority ?? '?'}, class: ${c.class})`);
      lines.push(`  - Title: ${c.title}`);
      lines.push(`  - Evidence: ${c.evidence}`);
    }
  }
  lines.push('');

  // Maintenance Candidates
  lines.push('## Maintenance Candidates');
  lines.push('');
  for (const c of maintenanceIssues) {
    lines.push(`- **${c.id}** (class: ${c.class})`);
    lines.push(`  - Title: ${c.title}`);
    lines.push(`  - Evidence: ${c.evidence}`);
  }
  lines.push('');

  // Full Ranked List
  lines.push('## Full Decision Ranking');
  lines.push('');
  lines.push('Sorted by: class rank (improvement=0, maintenance=1), then priority score desc, then expected improvement total desc.');
  lines.push('');
  lines.push('| Rank | ID | Class | Priority | Exp. Improvement | Title |');
  lines.push('|---|---|---|---|---|---|');
  for (const c of decisionRanking.candidates) {
    lines.push(`| ${c.rank} | ${c.id} | ${c.class} | ${c.priorityScore} | +${c.expectedImprovement.total} | ${c.title} |`);
  }
  lines.push('');
  if (decisionRanking.advancement?.suppressedCandidates?.length) {
    lines.push('## Recommendation Advancement');
    lines.push('');
    for (const item of decisionRanking.advancement.suppressedCandidates) lines.push(`- Suppressed **${item.title}** (${item.id}): ${item.reason}`);
    lines.push('');
  }

  // Winner
  const winner = decisionRanking.candidates[0];
  lines.push('## Selected Recommendation');
  lines.push('');
  if (winner) {
    lines.push(`- **ID**: ${winner.id}`);
    lines.push(`- **Title**: ${winner.title}`);
    lines.push(`- **Class**: ${winner.class}`);
    lines.push(`- **Priority Score**: ${winner.priorityScore}`);
    lines.push(`- **Expected Improvement Total**: +${winner.expectedImprovement.total}`);
    lines.push(`- **Evidence**: ${winner.evidence}`);
    lines.push(`- **Reason**: ${winner.reason}`);
    if (winner.advancement?.reason) lines.push(`- **Recommendation advancement**: ${winner.advancement.reason}`);
    lines.push('');
    lines.push('### Why This Recommendation Was Selected');
    lines.push('');
    lines.push(decisionRanking.selectionExplanation);
    if (improvementCandidates.length === 0) {
      lines.push('');
      lines.push('No improvement candidates were produced by the analyzer. The maintenance candidate with the highest priority score was therefore selected.');
      lines.push('');
      lines.push('To produce an improvement candidate, at least one of the following must be true:');
      lines.push('- `.ai/execution-model.md` must exist and contain `### Ownership Risks` or a non-maintenance `## Architectural Risks` block.');
      lines.push('- `.ai/decisions.md` must contain `localStorage` or `sessionStorage`.');
      lines.push('- `.ai/backlog.md` must contain a debt keyword: technical debt, refactor, simplify, duplicate, clean up, legacy, workaround, hack.');
      lines.push('- `.ai/architecture.md` `## Core Systems` must list 12 or more bullet points.');
      lines.push('- `.ai/strategy.md` `## Current Product Bet` must contain words (>4 chars) that do not appear in `## Primary Flows` or `## Core Systems` in architecture.md.');
    }
  } else {
    lines.push('- No recommendation produced.');
  }
  lines.push('');

  return lines.join('\n');
}

export async function generateNextImprovement(repositoryPath = process.cwd(), options = {}) {
  const resolved = resolve(repositoryPath);
  const preBootstrapStatus = await canonicalStatus(resolved, '.ai/goals.md');
  const bootstrap = await bootstrapCanonicalIntelligence(resolved, '.ai/goals.md');
  // Refresh execution-model.md immediately before recommendation analysis so stale
  // execution-model risks cannot be copied into decision-ranking, active
  // recommendation, or the implementation package after canonical docs changed.
  await generateExecutionModel(resolved);
  const staleQuality = await readJson(resolved, 'intelligence-quality.json');
  if (staleQuality?.consistency?.contradictions?.length) await persistQuality(resolved);
  const [goals, health, quality, audit, backlog, strategy, contextPackage, architecture, decisions, executionModel, validation, aiHandoffValidation, intelligenceVerification] = await Promise.all([readText(resolved, 'goals.md'), readText(resolved, 'repository-health.md'), readJson(resolved, 'intelligence-quality.json'), readText(resolved, 'intelligence-audit.md'), readText(resolved, 'backlog.md'), readText(resolved, 'strategy.md'), readText(resolved, 'context-package.md'), readText(resolved, 'architecture.md'), readText(resolved, 'decisions.md'), readText(resolved, 'execution-model.md'), readText(resolved, 'validation.md'), readText(resolved, 'ai-handoff-validation.md'), readText(resolved, 'intelligence-verification.md')]);

  const outcomeEntries = options.outcomeEntries ?? (await readOutcomeEvidence(resolved)).entries;
  const { selectedIssue, candidates, decisionRanking } = chooseNextImprovementWithCandidates({ goals, health, quality, audit, backlog, strategy, contextPackage, architecture, decisions, executionModel, validation, aiHandoffValidation, intelligenceVerification, repositoryPath: resolved, validationCompletions: options.validationCompletions ?? [], outcomeEntries });
  selectedIssue.explanation = explainRecommendation(selectedIssue, candidates);
  if ((selectedIssue.packageType ?? packageTypeForActionability(selectedIssue.actionability)) === 'validation-experiment') {
    selectedIssue.validationGuidance = validationGuidanceFromEvidence(await collectValidationEvidence(resolved));
    if (decisionRanking?.selectedIssue) decisionRanking.selectedIssue.validationGuidance = selectedIssue.validationGuidance;
    if (decisionRanking?.candidates?.[0]) decisionRanking.candidates[0].validationGuidance = selectedIssue.validationGuidance;
  }
  decisionRanking.explanation = explainDecisionRanking(decisionRanking);
  await mkdir(join(resolved, '.ai'), { recursive: true });
  await writeFile(join(resolved, '.ai', 'decision-ranking.json'), `${JSON.stringify(decisionRanking, null, 2)}\n`);
  let productIntelligence = null;
  try {
    productIntelligence = await generateProductIntelligence(resolved, { generatedAt: options.generatedAt });
  } catch (error) {
    console.error('[product-intelligence] Generation failed (non-blocking):', error.message);
  }
  const prompt = renderPrompt({ selectedIssue, decisionRanking }, productIntelligence);
  await writeFile(join(resolved, '.ai', 'next-improvement-prompt.md'), prompt);

  // Refresh execution-model.md again after decision-ranking and prompt artifacts are
  // written so recommendation traces describe the final refreshed artifact set, not
  // a pre-ranking intermediate state.
  await generateExecutionModel(resolved);
  const refreshedExecutionModel = await readText(resolved, 'execution-model.md');
  const { stages: refreshedStages } = analyzeImprovementsWithTrace({ architecture, decisions, executionModel: refreshedExecutionModel, backlog, strategy });

  // Write the deterministic recommendation trace.
  const maintenanceIssues = candidates.filter((c) => c.class === 'maintenance');
  const docs = { goals, health, quality, audit, backlog, strategy, contextPackage, architecture, decisions, executionModel: refreshedExecutionModel, validation, aiHandoffValidation, intelligenceVerification };
  const generatorFailures = options.generatorFailures ?? [];
  const trace = renderRecommendationTrace({ stages: refreshedStages, improvementCandidates: candidates.filter((c) => c.class === 'improvement'), maintenanceIssues, allCandidates: candidates, decisionRanking, filesRead: requiredFiles, docs, generatorFailures });
  await writeFile(join(resolved, '.ai', 'recommendation-trace.md'), trace);

  return { choice: selectedIssue, selectedIssue, candidates, decisionRanking, explanation: selectedIssue.explanation, prompt, filesRead: requiredFiles, productIntelligence, canonicalBootstrap: { requiredFile: '.ai/goals.md', before: preBootstrapStatus.state, created: bootstrap.bootstrapped } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await generateNextImprovement(process.cwd());
  console.log(`Generated .ai/next-improvement-prompt.md: ${result.selectedIssue.title}`);
}
