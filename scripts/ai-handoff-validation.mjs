import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const categories = [
  ['repositoryExplanation', 'Repository explanation', ['Product Thesis', 'Core Systems', 'Repository Health Summary']],
  ['productThesis', 'Product thesis', ['Product Thesis']],
  ['currentProductBet', 'Current product bet', ['Strategy'], /current product bet/i],
  ['currentFocus', 'Current focus', ['Current Focus']],
  ['strategy', 'Strategy', ['Strategy']],
  ['architecture', 'Architecture', ['Core Systems']],
  ['decisionRanking', 'Decision ranking', ['Decision Ranking']],
  ['highestPriorityIssue', 'Highest-priority issue', ['Highest-Priority Issue', 'Decision Ranking'], /selected|rank #?1|1\./i],
  ['nextImplementationStep', 'Next implementation step', ['Next Implementation Step', 'Repository Health Summary'], /recommended next step|next implementation/i],
  ['validationStatus', 'Validation status', ['Validation Summary']],
  ['canonicalOwnership', 'Canonical ownership', ['Canonical Intelligence Ownership']],
  ['confidenceExplanation', 'Confidence explanation', ['Confidence Explanation', 'Strategy'], /confidence.*(?:evidence|calculation|rationale|source)/i],
];

async function readAi(repositoryPath, file) {
  return readFile(join(repositoryPath, '.ai', file), 'utf8').catch((error) => error?.code === 'ENOENT' ? '' : Promise.reject(error));
}

export function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}
function meaningful(text) { return Boolean(text?.trim()) && !/no generated content|not detected yet|missing|unknown|none detected|tbd|todo/i.test(text); }
function evidenceFor(packageText, headings, pattern) {
  const sections = headings.map((heading) => ({ heading, text: mdSection(packageText, heading) })).filter((item) => meaningful(item.text));
  const match = sections.find((item) => !pattern || pattern.test(item.text) || pattern.test(item.heading));
  if (match) return { status: pattern && !pattern.test(match.text) && !pattern.test(match.heading) ? 'Partial' : 'Present', evidence: `Context Package exposes ## ${match.heading}.` };
  const fallback = pattern?.test(packageText);
  if (fallback) return { status: 'Partial', evidence: 'Context Package mentions the category but does not expose a dedicated reconstructable section.' };
  return { status: 'Missing', evidence: `Context Package does not expose ${headings.map((h) => `## ${h}`).join(' or ')}.` };
}
function bullets(items) { return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None detected.'; }
function includesNormalized(haystack, needle) {
  const n = String(needle ?? '').replace(/^[-*]\s+/, '').trim();
  return !n || haystack.includes(n);
}

export async function validateAIHandoff(repositoryPath) {
  const aiDir = join(repositoryPath, '.ai');
  const [contextPackage, strategy, architecture, health, nextPrompt, qualityText, explanationsText, rankingText, synthesisText] = await Promise.all([
    readAi(repositoryPath, 'context-package.md'), readAi(repositoryPath, 'strategy.md'), readAi(repositoryPath, 'architecture.md'), readAi(repositoryPath, 'repository-health.md'), readAi(repositoryPath, 'next-improvement-prompt.md'), readAi(repositoryPath, 'intelligence-quality.json'), readAi(repositoryPath, 'intelligence-explanations.json'), readAi(repositoryPath, 'decision-ranking.json'), readAi(repositoryPath, 'evidence-synthesis.json'),
  ]);
  const quality = qualityText ? JSON.parse(qualityText) : null;
  const explanations = explanationsText ? JSON.parse(explanationsText) : null;
  const ranking = rankingText ? JSON.parse(rankingText) : null;
  const synthesis = synthesisText ? JSON.parse(synthesisText) : null;
  const evaluated = Object.fromEntries(categories.map(([key, label, headings, pattern]) => [key, { label, ...evidenceFor(contextPackage, headings, pattern) }]));
  const contradictions = [];
  const hiddenInformation = [];
  const missingExplanations = [];
  const recoverableInformation = Object.values(evaluated).filter((item) => item.status !== 'Missing').map((item) => item.label);
  for (const [key, item] of Object.entries(evaluated)) if (item.status === 'Missing') hiddenInformation.push(item.label);
  if (/current product bet/i.test(contextPackage) && evaluated.currentProductBet.status === 'Missing') contradictions.push('Context Package references Current Product Bet without exposing it.');
  if (/architecture|core systems/i.test(contextPackage) && evaluated.architecture.status !== 'Present') contradictions.push('Context Package references architecture but provides insufficient summary.');
  if (ranking?.candidates?.length && evaluated.decisionRanking.status === 'Missing') contradictions.push('Package omits decision ranking.');
  if (ranking?.selectedIssue?.title && !includesNormalized(contextPackage + '\n' + nextPrompt, ranking.selectedIssue.title)) contradictions.push('Decision ranking selected issue is hidden from handoff artifacts.');
  if (quality?.generatedExportQuality?.score >= 70 && evaluated.decisionRanking.status === 'Missing' && ranking?.candidates?.length) contradictions.push('Intelligence quality reports acceptable export quality while handoff hides decision ranking.');
  if (/strategy confidence/i.test(contextPackage) && !/evidence|source|rationale|calculation/i.test(mdSection(contextPackage, 'Strategy'))) contradictions.push('Strategy confidence is surfaced without rationale.');
  if (/recommended|recommendation|selected issue/i.test(nextPrompt) && !/evidence|source risk|reason/i.test(nextPrompt)) contradictions.push('Recommendation lacks repository-local evidence.');
  for (const [name, field] of Object.entries(synthesis?.fields ?? {})) if (field.suggestedWording && !contextPackage.includes(field.suggestedWording)) contradictions.push(`Evidence synthesis for ${field.label ?? name} is not exposed to Context Package.`);
  if (evaluated.confidenceExplanation.status === 'Missing') missingExplanations.push('Confidence explanation');
  if (!explanations?.decisionRanking && ranking?.candidates?.length) missingExplanations.push('Decision ranking rationale');
  if (!explanations?.recommendation && nextPrompt.trim()) missingExplanations.push('Recommendation rationale');
  const present = Object.values(evaluated).filter((item) => item.status === 'Present').length;
  const partial = Object.values(evaluated).filter((item) => item.status === 'Partial').length;
  const baseScore = Math.round(((present + partial * 0.5) / categories.length) * 100);
  const overallScore = Math.max(0, baseScore - contradictions.length * 8 - missingExplanations.length * 4);
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    overallScore,
    status: overallScore >= 85 && contradictions.length === 0 ? 'Ready' : overallScore >= 60 ? 'Partial' : 'Not Ready',
    categories: evaluated,
    recoverableInformation,
    hiddenInformation,
    contradictions,
    missingExplanations,
    suggestedImprovements: [...hiddenInformation.map((item) => `Expose ${item} in .ai/context-package.md.`), ...contradictions.map((item) => `Resolve contradiction: ${item}`), ...missingExplanations.map((item) => `Add ${item.toLowerCase()} to generated explanations.`)],
  };
  await mkdir(aiDir, { recursive: true });
  await writeFile(join(aiDir, 'ai-handoff-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export function renderAIHandoffValidationMarkdown(validation) {
  if (!validation) return '## AI Handoff Validation\n- Missing. Run `node scripts/ai-handoff-validation.mjs`.';
  return ['## AI Handoff Validation', `- Overall score: ${validation.overallScore}/100 (${validation.status})`, '', '### Recoverable Information', bullets(validation.recoverableInformation), '', '### Hidden Information', bullets(validation.hiddenInformation), '', '### Contradictions', bullets(validation.contradictions), '', '### Missing Explanations', bullets(validation.missingExplanations), '', '### Suggested Improvements', bullets(validation.suggestedImprovements)].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repositoryPath = resolve(process.argv[2] ?? process.cwd());
  const result = await validateAIHandoff(repositoryPath);
  console.log(`Wrote ${join(repositoryPath, '.ai/ai-handoff-validation.json')} (${result.overallScore}/100)`);
}
