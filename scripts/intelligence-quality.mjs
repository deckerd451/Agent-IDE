import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { evaluateCanonicalCompleteness } from './canonical-completeness.mjs';
import { synthesizeEvidenceFromDocs } from './evidence-synthesis.mjs';
import { classifyEvidenceSource, persistEvidenceLineage, confidenceFromEvidence } from './evidence-lineage.mjs';
import { validateAIHandoff } from './ai-handoff-validation.mjs';
import { explainCompleteness, explainQuality, explainCompletenessSynchronization, explainEvidenceSynthesis } from './intelligence-explanations.mjs';

export const canonicalIntelligenceFiles = ['goals.md'];
export const generatedIntelligenceFiles = ['strategy.md','architecture.md','repository-health.md','context-package.md','intelligence-quality.json','intelligence-history.json','intelligence-snapshot.json','intelligence-diff.json','intelligence-verification.json','ai-handoff-validation.json','next-improvement-prompt.md','prompts/architect.md','prompts/builder.md','prompts/reviewer.md','prompts/debugger.md'];
export const supportingIntelligenceFiles = ['decisions.md','validation.md','backlog.md','agents.md','code.md','intelligence-audit.md'];
export const derivedArtifactFiles = [...generatedIntelligenceFiles, ...supportingIntelligenceFiles];
export const qualityFiles = [...canonicalIntelligenceFiles, ...derivedArtifactFiles];

export function classifyIntelligenceSource(file) {
  const normalizedFile = file.replace(/^\.ai\//, '').replace(/\\/g, '/');
  const lineage = classifyEvidenceSource(normalizedFile.startsWith('.ai/') || normalizedFile === 'README.md' ? normalizedFile : `.ai/${normalizedFile}`);
  if (lineage === 'Canonical') return 'canonical';
  if (lineage === 'Generated') return 'derived';
  if (lineage === 'Independent') return 'supporting';
  return 'unknown';
}

export function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function firstLine(value, fallback = 'Unknown') {
  return value.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).find(Boolean) ?? fallback;
}

function stripEvidenceLines(value) {
  return value
    .split('\n')
    .filter((line) => !/^(?:evidence|product thesis evidence|current focus evidence):/i.test(line.trim()))
    .join('\n');
}
function normalized(value) { return stripEvidenceLines(value).toLowerCase().replace(/[`*_#>-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function canonicalComparable(value) {
  return normalized(value)
    .replace(/\b(agent ide|the repository|this repository) exists to\b/g, '$1')
    .replace(/\bis currently focused on\b/g, 'focuses on')
    .replace(/\s+/g, ' ')
    .trim();
}
function present(value) { const v = firstLine(value, ''); return Boolean(v) && !/^(unknown|missing|not detected yet|none detected|tbd|todo|generated placeholder)$/i.test(v); }
function percent(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function confidenceValue(value) { const v = normalized(value); if (/high|ready|pass/.test(v)) return 90; if (/medium|partial|mixed/.test(v)) return 65; if (/low|weak|fail|needs attention/.test(v)) return 35; if (/unknown|missing/.test(v)) return 20; return 55; }
function extractRisks(docs, files = Object.keys(docs)) { return files.map((file) => docs[file] ?? '').flatMap((doc) => (mdSection(doc, 'Risks') || mdSection(doc, 'Known Risks')).split('\n')).filter((line) => /^[-*]\s+/.test(line.trim())).map((line) => line.trim().replace(/^[-*]\s+/, '')).filter((line) => !/no .*risks/i.test(line)); }
function backlogItems(backlog) { return (mdSection(backlog, 'Prioritized Backlog') || mdSection(backlog, 'Current Backlog') || mdSection(backlog, 'Manual Backlog') || backlog).split('\n').filter((line) => /^[-*]\s+/.test(line.trim())).map((line) => line.trim()); }

export function detectContradictions(values, normalize = normalized) {
  const known = values.map(normalize).filter(Boolean).filter((v) => !/unknown|missing|not detected/.test(v));
  return [...new Set(known)].length > 1;
}

export function normalizeConfidence(value) {
  const score = confidenceValue(value);
  if (score >= 80) return 'high';
  if (score >= 55) return 'medium';
  if (score >= 30) return 'low';
  return 'unknown';
}

export function detectDuplicateSections(markdown) {
  const seen = new Set();
  const duplicates = [];
  for (const match of markdown.matchAll(/^##\s+(.+)$/gim)) {
    const heading = normalized(match[1]);
    if (seen.has(heading)) duplicates.push(match[1].trim());
    seen.add(heading);
  }
  return duplicates;
}

export function computeTrend(history, current) {
  const previous = history.at(-1);
  if (!previous) return 'Stable';
  const delta = current.overallScore - previous.overallScore;
  const regressions = current.recentRegressions?.length ?? 0;
  if (delta >= 5 && regressions === 0) return 'Improving';
  if (delta <= -5 || regressions > 0 || current.consistency.contradictions.length > 0) return 'Needs Attention';
  return 'Stable';
}

export function computeDrift(previous, current) {
  const prev = previous?.fingerprints ?? {};
  const cur = current.fingerprints;
  const previousRisks = new Set(previous?.risks ?? []);
  const currentRisks = new Set(current.risks ?? []);
  return {
    productThesisChanged: Boolean(previous) && prev.productThesis !== cur.productThesis,
    strategyChanged: Boolean(previous) && prev.strategy !== cur.strategy,
    architectureChanged: Boolean(previous) && prev.architecture !== cur.architecture,
    backlogGrew: Boolean(previous) && (current.backlogCount > (previous.backlogCount ?? 0)),
    backlogShrank: Boolean(previous) && (current.backlogCount < (previous.backlogCount ?? 0)),
    newRisks: [...currentRisks].filter((risk) => !previousRisks.has(risk)),
    removedRisks: [...previousRisks].filter((risk) => !currentRisks.has(risk)),
  };
}

export async function readQualityDocs(repositoryPath) {
  return Object.fromEntries(await Promise.all(qualityFiles.map(async (file) => [file, await readFile(join(repositoryPath, '.ai', file), 'utf8').catch(() => '')])));
}

export async function computeQualitySnapshot(repositoryPath, docs, previousQuality = null, previousHistory = []) {
  const now = new Date();
  const consistencyDocs = Object.fromEntries(Object.entries(docs).filter(([file]) => ['goals.md','strategy.md','architecture.md','validation.md','repository-health.md'].includes(file)));
  const coverageDocs = Object.fromEntries(Object.entries(docs).filter(([file]) => ['goals.md','strategy.md','architecture.md','decisions.md','validation.md','backlog.md','repository-health.md','agents.md','code.md'].includes(file)));
  const promptFiles = ['prompts/architect.md','prompts/builder.md','prompts/reviewer.md','prompts/debugger.md'];
  const promptsPresent = promptFiles.every((file) => docs[file]?.trim());
  const canonicalCoverageItems = {
    goalsPresent: Boolean(docs['goals.md']?.trim()), strategyPresent: Boolean(docs['strategy.md']?.trim()), architecturePresent: Boolean(docs['architecture.md']?.trim()), decisionsPresent: Boolean(docs['decisions.md']?.trim()), validationPresent: Boolean(docs['validation.md']?.trim()), backlogPresent: Boolean(docs['backlog.md']?.trim()), repositoryHealthPresent: Boolean(docs['repository-health.md']?.trim()), agentsPresent: Boolean(docs['agents.md']?.trim()), codePresent: Boolean(docs['code.md']?.trim()),
  };
  const exportCoverageItems = { contextPackagePresent: Boolean(docs['context-package.md']?.trim()), promptsPresent };
  const coverageItems = { ...canonicalCoverageItems, ...exportCoverageItems };
  const canonicalCompleteness = evaluateCanonicalCompleteness(docs['goals.md'] ?? '');
  const synthesisDocs = Object.fromEntries(Object.entries(docs).map(([file, text]) => [file === 'goals.md' ? '.ai/goals.md' : file.startsWith('.') || file === 'README.md' ? file : `.ai/${file}`, text]));
  const evidenceSynthesis = synthesizeEvidenceFromDocs(synthesisDocs, docs['goals.md'] ?? '');
  const evidenceLineage = await persistEvidenceLineage(repositoryPath, Object.keys(synthesisDocs));
  const canonicalCoverageScore = canonicalCompleteness.score;
  const intelligenceCoverageScore = percent(Object.values(coverageDocs).filter((value) => value?.trim()).length, Object.keys(coverageDocs).length);
  const exportCoverageScore = percent(Object.values(exportCoverageItems).filter(Boolean).length, Object.values(exportCoverageItems).length);
  const coverageScore = Math.round(intelligenceCoverageScore * 0.8 + exportCoverageScore * 0.2);
  const thesisValues = [mdSection(docs['goals.md'] ?? '', 'Product Thesis') || mdSection(docs['goals.md'] ?? '', 'Product Purpose'), mdSection(docs['strategy.md'] ?? '', 'Product Thesis'), mdSection(docs['architecture.md'] ?? '', 'Product Thesis')].filter(present).map((v) => firstLine(v, ''));
  const focusValues = [mdSection(docs['goals.md'] ?? '', 'Current Focus'), mdSection(docs['strategy.md'] ?? '', 'Current Product Bet'), mdSection(docs['architecture.md'] ?? '', 'Current Focus')].filter(present).map((v) => firstLine(v, ''));
  const northStarValues = [mdSection(docs['goals.md'] ?? '', 'North Star Metric'), mdSection(docs['strategy.md'] ?? '', 'North Star Metric'), mdSection(docs['architecture.md'] ?? '', 'North Star Metric')].filter(present).map((v) => firstLine(v, ''));
  const healthValidationConfidence = (docs['repository-health.md'] ?? '').match(/^-\s*Validation confidence\s+(.+)$/im)?.[1] ?? (docs['repository-health.md'] ?? '').match(/^Confidence:\s*(.+)$/im)?.[1] ?? mdSection(docs['repository-health.md'] ?? '', 'Validation Summary');
  const validationValues = [mdSection(docs['validation.md'] ?? '', 'Confidence'), healthValidationConfidence].filter(present).map((v) => firstLine(v, ''));
  const duplicates = Object.entries(consistencyDocs).flatMap(([file, markdown]) => detectDuplicateSections(markdown).map((heading) => `${file}: ${heading}`));
  const contradictions = [];
  const thesisContradictory = detectContradictions(thesisValues, canonicalComparable);
  const focusContradictory = detectContradictions(focusValues, canonicalComparable);
  const northStarContradictory = detectContradictions(northStarValues, canonicalComparable);
  const validationContradictory = detectContradictions(validationValues, normalizeConfidence);
  if (thesisContradictory) contradictions.push('Product Thesis differs across Goals, Strategy, and Architecture.');
  if (focusContradictory) contradictions.push('Current Focus differs across Goals, Strategy, and Architecture.');
  if (northStarContradictory) contradictions.push('North Star differs across Goals, Strategy, and Architecture.');
  if (validationContradictory) contradictions.push('Validation confidence differs between Validation and Repository Health.');
  const strategyEvidence = /evidence/i.test(docs['strategy.md'] ?? '') || /Evidence-backed/i.test(docs['repository-health.md'] ?? '');
  const strategyConsistent = !thesisContradictory && !focusContradictory && !northStarContradictory;
  const validationConsistent = !validationContradictory;
  const consistencyChecks = [strategyConsistent, validationConsistent, strategyEvidence, duplicates.length === 0, contradictions.length === 0];
  const consistencyScore = percent(consistencyChecks.filter(Boolean).length, consistencyChecks.length);
  const mtimes = await Promise.all(qualityFiles.map(async (file) => [file, await stat(join(repositoryPath, '.ai', file)).then((s) => s.mtime).catch(() => null)]));
  const staleDocuments = mtimes.filter(([, mtime]) => mtime && now - mtime > 14 * 86400000).map(([file]) => file);
  const canonicalStaleDocuments = staleDocuments.filter((file) => classifyIntelligenceSource(file) === 'canonical');
  const derivedStaleDocuments = staleDocuments.filter((file) => classifyIntelligenceSource(file) === 'derived');
  const freshnessScore = Math.max(0, 100 - staleDocuments.length * 10);
  const canonicalFreshnessScore = Math.max(0, 100 - canonicalStaleDocuments.length * 12);
  const exportFreshnessScore = Math.max(0, 100 - derivedStaleDocuments.length * 12);
  const manualNotesPreserved = /^##\s+Manual /im.test(docs['goals.md'] ?? '');
  const strategyConfidence = firstLine(mdSection(docs['strategy.md'] ?? '', 'Strategy Confidence'), 'Unknown');
  const validationConfidence = firstLine(mdSection(docs['validation.md'] ?? '', 'Confidence'), 'Unknown');
  const existingConfidence = (docs['repository-health.md'] ?? '').match(/^Confidence:\s*(.+)$/im)?.[1]?.trim() ?? 'Unknown';
  const lineageConfidence = confidenceFromEvidence(evidenceLineage.sources);
  const confidenceScore = confidenceValue(lineageConfidence.confidence);
  const verification = JSON.parse(docs['intelligence-verification.json'] || 'null');
  const aiHandoffValidation = await validateAIHandoff(repositoryPath);
  const verificationScore = typeof verification?.score === 'number' ? verification.score : 100;
  const verificationFailures = Array.isArray(verification?.failures) ? verification.failures : [];
  const risks = extractRisks(docs, Object.keys(consistencyDocs));
  const backlogCount = backlogItems(docs['backlog.md'] ?? '').length;
  const current = { fingerprints: { productThesis: normalized(thesisValues[0] ?? ''), strategy: normalized(mdSection(docs['strategy.md'] ?? '', 'Current Product Bet') || docs['strategy.md'] || ''), architecture: normalized(mdSection(docs['architecture.md'] ?? '', 'Core Systems') || docs['architecture.md'] || '') }, risks, backlogCount };
  const drift = computeDrift(previousQuality, current);
  const recentRegressions = [...contradictions, ...duplicates.map((d) => `Duplicate section: ${d}`), ...drift.newRisks.map((r) => `New risk: ${r}`)];
  const recentImprovements = [...drift.removedRisks.map((r) => `Removed risk: ${r}`)];
  const riskScore = Math.max(0, 100 - risks.length * 8);
  const canonicalIntelligenceQualityScore = Math.round(canonicalCoverageScore * 0.5 + consistencyScore * 0.2 + canonicalFreshnessScore * 0.1 + confidenceScore * 0.15 + riskScore * 0.05);
  const handoffScore = typeof aiHandoffValidation?.overallScore === 'number' ? aiHandoffValidation.overallScore : 50;
  const generatedExportQualityScore = Math.round(exportCoverageScore * 0.35 + exportFreshnessScore * 0.25 + (promptsPresent && docs['context-package.md']?.trim() ? 100 : 50) * 0.1 + handoffScore * 0.3);
  const overallScore = Math.round(canonicalIntelligenceQualityScore * 0.75 + generatedExportQualityScore * 0.1 + verificationScore * 0.15);
  const snapshot = { timestamp: now.toISOString(), overallScore, canonicalIntelligenceQuality: { score: canonicalIntelligenceQualityScore, completenessScore: canonicalCompleteness.score, completenessState: canonicalCompleteness.state, fields: canonicalCompleteness.fields, evidenceSynthesis, evidenceLineage, coverageScore: canonicalCoverageScore, consistencyScore, freshnessScore: canonicalFreshnessScore, sourceOfTruth: 'goals.md' }, generatedExportQuality: { score: generatedExportQualityScore, coverageScore: exportCoverageScore, freshnessScore: exportFreshnessScore, promptsFreshnessOnly: true, aiHandoffReadinessScore: handoffScore, aiHandoffValidation }, coverage: { score: coverageScore, ...coverageItems }, consistency: { score: consistencyScore, productThesisConsistent: !thesisContradictory, currentFocusConsistent: !focusContradictory, northStarConsistent: !northStarContradictory, validationConsistent, strategyConsistent, strategyReferencesSupportedByEvidence: strategyEvidence, duplicatedSections: duplicates, contradictions }, freshness: { score: freshnessScore, lastRefresh: now.toISOString(), filesChanged: previousQuality ? Number(drift.productThesisChanged) + Number(drift.strategyChanged) + Number(drift.architectureChanged) + Number(drift.backlogGrew || drift.backlogShrank) + drift.newRisks.length + drift.removedRisks.length : 0, staleDocuments, canonicalStaleDocuments, derivedStaleDocuments, manualNotesPreserved }, confidence: { score: confidenceScore, existingConfidence, strategyConfidence, validationConfidence, lineageConfidence, confidenceCalculation: lineageConfidence.rule, overallRepositoryConfidence: lineageConfidence.confidence }, verification: { score: verificationScore, status: verification?.status ?? 'Missing', failures: verificationFailures }, drift, risks, backlogCount, fingerprints: current.fingerprints, recentRegressions, recentImprovements };
  snapshot.explanations = { aiHandoffValidation, completeness: explainCompleteness(docs['goals.md'] ?? ''), evidenceSynthesis: explainEvidenceSynthesis(evidenceSynthesis), quality: explainQuality(snapshot), completenessSynchronization: explainCompletenessSynchronization({ completeness: canonicalCompleteness, evidenceSynthesis }) };
  return { ...snapshot, trend: computeTrend(previousHistory, snapshot), recommendedAction: recommendQualityAction(snapshot) };
}

export function recommendQualityAction(snapshot) {
  const manualGoals = snapshot.canonicalIntelligenceQuality?.fields?.manualGoals;
  if (manualGoals && manualGoals.percent < 100) return `Complete Manual Goals fields: ${manualGoals.missing.join(', ')}.`;
  const missing = canonicalIntelligenceFiles.find((file) => !snapshot.coverage[`${file.replace(/\.md$/, '').replace(/-([a-z])/g, (_, char) => char.toUpperCase())}Present`]);
  if (missing) return `Generate missing intelligence: ${missing.replace(/\.md$/, '')}.`;
  if (snapshot.consistency.contradictions.length) return `Resolve contradiction: ${snapshot.consistency.contradictions[0]}`;
  if (snapshot.confidence.score < 55) return 'Improve weak confidence by adding deterministic validation or evidence.';
  if (snapshot.verification?.failures?.length) return `Refresh Repository Intelligence: ${snapshot.verification.failures[0]}`;
  if (snapshot.freshness.canonicalStaleDocuments.length) return `Refresh stale intelligence: ${snapshot.freshness.canonicalStaleDocuments[0]}.`;
  if (snapshot.backlogCount === 0) return 'Add a prioritized backlog item tied to repository intelligence.';
  return 'Keep refreshing intelligence after meaningful repository changes.';
}

export async function persistQuality(repositoryPath) {
  const docs = await readQualityDocs(repositoryPath);
  const qualityPath = join(repositoryPath, '.ai', 'intelligence-quality.json');
  const historyPath = join(repositoryPath, '.ai', 'intelligence-history.json');
  const previousQuality = JSON.parse(await readFile(qualityPath, 'utf8').catch(() => 'null'));
  const history = JSON.parse(await readFile(historyPath, 'utf8').catch(() => '[]'));
  const snapshot = await computeQualitySnapshot(repositoryPath, docs, previousQuality, history);
  const nextHistory = [...history, { timestamp: snapshot.timestamp, overallScore: snapshot.overallScore, coverageScore: snapshot.coverage.score, consistencyScore: snapshot.consistency.score, freshnessScore: snapshot.freshness.score, confidenceScore: snapshot.confidence.score, trend: snapshot.trend, regressions: snapshot.recentRegressions, improvements: snapshot.recentImprovements }].slice(-100);
  await writeFile(qualityPath, JSON.stringify(snapshot, null, 2));
  await writeFile(historyPath, JSON.stringify(nextHistory, null, 2));
  return { snapshot, history: nextHistory };
}
