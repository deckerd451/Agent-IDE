import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const requiredFiles = ['repository-health.md','intelligence-quality.json','intelligence-audit.md','backlog.md','strategy.md','context-package.md'];
const constraints = ['local-first','deterministic','no LLM calls','no cloud','no telemetry','preserve manual sections','keep changes small and reviewable'];

async function readText(repositoryPath, file) {
  return readFile(join(repositoryPath, '.ai', file), 'utf8').catch((error) => error?.code === 'ENOENT' ? '' : Promise.reject(error));
}
async function readJson(repositoryPath, file) {
  const text = await readText(repositoryPath, file);
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
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

function packageTypeForActionability(actionability) {
  if (actionability === 'manual') return 'product-decision';
  if (actionability === 'validation-experiment') return 'validation-experiment';
  return 'implementation';
}

function selectedIssue({ id, category, severity = 'high', actionability = issueActionability(id, source), source, title, evidence, reason, recommendedAction }) {
  return { id, kind: id, category, severity, actionability, packageType: packageTypeForActionability(actionability), source, title, evidence: evidence || source, reason, recommendedAction };
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

function selectBestIssue(issues) {
  return issues.sort((a, b) => actionabilityRank(a) - actionabilityRank(b) || severityRank(a) - severityRank(b))[0];
}

const issueDetails = {
  'missing-manual-goals': {
    problem: 'The repository is missing populated Manual Goals, so generated intelligence cannot reliably identify current product intent, success criteria, or the safest next implementation target.',
    requirements: ['Populate `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.', 'Base the entry on repository-local evidence only.', 'Do not rewrite unrelated manual or generated intelligence sections.'],
    acceptance: ['Manual Goals are populated with current product intent and success criteria.', 'Generated intelligence can be refreshed without mixing Manual Goals with backlog, strategy, validation, or handoff issues.', 'Manual sections remain intact.'],
  },
  'backlog-noise': {
    problem: 'The backlog contains severe noise that obscures the highest-leverage implementation work and makes generated implementation packages harder to trust.',
    requirements: ['Review the backlog items cited in Current Evidence.', 'Remove, merge, or downgrade noisy backlog items so the backlog emphasizes actionable high-leverage work.', 'Do not change Manual Goals, strategy, validation, or AI handoff content unless directly required by the backlog cleanup.'],
    acceptance: ['Backlog noise is removed, merged, or downgraded with evidence.', 'The highest-priority backlog items remain actionable and repository-specific.', 'Manual sections remain intact.'],
  },
  'strategy-quality': {
    problem: 'Strategy quality is weak or under-evidenced, reducing confidence that the next implementation task matches repository intent.',
    requirements: ['Strengthen strategy intelligence using repository-local evidence.', 'Clarify product intent, current focus, and confidence without changing unrelated backlog or validation content.', 'Keep the strategy update deterministic and reviewable.'],
    acceptance: ['Strategy intelligence describes repository intent and current focus with evidence.', 'Strategy confidence no longer reports a weak, missing, or unknown strategy gap.', 'Manual sections remain intact.'],
  },
  validation: {
    problem: 'Validation confidence is weak or missing, so generated implementation work lacks clear deterministic checks.',
    requirements: ['Identify the strongest deterministic local validation commands available in this repository.', 'Update validation intelligence so confidence reflects real commands and known gaps.', 'Keep validation safe for local execution.'],
    acceptance: ['Validation intelligence lists deterministic local checks and known gaps.', 'Validation confidence is evidence-backed and no longer mismatched with the selected issue.', 'Manual sections remain intact.'],
  },
  'ai-handoff-validation': {
    problem: 'No serious repository intelligence issue is detected, so the safest next step is validating that the generated AI handoff package is usable as-is.',
    requirements: ['Run a local AI handoff dry run using the generated context package and prompts as static inputs.', 'Document whether the package contains enough context for an outside builder to choose safe first edits.', 'Do not request code changes unless adding or documenting a validation workflow.'],
    acceptance: ['AI handoff validation is documented with deterministic local evidence.', 'Any missing context or acceptance-test gaps are recorded in the appropriate \`.ai/\` manual section.', 'No unrelated code changes are requested.'],
  },
  'missing-canonical': {
    problem: 'Canonical repository intelligence is missing, preventing generated prompts and handoffs from relying on a complete source of truth.',
    requirements: ['Restore only the missing canonical intelligence named in Current Evidence.', 'Use repository-local evidence and preserve existing manual sections.', 'Do not mix this work with backlog, strategy, validation, or handoff issues.'],
    acceptance: ['The missing canonical intelligence is restored or explicitly documented.', 'Generated intelligence can be refreshed without introducing contradictions.', 'Manual sections remain intact.'],
  },
  'consistency-cleanup': {
    problem: 'Canonical intelligence contains contradictions or duplicate sections that make generated implementation packages ambiguous.',
    requirements: ['Find the contradictory or duplicate canonical sections named in Current Evidence.', 'Choose one evidence-backed canonical wording and apply it consistently.', 'Do not rewrite unrelated manual notes or generated sections.'],
    acceptance: ['Contradictory or duplicate canonical intelligence is resolved with evidence.', 'Generated intelligence can be refreshed without reintroducing the mismatch.', 'Manual sections remain intact.'],
  },
  'handoff-readiness': {
    problem: 'The generated AI handoff package is incomplete or low quality, so outside builders may lack enough context for safe implementation work.',
    requirements: ['Improve only the generated handoff context cited in Current Evidence.', 'Preserve manual sections and keep updates local-first.', 'Do not mix handoff readiness with backlog or strategy cleanup.'],
    acceptance: ['The handoff package includes complete repository-specific context.', 'Generated export quality is evidence-backed.', 'Manual sections remain intact.'],
  },
  'stale-intelligence': {
    problem: 'Canonical intelligence is stale and may point builders at outdated goals, risks, or validation.',
    requirements: ['Refresh only the stale canonical document cited in Current Evidence.', 'Use current repository-local evidence.', 'Avoid unrelated backlog, strategy, validation, or handoff changes.'],
    acceptance: ['The stale intelligence is refreshed or documented with evidence.', 'Generated intelligence can be refreshed without stale warnings.', 'Manual sections remain intact.'],
  },
};

export function chooseNextImprovement({ health = '', quality = null, audit = '', backlog = '', strategy = '', contextPackage = '' }) {
  const risks = healthRisks(health);
  const coverage = quality?.coverage ?? {};
  const issues = [];
  const missingCanonical = ['goalsPresent','strategyPresent','architecturePresent','decisionsPresent','validationPresent','backlogPresent','repositoryHealthPresent','agentsPresent','codePresent'].find((key) => coverage[key] === false);
  const manualGoalsRisk = risks.find((r) => /manual goals|product thesis|current product intent|success criteria|current focus/i.test(r));
  if (coverage.goalsPresent === false || manualGoalsRisk) {
    const evidence = manualGoalsRisk ?? 'Manual Goals are missing from `.ai/goals.md`.';
    issues.push(selectedIssue({ id: 'missing-manual-goals', category: 'missing manual goals', severity: 'high', actionability: 'manual', source: evidence, title: 'Complete Manual Repository Intent Notes', evidence, reason: 'Manual Goals are the source of truth for product intent and success criteria.', recommendedAction: 'Populate `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.' }));
  }
  if (missingCanonical || risks.some((r) => /missing intelligence file|architecture has no/i.test(r))) {
    const risk = risks.find((r) => /missing intelligence file|architecture has no/i.test(r)) ?? `Missing canonical intelligence: ${missingCanonical?.replace(/Present$/, '')}`;
    if (missingCanonical !== 'goalsPresent') issues.push(selectedIssue({ id: 'missing-canonical', category: 'missing canonical intelligence', severity: 'high', source: risk, title: 'Restore Missing Canonical Intelligence', evidence: risk, reason: 'Canonical intelligence is the source of truth for every generated prompt and handoff.', recommendedAction: 'Restore the missing canonical intelligence named in Current Evidence.' }));
  }
  const contradictions = quality?.consistency?.contradictions ?? [];
  const duplicates = quality?.consistency?.duplicatedSections ?? [];
  if (contradictions.length || duplicates.length || /contradiction|duplicate canonical/i.test(audit)) {
    const source = contradictions[0] ?? duplicates[0] ?? firstLine(audit.match(/.*(?:contradiction|duplicate canonical).*/i)?.[0] ?? audit);
    issues.push(selectedIssue({ id: 'consistency-cleanup', category: contradictions.length || /contradiction/i.test(source) ? 'contradiction normalization' : 'duplicate generated sections', severity: 'high', actionability: 'code-fixable', source, title: 'Clean Up Canonical Contradictions', evidence: source, reason: 'Conflicting canonical intelligence makes the next implementation package unsafe and ambiguous.', recommendedAction: 'Resolve only the contradiction or duplicate canonical section cited in Current Evidence.' }));
  }
  const strategyScore = score(quality?.canonicalIntelligenceQuality?.score);
  const strategyConfidence = firstLine(mdSection(strategy, 'Strategy Confidence'), 'Unknown');
  if (strategyScore < 70 || /low|weak|unknown|missing/i.test(strategyConfidence) || /strategy.*(?:weak|missing|warning|leakage)/i.test(risks.join('\n'))) {
    const evidence = /low|weak|unknown|missing/i.test(strategyConfidence) ? `Strategy Confidence: ${strategyConfidence}` : healthRecommendation(health);
    issues.push(selectedIssue({ id: 'strategy-quality', category: 'fill strategy manual notes', severity: 'medium', actionability: 'manual', source: evidence, title: 'Strengthen Strategy Quality', evidence, reason: 'Weak strategy quality reduces confidence that generated implementation work matches product intent.', recommendedAction: 'Strengthen strategy intelligence with evidence-backed repository intent.' }));
  }
  const validationConfidence = quality?.confidence?.validationConfidence ?? '';
  if (score(quality?.confidence?.score) < 55 || /low|weak|unknown|missing/i.test(validationConfidence) || risks.some((r) => /validation.*(?:low|weak|no deterministic|missing)/i.test(r))) {
    const evidence = validationConfidence || healthRecommendation(health);
    issues.push(selectedIssue({ id: 'validation', category: 'validation detector gaps', severity: 'medium', actionability: 'code-fixable', source: evidence, title: 'Improve Validation Confidence', evidence, reason: 'Implementation packages should be backed by known local checks that prove changes still work.', recommendedAction: 'Update validation intelligence with deterministic local checks and known gaps.' }));
  }
  const handoffReady = Boolean(contextPackage.trim()) && score(quality?.generatedExportQuality?.score) >= 70;
  if (!handoffReady) issues.push(selectedIssue({ id: 'handoff-readiness', category: 'AI handoff readiness', severity: 'medium', actionability: 'code-fixable', source: '.ai/context-package.md or generated export quality is weak.', title: 'Improve AI Handoff Readiness', evidence: '.ai/context-package.md or generated export quality is weak.', reason: 'Assistant handoffs need complete generated context before implementation work begins.', recommendedAction: 'Improve the generated handoff package cited in Current Evidence.' }));
  const stale = quality?.freshness?.canonicalStaleDocuments ?? [];
  if (stale.length) issues.push(selectedIssue({ id: 'stale-intelligence', category: 'stale intelligence', severity: 'medium', source: stale[0], title: 'Refresh Stale Intelligence', evidence: stale[0], reason: 'Stale canonical files can point builders at outdated goals, risks, or validation.', recommendedAction: 'Refresh the stale canonical intelligence cited in Current Evidence.' }));
  const backlogRisk = risks.find((r) => /backlog.*noise|severe backlog noise/i.test(r));
  if (backlogCount(backlog) > 25 || backlogRisk) {
    const evidence = backlogRisk ?? `Backlog contains ${backlogCount(backlog)} items, exceeding the noise threshold of 25.`;
    issues.push(selectedIssue({ id: 'backlog-noise', category: 'backlog filtering bugs', severity: 'medium', actionability: 'code-fixable', source: evidence, title: 'Reduce Backlog Noise', evidence, reason: 'A noisy backlog hides the highest-leverage next implementation work.', recommendedAction: 'Remove, merge, or downgrade noisy backlog items.' }));
  }
  return selectBestIssue(issues.length ? issues : [selectedIssue({ id: 'ai-handoff-validation', category: 'AI handoff validation', severity: 'low', actionability: 'validation-experiment', source: 'No serious repository intelligence issue detected.', title: 'Run AI Handoff Validation', evidence: 'No serious repository intelligence issue detected.', reason: 'When the control plane is healthy, validate that a fresh assistant can use the handoff package successfully.', recommendedAction: 'Run and document a local AI handoff validation dry run.' })]);
}


function suggestedManualUpdate(selected) {
  if (selected.id === 'missing-manual-goals') {
    return [
      'Add text like the following under `.ai/goals.md` `## Manual Goals`:',
      '',
      '```md',
      '- Product intent: [Repository owner: describe the product purpose this repository should serve.]',
      '- Current focus: [Repository owner: describe the current product priority.]',
      '- Success criteria: [Repository owner: describe how success should be judged.]',
      '```',
      '',
      'Do not edit automatically. The repository owner should review, accept, or edit this text before saving it.',
    ].join('\n');
  }
  if (selected.id === 'strategy-quality') {
    return [
      'Add text like the following under `.ai/strategy.md` `## Manual Strategy Notes`:',
      '',
      '```md',
      '- Strategic bet: [Repository owner: describe the product strategy this repository should support.]',
      '- Differentiator: [Repository owner: describe what this project should optimize for or avoid.]',
      '- Evidence: [Repository owner: cite repository-local files, decisions, or docs that justify the strategy.]',
      '```',
      '',
      'Do not edit automatically. The repository owner should review, accept, or edit this text before saving it.',
    ].join('\n');
  }
  return 'Record the product-owner decision in the appropriate \`.ai/\` manual section. Do not edit automatically; the repository owner should review, accept, or edit the final text.';
}

function renderSelectedIssue(selected) {
  return `- ID: ${selected.id}\n- Category: ${selected.category}\n- Severity: ${selected.severity}\n- Actionability: ${selected.actionability}\n- Package Type: ${selected.packageType ?? packageTypeForActionability(selected.actionability)}\n- Source: ${selected.source}\n- Title: ${selected.title}\n- Evidence: ${selected.evidence}\n- Reason: ${selected.reason}\n- Recommended Action: ${selected.recommendedAction}`;
}

function renderImplementationPackage(selected, details) {
  return `# ${selected.title}\n\n## Implementation Instructions\nImplement this Implementation Package exactly as written.\nUse the cited repository evidence to identify the root cause before making changes.\nKeep the implementation narrowly scoped.\nDo not broaden scope beyond the selected issue.\nPreserve deterministic, local-first behavior.\nPreserve manual intelligence sections.\nAvoid unrelated refactoring.\nUse only repository-local evidence.\nDo not make LLM calls, use cloud services, or add telemetry.\nEnsure execution and validation are fully reproducible.\n\n## Selected Issue\n${renderSelectedIssue(selected)}\n\n## Motivation\nAgent IDE should close the loop from repository intelligence to one safe next builder task. This Implementation Package was generated deterministically from the selected issue above.\n\n## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n\n## Problem\n${details.problem}\n\n## Goal\n${selected.recommendedAction}\n\n## Requirements\n${details.requirements.map((item) => `- ${item}`).join('\n')}\n\n## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n- The final diff is small, deterministic, and reviewable.\n\n## Testing Commands\n- npm test\n- npm run build\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n\n## Expected Repository Improvement\n- Repository Health should improve.\n- Intelligence Quality should improve.\n- The selected issue should disappear or downgrade.\n- No new canonical contradictions should be introduced.\n\n## After Implementation\n- Refresh Repository Intelligence.\n- Compare Repository Health before and after.\n- Compare Intelligence Quality before and after.\n- Verify whether the selected issue was resolved.\n- Summarize any newly discovered issues.\n- Generate the next Implementation Package.\n`;
}

function renderProductDecisionPackage(selected, details) {
  return `# ${selected.title}\n\n## Decision Instructions\nThis is a product-owner decision task, not a Codex implementation task.\nUse repository-local evidence to decide or record the missing product, strategy, or manual-intelligence information.\nDo not send this package to Codex as implementation work.\nDo not edit files automatically; the repository owner should review, accept, or edit the suggested manual update.\n\n## Selected Issue\n${renderSelectedIssue(selected)}\n\n## Why Human Judgment Is Required\n${details.problem}\n\n${selected.reason} This requires repository-owner judgment about intent, strategy, priorities, or manual notes rather than a deterministic code fix.\n\n## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n\n## Decision Needed\n${selected.recommendedAction}\n\n## Suggested Manual Update\n${suggestedManualUpdate(selected)}\n\n## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n- The repository owner reviews the suggested manual text.\n- The repository owner accepts, edits, or rejects the suggested text based on actual product intent.\n- Any accepted decision is recorded in the correct \`.ai/\` manual section.\n- No manual work is labeled as Codex implementation work.\n\n## After Decision\n- Refresh Repository Intelligence.\n- Compare Repository Health before and after.\n- Compare Intelligence Quality before and after.\n- Verify whether the selected manual issue was resolved or downgraded.\n- Generate the next correctly typed package.\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n`;
}

function renderValidationPackage(selected, details) {
  return `# ${selected.title}\n\n## Validation Instructions\nRun this Validation Experiment as a deterministic local check.\nUse the cited repository evidence to validate handoff quality without broadening scope.\nDo not make product-owner decisions, LLM calls, cloud calls, or telemetry changes.\n\n## Selected Issue\n${renderSelectedIssue(selected)}\n\n## Current Evidence\n- Source risk/recommendation: ${selected.evidence}\n- Reason: ${selected.reason}\n\n## Experiment\n${details.problem}\n\n## Requirements\n${details.requirements.map((item) => `- ${item}`).join('\n')}\n\n## Acceptance Criteria\n${details.acceptance.map((item) => `- ${item}`).join('\n')}\n- The validation result is deterministic, local-first, and reviewable.\n\n## Testing Commands\n- npm test\n- npm run build\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n\n## After Validation\n- Refresh Repository Intelligence.\n- Record any gaps in the appropriate manual section.\n- Generate the next correctly typed package.\n`;
}

export function renderPrompt(choice) {
  const selected = choice.selectedIssue ?? choice;
  selected.packageType ??= packageTypeForActionability(selected.actionability);
  const details = issueDetails[selected.id] ?? issueDetails[selected.kind] ?? issueDetails['missing-canonical'];
  if (selected.packageType === 'product-decision') return renderProductDecisionPackage(selected, details);
  if (selected.packageType === 'validation-experiment') return renderValidationPackage(selected, details);
  return renderImplementationPackage(selected, details);
}

export async function generateNextImprovement(repositoryPath = process.cwd()) {
  const resolved = resolve(repositoryPath);
  const [health, quality, audit, backlog, strategy, contextPackage] = await Promise.all([readText(resolved, 'repository-health.md'), readJson(resolved, 'intelligence-quality.json'), readText(resolved, 'intelligence-audit.md'), readText(resolved, 'backlog.md'), readText(resolved, 'strategy.md'), readText(resolved, 'context-package.md')]);
  const selectedIssue = chooseNextImprovement({ health, quality, audit, backlog, strategy, contextPackage });
  const prompt = renderPrompt({ selectedIssue });
  await mkdir(join(resolved, '.ai'), { recursive: true });
  await writeFile(join(resolved, '.ai', 'next-improvement-prompt.md'), prompt);
  return { choice: selectedIssue, selectedIssue, prompt, filesRead: requiredFiles };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await generateNextImprovement(process.cwd());
  console.log(`Generated .ai/next-improvement-prompt.md: ${result.selectedIssue.title}`);
}
