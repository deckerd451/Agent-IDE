import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const qualityFiles = ['goals.md','strategy.md','architecture.md','decisions.md','validation.md','backlog.md','context-package.md','repository-health.md','prompts/architect.md','prompts/builder.md','prompts/reviewer.md','prompts/debugger.md'];

export function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function firstLine(value, fallback = 'Unknown') {
  return value.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).find(Boolean) ?? fallback;
}

function normalized(value) { return value.toLowerCase().replace(/[`*_#>-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function present(value) { const v = firstLine(value, ''); return Boolean(v) && !/^(unknown|missing|not detected yet|none detected|tbd|todo|generated placeholder)$/i.test(v); }
function percent(n, d) { return d ? Math.round((n / d) * 100) : 0; }
function confidenceValue(value) { const v = normalized(value); if (/high|ready|pass/.test(v)) return 90; if (/medium|partial|mixed/.test(v)) return 65; if (/low|weak|fail|needs attention/.test(v)) return 35; if (/unknown|missing/.test(v)) return 20; return 55; }
function extractRisks(docs) { return Object.values(docs).flatMap((doc) => (mdSection(doc, 'Risks') || mdSection(doc, 'Known Risks')).split('\n')).filter((line) => /^[-*]\s+/.test(line.trim())).map((line) => line.trim().replace(/^[-*]\s+/, '')).filter((line) => !/no .*risks/i.test(line)); }
function backlogItems(backlog) { return (mdSection(backlog, 'Prioritized Backlog') || mdSection(backlog, 'Current Backlog') || mdSection(backlog, 'Manual Backlog') || backlog).split('\n').filter((line) => /^[-*]\s+/.test(line.trim())).map((line) => line.trim()); }

export function detectContradictions(values) {
  const known = values.map(normalized).filter(Boolean).filter((v) => !/unknown|missing|not detected/.test(v));
  return [...new Set(known)].length > 1;
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
  const promptsPresent = ['prompts/architect.md','prompts/builder.md','prompts/reviewer.md','prompts/debugger.md'].every((file) => docs[file]?.trim());
  const coverageItems = {
    goalsPresent: Boolean(docs['goals.md']?.trim()), strategyPresent: Boolean(docs['strategy.md']?.trim()), architecturePresent: Boolean(docs['architecture.md']?.trim()), decisionsPresent: Boolean(docs['decisions.md']?.trim()), validationPresent: Boolean(docs['validation.md']?.trim()), backlogPresent: Boolean(docs['backlog.md']?.trim()), contextPackagePresent: Boolean(docs['context-package.md']?.trim()), promptsPresent,
  };
  const coverageScore = percent(Object.values(coverageItems).filter(Boolean).length, Object.values(coverageItems).length);
  const thesisValues = [mdSection(docs['goals.md'] ?? '', 'Product Thesis') || mdSection(docs['goals.md'] ?? '', 'Product Purpose'), mdSection(docs['strategy.md'] ?? '', 'Product Thesis'), mdSection(docs['architecture.md'] ?? '', 'Product Thesis')].filter(present).map((v) => firstLine(v, ''));
  const focusValues = [mdSection(docs['goals.md'] ?? '', 'Current Focus'), mdSection(docs['architecture.md'] ?? '', 'Current Focus')].filter(present).map((v) => firstLine(v, ''));
  const northStarValues = [mdSection(docs['goals.md'] ?? '', 'North Star Metric'), mdSection(docs['strategy.md'] ?? '', 'North Star Metric'), mdSection(docs['architecture.md'] ?? '', 'North Star Metric')].filter(present).map((v) => firstLine(v, ''));
  const duplicates = Object.entries(docs).flatMap(([file, markdown]) => detectDuplicateSections(markdown).map((heading) => `${file}: ${heading}`));
  const contradictions = [];
  if (detectContradictions(thesisValues)) contradictions.push('Product Thesis differs across Goals, Strategy, and Architecture.');
  if (detectContradictions(focusValues)) contradictions.push('Current Focus differs across intelligence files.');
  if (detectContradictions(northStarValues)) contradictions.push('North Star differs across intelligence files.');
  const strategyEvidence = /evidence/i.test(docs['strategy.md'] ?? '') || /Evidence-backed/i.test(docs['repository-health.md'] ?? '');
  const consistencyChecks = [!detectContradictions(thesisValues), !detectContradictions(focusValues), !detectContradictions(northStarValues), strategyEvidence, duplicates.length === 0, contradictions.length === 0];
  const consistencyScore = percent(consistencyChecks.filter(Boolean).length, consistencyChecks.length);
  const mtimes = await Promise.all(qualityFiles.map(async (file) => [file, await stat(join(repositoryPath, '.ai', file)).then((s) => s.mtime).catch(() => null)]));
  const staleDocuments = mtimes.filter(([, mtime]) => mtime && now - mtime > 14 * 86400000).map(([file]) => file);
  const freshnessScore = Math.max(0, 100 - staleDocuments.length * 10);
  const manualNotesPreserved = Object.values(docs).some((doc) => /^##\s+Manual /im.test(doc));
  const strategyConfidence = firstLine(mdSection(docs['strategy.md'] ?? '', 'Strategy Confidence'), 'Unknown');
  const validationConfidence = firstLine(mdSection(docs['validation.md'] ?? '', 'Confidence'), 'Unknown');
  const existingConfidence = (docs['repository-health.md'] ?? '').match(/^Confidence:\s*(.+)$/im)?.[1]?.trim() ?? 'Unknown';
  const confidenceScore = Math.round((confidenceValue(existingConfidence) + confidenceValue(strategyConfidence) + confidenceValue(validationConfidence)) / 3);
  const risks = extractRisks(docs);
  const backlogCount = backlogItems(docs['backlog.md'] ?? '').length;
  const current = { fingerprints: { productThesis: normalized(thesisValues[0] ?? ''), strategy: normalized(mdSection(docs['strategy.md'] ?? '', 'Current Product Bet') || docs['strategy.md'] || ''), architecture: normalized(mdSection(docs['architecture.md'] ?? '', 'Core Systems') || docs['architecture.md'] || '') }, risks, backlogCount };
  const drift = computeDrift(previousQuality, current);
  const recentRegressions = [...contradictions, ...duplicates.map((d) => `Duplicate section: ${d}`), ...drift.newRisks.map((r) => `New risk: ${r}`)];
  const recentImprovements = [...drift.removedRisks.map((r) => `Removed risk: ${r}`)];
  const overallScore = Math.round(coverageScore * 0.3 + consistencyScore * 0.3 + freshnessScore * 0.15 + confidenceScore * 0.2 + Math.max(0, 100 - risks.length * 8) * 0.05);
  const snapshot = { timestamp: now.toISOString(), overallScore, coverage: { score: coverageScore, ...coverageItems }, consistency: { score: consistencyScore, productThesisConsistent: !detectContradictions(thesisValues), currentFocusConsistent: !detectContradictions(focusValues), northStarConsistent: !detectContradictions(northStarValues), strategyReferencesSupportedByEvidence: strategyEvidence, duplicatedSections: duplicates, contradictions }, freshness: { score: freshnessScore, lastRefresh: now.toISOString(), filesChanged: previousQuality ? Number(drift.productThesisChanged) + Number(drift.strategyChanged) + Number(drift.architectureChanged) + Number(drift.backlogGrew || drift.backlogShrank) + drift.newRisks.length + drift.removedRisks.length : 0, staleDocuments, manualNotesPreserved }, confidence: { score: confidenceScore, existingConfidence, strategyConfidence, validationConfidence, overallRepositoryConfidence: confidenceScore >= 80 ? 'High' : confidenceScore >= 55 ? 'Medium' : 'Low' }, drift, risks, backlogCount, fingerprints: current.fingerprints, recentRegressions, recentImprovements };
  return { ...snapshot, trend: computeTrend(previousHistory, snapshot), recommendedAction: recommendQualityAction(snapshot) };
}

export function recommendQualityAction(snapshot) {
  const missing = Object.entries(snapshot.coverage).find(([key, value]) => key.endsWith('Present') && value === false);
  if (missing) return `Generate missing intelligence: ${missing[0].replace(/Present$/, '')}.`;
  if (snapshot.consistency.contradictions.length) return `Resolve contradiction: ${snapshot.consistency.contradictions[0]}`;
  if (snapshot.confidence.score < 55) return 'Improve weak confidence by adding deterministic validation or evidence.';
  if (snapshot.freshness.staleDocuments.length) return `Refresh stale intelligence: ${snapshot.freshness.staleDocuments[0]}.`;
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
