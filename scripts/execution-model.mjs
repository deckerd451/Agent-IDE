import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const manualHeader = '## Manual Execution Notes';

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

async function readIfExists(path) {
  return readFile(path, 'utf8').catch((error) => (error?.code === 'ENOENT' ? '' : Promise.reject(error)));
}

async function readAiFile(aiDir, fileName) {
  return readIfExists(join(aiDir, fileName));
}

async function readExistingManualNotes(outputPath) {
  const current = await readIfExists(outputPath);
  if (!current) return `${manualHeader}\n`;
  const index = current.indexOf(manualHeader);
  if (index === -1) return `${manualHeader}\n`;
  return `${current.slice(index).trimEnd()}\n`;
}

// ---------------------------------------------------------------------------
// Text helpers (deterministic, no side effects)
// ---------------------------------------------------------------------------

function sectionText(text, header) {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function bullets(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, '').trim());
}

function firstLine(text, fallback = '') {
  return text.split('\n').map((l) => l.replace(/^[-*]\s+/, '').trim()).find(Boolean) ?? fallback;
}

function hasContent(text, header) {
  const s = sectionText(text, header);
  return Boolean(s) && !/^(not detected yet|missing|none detected|generated placeholder|tbd|todo)$/i.test(s.split('\n').find(Boolean) ?? '');
}

// ---------------------------------------------------------------------------
// Entities: intelligence files with known ownership properties
// ---------------------------------------------------------------------------

const intelligenceFileEntities = [
  { entity: 'Canonical Goals', file: 'goals.md', owner: 'Human (repository owner)', persistence: 'Disk (.ai/goals.md)', type: 'Canonical' },
  { entity: 'Architecture', file: 'architecture.md', owner: 'Generator (audit.mjs)', persistence: 'Disk (.ai/architecture.md)', type: 'Generated' },
  { entity: 'Strategy', file: 'strategy.md', owner: 'Generator (strategy.mjs)', persistence: 'Disk (.ai/strategy.md)', type: 'Generated' },
  { entity: 'Backlog', file: 'backlog.md', owner: 'Generator (backlog.mjs)', persistence: 'Disk (.ai/backlog.md)', type: 'Generated' },
  { entity: 'Decisions', file: 'decisions.md', owner: 'Generator (decisions.mjs)', persistence: 'Disk (.ai/decisions.md)', type: 'Generated' },
  { entity: 'Validation', file: 'validation.md', owner: 'Generator (validate-intel.mjs)', persistence: 'Disk (.ai/validation.md)', type: 'Generated' },
  { entity: 'Repository Health', file: 'repository-health.md', owner: 'Generator (health.mjs)', persistence: 'Disk (.ai/repository-health.md)', type: 'Generated' },
  { entity: 'Context Package', file: 'context-package.md', owner: 'Generator (context-package.mjs)', persistence: 'Disk (.ai/context-package.md)', type: 'Generated' },
  { entity: 'Decision Ranking', file: 'decision-ranking.json', owner: 'Generator (next-improvement.mjs)', persistence: 'Disk (.ai/decision-ranking.json)', type: 'Generated' },
  { entity: 'AI Handoff Validation', file: 'ai-handoff-validation.json', owner: 'Generator (ai-handoff-validation.mjs)', persistence: 'Disk (.ai/ai-handoff-validation.json)', type: 'Generated' },
  { entity: 'Evidence Lineage', file: 'evidence-lineage.json', owner: 'Generator (evidence-lineage.mjs)', persistence: 'Disk (.ai/evidence-lineage.json)', type: 'Generated' },
  { entity: 'Intelligence Quality', file: 'intelligence-quality.json', owner: 'Generator (intelligence-quality.mjs)', persistence: 'Disk (.ai/intelligence-quality.json)', type: 'Generated' },
];

async function buildEntityTable(aiDir, docs) {
  const coreSystemsText = sectionText(docs.architecture, 'Core Systems');
  const coreSystems = bullets(coreSystemsText)
    .map((b) => b.split(':')[0].trim())
    .filter((s) => s.length > 0 && s.length < 60)
    .slice(0, 8);

  const rows = [];

  for (const item of intelligenceFileEntities) {
    const content = await readIfExists(join(aiDir, item.file));
    const exists = Boolean(content.trim());
    const confidence = exists ? 'High' : 'Not present';
    rows.push({ ...item, confidence });
  }

  for (const system of coreSystems) {
    const alreadyListed = rows.some((r) => r.entity.toLowerCase() === system.toLowerCase());
    if (!alreadyListed) {
      rows.push({
        entity: system,
        owner: 'See .ai/architecture.md',
        persistence: 'Inferred from architecture',
        type: 'Inferred',
        confidence: 'Medium',
      });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Sources of Truth: detect ownership from decisions and architecture
// ---------------------------------------------------------------------------

function buildOwnershipTable(docs) {
  const conceptsToCheck = [
    { concept: 'Product Intent', canonical: '.ai/goals.md', evidenceSource: 'goals.md' },
    { concept: 'Architecture Description', canonical: '.ai/architecture.md', evidenceSource: 'architecture.md' },
    { concept: 'Product Strategy', canonical: '.ai/strategy.md', evidenceSource: 'strategy.md' },
    { concept: 'Prioritized Work', canonical: '.ai/backlog.md', evidenceSource: 'backlog.md' },
    { concept: 'Technical Decisions', canonical: '.ai/decisions.md', evidenceSource: 'decisions.md' },
    { concept: 'Validation Evidence', canonical: '.ai/validation.md', evidenceSource: 'validation.md' },
    { concept: 'Intelligence Quality', canonical: '.ai/repository-health.md', evidenceSource: 'repository-health.md' },
    { concept: 'Ranked Recommendation', canonical: '.ai/decision-ranking.json', evidenceSource: 'decision-ranking.json' },
    { concept: 'Handoff Artifact', canonical: '.ai/context-package.md', evidenceSource: 'context-package.md' },
  ];

  const riskConcepts = [];

  // Detect multi-owner patterns from decisions.md
  const decisionsText = docs.decisions;
  const multiOwnerPatterns = [
    /multiple\s+(?:sources?|owners?|canonical|truth)/gi,
    /(?:shared|duplicated)\s+(?:state|ownership|source)/gi,
    /(?:client|browser|localStorage).+(?:server|disk|file)/gi,
  ];
  const multiOwnerMentions = multiOwnerPatterns.flatMap((pat) => [...decisionsText.matchAll(pat)].map((m) => m[0]));

  // Detect any concept mentioned as owned in multiple places
  for (const item of conceptsToCheck) {
    const foundInDecisions = decisionsText.toLowerCase().includes(item.concept.toLowerCase());
    const foundInArchitecture = docs.architecture.toLowerCase().includes(item.concept.toLowerCase());
    if (foundInDecisions && foundInArchitecture) {
      // check if decisions.md says something different from the canonical
      const conflictPattern = new RegExp(`${item.concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^.]*(?:also|additionally|both|shared|duplicated)`, 'i');
      if (conflictPattern.test(decisionsText)) {
        riskConcepts.push(item.concept);
      }
    }
  }

  if (multiOwnerMentions.length > 0) {
    riskConcepts.push(...multiOwnerMentions.map((m) => `Detected: "${m.trim()}"`));
  }

  return { conceptsToCheck, riskConcepts: [...new Set(riskConcepts)] };
}

// ---------------------------------------------------------------------------
// Repository Purpose
// ---------------------------------------------------------------------------

function inferRepositoryPurpose(docs) {
  const sources = [
    sectionText(docs.goals, 'Product Purpose'),
    sectionText(docs.goals, 'Product Thesis'),
    sectionText(docs.strategy, 'Product Thesis'),
    sectionText(docs.architecture, 'Product Thesis'),
  ];
  const found = sources.map((s) => firstLine(s)).find((s) => s && !/^(not detected|missing|unknown)/i.test(s));
  return found || 'Not detected. Populate `.ai/goals.md` with a Product Purpose section.';
}

// ---------------------------------------------------------------------------
// Primary Execution Pipeline: from validation commands and architecture flows
// ---------------------------------------------------------------------------

function inferPipelineStages(docs) {
  const stages = [];

  // From validation.md commands
  const commandsSection = sectionText(docs.validation, 'Commands Run');
  const commandLines = bullets(commandsSection).filter((b) => /`[^`]+`/.test(b));
  for (const cmd of commandLines.slice(0, 8)) {
    const command = cmd.match(/`([^`]+)`/)?.[1] ?? cmd;
    const label = command.startsWith('npm run build') ? 'Build'
      : command.startsWith('npm test') || command.startsWith('npm run test') ? 'Test'
      : command.startsWith('npm run lint') ? 'Lint'
      : command.startsWith('npm run type') ? 'Type Check'
      : command.startsWith('cargo') ? 'Cargo Build/Test'
      : command.startsWith('swift') || command.startsWith('xcodebuild') ? 'Xcode Build/Test'
      : command.startsWith('go ') ? 'Go Build/Test'
      : 'Run';
    stages.push({ label, command: `\`${command}\`` });
  }

  // From architecture.md primary flows
  const primaryFlows = sectionText(docs.architecture, 'Primary Flows');
  const flowLines = bullets(primaryFlows).slice(0, 6);
  for (const flow of flowLines) {
    const alreadyPresent = stages.some((s) => s.label.toLowerCase() === flow.toLowerCase().split(':')[0].trim().toLowerCase());
    if (!alreadyPresent) {
      stages.push({ label: flow.split(':')[0].trim(), command: null, source: 'architecture.md' });
    }
  }

  return stages;
}

// ---------------------------------------------------------------------------
// State Transitions
// ---------------------------------------------------------------------------

function inferStateTransitions(docs) {
  const transitions = [];

  // From validation.md: detect CI/validation pipeline states
  const validationStatus = firstLine(sectionText(docs.validation, 'Overall Status'));
  const hasValidation = Boolean(sectionText(docs.validation, 'Commands Run').trim());
  if (hasValidation) {
    transitions.push(
      { from: 'Source Changed', trigger: 'Developer pushes code', to: 'Validation Running', deterministic: true },
      { from: 'Validation Running', trigger: 'All validation commands pass', to: 'Validated', deterministic: true },
      { from: 'Validation Running', trigger: 'Any validation command fails', to: 'Validation Failed', deterministic: true },
    );
  }

  // From architecture.md primary flows
  const primaryFlows = sectionText(docs.architecture, 'Primary Flows');
  const flowLines = bullets(primaryFlows).slice(0, 5);
  for (const flow of flowLines) {
    const parts = flow.split(/[→→\-\>]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      transitions.push({
        from: parts[0],
        trigger: 'System operation',
        to: parts[parts.length - 1],
        deterministic: true,
        source: 'architecture.md Primary Flows',
      });
    }
  }

  // From backlog.md: detect lifecycle stages mentioned in backlog items
  const backlogSection = sectionText(docs.backlog, 'Prioritized Backlog') || sectionText(docs.backlog, 'Current Backlog');
  const lifecycleKeywords = ['initializ', 'start', 'connect', 'refresh', 'complet', 'reset', 'restart'];
  const backlogItems = bullets(backlogSection);
  for (const item of backlogItems.slice(0, 10)) {
    const matched = lifecycleKeywords.find((k) => item.toLowerCase().includes(k));
    if (matched) {
      transitions.push({
        from: 'Current State',
        trigger: item.slice(0, 80),
        to: 'Next State',
        deterministic: false,
        source: 'backlog.md (inferred)',
      });
    }
  }

  return transitions;
}

// ---------------------------------------------------------------------------
// Architectural Invariants
// ---------------------------------------------------------------------------

function extractConstraintStatements(text) {
  const statements = [];
  const lines = text.split('\n');
  const constraintPatterns = [
    /(?:must|always|never|only|deterministic|no\s+(?:llm|cloud|telemetry|random|auth))/i,
    /(?:guarantee|invariant|constraint|require|enforce|ensure)/i,
    /(?:single\s+source|canonical|exactly\s+one|one\s+canonical)/i,
  ];
  for (const line of lines) {
    const trimmed = line.replace(/^[-*#\s]+/, '').trim();
    if (trimmed.length < 10 || trimmed.length > 200) continue;
    if (constraintPatterns.some((pat) => pat.test(trimmed))) {
      statements.push(trimmed);
    }
  }
  return [...new Set(statements)].slice(0, 12);
}

function inferInvariants(docs, entityRows) {
  const invariants = [];

  // From decisions.md — constraint language
  const decisionsConstraints = extractConstraintStatements(docs.decisions);
  for (const constraint of decisionsConstraints) {
    invariants.push({
      invariant: constraint,
      confidence: 'High',
      evidence: '.ai/decisions.md',
    });
  }

  // From goals.md success criteria
  const successCriteria = sectionText(docs.goals, 'Success Criteria');
  const criteriaLines = bullets(successCriteria).slice(0, 4);
  for (const criterion of criteriaLines) {
    if (criterion.length > 10 && !/not detected|missing/i.test(criterion)) {
      invariants.push({
        invariant: `Success criterion: ${criterion}`,
        confidence: 'Medium',
        evidence: '.ai/goals.md (Success Criteria)',
      });
    }
  }

  // From architecture.md — constraint-sounding statements
  const archConstraints = extractConstraintStatements(docs.architecture);
  for (const constraint of archConstraints) {
    const alreadyPresent = invariants.some((i) => i.invariant === constraint);
    if (!alreadyPresent) {
      invariants.push({
        invariant: constraint,
        confidence: 'Medium',
        evidence: '.ai/architecture.md',
      });
    }
  }

  // Structural invariants: each canonical intelligence file has exactly one generator
  const generatedEntities = entityRows.filter((e) => e.type === 'Generated' && e.confidence === 'High');
  if (generatedEntities.length > 0) {
    invariants.push({
      invariant: `${generatedEntities.length} intelligence artifact${generatedEntities.length === 1 ? '' : 's'} are generated deterministically and not manually edited`,
      confidence: 'High',
      evidence: '.ai/ directory structure',
    });
  }

  // Validation invariant if commands exist
  const commands = bullets(sectionText(docs.validation, 'Commands Run')).filter((b) => /`[^`]+`/.test(b));
  if (commands.length > 0) {
    invariants.push({
      invariant: `Repository correctness is verified by ${commands.length} deterministic validation command${commands.length === 1 ? '' : 's'}`,
      confidence: 'High',
      evidence: '.ai/validation.md (Commands Run)',
    });
  }

  // Deduplicate by invariant text
  const seen = new Set();
  return invariants.filter(({ invariant }) => {
    const key = invariant.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Architectural Risks
// ---------------------------------------------------------------------------

function inferRisks(docs, entityRows, ownershipResult) {
  const risks = [];

  // From repository-health.md risks section
  const healthRisks = bullets(sectionText(docs.health, 'Risks'))
    .filter((r) => !/no .*risks/i.test(r));
  for (const risk of healthRisks) {
    risks.push({
      observation: risk,
      evidence: '.ai/repository-health.md (Risks)',
      category: 'Repository Health',
    });
  }

  // From ownership analysis
  for (const risk of ownershipResult.riskConcepts) {
    risks.push({
      observation: `Potential multiple ownership: ${risk}`,
      evidence: '.ai/decisions.md or .ai/architecture.md',
      category: 'Ownership',
    });
  }

  // Missing canonical files
  const missingEntities = entityRows.filter((e) => e.type === 'Canonical' && e.confidence === 'Not present');
  for (const missing of missingEntities) {
    risks.push({
      observation: `Canonical intelligence file not present: ${missing.file}`,
      evidence: '.ai/ directory',
      category: 'Missing Intelligence',
    });
  }

  // Missing generated files
  const missingGenerated = entityRows.filter((e) => e.type === 'Generated' && e.confidence === 'Not present');
  if (missingGenerated.length > 0) {
    risks.push({
      observation: `${missingGenerated.length} generated intelligence file${missingGenerated.length === 1 ? '' : 's'} not present: ${missingGenerated.map((e) => e.file).join(', ')}`,
      evidence: '.ai/ directory',
      category: 'Missing Intelligence',
    });
  }

  // Detect implicit persistence from decisions.md
  const implicitPersistencePatterns = [/localStorage/i, /sessionStorage/i, /in-memory/i, /cache/i];
  for (const pat of implicitPersistencePatterns) {
    if (pat.test(docs.decisions)) {
      const match = docs.decisions.match(pat);
      risks.push({
        observation: `Implicit or session-scoped persistence detected in decisions: "${match?.[0]}"`,
        evidence: '.ai/decisions.md',
        category: 'Persistence',
      });
      break;
    }
  }

  // Detect cyclic dependency hints
  if (/circular|cyclic|cycle/i.test(docs.architecture) || /circular|cyclic|cycle/i.test(docs.decisions)) {
    risks.push({
      observation: 'Cyclic dependency language detected in architecture or decisions',
      evidence: [/circular|cyclic|cycle/i.test(docs.architecture) && '.ai/architecture.md', /circular|cyclic|cycle/i.test(docs.decisions) && '.ai/decisions.md'].filter(Boolean).join(', '),
      category: 'Coupling',
    });
  }

  // Deduplicate
  const seen = new Set();
  return risks.filter(({ observation }) => {
    const key = observation.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Execution Confidence
// ---------------------------------------------------------------------------

function computeConfidence(docs, entityRows, invariants, risks) {
  const presentFiles = entityRows.filter((e) => e.confidence === 'High').length;
  const totalFiles = entityRows.filter((e) => e.type === 'Canonical' || e.type === 'Generated').length;
  const coveragePercent = totalFiles > 0 ? Math.round((presentFiles / totalFiles) * 100) : 0;

  const evidenceSources = [
    Boolean(sectionText(docs.goals, 'Product Purpose') || sectionText(docs.goals, 'Product Thesis')) && '.ai/goals.md',
    Boolean(sectionText(docs.architecture, 'Core Systems')) && '.ai/architecture.md',
    Boolean(sectionText(docs.strategy, 'Product Thesis') || sectionText(docs.strategy, 'Current Product Bet')) && '.ai/strategy.md',
    Boolean(sectionText(docs.decisions, 'Active Decisions')) && '.ai/decisions.md',
    Boolean(sectionText(docs.validation, 'Commands Run')) && '.ai/validation.md',
    Boolean(sectionText(docs.health, 'Risks') || sectionText(docs.health, 'Recommended Next Step')) && '.ai/repository-health.md',
  ].filter(Boolean);

  const unresolvedAmbiguities = [];
  if (!sectionText(docs.goals, 'Product Purpose') && !sectionText(docs.goals, 'Product Thesis') && !sectionText(docs.strategy, 'Product Thesis')) {
    unresolvedAmbiguities.push('Repository purpose not detected in goals.md or strategy.md');
  }
  if (!sectionText(docs.architecture, 'Core Systems')) {
    unresolvedAmbiguities.push('Core systems not detected in architecture.md');
  }
  if (!sectionText(docs.validation, 'Commands Run')) {
    unresolvedAmbiguities.push('Validation commands not detected; execution pipeline is inferred');
  }
  if (risks.some((r) => r.category === 'Ownership')) {
    unresolvedAmbiguities.push('Multiple ownership detected for at least one concept');
  }

  const inferredAssumptions = [
    'Generated intelligence files are regenerated atomically on each refresh',
    '.ai/goals.md is the only file edited directly by repository owners',
    'Validation commands reflect the complete required execution pipeline',
  ];

  const overallConfidence = coveragePercent >= 80 ? 'High'
    : coveragePercent >= 50 ? 'Medium'
    : 'Low';

  return {
    overallConfidence,
    coveragePercent,
    evidenceCount: evidenceSources.length,
    evidenceSources,
    invariantCount: invariants.length,
    riskCount: risks.length,
    unresolvedAmbiguities,
    inferredAssumptions,
  };
}

// ---------------------------------------------------------------------------
// Render functions (all deterministic)
// ---------------------------------------------------------------------------

function renderEntityTable(rows) {
  if (rows.length === 0) return '- No entities detected. Refresh intelligence to populate.';
  const lines = [
    '| Entity | Owner | Persistence | Type | Confidence |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.entity} | ${r.owner} | ${r.persistence} | ${r.type} | ${r.confidence} |`),
  ];
  return lines.join('\n');
}

function renderOwnershipTable(ownershipResult) {
  const { conceptsToCheck, riskConcepts } = ownershipResult;
  const lines = [
    '| Concept | Canonical Owner | Notes |',
    '|---|---|---|',
    ...conceptsToCheck.map((row) => `| ${row.concept} | ${row.canonical} | — |`),
  ];
  const table = lines.join('\n');
  if (riskConcepts.length === 0) return table;
  const riskLines = [
    '',
    '### Ownership Risks',
    '',
    ...riskConcepts.map((r) => `- ${r}`),
  ];
  return `${table}\n${riskLines.join('\n')}`;
}

function renderPipeline(stages) {
  if (stages.length === 0) return '- No execution pipeline detected. Populate `.ai/validation.md` with validation commands.';
  return stages.map((s, i) => `${i + 1}. **${s.label}**: ${s.command ?? s.source ?? 'see architecture.md'}`).join('\n');
}

function renderTransitions(transitions) {
  if (transitions.length === 0) return '- No state transitions detected. Populate `.ai/architecture.md` with Primary Flows.';
  const lines = [
    '| From | Trigger | To | Deterministic |',
    '|---|---|---|---|',
    ...transitions.map((t) => `| ${t.from} | ${t.trigger.slice(0, 60)} | ${t.to} | ${t.deterministic ? 'Yes' : 'No'} |`),
  ];
  return lines.join('\n');
}

function renderInvariants(invariants) {
  if (invariants.length === 0) return '- No architectural invariants detected. Populate `.ai/decisions.md` with Active Decisions.';
  return invariants.map((inv) => [
    `- **${inv.invariant}**`,
    `  - Confidence: ${inv.confidence}`,
    `  - Evidence: ${inv.evidence}`,
  ].join('\n')).join('\n');
}

function renderRisks(risks) {
  if (risks.length === 0) return '- No architectural risks detected from available intelligence.';
  return risks.map((r) => [
    `- **${r.observation}**`,
    `  - Category: ${r.category}`,
    `  - Evidence: ${r.evidence}`,
  ].join('\n')).join('\n');
}

function renderConfidence(conf) {
  const lines = [
    `- Overall Confidence: **${conf.overallConfidence}** (${conf.coveragePercent}% of intelligence files present)`,
    `- Evidence Count: ${conf.evidenceCount} populated source${conf.evidenceCount === 1 ? '' : 's'}`,
    `- Invariant Count: ${conf.invariantCount}`,
    `- Architectural Risk Count: ${conf.riskCount}`,
    '',
    '**Evidence Sources:**',
    ...conf.evidenceSources.map((s) => `- ${s}`),
  ];
  if (conf.unresolvedAmbiguities.length > 0) {
    lines.push('', '**Unresolved Ambiguities:**', ...conf.unresolvedAmbiguities.map((a) => `- ${a}`));
  }
  lines.push('', '**Inferred Assumptions:**', ...conf.inferredAssumptions.map((a) => `- ${a}`));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateExecutionModel(repositoryPath = process.cwd()) {
  const aiDir = join(repositoryPath, '.ai');
  const outputPath = join(aiDir, 'execution-model.md');

  const [goals, architecture, strategy, decisions, validation, health, backlog] = await Promise.all([
    readAiFile(aiDir, 'goals.md'),
    readAiFile(aiDir, 'architecture.md'),
    readAiFile(aiDir, 'strategy.md'),
    readAiFile(aiDir, 'decisions.md'),
    readAiFile(aiDir, 'validation.md'),
    readAiFile(aiDir, 'repository-health.md'),
    readAiFile(aiDir, 'backlog.md'),
  ]);

  const docs = { goals, architecture, strategy, decisions, validation, health, backlog };
  const manualNotes = await readExistingManualNotes(outputPath);

  const entityRows = await buildEntityTable(aiDir, docs);
  const ownershipResult = buildOwnershipTable(docs);
  const pipelineStages = inferPipelineStages(docs);
  const stateTransitions = inferStateTransitions(docs);
  const invariants = inferInvariants(docs, entityRows);
  const risks = inferRisks(docs, entityRows, ownershipResult);
  const confidence = computeConfidence(docs, entityRows, invariants, risks);
  const repositoryPurpose = inferRepositoryPurpose(docs);

  const content = [
    '# Execution Model',
    '',
    '## Repository Execution Model',
    '',
    '### Repository Purpose',
    '',
    repositoryPurpose,
    '',
    '### Primary Execution Pipeline',
    '',
    renderPipeline(pipelineStages),
    '',
    '### Major Execution Stages',
    '',
    pipelineStages.length > 0
      ? pipelineStages.map((s) => `- ${s.label}`).join('\n')
      : '- Not detected. Populate `.ai/validation.md` and `.ai/architecture.md` to generate execution stages.',
    '',
    '## Canonical Entities',
    '',
    renderEntityTable(entityRows),
    '',
    '## Sources of Truth',
    '',
    renderOwnershipTable(ownershipResult),
    '',
    '## Repository State Transitions',
    '',
    renderTransitions(stateTransitions),
    '',
    '## Architectural Invariants',
    '',
    renderInvariants(invariants),
    '',
    '## Architectural Risks',
    '',
    renderRisks(risks),
    '',
    '## Execution Confidence',
    '',
    renderConfidence(confidence),
    '',
    manualNotes,
  ].join('\n');

  await mkdir(aiDir, { recursive: true });
  await writeFile(outputPath, content);
  return outputPath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = await generateExecutionModel(resolve(process.argv[2] ?? process.cwd()));
  console.log(`Wrote ${outputPath}`);
}
