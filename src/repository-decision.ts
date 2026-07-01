export type DecisionPackageType = 'implementation' | 'validation-experiment' | 'product-decision' | 'investigation' | 'documentation';
export type RequiredOwnerAction = 'Review decision' | 'Choose execution agent' | 'Perform external work' | 'Record outcome evidence' | 'Approve canonical intent' | 'Refresh repository intelligence';
export type ExecutionReadiness = 'ready' | 'external-work-pending' | 'outcome-needed' | 'refresh-ready' | 'refresh-running' | 'blocked';
export type ExecutionAgent = 'Claude' | 'Codex' | 'ChatGPT' | 'Gemini' | 'Generic';

export type DecisionFlowRecommendation = {
  title?: string;
  displayTitle?: string;
  explanation?: string;
  whyItMatters?: string;
  packageType?: 'implementation' | 'product-decision' | 'validation-experiment' | 'task-clarification' | string;
  evidenceSource?: string;
  canonicalIntelligenceState?: 'existing' | 'missing';
};

export type DecisionFlowCandidate = {
  title?: string;
  category?: string;
  reason?: string;
  ownerAction?: string;
  source?: string;
};

export type DecisionFlowStatus = {
  repositoryName?: string;
  overallHealth?: string;
  repositoryHandoffReadiness?: string;
  currentConfidence?: string;
  lastRefresh?: string;
};

export type DecisionFlowInput = {
  status?: DecisionFlowStatus;
  recommendation?: DecisionFlowRecommendation | null;
  selectedCandidate?: DecisionFlowCandidate | null;
  workflow?: { type?: string; repositoryState?: string; completionState?: string; currentStep?: { id?: string } } | null;
  isRefreshing?: boolean;
  hasOutcomeEvidenceForCurrentDecision?: boolean;
  debugReferences?: string[];
};

type RepositoryDecisionFlow = {
  repositoryStatus: string;
  selectedDecisionTitle: string;
  whyThisDecisionExists: string;
  currentRequiredOwnerAction: RequiredOwnerAction;
  executionReadiness: ExecutionReadiness;
  packageType: DecisionPackageType;
};

const defaultExecutionAgents: ExecutionAgent[] = ['Claude', 'Codex', 'ChatGPT', 'Gemini', 'Generic'];

export function decisionPackageType(input: Pick<DecisionFlowInput, 'recommendation' | 'selectedCandidate' | 'workflow'>): DecisionPackageType {
  if (input.recommendation?.packageType === 'product-decision') return 'product-decision';
  if (input.recommendation?.packageType === 'validation-experiment') return 'validation-experiment';
  if (input.recommendation?.packageType === 'implementation') return 'implementation';
  const text = `${input.selectedCandidate?.category ?? ''} ${input.selectedCandidate?.title ?? ''} ${input.selectedCandidate?.ownerAction ?? ''} ${input.recommendation?.title ?? ''} ${input.workflow?.type ?? ''}`;
  if (/documentation|docs/i.test(text)) return 'documentation';
  if (/investigat|unknown|risk|explain/i.test(text)) return 'investigation';
  return 'implementation';
}

function isExternalWorkStep(step: { id?: string } | null | undefined) {
  return Boolean(step?.id && ['open-codex', 'run-implementation', 'open-chatgpt', 'paste-response', 'edit-documentation'].includes(step.id));
}

function ownerActionFor(input: DecisionFlowInput, packageType: DecisionPackageType): RequiredOwnerAction {
  if (input.isRefreshing) return 'Refresh repository intelligence';
  const workflow = input.workflow;
  if (!workflow) return 'Refresh repository intelligence';
  if (workflow.repositoryState === 'Refresh Repository' || workflow.completionState === 'Ready To Refresh') return 'Refresh repository intelligence';
  if (isExternalWorkStep(workflow.currentStep)) return input.hasOutcomeEvidenceForCurrentDecision ? 'Perform external work' : 'Record outcome evidence';
  if (packageType === 'product-decision') return 'Approve canonical intent';
  return 'Choose execution agent';
}

function readinessFor(input: DecisionFlowInput, ownerAction: RequiredOwnerAction): ExecutionReadiness {
  if (input.isRefreshing) return 'refresh-running';
  if (ownerAction === 'Refresh repository intelligence') return 'refresh-ready';
  if (ownerAction === 'Perform external work') return 'external-work-pending';
  if (ownerAction === 'Record outcome evidence') return 'outcome-needed';
  return input.recommendation ? 'ready' : 'blocked';
}

function createRepositoryDecisionFlow(input: DecisionFlowInput): RepositoryDecisionFlow {
  const status = input.status ?? {};
  const recommendation = input.recommendation;
  const selectedCandidate = input.selectedCandidate;
  const packageType = decisionPackageType(input);
  const currentRequiredOwnerAction = ownerActionFor(input, packageType);
  const executionReadiness = readinessFor(input, currentRequiredOwnerAction);
  return {
    repositoryStatus: [status.repositoryName, status.overallHealth, status.repositoryHandoffReadiness, status.currentConfidence].filter(Boolean).join(' · ') || 'Repository intelligence not loaded',
    selectedDecisionTitle: selectedCandidate?.title ?? recommendation?.displayTitle ?? recommendation?.title ?? 'Refresh repository intelligence',
    whyThisDecisionExists: selectedCandidate?.reason ?? recommendation?.explanation ?? recommendation?.whyItMatters ?? 'Repository intelligence needs to be generated before a decision can be selected.',
    currentRequiredOwnerAction,
    executionReadiness,
    packageType,
  };
}

export type RepositoryDecision = Readonly<{
  available: boolean;
  repositoryName: string;
  repositoryStatus: string;
  selectedDecision: string;
  packageType: string;
  confidence: string;
  handoffReadiness: string;
  executionAgents: readonly ExecutionAgent[];
  executionReady: string;
  decisionSummary: string;
  recommendedOwnerAction: string;
}>;

const emptyDecision = 'Not available — refresh repository intelligence in Agent IDE.';

function clean(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function firstValue(...values: unknown[]) {
  for (const value of values) {
    const normalized = clean(value);
    if (normalized) return normalized;
  }
  return '';
}

function selectedRankingCandidate(ranking: any) {
  if (!ranking || typeof ranking !== 'object') return null;
  const candidates = Array.isArray(ranking.candidates) ? ranking.candidates : [];
  const selected = ranking.selectedIssue ?? candidates.find((candidate: any) => candidate?.selected) ?? candidates[0] ?? null;
  if (!selected) return null;
  return candidates.find((candidate: any) => clean(candidate?.id) && candidate.id === selected.id) ?? selected;
}

function formatConfidence(activeRecommendation: any, selectedCandidate: any, quality: any, status: any) {
  const confidence = firstValue(
    status?.currentConfidence,
    activeRecommendation?.confidence,
    selectedCandidate?.confidence,
    quality?.confidence?.lineageConfidence?.confidence,
    quality?.confidence?.validationConfidence,
  );
  if (confidence) return confidence;
  if (typeof quality?.confidence?.score === 'number') return `${quality.confidence.score}/100`;
  return 'Unknown';
}

function formatHandoffReadiness(validation: any, healthMarkdown: string, status: any) {
  const statusReadiness = firstValue(status?.repositoryHandoffReadiness);
  if (statusReadiness) return statusReadiness;
  const direct = firstValue(validation?.status, validation?.readiness, validation?.handoffReadiness);
  if (direct && typeof validation?.overallScore === 'number') return `${direct} (${validation.overallScore}/100)`;
  if (direct) return direct;
  if (typeof validation?.overallScore === 'number') return `${validation.overallScore}/100`;
  const healthMatch = healthMarkdown.match(/(?:repository\s+handoff\s+readiness|handoff\s+readiness)\s*[:\-]\s*(.+)$/im);
  return clean(healthMatch?.[1]) || 'Unknown';
}

export type RepositoryDecisionInput = DecisionFlowInput & {
  repositoryName?: string;
  quality?: any;
  aiHandoffValidation?: any;
  healthMarkdown?: string;
};

export function createRepositoryDecision(input: RepositoryDecisionInput): RepositoryDecision {
  const selectedCandidate = input.selectedCandidate as any;
  const recommendation = input.recommendation as any;
  const flow = createRepositoryDecisionFlow(input);
  const repositoryName = firstValue(input.repositoryName, input.status?.repositoryName, 'Connected repository');
  const selectedDecision = flow.selectedDecisionTitle || emptyDecision;
  const decisionSummary = firstValue(selectedCandidate?.reason, recommendation?.displaySummary, recommendation?.explanation, recommendation?.whyItMatters, flow.whyThisDecisionExists);
  const model = {
    available: selectedDecision !== 'Refresh repository intelligence' && selectedDecision !== emptyDecision,
    repositoryName,
    repositoryStatus: flow.repositoryStatus,
    selectedDecision: selectedDecision === 'Refresh repository intelligence' ? emptyDecision : selectedDecision,
    packageType: flow.packageType,
    confidence: formatConfidence(recommendation, selectedCandidate, input.quality, input.status),
    handoffReadiness: formatHandoffReadiness(input.aiHandoffValidation, input.healthMarkdown ?? '', input.status),
    executionAgents: Object.freeze([...defaultExecutionAgents]),
    executionReady: flow.executionReadiness,
    decisionSummary: decisionSummary || 'Repository intelligence needs to be generated before a decision can be selected.',
    recommendedOwnerAction: flow.currentRequiredOwnerAction,
  };
  return Object.freeze(model);
}

export function createRepositoryDecisionFromArtifacts(input: RepositoryDecisionInput & { activeRecommendation?: any; decisionRanking?: any }): RepositoryDecision {
  const selectedCandidate = input.selectedCandidate ?? selectedRankingCandidate(input.decisionRanking);
  const recommendation = input.recommendation ?? input.activeRecommendation ?? (selectedCandidate ? { title: (selectedCandidate as any).title, packageType: (selectedCandidate as any).packageType, explanation: (selectedCandidate as any).reason } : null);
  return createRepositoryDecision({ ...input, recommendation, selectedCandidate });
}

export { emptyDecision as emptyRepositoryDecision };
