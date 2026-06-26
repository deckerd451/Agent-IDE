export const completenessStates = ['Missing', 'Partial', 'Complete', 'Strong'];

const missingPattern = /^(?:unknown|missing|not detected yet|none detected|generated placeholder|tbd|todo|n\/?a|na|\[repository owner:[\s\S]*\])$/i;

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

function normalizeFieldValue(value) {
  return value.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).join(' ').replace(/\s+/g, ' ').trim();
}

function fieldPattern(label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*(?:[-*]\\s*)?${escaped}\\s*:\\s*(.*)$`, 'i');
}

function manualStrategyFieldEvidence(markdown, field) {
  const section = mdSection(markdown, field.heading);
  if (!section) return { evidence: [], placeholders: [] };
  const aliases = [field.label, ...(field.aliases ?? [])];
  const patterns = aliases.map(fieldPattern);
  const lines = section.split('\n');
  const found = [];
  for (let index = 0; index < lines.length; index += 1) {
    const patternMatch = patterns.map((pattern) => lines[index].match(pattern)).find(Boolean);
    if (!patternMatch) continue;
    const valueLines = [patternMatch[1] ?? ''];
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextLine = lines[next];
      if (/^\s*(?:[-*]\s*)?[A-Z][A-Za-z0-9 &'/-]+\s*:/.test(nextLine) || /^#{1,6}\s+/.test(nextLine)) break;
      if (nextLine.trim()) valueLines.push(nextLine);
    }
    const value = normalizeFieldValue(valueLines.join('\n'));
    found.push({ heading: field.heading, line: `${field.label}: ${value}`, value, placeholder: !value || missingPattern.test(value) });
  }
  return { evidence: found.filter((item) => !item.placeholder), placeholders: found.filter((item) => item.placeholder) };
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

export const canonicalStrategyFields = [
  { key: 'currentProductBet', label: 'Current Product Bet', heading: 'Manual Strategy Notes', aliases: ['Strategic Bet'], manualUpdate: '- Current Product Bet:\n  [Repository owner: describe the primary product hypothesis currently being tested.]', why: 'This field records the primary product hypothesis currently being tested and is required to strengthen repository strategy quality.' },
  { key: 'strategicDifferentiator', label: 'Strategic Differentiator', heading: 'Manual Strategy Notes', aliases: ['Product Differentiator', 'Differentiator'], manualUpdate: '- Strategic Differentiator:\n  [Repository owner: describe what makes this repository strategy meaningfully different.]', why: 'This field records what the product strategy should optimize around or emphasize differently from alternatives.' },
  { key: 'whatNotToBuild', label: 'What Not To Build', heading: 'Manual Strategy Notes', aliases: [], manualUpdate: '- What Not To Build:\n  [Repository owner: describe explicit product boundaries or non-goals.]', why: 'This field records product boundaries so generated implementation work avoids unsupported directions.' },
  { key: 'repositoryPrinciples', label: 'Repository Principles', heading: 'Manual Strategy Notes', aliases: ['Principles'], optional: true, manualUpdate: '- Repository Principles:\n  [Repository owner: describe durable principles that should guide repository decisions.]', why: 'This optional field records durable repository-level decision principles for future work.' },
  { key: 'strategyEvidence', label: 'Strategy Evidence', heading: 'Manual Strategy Notes', aliases: ['Strategy Evidence Sources', 'Evidence Sources'], manualUpdate: '- Strategy Evidence:\n  [Repository owner: cite repository-local files, decisions, or docs that support the strategy.]', why: 'This field records repository-local evidence supporting the strategy so future generated intelligence can trace owner intent.' },
];

export function evaluateCanonicalStrategyCompleteness(goalsMarkdown = '') {
  const requiredFields = canonicalStrategyFields.map((field) => {
    const { evidence, placeholders } = manualStrategyFieldEvidence(goalsMarkdown, field);
    const classification = evidence.length > 0 ? 'Present' : placeholders.length > 0 ? 'Partial' : 'Missing';
    return {
      key: field.key,
      label: field.label,
      canonicalFile: '.ai/goals.md',
      canonicalSection: `## ${field.heading}`,
      optional: Boolean(field.optional),
      classification,
      state: classification,
      present: evidence.length > 0,
      evidence: evidence.map((item) => `${item.heading}: ${item.line}`),
      placeholders: placeholders.map((item) => `${item.heading}: ${item.line}`),
      manualUpdate: field.manualUpdate,
      why: field.why,
    };
  });
  const requiredOnly = requiredFields.filter((field) => !field.optional);
  const presentCount = requiredOnly.filter((field) => field.present).length;
  const percent = Math.round((presentCount / requiredOnly.length) * 100);
  const classification = presentCount === 0 ? 'Missing' : presentCount < requiredOnly.length ? 'Partial' : 'Present';
  return {
    canonicalFile: '.ai/goals.md',
    canonicalSection: '## Manual Strategy Notes',
    requiredFields,
    missing: requiredOnly.filter((field) => !field.present).map((field) => field.label),
    percent,
    classification,
    threshold: 'Missing = no required canonical strategy fields present; Partial = some required fields present; Present = all required fields present. Repository Principles is optional.',
  };
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
