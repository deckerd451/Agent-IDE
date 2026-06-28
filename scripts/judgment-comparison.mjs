/**
 * Judgment Comparison — deterministic evaluation layer only.
 * Compares Repository Judgment and Product Judgment without changing Work Queue selection.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const JUDGMENT_COMPARISON_SCHEMA_VERSION = 1;
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const INPUTS = [
  'repository-judgment.json', 'repository-judgment.md', 'product-judgment.json', 'product-judgment.md',
  'product-judgment-evaluation.md', 'repository-judgment-evaluation.md', 'goals.md', 'strategy.md',
  'backlog.md', 'architecture.md', 'decisions.md', 'context-package.md', 'repository-health.md', 'execution-model.md',
];

function clamp(n) { return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0))); }
function confidenceNumber(value) {
  if (typeof value === 'number') return clamp(value <= 1 ? value * 100 : value);
  if (/high/i.test(String(value))) return 85;
  if (/medium/i.test(String(value))) return 60;
  if (/low/i.test(String(value))) return 35;
  return 0;
}
function safeJson(text) { try { return JSON.parse(text); } catch { return null; } }
async function readAi(repositoryPath, file) {
  return readFile(join(repositoryPath, '.ai', file), 'utf8').catch((e) => (e?.code === 'ENOENT' ? '' : Promise.reject(e)));
}
function evidenceKey(item) {
  if (typeof item === 'string') return item.trim();
  return `${item?.sourceFile ?? item?.file ?? ''}${item?.sourceSection ? `#${item.sourceSection}` : ''}: ${item?.text ?? item?.evidence ?? ''}`.trim();
}
function sourceFilesFromEvidence(evidence) {
  return [...new Set(evidence.map((item) => {
    if (typeof item !== 'string') return item.sourceFile ?? item.file ?? '';
    return item.match(/^(\.ai\/[^\s—:]+|docs\/[^\s—:]+|src\/[^\s—:]+)/)?.[1] ?? '';
  }).filter(Boolean))].sort();
}
function normalizeRepository(repo) {
  const c = Array.isArray(repo?.candidates) ? repo.candidates[0] : null;
  const evidence = Array.isArray(c?.evidence) ? c.evidence.map(evidenceKey) : [];
  const scores = {
    total: clamp(c?.totalScore), productValue: clamp(c?.impactScore ?? c?.totalScore), repositoryValue: clamp(c?.totalScore),
    strategicAlignment: clamp(c?.strategyScore ?? c?.strategicScore ?? c?.totalScore), userImpact: clamp(c?.userValue ?? c?.impactScore ?? c?.totalScore),
    implementationCost: clamp(c?.implementationScore ?? c?.costScore ?? 50), leverage: clamp(c?.leverageScore ?? c?.impactScore ?? c?.totalScore),
  };
  return {
    engine: 'Repository Judgment', available: Boolean(c), recommendation: c?.title ?? 'Unavailable', category: c?.category ?? 'Unavailable',
    confidence: confidenceNumber(c?.confidence), scores, evidence, repositoryFilesUsed: [...new Set([...(c?.sourceFiles ?? []), ...sourceFilesFromEvidence(evidence)])].sort(),
    reasoning: c?.whyItMatters ?? 'Repository Judgment artifact is missing or has no candidate.', expectedProductValue: scores.productValue,
  };
}
function normalizeProduct(pj) {
  const c = Array.isArray(pj?.candidates) ? pj.candidates[0] : null;
  const evidence = c?.evidence ? [evidenceKey(c.evidence)] : [];
  const scores = {
    total: clamp(c?.compositeScore), productValue: clamp(c?.scores?.productValue), repositoryValue: clamp(((c?.scores?.leverage ?? 0) + (c?.scores?.cost ?? 0)) / 2),
    strategicAlignment: clamp(c?.scores?.strategic), userImpact: clamp(c?.scores?.userImpact), implementationCost: clamp(c?.scores?.cost), leverage: clamp(c?.scores?.leverage),
  };
  return {
    engine: 'Product Judgment', available: Boolean(c), recommendation: c?.title ?? 'Unavailable', category: c?.category ?? 'Unavailable',
    confidence: confidenceNumber(c?.confidence), scores, evidence, repositoryFilesUsed: [...new Set([...(c?.sourceFiles ?? []), ...sourceFilesFromEvidence(evidence)])].sort(),
    reasoning: [c?.whyItMatters, c?.whyOutranks].filter(Boolean).join(' ' ) || 'Product Judgment artifact is missing or has no candidate.', expectedProductValue: scores.productValue,
  };
}
function overlap(a, b) { const A = new Set(a), B = new Set(b); return [...A].filter((x) => B.has(x)).sort(); }
function difference(a, b) { const B = new Set(b); return [...new Set(a)].filter((x) => !B.has(x)).sort(); }
function pickWinner(repo, product) {
  const delta = product.scores.productValue - repo.scores.productValue;
  if (!repo.available && product.available) return 'Product Judgment';
  if (repo.available && !product.available) return 'Repository Judgment';
  if (Math.abs(delta) < 5 && Math.abs(product.scores.total - repo.scores.total) < 5) return 'Equivalent';
  return delta > 0 ? 'Product Judgment' : 'Repository Judgment';
}
function optimizationType(repo, product) {
  const diffs = [
    ['product optimization', product.scores.productValue - repo.scores.productValue],
    ['repository optimization', repo.scores.repositoryValue - product.scores.repositoryValue],
    ['strategic optimization', Math.abs(product.scores.strategicAlignment - repo.scores.strategicAlignment)],
    ['architectural optimization', /architecture|system/i.test(`${repo.category} ${product.category}`) ? 50 : 0],
    ['backlog optimization', /backlog/i.test(`${repo.category} ${product.category}`) ? 50 : 0],
  ];
  return diffs.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
}
export async function generateJudgmentComparison(repositoryPath = process.cwd()) {
  const raw = Object.fromEntries(await Promise.all(INPUTS.map(async (f) => [f, await readAi(repositoryPath, f)])));
  const repo = normalizeRepository(safeJson(raw['repository-judgment.json']));
  const product = normalizeProduct(safeJson(raw['product-judgment.json']));
  const sharedEvidence = overlap(repo.evidence, product.evidence);
  const sharedFiles = overlap(repo.repositoryFilesUsed, product.repositoryFilesUsed);
  const uniqueRepositoryEvidence = difference(repo.evidence, product.evidence);
  const uniqueProductEvidence = difference(product.evidence, repo.evidence);
  const evidenceUnion = new Set([...repo.evidence, ...product.evidence]);
  const evidenceOverlap = evidenceUnion.size ? clamp((sharedEvidence.length / evidenceUnion.size) * 100) : 0;
  const recommendationDivergenceScore = repo.recommendation === product.recommendation ? 0 : clamp(100 - evidenceOverlap + Math.abs(product.scores.total - repo.scores.total) / 2);
  const agreementScore = clamp(100 - recommendationDivergenceScore);
  const winner = pickWinner(repo, product);
  const appears = winner === 'Equivalent' ? 'equivalent' : winner === 'Repository Judgment' ? 'stronger' : 'weaker';
  const reason = winner === 'Equivalent'
    ? 'Deterministic score deltas are below the equivalence threshold.'
    : `${winner} has the stronger deterministic product-value signal (${winner === 'Product Judgment' ? product.scores.productValue : repo.scores.productValue}/100).`;
  const comparison = {
    schemaVersion: JUDGMENT_COMPARISON_SCHEMA_VERSION, generatedAt: GENERATED_AT, deterministic: true,
    inputs: Object.fromEntries(Object.entries(raw).map(([k, v]) => [`.ai/${k}`, Boolean(v.trim())])),
    engines: { repositoryJudgment: repo, productJudgment: product },
    metrics: {
      agreementScore, evidenceOverlap, evidenceDifference: { uniqueRepositoryEvidenceCount: uniqueRepositoryEvidence.length, uniqueProductEvidenceCount: uniqueProductEvidence.length },
      recommendationDivergenceScore, productValueDifference: product.scores.productValue - repo.scores.productValue,
      repositoryValueDifference: product.scores.repositoryValue - repo.scores.repositoryValue,
      strategicAlignmentDifference: product.scores.strategicAlignment - repo.scores.strategicAlignment,
      userImpactDifference: product.scores.userImpact - repo.scores.userImpact,
      implementationCostDifference: product.scores.implementationCost - repo.scores.implementationCost,
      leverageDifference: product.scores.leverage - repo.scores.leverage,
      confidenceDifference: product.confidence - repo.confidence,
    },
    evidence: { sharedEvidence, sharedRepositoryFiles: sharedFiles, uniqueRepositoryJudgmentEvidence: uniqueRepositoryEvidence, uniqueProductJudgmentEvidence: uniqueProductEvidence, ignoredEvidence: difference(Object.keys(raw).map((f) => `.ai/${f}`), [...repo.repositoryFilesUsed, ...product.repositoryFilesUsed]) },
    explanation: {
      whyRepositoryJudgmentSelected: repo.reasoning, whyProductJudgmentSelected: product.reasoning,
      mostInfluentialEvidence: [...sharedEvidence, uniqueProductEvidence[0], uniqueRepositoryEvidence[0]].filter(Boolean).slice(0, 5),
      whyEnginesDisagreed: repo.recommendation === product.recommendation ? 'The engines selected the same recommendation.' : `The engines optimized different deterministic signals: Repository Judgment selected ${repo.category}; Product Judgment selected ${product.category}.`,
      disagreementIndicates: optimizationType(repo, product), recommendationAppearsStronger: winner,
    },
    shadowEvaluation: { repositoryJudgmentCurrentlyAppears: appears, winner, reason, repositoryJudgmentRemainsAuthoritative: true, productJudgmentRemainsShadowOnly: true },
    summary: `${repo.recommendation} vs ${product.recommendation}. Agreement ${agreementScore}/100; divergence ${recommendationDivergenceScore}/100. Winner: ${winner}.`,
  };
  const md = renderMarkdown(comparison);
  await mkdir(join(repositoryPath, '.ai'), { recursive: true });
  await Promise.all([
    writeFile(join(repositoryPath, '.ai', 'judgment-comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`, 'utf8'),
    writeFile(join(repositoryPath, '.ai', 'judgment-comparison.md'), md, 'utf8'),
  ]);
  return comparison;
}
function renderMarkdown(c) {
  return `# Judgment Comparison\n\nGenerated: ${c.generatedAt}\n\n> Deterministic evaluation only. Repository Judgment remains authoritative; Product Judgment remains shadow-only.\n\n## Summary\n\n${c.summary}\n\n## Metrics\n\n- Agreement Score: ${c.metrics.agreementScore}/100\n- Recommendation Divergence Score: ${c.metrics.recommendationDivergenceScore}/100\n- Evidence Overlap: ${c.metrics.evidenceOverlap}/100\n- Product Value Difference: ${c.metrics.productValueDifference}\n- Repository Value Difference: ${c.metrics.repositoryValueDifference}\n- Strategic Alignment Difference: ${c.metrics.strategicAlignmentDifference}\n- User Impact Difference: ${c.metrics.userImpactDifference}\n- Implementation Cost Difference: ${c.metrics.implementationCostDifference}\n- Leverage Difference: ${c.metrics.leverageDifference}\n- Confidence Difference: ${c.metrics.confidenceDifference}\n\n## Repository Judgment\n\n- Recommendation: ${c.engines.repositoryJudgment.recommendation}\n- Category: ${c.engines.repositoryJudgment.category}\n- Confidence: ${c.engines.repositoryJudgment.confidence}/100\n- Expected Product Value: ${c.engines.repositoryJudgment.expectedProductValue}/100\n- Reasoning: ${c.engines.repositoryJudgment.reasoning}\n\n## Product Judgment\n\n- Recommendation: ${c.engines.productJudgment.recommendation}\n- Category: ${c.engines.productJudgment.category}\n- Confidence: ${c.engines.productJudgment.confidence}/100\n- Expected Product Value: ${c.engines.productJudgment.expectedProductValue}/100\n- Reasoning: ${c.engines.productJudgment.reasoning}\n\n## Evidence\n\n### Shared Evidence\n${c.evidence.sharedEvidence.map((e) => `- ${e}`).join('\n') || '- None'}\n\n### Unique Repository Judgment Evidence\n${c.evidence.uniqueRepositoryJudgmentEvidence.map((e) => `- ${e}`).join('\n') || '- None'}\n\n### Unique Product Judgment Evidence\n${c.evidence.uniqueProductJudgmentEvidence.map((e) => `- ${e}`).join('\n') || '- None'}\n\n### Ignored Inputs\n${c.evidence.ignoredEvidence.map((e) => `- ${e}`).join('\n') || '- None'}\n\n## Explanation\n\n- Why Repository Judgment selected its recommendation: ${c.explanation.whyRepositoryJudgmentSelected}\n- Why Product Judgment selected its recommendation: ${c.explanation.whyProductJudgmentSelected}\n- Why engines disagreed: ${c.explanation.whyEnginesDisagreed}\n- Disagreement indicates: ${c.explanation.disagreementIndicates}\n- Recommendation winner: ${c.shadowEvaluation.winner}\n- Reason: ${c.shadowEvaluation.reason}\n`;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await generateJudgmentComparison(process.cwd());
  console.log(`Generated .ai/judgment-comparison.json and .ai/judgment-comparison.md (agreement ${result.metrics.agreementScore}, divergence ${result.metrics.recommendationDivergenceScore}).`);
}
