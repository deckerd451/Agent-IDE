import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { explainDecisionRanking, explainRecommendation, renderExplanationMarkdown } from './intelligence-explanations.mjs';
import { canonicalManualGoalsSuggestedUpdate, evaluateCanonicalStrategyCompleteness } from './canonical-completeness.mjs';
import { renderSynthesisMarkdown } from './evidence-synthesis.mjs';
import { analyzeImprovements, analyzeImprovementsWithTrace } from './improvement-analyzer.mjs';
import { readOutcomeEvidence } from './outcomes.mjs';

const requiredFiles = ['goals.md','repository-health.md','intelligence-quality.json','intelligence-audit.md','backlog.md','strategy.md','context-package.md','architecture.md','decisions.md','execution-model.md'];

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


function completedWorkedOutcomeFor(issue, outcomeEntries = []) {
  return outcomeEntries.slice().reverse().find((entry) => entry?.outcome === 'implemented'
    && entry?.promptQuality === 'worked'
    && (entry.recommendationId === issue?.id || entry.recommendationTitle === issue?.title));
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
    const outcome = completedWorkedOutcomeFor(candidate, outcomeEntries);
    if (!outcome) return { ...candidate, advancement: { state: 'eligible', reason: 'No implemented + worked outcome matched this recommendation.' } };
    const retentionEvidence = deterministicRetentionEvidence(candidate);
    if (retentionEvidence) {
      const reason = `Retained despite implemented outcome because ${retentionEvidence}.`;
      return { ...candidate, advancement: { state: 'retained', reason, outcomeTimestamp: outcome.timestamp }, retentionReason: reason };
    }
    return { ...candidate, advancement: { state: 'satisfied', reason: `Satisfied by implemented + worked outcome recorded at ${outcome.timestamp ?? 'unknown time'}; no deterministic incomplete evidence remains.`, outcomeTimestamp: outcome.timestamp } };
  });
  const unsuppressed = evaluated.filter((candidate) => candidate.advancement?.state !== 'satisfied');
  if (unsuppressed.length > 0) return unsuppressed.map((candidate) => ({ ...candidate, advancementSuppressedCandidates: evaluated.filter((item) => item.advancement?.state === 'satisfied').map((item) => ({ id: item.id, title: item.title, reason: item.advancement.reason })) }));
  return evaluated.map((candidate, index) => index === 0
    ? { ...candidate, advancement: { ...candidate.advancement, state: 'ambiguous', reason: `Ambiguous advancement: ${candidate.advancement.reason} No alternate eligible recommendation exists, so this recommendation remains selected.` } }
    : candidate);
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



const basePriorityById = { 'consistency-cleanup': 98, 'missing-intelligence': 95, validation: 86, 'handoff-readiness': 84, 'backlog-noise': 82, 'missing-manual-goals': 74, 'strategy-quality': 72, 'stale-intelligence': 55, 'ai-handoff-validation': 10 };
const improvementById = {
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
  const selectedIssue = enriched[0];
  return {
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    scoringRules: [
      'Priority score = issue base priority + severity boost + actionability boost, capped at 100.',
      'Expected improvement is a deterministic repository-local lookup by issue type.',
      'Ordering ties break by expected improvement total, actionability, severity, title, then issue ID.',
    ],
    tieBreaking: ['priorityScore desc', 'expectedImprovement.total desc', 'actionability rank asc', 'severity rank asc', 'title asc', 'id asc'],
    candidates: enriched,
    selectedIssue: selectedIssue ? { id: selectedIssue.id, title: selectedIssue.title, rank: selectedIssue.rank, priorityScore: selectedIssue.priorityScore, advancement: selectedIssue.advancement } : null,
    advancement: { suppressedCandidates: enriched.flatMap((issue) => issue.advancementSuppressedCandidates ?? []), selected: selectedIssue?.advancement ?? null },
    selectionExplanation: selectedIssue ? `${selectedIssue.title} is ranked #1 with priority ${selectedIssue.priorityScore} and total expected improvement +${selectedIssue.expectedImprovement.total}.${selectedIssue.advancement?.reason ? ` Advancement: ${selectedIssue.advancement.reason}` : ''}` : 'No candidate issue generated.',
  };
}

const issueDetails = {
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

export function chooseNextImprovementWithCandidates({ health = '', quality = null, audit = '', backlog = '', strategy = '', contextPackage = '', goals = '', repositoryPath = '', validationCompletions = [], outcomeEntries = [], architecture = '', decisions = '', executionModel = '' }) {
  // --- Repository Improvement Analysis ---
  // Improvements must dominate maintenance recommendations.
  const improvementCandidates = analyzeImprovements({ architecture, decisions, executionModel, backlog, strategy });
  const risks = healthRisks(health);
  const coverage = quality?.coverage ?? {};
  const issues = [];
  const missingCanonical = ['goalsPresent','strategyPresent','architecturePresent','decisionsPresent','validationPresent','backlogPresent','repositoryHealthPresent','agentsPresent','codePresent'].find((key) => coverage[key] === false);
  const manualCompleteness = quality?.canonicalIntelligenceQuality?.fields?.manualGoals;
  const manualGoalsRisk = risks.find((r) => /manual goals.*(?:missing|partial|\d+%)/i.test(r));
  const manualNeedsDecision = coverage.goalsPresent === false || (manualCompleteness && Number(manualCompleteness.percent) < 100) || manualGoalsRisk;
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
  if (contradictions.length || duplicates.length || /contradiction|duplicate canonical/i.test(audit)) {
    const source = contradictions[0] ?? duplicates[0] ?? firstLine(audit.match(/.*(?:contradiction|duplicate canonical).*/i)?.[0] ?? audit);
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
  console.error('[refresh:diagnostic] suppression check — contextHash:', contextHash, '| validationCompletions count:', validationCompletions.length);
  console.error('[refresh:diagnostic] completion hashes:', JSON.stringify(validationCompletions.map((r) => ({ repositoryPath: r.repositoryPath, workflowKey: r.workflowKey, selectedIssueId: r.selectedIssueId, contextPackageHash: r.contextPackageHash }))));
  console.error('[refresh:diagnostic] validationAlreadyCompleted:', validationAlreadyCompleted);
  if (!validationAlreadyCompleted && validationCompletions.length > 0) {
    const mismatch = validationCompletions[0];
    console.error('[refresh:diagnostic] suppression skipped — first record mismatch details:', JSON.stringify({ storedPath: mismatch.repositoryPath, resolvedPath: repositoryPath, pathMatch: mismatch.repositoryPath === repositoryPath, storedKey: mismatch.workflowKey, expectedKey: validationWorkflowKey, keyMatch: mismatch.workflowKey === validationWorkflowKey, storedIssueId: mismatch.selectedIssueId, issueMatch: mismatch.selectedIssueId === 'ai-handoff-validation', storedHash: mismatch.contextPackageHash, computedHash: contextHash, hashMatch: mismatch.contextPackageHash === contextHash }));
  }
  // Merge: improvements always appear first (enforced by classRank comparator).
  // Maintenance fallback only when there are no improvements and health is stable.
  const maintenanceIssues = issues.length ? issues : (validationAlreadyCompleted
    ? [upToDateIssue(contextHash)]
    : [selectedIssue({ id: 'ai-handoff-validation', category: 'AI handoff validation', severity: 'low', actionability: 'validation-experiment', source: 'No serious repository intelligence issue detected.', title: 'Run AI Handoff Validation', evidence: 'No serious repository intelligence issue detected.', reason: 'When the control plane is healthy, validate that a fresh assistant can use the handoff package successfully.', recommendedAction: 'Run and document a local AI handoff validation dry run.' })]);
  const candidates = applyRecommendationAdvancement([...improvementCandidates, ...maintenanceIssues], outcomeEntries);
  const decisionRanking = buildDecisionRanking(candidates);
  console.error('[refresh:diagnostic] selected recommendation:', decisionRanking.candidates[0]?.id, '|', decisionRanking.candidates[0]?.title);
  return { selectedIssue: decisionRanking.candidates[0], candidates: decisionRanking.candidates, decisionRanking };
}


function suggestedManualUpdate(selected) {
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

function renderImplementationPackage(selected, details, ranking) {
  const isArchitecturalImprovement = selected.class === 'improvement';
  const traceRef = isArchitecturalImprovement ? '\n\n> Trace: `.ai/recommendation-trace.md` — full reasoning pipeline for this recommendation.' : '';
  return `# ${selected.title}\n\n## Implementation Instructions\nImplement this Implementation Package exactly as written.\nUse the cited repository evidence to identify the root cause before making changes.\nKeep the implementation narrowly scoped.\nDo not broaden scope beyond the selected issue.\nPreserve deterministic, local-first behavior.\nPreserve manual intelligence sections.\nAvoid unrelated refactoring.\nUse only repository-local evidence.\nDo not make LLM calls, use cloud services, or add telemetry.\nEnsure execution and validation are fully reproducible.${traceRef}\n\n## Selected Issue\n${renderSelectedIssue(selected)}\n\n${renderExplanationMarkdown(selected.explanation)}\n\n${renderDecisionRanking(ranking)}## Motivation\nAgent IDE should close the loop from repository intelligence to one safe next builder task. This Implementation Package was generated deterministically from the selected issue above.\n\n## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n${renderAffectedFiles(selected)}\n## Problem\n${details.problem}\n\n## Goal\n${selected.recommendedAction}\n\n## Requirements\n${details.requirements.map((item) => `- ${item}`).join('\n')}\n\n## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n- The final diff is small, deterministic, and reviewable.\n\n## Testing Commands\n- npm test\n- npm run build\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n\n## Expected Repository Improvement\n- Repository Health should improve.\n- Intelligence Quality should improve.\n- The selected issue should disappear or downgrade.\n- No new contradictions with \`.ai/goals.md\` should be introduced.\n\n## After Implementation\n- Refresh Repository Intelligence.\n- Compare Repository Health before and after.\n- Compare Intelligence Quality before and after.\n- Verify whether the selected issue was resolved.\n- Summarize any newly discovered issues.\n- Generate the next Implementation Package.\n`;
}

function renderProductDecisionPackage(selected, details, ranking) {
  return `# ${selected.title}\n\n## Decision Instructions\nThis is a product-owner decision task, not a Codex implementation task.\nUse repository-local evidence to decide or record the missing product, strategy, or manual-intelligence information.\nDo not send this package to Codex as implementation work.\nDo not edit files automatically; the repository owner should review, accept, or edit the suggested manual update in \`.ai/goals.md\`.
Repository owner edits: \`.ai/goals.md\`
Everything else will be regenerated.\n\n## Selected Issue\n${renderSelectedIssue(selected)}\n\n${renderExplanationMarkdown(selected.explanation)}\n\n${renderDecisionRanking(ranking)}${renderManualGoalsDeterministicEvaluation(selected)}${renderStrategyDeterministicEvaluation(selected)}\n\n## Why Human Judgment Is Required\n${details.problem}\n\n${selected.reason} This requires repository-owner judgment about intent, strategy, priorities, or manual notes rather than a deterministic code fix.\n\n## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n\n## Decision Needed\n${selected.recommendedAction}\n\n## Suggested Manual Update\n${suggestedManualUpdate(selected)}\n\n${suggestedCanonicalWording(selected)}## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n${selected.id === 'missing-manual-goals' ? '- Suggested Manual Update exactly matches the canonical Deterministic Evaluation missing fields.\n' : ''}- The repository owner reviews the suggested manual text.\n- The repository owner accepts, edits, or rejects the suggested text based on actual product intent.\n- Any accepted decision is recorded in the correct manual section of \`.ai/goals.md\`.\n- No manual work is labeled as Codex implementation work.\n\n## After Decision\n- Refresh Repository Intelligence.\n- Compare Repository Health before and after.\n- Compare Intelligence Quality before and after.\n- Verify whether the selected manual issue was resolved or downgraded.\n- Generate the next correctly typed package.\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n`;
}

function renderValidationPackage(selected, details, ranking) {
  return `# ${selected.title}\n\n## Validation Instructions\nRun this Validation Experiment as a deterministic local check.\nUse the cited repository evidence to validate handoff quality without broadening scope.\nDo not make product-owner decisions, LLM calls, cloud calls, or telemetry changes.\n\n## Selected Issue\n${renderSelectedIssue(selected)}\n\n${renderExplanationMarkdown(selected.explanation)}\n\n${renderDecisionRanking(ranking)}## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n\n## Experiment\n${details.problem}\n\n## Requirements\n${details.requirements.map((item) => `- ${item}`).join('\n')}\n\n## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n- The validation result is deterministic, local-first, and reviewable.\n\n## Testing Commands\n- npm test\n- npm run build\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n\n## After Validation\n- Refresh Repository Intelligence.\n- Record any gaps in the appropriate manual section of \`.ai/goals.md\`.\n- Generate the next correctly typed package.\n`;
}

export function renderPrompt(choice) {
  const selected = choice.selectedIssue ?? choice;
  selected.packageType ??= packageTypeForActionability(selected.actionability);
  const details = selected.details ?? issueDetails[selected.id] ?? issueDetails[selected.kind] ?? issueDetails['missing-intelligence'];
  const ranking = choice.decisionRanking ?? selected.decisionRanking;
  if (selected.packageType === 'product-decision') return renderProductDecisionPackage(selected, details, ranking);
  if (selected.packageType === 'validation-experiment') return renderValidationPackage(selected, details, ranking);
  return renderImplementationPackage(selected, details, ranking);
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
  const [goals, health, quality, audit, backlog, strategy, contextPackage, architecture, decisions, executionModel] = await Promise.all([readText(resolved, 'goals.md'), readText(resolved, 'repository-health.md'), readJson(resolved, 'intelligence-quality.json'), readText(resolved, 'intelligence-audit.md'), readText(resolved, 'backlog.md'), readText(resolved, 'strategy.md'), readText(resolved, 'context-package.md'), readText(resolved, 'architecture.md'), readText(resolved, 'decisions.md'), readText(resolved, 'execution-model.md')]);

  // Run improvement analysis with per-stage trace diagnostics.
  const { candidates: improvementCandidates, stages } = analyzeImprovementsWithTrace({ architecture, decisions, executionModel, backlog, strategy });

  const outcomeEntries = options.outcomeEntries ?? (await readOutcomeEvidence(resolved)).entries;
  const { selectedIssue, candidates, decisionRanking } = chooseNextImprovementWithCandidates({ goals, health, quality, audit, backlog, strategy, contextPackage, architecture, decisions, executionModel, repositoryPath: resolved, validationCompletions: options.validationCompletions ?? [], outcomeEntries });
  selectedIssue.explanation = explainRecommendation(selectedIssue, candidates);
  decisionRanking.explanation = explainDecisionRanking(decisionRanking);
  const prompt = renderPrompt({ selectedIssue, decisionRanking });
  await mkdir(join(resolved, '.ai'), { recursive: true });
  await writeFile(join(resolved, '.ai', 'next-improvement-prompt.md'), prompt);
  await writeFile(join(resolved, '.ai', 'decision-ranking.json'), `${JSON.stringify(decisionRanking, null, 2)}\n`);

  // Write the deterministic recommendation trace.
  const maintenanceIssues = candidates.filter((c) => c.class === 'maintenance');
  const docs = { goals, health, quality, audit, backlog, strategy, contextPackage, architecture, decisions, executionModel };
  const generatorFailures = options.generatorFailures ?? [];
  const trace = renderRecommendationTrace({ stages, improvementCandidates, maintenanceIssues, allCandidates: candidates, decisionRanking, filesRead: requiredFiles, docs, generatorFailures });
  await writeFile(join(resolved, '.ai', 'recommendation-trace.md'), trace);

  return { choice: selectedIssue, selectedIssue, candidates, decisionRanking, explanation: selectedIssue.explanation, prompt, filesRead: requiredFiles };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await generateNextImprovement(process.cwd());
  console.log(`Generated .ai/next-improvement-prompt.md: ${result.selectedIssue.title}`);
}
