export const completenessStates = ['Missing', 'Partial', 'Complete', 'Strong'];

const missingPattern = /^(?:unknown|missing|not detected yet|none detected|generated placeholder|tbd|todo|n\/a|na)$/i;

export const canonicalFields = [
  { key: 'manualGoals', label: 'Manual Goals', heading: 'Manual Goals', required: [
    { key: 'productIntent', label: 'Product intent', headings: ['Manual Goals', 'Product Purpose', 'Product Thesis'], patterns: [/product\s+(?:intent|purpose|thesis)\s*:/i], manualUpdate: '- Product intent: [Repository owner: describe the product purpose this repository should serve.]' },
    { key: 'currentFocus', label: 'Current focus', headings: ['Manual Goals', 'Current Focus'], patterns: [/current\s+focus\s*:/i], manualUpdate: '- Current focus: [Repository owner: describe the current product priority.]' },
    { key: 'successCriteria', label: 'Success criteria', headings: ['Manual Goals', 'Success Criteria', 'Success Definition'], patterns: [/success\s+(?:criteria|definition)\s*:/i], manualUpdate: '- Success criteria: [Repository owner: describe how success should be judged.]' },
    { key: 'longTermVision', label: 'Long-term vision', headings: ['Manual Goals', 'Long-Term Vision'], patterns: [/long[-\s]?term\s+vision\s*:/i], manualUpdate: '- Long-term vision: [Repository owner: describe the long-term vision for this product.]' },
  ] },
  { key: 'productThesis', label: 'Product Thesis', headings: ['Product Thesis', 'Product Purpose'] },
  { key: 'currentFocus', label: 'Current Focus', headings: ['Current Focus'] },
  { key: 'successCriteria', label: 'Success Criteria', headings: ['Success Criteria', 'Success Definition'] },
  { key: 'currentProductBet', label: 'Current Product Bet', headings: ['Current Product Bet', 'Strategic Bet'] },
  { key: 'whatNotToBuild', label: 'What Not To Build', headings: ['What Not To Build'] },
];

export function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function meaningfulLines(value) {
  return value.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).filter((line) => line && !/^#+\s+/.test(line) && !missingPattern.test(line));
}

function fieldEvidence(markdown, headings, patterns = []) {
  const sections = headings.map((heading) => ({ heading, text: mdSection(markdown, heading) })).filter((item) => item.text);
  const direct = sections.filter((item) => !(item.heading === 'Manual Goals' && patterns.length)).flatMap((item) => meaningfulLines(item.text).map((line) => ({ heading: item.heading, line })));
  const patternEvidence = patterns.flatMap((pattern) => meaningfulLines(mdSection(markdown, 'Manual Goals')).filter((line) => pattern.test(line)).map((line) => ({ heading: 'Manual Goals', line })));
  return [...patternEvidence, ...direct].filter((item, index, all) => all.findIndex((other) => other.heading === item.heading && other.line === item.line) === index);
}

function stateFromEvidence(evidence) {
  if (evidence.length === 0) return 'Missing';
  if (evidence.length === 1) return 'Complete';
  return 'Strong';
}

export function evaluateCanonicalCompleteness(goalsMarkdown = '') {
  const fields = {};
  for (const field of canonicalFields) {
    if (field.required) {
      const requirements = field.required.map((req) => {
        const evidence = fieldEvidence(goalsMarkdown, req.headings, req.patterns);
        return { key: req.key, label: req.label, state: stateFromEvidence(evidence), complete: evidence.length > 0, evidence: evidence.map((item) => `${item.heading}: ${item.line}`), manualUpdate: req.manualUpdate };
      });
      const completeCount = requirements.filter((req) => req.complete).length;
      const strongCount = requirements.filter((req) => req.state === 'Strong').length;
      const percent = Math.round((completeCount / requirements.length) * 100);
      const state = completeCount === 0 ? 'Missing' : completeCount < requirements.length ? 'Partial' : strongCount === requirements.length ? 'Strong' : 'Complete';
      fields[field.key] = { key: field.key, label: field.label, state, percent, requirements, missing: requirements.filter((req) => !req.complete).map((req) => req.label) };
    } else {
      const evidence = fieldEvidence(goalsMarkdown, field.headings);
      const state = stateFromEvidence(evidence);
      fields[field.key] = { key: field.key, label: field.label, state, percent: evidence.length ? 100 : 0, evidence: evidence.map((item) => `${item.heading}: ${item.line}`), missing: evidence.length ? [] : [field.label] };
    }
  }
  const values = Object.values(fields);
  const score = Math.round(values.reduce((sum, item) => sum + item.percent, 0) / values.length);
  const state = score === 0 ? 'Missing' : score < 100 ? 'Partial' : values.every((item) => item.state === 'Strong') ? 'Strong' : 'Complete';
  return { score, state, fields };
}

export function manualGoalsExplanationFromCompleteness(completeness) {
  const manualGoals = completeness?.fields?.manualGoals;
  if (!manualGoals) return null;
  const requiredFields = manualGoals.requirements?.map((req) => ({
    key: req.key,
    label: req.label,
    found: req.complete,
    state: req.state,
    evidence: req.evidence,
    manualUpdate: req.manualUpdate,
    reason: req.complete ? `${req.label} detected.` : `${req.label} not detected.`,
  })) ?? [];
  const missing = requiredFields.filter((req) => !req.found).map((req) => req.label);
  return {
    requiredFields,
    missing,
    computed: { percent: manualGoals.percent, found: requiredFields.filter((req) => req.found).length, total: requiredFields.length },
    classification: manualGoals.state,
    threshold: 'Missing = 0%; Partial = >0% and <100%; Complete = 100%; Strong = multiple evidence lines for every required field.',
  };
}

export function canonicalManualGoalsUpdateLines(explanation) {
  const missing = new Set(explanation?.missing ?? []);
  return (explanation?.requiredFields ?? [])
    .filter((field) => missing.has(field.label))
    .map((field) => field.manualUpdate)
    .filter(Boolean);
}

export function canonicalManualGoalsSuggestedUpdate(explanation) {
  const updateLines = canonicalManualGoalsUpdateLines(explanation);
  return updateLines.length ? updateLines.join('\n') : 'No Manual Goals fields require updates.';
}

export function formatCompletenessState(item) {
  return `${item.state} (${item.percent ?? item.score}%)`;
}
