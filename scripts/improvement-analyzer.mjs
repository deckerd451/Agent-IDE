/**
 * Deterministic Improvement Analyzer
 *
 * Synthesizes repository intelligence artifacts to produce architectural improvement candidates.
 * Every candidate cites deterministic evidence from .ai/ files.
 * No candidate is produced without evidence.
 * No randomness, no LLM, no cloud.
 */

function sectionText(text, header) {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() ?? '';
}

function bullets(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, '').trim());
}

function firstNonEmpty(text, fallback = '') {
  return text.split('\n').map((l) => l.replace(/^[-*#\s]+/, '').trim()).find(Boolean) ?? fallback;
}

function hasRealContent(text) {
  return Boolean(text) && !/^\s*$/.test(text) && !/^(not detected yet|missing|none detected|generated placeholder|tbd|todo|n\/a)\s*$/i.test(text.split('\n').find((l) => l.trim()) ?? '');
}

// ---------------------------------------------------------------------------
// Ownership conflicts from execution-model.md ## Sources of Truth
// ---------------------------------------------------------------------------

function fromOwnershipRisks(executionModelText) {
  if (!executionModelText.trim()) return [];
  const sourcesSection = sectionText(executionModelText, 'Sources of Truth');
  if (!sourcesSection) return [];
  const ownershipIdx = sourcesSection.indexOf('### Ownership Risks');
  if (ownershipIdx === -1) return [];
  const ownershipSubsection = sourcesSection.slice(ownershipIdx);
  const risks = ownershipSubsection
    .split('\n')
    .filter((l) => l.trimStart().startsWith('- '))
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter((r) => r.length > 4 && !/^ownership risk/i.test(r));
  return risks.slice(0, 3).map((risk, i) => ({
    id: `ownership-risk-${i}`,
    kind: 'architectural-improvement',
    class: 'improvement',
    category: 'ownership-clarification',
    severity: 'high',
    actionability: 'code-fixable',
    priority: 92,
    expectedImprovementValues: { repositoryHealth: 8, canonicalCompleteness: 5, quality: 10, verification: 0, handoffReadiness: 8 },
    source: '.ai/execution-model.md (Ownership Risks)',
    title: `Clarify Ownership: ${risk.replace(/^Detected: "?|"?$/g, '').slice(0, 60)}`,
    evidence: `Ownership conflict detected in execution-model.md: ${risk}`,
    reason: 'Duplicated or ambiguous ownership violates the single-source-of-truth invariant and makes deterministic ranking unreliable.',
    recommendedAction: `Establish a single canonical owner for: ${risk}.`,
    details: {
      problem: `Execution model analysis detected an ownership conflict: ${risk}. Multiple owners for the same concept means the system cannot determine a single authoritative source of truth.`,
      requirements: [
        'Identify which canonical file should be the single authoritative owner.',
        'Update .ai/decisions.md to record the resolution.',
        'Remove or redirect any secondary owners to the canonical source.',
        'Preserve all manual sections.',
      ],
      acceptance: [
        'The concept has exactly one canonical owner in the repository.',
        'The resolution is recorded in .ai/decisions.md.',
        'execution-model.md no longer reports this ownership conflict after refresh.',
      ],
    },
  }));
}

// ---------------------------------------------------------------------------
// Architectural risks from execution-model.md ## Architectural Risks
// (excluding ownership and maintenance categories — those are handled separately)
// ---------------------------------------------------------------------------

const maintenanceRiskCategories = new Set(['repository health', 'missing intelligence', 'ownership']);

const knownSourceFiles = ['src/workflow.ts', 'src/App.tsx', 'scripts/server.mjs', 'scripts/next-improvement.mjs', 'scripts/execution-model.mjs', 'scripts/improvement-analyzer.mjs'];

function extractAffectedFiles(text) {
  return knownSourceFiles.filter((f) => {
    const base = f.split('/').pop().replace(/\.[^.]+$/, '');
    return new RegExp(base, 'i').test(text);
  });
}

function fromExecutionModelRisks(executionModelText) {
  if (!executionModelText.trim()) return [];
  const section = sectionText(executionModelText, 'Architectural Risks');
  if (!section || /No architectural risks detected from available intelligence/i.test(section)) return [];

  const riskBlocks = section.split(/\n(?=- \*\*)/).filter((b) => b.trim().startsWith('- **'));
  const improvementBlocks = riskBlocks.filter((block) => {
    const catMatch = block.match(/- Category:\s*(.+)$/im);
    const category = catMatch?.[1]?.toLowerCase().trim() ?? '';
    return !maintenanceRiskCategories.has(category);
  });

  return improvementBlocks.slice(0, 4).map((block, i) => {
    const titleMatch = block.match(/^- \*\*(.+?)\*\*/m);
    const title = titleMatch?.[1] ?? `Architectural Risk ${i + 1}`;
    const evidenceMatch = block.match(/- Evidence:\s*(.+)$/im);
    const evidence = evidenceMatch?.[1]?.trim() ?? '.ai/execution-model.md (Architectural Risks)';
    const categoryMatch = block.match(/- Category:\s*(.+)$/im);
    const rawCategory = categoryMatch?.[1]?.trim() ?? 'Architectural Risk';
    const category = rawCategory.toLowerCase();

    const isPersistence = /persistence|storage|localStorage|sessionStorage/i.test(title + rawCategory);
    const isCoupling = /coupling|cyclic|circular/i.test(title + rawCategory);
    const isComplexity = /complexity|simplif/i.test(title + rawCategory);
    const resolvedCategory = isPersistence ? 'implicit-state' : isCoupling ? 'architectural-coupling' : isComplexity ? 'architectural-simplification' : rawCategory.toLowerCase();
    const affectedFiles = extractAffectedFiles(evidence + ' ' + title);

    return {
      id: `exec-model-risk-${i}`,
      kind: 'architectural-improvement',
      class: 'improvement',
      packageType: 'implementation',
      category: resolvedCategory,
      severity: /localStorage|sessionStorage|cyclic|split ownership|fatal|critical/i.test(title) ? 'high' : 'medium',
      actionability: isPersistence || isCoupling ? 'code-fixable' : 'code-fixable',
      priority: isPersistence ? 94 : isCoupling ? 88 : 84,
      expectedImprovementValues: { repositoryHealth: 10, canonicalCompleteness: 0, quality: 10, verification: 0, handoffReadiness: 8 },
      affectedFiles,
      source: evidence,
      title: `Resolve Architectural Risk: ${title.slice(0, 65)}`,
      evidence: `${title} — Source: ${evidence}`,
      reason: 'Execution model analysis identified this as an evidence-backed architectural risk. Resolving it improves determinism and maintainability.',
      recommendedAction: `Investigate and resolve: ${title}.`,
      details: {
        problem: `${title} (Category: ${rawCategory}). Evidence: ${evidence}.`,
        requirements: [
          'Investigate the evidence cited before making changes.',
          'Apply only the focused change required to resolve this risk.',
          'Keep the change narrowly scoped and do not introduce unrelated refactoring.',
          'Preserve all manual intelligence sections.',
        ],
        acceptance: [
          'The cited architectural risk is resolved or explicitly documented as accepted.',
          'execution-model.md no longer reports this risk after refresh.',
          'No new architectural risks are introduced.',
        ],
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Implicit persistence from decisions.md (client-side state in server concern)
// ---------------------------------------------------------------------------

const persistencePatterns = [
  {
    pattern: /\blocalStorage\b/i,
    title: 'Migrate Client-Side Completion Records to Server-Side Storage',
    category: 'implicit-state',
    reason: 'localStorage is scoped to a single browser, causing different clients to produce different recommendations from the same repository — violating the determinism invariant.',
    recommendedAction: 'Move completion records from localStorage to a deterministic server-side file (e.g., .ai/completions.json) so all clients see the same recommendation state.',
    problem: 'Completion records stored in localStorage are invisible to other browsers and vanish on cache clear, making repository recommendations non-reproducible across clients.',
    priority: 96,
  },
  {
    pattern: /\bsessionStorage\b/i,
    title: 'Eliminate Session-Scoped State for Repository Intelligence',
    category: 'implicit-state',
    reason: 'sessionStorage state is lost on browser refresh, making recommendation state non-reproducible.',
    recommendedAction: 'Move session-scoped state to a deterministic server-side file in .ai/.',
    problem: 'Session-scoped state prevents reproducible repository recommendations and creates implicit coupling between the client session and recommendation logic.',
    priority: 92,
  },
];

function fromImplicitPersistence(decisionsText) {
  if (!decisionsText.trim()) return [];
  const results = [];
  for (const { pattern, title, category, reason, recommendedAction, problem, priority } of persistencePatterns) {
    if (!pattern.test(decisionsText)) continue;
    const match = decisionsText.match(pattern);
    results.push({
      id: `implicit-persistence-${results.length}`,
      kind: 'architectural-improvement',
      class: 'improvement',
      category,
      severity: 'high',
      actionability: 'code-fixable',
      priority,
      expectedImprovementValues: { repositoryHealth: 12, canonicalCompleteness: 0, quality: 10, verification: 0, handoffReadiness: 10 },
      source: '.ai/decisions.md',
      title,
      evidence: `"${match?.[0]}" detected in .ai/decisions.md`,
      reason,
      recommendedAction,
      details: {
        problem,
        requirements: [
          'Identify all places where the client-side state is written and read.',
          'Design a server-side equivalent that is written atomically and read deterministically.',
          'Migrate without changing observable behavior for the common case.',
          'Add a deterministic test proving the new storage is reproducible.',
        ],
        acceptance: [
          'No recommendation-affecting state is stored in localStorage or sessionStorage.',
          'The same repository produces the same recommendation regardless of browser or client session.',
          'All existing tests continue to pass.',
        ],
      },
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Technical debt from backlog.md (explicit debt markers)
// ---------------------------------------------------------------------------

const debtPatterns = [
  /\btechnical[\s-]debt\b/i,
  /\brefactor\b/i,
  /\bsimplif(?:y|ication)\b/i,
  /\bduplicat(?:e|ion|ed)\b/i,
  /\bclean[\s-]?up\b/i,
  /\blegacy\b/i,
  /\bworkaround\b/i,
  /\bhack\b/i,
];

function fromTechnicalDebt(backlogText) {
  if (!backlogText.trim()) return [];
  const allBacklogLines = backlogText
    .split('\n')
    .filter((l) => /^[-*]\s+/.test(l.trim()))
    .map((l) => l.replace(/^[-*]\s+/, '').trim());
  const debtItems = allBacklogLines.filter((item) => debtPatterns.some((p) => p.test(item)));
  if (!debtItems.length) return [];
  const firstItem = debtItems[0];
  return [{
    id: 'technical-debt',
    kind: 'architectural-improvement',
    class: 'improvement',
    category: 'technical-debt',
    severity: 'medium',
    actionability: 'code-fixable',
    priority: 80,
    expectedImprovementValues: { repositoryHealth: 7, canonicalCompleteness: 0, quality: 8, verification: 3, handoffReadiness: 5 },
    source: '.ai/backlog.md',
    title: `Address Technical Debt: ${firstItem.slice(0, 60)}`,
    evidence: `Technical debt in .ai/backlog.md: ${debtItems.slice(0, 2).join('; ')}`,
    reason: 'Unresolved technical debt blocks future feature work and accumulates architectural drag.',
    recommendedAction: `Resolve the highest-priority technical debt item: ${firstItem}.`,
    details: {
      problem: `The backlog contains ${debtItems.length} technical debt item${debtItems.length === 1 ? '' : 's'}: ${debtItems.slice(0, 3).join('; ')}.`,
      requirements: [
        'Address only the debt item cited in Current Evidence.',
        'Do not introduce new complexity while resolving debt.',
        'Preserve manual intelligence sections.',
        'Keep the change narrowly scoped and reviewable.',
      ],
      acceptance: [
        'The cited technical debt item is resolved and removed from the backlog.',
        'No new technical debt is introduced.',
        'All existing tests pass.',
      ],
    },
  }];
}

// ---------------------------------------------------------------------------
// Architectural complexity from architecture.md
// ---------------------------------------------------------------------------

function fromArchitecturalComplexity(architectureText) {
  if (!architectureText.trim()) return [];
  const coreSystemsSection = sectionText(architectureText, 'Core Systems');
  if (!coreSystemsSection) return [];
  const systemCount = bullets(coreSystemsSection).length;
  if (systemCount < 12) return [];
  return [{
    id: 'architectural-complexity',
    kind: 'architectural-improvement',
    class: 'improvement',
    category: 'architectural-simplification',
    severity: 'medium',
    actionability: 'code-fixable',
    priority: 76,
    expectedImprovementValues: { repositoryHealth: 8, canonicalCompleteness: 0, quality: 9, verification: 2, handoffReadiness: 7 },
    source: '.ai/architecture.md (Core Systems)',
    title: `Simplify Architecture: ${systemCount} Core Systems Detected`,
    evidence: `architecture.md lists ${systemCount} core systems, suggesting high coupling or decomposition opportunities.`,
    reason: 'A large number of tightly coupled core systems increases maintenance burden and reduces architectural clarity.',
    recommendedAction: 'Identify which core systems can be merged, extracted, or eliminated to reduce complexity.',
    details: {
      problem: `architecture.md lists ${systemCount} core systems. High system counts suggest that the architecture has grown without deliberate simplification.`,
      requirements: [
        'Review the Core Systems list for systems that could be merged or eliminated.',
        'Choose one consolidation and apply it.',
        'Update architecture.md to reflect the simplification.',
        'Preserve all manual sections.',
      ],
      acceptance: [
        'At least one core system is merged, extracted, or eliminated.',
        'architecture.md is updated to reflect the change.',
        'Downstream intelligence can be refreshed without contradiction.',
      ],
    },
  }];
}

// ---------------------------------------------------------------------------
// Strategic drift: Current Product Bet not reflected in architecture or backlog
// ---------------------------------------------------------------------------

function fromStrategicDrift(strategyText, architectureText, backlogText) {
  if (!strategyText.trim() || !architectureText.trim()) return [];
  const productBet = sectionText(strategyText, 'Current Product Bet');
  if (!productBet || !hasRealContent(productBet)) return [];

  const betWords = firstNonEmpty(productBet)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4 && !/^(the|this|that|with|from|have|will|should|their|would|could|being|which|about|into|when|then|each|every|after|before|under|over|without)$/.test(w));

  if (betWords.length < 3) return [];

  const archText = (sectionText(architectureText, 'Primary Flows') + sectionText(architectureText, 'Core Systems')).toLowerCase();
  const backlogItems = bullets(sectionText(backlogText, 'Prioritized Backlog') || sectionText(backlogText, 'Current Backlog') || backlogText).join(' ').toLowerCase();
  const foundInArch = betWords.some((w) => archText.includes(w));
  const foundInBacklog = betWords.some((w) => backlogItems.includes(w));
  if (foundInArch || foundInBacklog) return [];

  return [{
    id: 'strategic-drift',
    kind: 'architectural-improvement',
    class: 'improvement',
    category: 'architectural-drift',
    severity: 'medium',
    actionability: 'manual',
    priority: 82,
    expectedImprovementValues: { repositoryHealth: 9, canonicalCompleteness: 5, quality: 8, verification: 0, handoffReadiness: 9 },
    source: '.ai/strategy.md (Current Product Bet) vs .ai/architecture.md',
    title: 'Align Architecture with Current Product Bet',
    evidence: 'Current Product Bet in strategy.md is not reflected in architecture.md Primary Flows or Core Systems.',
    reason: 'When the architecture does not reflect the product bet, implementation effort risks going in the wrong direction.',
    recommendedAction: 'Review the Current Product Bet and update architecture.md or backlog.md to reflect its implementation status.',
    details: {
      problem: `The Current Product Bet ("${firstNonEmpty(productBet).slice(0, 80)}") does not appear in architecture.md or backlog.md, suggesting architectural drift between strategy and implementation.`,
      requirements: [
        'Review the Current Product Bet against the actual architecture.',
        'Update either architecture.md to show how the bet is implemented, or update backlog.md to add the required work.',
        'Record the alignment decision in .ai/decisions.md.',
        'Do not change generated artifacts directly.',
      ],
      acceptance: [
        'architecture.md or backlog.md reflects the Current Product Bet.',
        'The drift is resolved or explicitly documented as intentional.',
        'No generated artifacts are edited directly.',
      ],
    },
  }];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyze repository intelligence and produce architectural improvement candidates.
 * @param {object} docs - Repository intelligence documents
 * @param {string} [docs.architecture] - .ai/architecture.md content
 * @param {string} [docs.decisions] - .ai/decisions.md content
 * @param {string} [docs.executionModel] - .ai/execution-model.md content
 * @param {string} [docs.backlog] - .ai/backlog.md content
 * @param {string} [docs.strategy] - .ai/strategy.md content
 * @returns {Array} Improvement candidates, each with class:'improvement'
 */
export function analyzeImprovements(docs = {}) {
  return analyzeImprovementsWithTrace(docs).candidates;
}

/**
 * Like analyzeImprovements, but also returns per-stage diagnostics.
 * @param {object} docs
 * @returns {{ candidates: Array, stages: Array }}
 */
export function analyzeImprovementsWithTrace({ architecture = '', decisions = '', executionModel = '', backlog = '', strategy = '' } = {}) {
  const stages = [];

  function runStage(name, inputFile, inputText, fn, args) {
    const inputPresent = Boolean(inputText && inputText.trim());
    const inputSize = inputText ? inputText.length : 0;
    const produced = fn(...args);
    stages.push({ stage: name, inputFile, inputPresent, inputSize, candidatesProduced: produced.length, rejectionReason: produced.length > 0 ? null : inputPresent ? `No matching patterns found in ${inputFile}` : `${inputFile} is absent or empty` });
    return produced;
  }

  const raw = [
    ...runStage('Ownership Risks (execution-model.md)', '.ai/execution-model.md', executionModel, fromOwnershipRisks, [executionModel]),
    ...runStage('Implicit Persistence (decisions.md)', '.ai/decisions.md', decisions, fromImplicitPersistence, [decisions]),
    ...runStage('Execution Model Risks (execution-model.md)', '.ai/execution-model.md', executionModel, fromExecutionModelRisks, [executionModel]),
    ...runStage('Strategic Drift (strategy.md vs architecture.md)', '.ai/strategy.md + .ai/architecture.md', strategy + architecture, fromStrategicDrift, [strategy, architecture, backlog]),
    ...runStage('Technical Debt (backlog.md)', '.ai/backlog.md', backlog, fromTechnicalDebt, [backlog]),
    ...runStage('Architectural Complexity (architecture.md)', '.ai/architecture.md', architecture, fromArchitecturalComplexity, [architecture]),
  ];

  // Deduplicate by evidence fingerprint (case-insensitive, first 120 chars)
  const seen = new Set();
  const candidates = raw.filter(({ evidence }) => {
    const key = evidence.toLowerCase().slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { candidates, stages };
}
