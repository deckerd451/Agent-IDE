import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { evaluateCanonicalCompleteness } from './canonical-completeness.mjs';

export const explanationSchemaVersion = 1;

export function explainCompleteness(goalsMarkdown = '') {
  const completeness = evaluateCanonicalCompleteness(goalsMarkdown);
  const fields = Object.fromEntries(Object.values(completeness.fields).map((field) => {
    const requiredFields = field.requirements?.map((req) => ({
      key: req.key,
      label: req.label,
      found: req.complete,
      state: req.state,
      evidence: req.evidence,
      reason: req.complete ? `${req.label} detected.` : `${req.label} not detected.`,
    })) ?? [{
      key: field.key,
      label: field.label,
      found: field.percent > 0,
      state: field.state,
      evidence: field.evidence ?? [],
      reason: field.percent > 0 ? `${field.label} detected.` : `${field.label} not detected.`,
    }];
    const missing = requiredFields.filter((req) => !req.found).map((req) => req.label);
    return [field.key, {
      id: `canonical-completeness:${field.key}`,
      title: `${field.label} Completeness Evaluation`,
      component: 'Canonical Completeness',
      subject: field.label,
      rule: field.requirements ? `${field.label} completeness = found required fields / total required fields.` : `${field.label} is complete when repository-local evidence exists.`,
      requiredFields,
      computed: { percent: field.percent, found: requiredFields.filter((req) => req.found).length, total: requiredFields.length },
      threshold: 'Missing = 0%; Partial = >0% and <100%; Complete = 100%; Strong = multiple evidence lines for every required field.',
      classification: field.state,
      evidence: requiredFields.flatMap((req) => req.evidence.length ? req.evidence : [`${req.label} missing`]),
      missing,
      reason: missing.length ? missing.map((label) => `${label} not detected.`) : [`${field.label} satisfied deterministic completeness requirements.`],
      recommendation: missing.length ? `Complete ${field.label} fields: ${missing.join(', ')}.` : `${field.label} is complete.`,
    }];
  }));
  return {
    id: 'canonical-completeness',
    title: 'Canonical Completeness Evaluation',
    score: completeness.score,
    classification: completeness.state,
    rule: 'Canonical completeness is the average percent completion across canonical goals fields.',
    threshold: 'Missing = 0%; Partial = >0% and <100%; Complete = 100%; Strong = 100% with strong evidence.',
    fields,
  };
}

export function explainQuality(snapshot = {}) {
  const canonical = snapshot.canonicalIntelligenceQuality ?? {};
  const deductions = [];
  for (const field of Object.values(canonical.fields ?? {})) {
    for (const missing of field.missing ?? []) deductions.push({ rule: `Missing ${missing}`, points: Math.max(1, Math.round((100 - (field.percent ?? 0)) / 10)), evidence: '.ai/goals.md' });
  }
  for (const contradiction of snapshot.consistency?.contradictions ?? []) deductions.push({ rule: contradiction, points: 20, evidence: 'Consistency comparison across generated artifacts' });
  for (const failure of snapshot.verification?.failures ?? []) deductions.push({ rule: failure, points: 15, evidence: '.ai/intelligence-verification.json' });
  return {
    id: 'intelligence-quality',
    title: 'Intelligence Quality Evaluation',
    score: snapshot.overallScore ?? 0,
    components: {
      canonicalCompleteness: { score: canonical.completenessScore ?? 0, rule: 'Completeness score comes from canonical goals field evaluation.', evidence: '.ai/goals.md' },
      consistency: { score: snapshot.consistency?.score ?? 0, rule: 'Consistency checks compare thesis, focus, north star, validation confidence, evidence, duplicates, and contradictions.', evidence: ['.ai/goals.md', '.ai/strategy.md', '.ai/architecture.md', '.ai/validation.md', '.ai/repository-health.md'] },
      freshness: { score: snapshot.freshness?.score ?? 0, rule: 'Freshness deducts for stale intelligence documents.', evidence: snapshot.freshness?.staleDocuments ?? [] },
      confidence: { score: snapshot.confidence?.score ?? 0, rule: 'Confidence is derived from Repository Health, Strategy, and Validation confidence values.', evidence: ['.ai/repository-health.md', '.ai/strategy.md', '.ai/validation.md'] },
      verification: { score: snapshot.verification?.score ?? 0, rule: 'Verification score is the percent of expected artifacts verified.', evidence: '.ai/intelligence-verification.json' },
    },
    deductions,
  };
}

const basePriorityById = { 'consistency-cleanup': 98, 'missing-intelligence': 95, validation: 86, 'handoff-readiness': 84, 'backlog-noise': 82, 'missing-manual-goals': 74, 'strategy-quality': 72, 'stale-intelligence': 55, 'ai-handoff-validation': 10 };
export function issuePriority(issue) {
  return issue?.priority ?? basePriorityById[issue?.id] ?? 40;
}

export function explainRecommendation(selectedIssue, candidates = []) {
  const candidateIssues = (candidates.length ? candidates : [selectedIssue]).filter(Boolean).map((issue) => ({ id: issue.id, title: issue.title, category: issue.category, priority: issue.priority ?? issuePriority(issue), actionability: issue.actionability, evidence: issue.evidence ?? issue.source }));
  const selected = selectedIssue ? { id: selectedIssue.id, title: selectedIssue.title, priority: selectedIssue.priority ?? issuePriority(selectedIssue) } : null;
  const highest = candidateIssues.slice().sort((a, b) => b.priority - a.priority)[0];
  return {
    id: 'recommendation-selection',
    title: 'Why This Issue Was Selected',
    rule: 'Select the highest deterministic priority issue that is actionable and backed by repository-local evidence.',
    candidateIssues,
    selected,
    computed: { selectedPriority: selected?.priority ?? null, highestPriority: highest?.priority ?? null },
    classification: selected?.id === highest?.id ? 'Consistent' : 'Needs Attention',
    reason: selected?.id === highest?.id ? 'Highest deterministic priority requiring action.' : 'Selected issue is not the highest priority candidate.',
    recommendation: selectedIssue?.recommendedAction ?? 'No recommendation generated.',
  };
}

export function explainHealth({ risks = [], canonicalCompleteness } = {}) {
  return risks.map((risk) => {
    const manual = /^Manual Goals (Missing|Partial|Complete|Strong) \((\d+)%\)/.exec(risk);
    if (manual) return {
      id: `repository-health:${risk}`,
      finding: risk,
      rule: 'Manual Goals completeness < 100%',
      computed: `${manual[2]}%`,
      evidence: canonicalCompleteness?.fields?.manualGoals?.requirements?.map((req) => `${req.label} ${req.complete ? 'found' : 'missing'}`) ?? [risk],
      threshold: 'Complete or Strong Manual Goals required for no finding.',
      result: manual[1],
    };
    return { id: `repository-health:${risk}`, finding: risk, rule: 'Repository health risk detector matched deterministic local evidence.', computed: 'Risk present', evidence: [risk], threshold: 'Risk absent for Healthy state.', result: 'Needs Attention' };
  });
}

export function renderExplanationMarkdown(explanation) {
  if (!explanation) return '';
  const lines = [`## ${explanation.title ?? 'Repository Intelligence Explanation'}`, '', `Rule: ${explanation.rule ?? 'Deterministic repository-local rule.'}`];
  if (explanation.candidateIssues) {
    lines.push('', 'Candidate Issues', ...explanation.candidateIssues.map((issue) => `- ${issue.title}: Priority ${issue.priority}`), '', `Selected: ${explanation.selected?.title ?? 'None'}`, `Reason: ${explanation.reason}`);
  }
  return lines.join('\n');
}

export async function persistIntelligenceExplanations(repositoryPath, explanation) {
  const aiDir = join(repositoryPath, '.ai');
  await mkdir(aiDir, { recursive: true });
  await writeFile(join(aiDir, 'intelligence-explanations.json'), `${JSON.stringify({ schemaVersion: explanationSchemaVersion, generatedAt: new Date().toISOString(), ...explanation }, null, 2)}\n`);
}

export async function readIntelligenceExplanations(repositoryPath) {
  return JSON.parse(await readFile(join(repositoryPath, '.ai', 'intelligence-explanations.json'), 'utf8').catch(() => 'null'));
}
