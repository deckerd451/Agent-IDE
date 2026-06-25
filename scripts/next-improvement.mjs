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

export function chooseNextImprovement({ health = '', quality = null, audit = '', backlog = '', strategy = '', contextPackage = '' }) {
  const risks = healthRisks(health);
  const coverage = quality?.coverage ?? {};
  const missingCanonical = ['goalsPresent','strategyPresent','architecturePresent','decisionsPresent','validationPresent','backlogPresent','repositoryHealthPresent','agentsPresent','codePresent'].find((key) => coverage[key] === false);
  if (missingCanonical || risks.some((r) => /missing intelligence file|no product thesis|no current focus|architecture has no/i.test(r))) {
    const risk = risks.find((r) => /missing intelligence file|no product thesis|no current focus|architecture has no/i.test(r)) ?? `Missing canonical intelligence: ${missingCanonical?.replace(/Present$/, '')}`;
    return { kind: 'missing-canonical', title: 'Restore missing canonical repository intelligence.', source: risk, reason: 'Canonical intelligence is the source of truth for every generated prompt and handoff.' };
  }
  const contradictions = quality?.consistency?.contradictions ?? [];
  const duplicates = quality?.consistency?.duplicatedSections ?? [];
  if (contradictions.length || duplicates.length || /contradiction|duplicate canonical/i.test(audit)) {
    const source = contradictions[0] ?? duplicates[0] ?? firstLine(audit.match(/.*(?:contradiction|duplicate canonical).*/i)?.[0] ?? audit);
    return { kind: 'consistency-cleanup', title: 'Clean up contradictory or duplicate canonical intelligence.', source, reason: 'Conflicting canonical intelligence makes the next builder prompt unsafe and ambiguous.' };
  }
  const strategyScore = score(quality?.canonicalIntelligenceQuality?.score);
  const strategyConfidence = firstLine(mdSection(strategy, 'Strategy Confidence'), 'Unknown');
  if (strategyScore < 70 || /low|weak|unknown|missing/i.test(strategyConfidence) || /strategy.*(?:weak|missing|warning|leakage)/i.test(risks.join('\n'))) {
    return { kind: 'strategy-quality', title: 'Strengthen strategy quality with evidence-backed repository intent.', source: healthRecommendation(health), reason: 'Weak strategy quality reduces confidence that generated implementation work matches product intent.' };
  }
  const validationConfidence = quality?.confidence?.validationConfidence ?? '';
  if (score(quality?.confidence?.score) < 55 || /low|weak|unknown|missing/i.test(validationConfidence) || risks.some((r) => /validation.*(?:low|weak|no deterministic|missing)/i.test(r))) {
    return { kind: 'validation', title: 'Improve deterministic validation confidence.', source: validationConfidence || healthRecommendation(health), reason: 'Builder prompts should be backed by known local checks that prove changes still work.' };
  }
  const handoffReady = Boolean(contextPackage.trim()) && score(quality?.generatedExportQuality?.score) >= 70;
  if (!handoffReady) return { kind: 'handoff-readiness', title: 'Improve AI handoff readiness.', source: '.ai/context-package.md or generated export quality is weak.', reason: 'Assistant handoffs need complete generated context before implementation work begins.' };
  const stale = quality?.freshness?.canonicalStaleDocuments ?? [];
  if (stale.length) return { kind: 'stale-intelligence', title: 'Refresh stale canonical intelligence.', source: stale[0], reason: 'Stale canonical files can point builders at outdated goals, risks, or validation.' };
  if (backlogCount(backlog) > 25 || risks.some((r) => /backlog.*noise|severe backlog noise/i.test(r))) return { kind: 'backlog-noise', title: 'Reduce severe backlog noise.', source: healthRecommendation(health), reason: 'A noisy backlog hides the highest-leverage next implementation work.' };
  return { kind: 'ai-handoff-validation', title: 'Run AI handoff validation for this repository.', source: 'No serious repository intelligence issue detected.', reason: 'When the control plane is healthy, validate that a fresh assistant can use the handoff package successfully.' };
}

function requirementsFor(choice) {
  if (choice.kind === 'ai-handoff-validation') return ['Run a local AI handoff dry run using the generated context package and prompts as static inputs.', 'Document whether the package contains enough context for an outside builder to choose safe first edits.', 'Record any missing context or acceptance-test gaps in the appropriate `.ai/` manual section.'];
  if (choice.kind === 'consistency-cleanup') return ['Find the contradictory or duplicate canonical sections named in Current Evidence.', 'Choose one evidence-backed canonical wording and apply it consistently across Goals, Strategy, Architecture, Validation, or Repository Health as appropriate.', 'Do not rewrite unrelated manual notes or generated sections.'];
  if (choice.kind === 'validation') return ['Identify the strongest deterministic local validation commands available in this repository.', 'Update validation intelligence so confidence reflects real commands and known gaps.', 'Keep validation safe for local execution.'];
  return ['Address only the issue named in Current Evidence.', 'Update the smallest set of source files or `.ai/` intelligence files needed to resolve it.', 'Preserve existing manual sections and reviewability.'];
}

export function renderPrompt(choice) {
  return `# ${choice.title}\n\n## Motivation\nAgent IDE should close the loop from repository intelligence to one safe next builder task. This prompt was generated deterministically from the Control Plane inputs.\n\n## Current Evidence\n- Source risk/recommendation: ${choice.source}\n- Reason: ${choice.reason}\n\n## Problem\nThe repository needs exactly one next improvement selected from current intelligence signals so implementation work starts from the highest-leverage issue instead of a generic request.\n\n## Goal\n${choice.title}\n\n## Requirements\n${requirementsFor(choice).map((item) => `- ${item}`).join('\n')}\n\n## Acceptance Criteria\n- The selected issue is resolved or explicitly documented with evidence.\n- Relevant generated intelligence can be refreshed without introducing contradictions.\n- Manual sections remain intact.\n- The final diff is small, deterministic, and reviewable.\n\n## Testing Commands\n- npm test\n- npm run build\n\n## Constraints\n${constraints.map((item) => `- ${item}`).join('\n')}\n`;
}

export async function generateNextImprovement(repositoryPath = process.cwd()) {
  const resolved = resolve(repositoryPath);
  const [health, quality, audit, backlog, strategy, contextPackage] = await Promise.all([readText(resolved, 'repository-health.md'), readJson(resolved, 'intelligence-quality.json'), readText(resolved, 'intelligence-audit.md'), readText(resolved, 'backlog.md'), readText(resolved, 'strategy.md'), readText(resolved, 'context-package.md')]);
  const choice = chooseNextImprovement({ health, quality, audit, backlog, strategy, contextPackage });
  const prompt = renderPrompt(choice);
  await mkdir(join(resolved, '.ai'), { recursive: true });
  await writeFile(join(resolved, '.ai', 'next-improvement-prompt.md'), prompt);
  return { choice, prompt, filesRead: requiredFiles };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await generateNextImprovement(process.cwd());
  console.log(`Generated .ai/next-improvement-prompt.md: ${result.choice.title}`);
}
