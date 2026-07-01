export type DecisionPackageType = 'implementation' | 'validation-experiment' | 'product-decision' | 'investigation' | 'documentation';
export type RequiredOwnerAction = 'Review decision' | 'Choose execution agent' | 'Perform external work' | 'Record outcome evidence' | 'Approve canonical intent' | 'Refresh repository intelligence';
export type ExecutionReadiness = 'ready' | 'external-work-pending' | 'outcome-needed' | 'refresh-ready' | 'refresh-running' | 'blocked';
export type ExecutionAgent = 'Claude' | 'Codex' | 'ChatGPT' | 'Gemini' | 'Generic';

export type RepositoryDecisionRecommendation = {
  title?: string;
  displayTitle?: string;
  displaySummary?: string;
  explanation?: string;
  whyItMatters?: string;
  packageType?: 'implementation' | 'product-decision' | 'validation-experiment' | 'task-clarification' | string;
  evidenceSource?: string;
  canonicalIntelligenceState?: 'existing' | 'missing';
  confidence?: string;
};

export type RepositoryDecisionCandidate = {
  id?: string;
  title?: string;
  category?: string;
  reason?: string;
  ownerAction?: string;
  source?: string;
  packageType?: string;
  selected?: boolean;
  confidence?: string;
};

export type RepositoryDecisionStatus = {
  repositoryName?: string;
  overallHealth?: string;
  repositoryHandoffReadiness?: string;
  currentConfidence?: string;
  lastRefresh?: string;
};

export type RepositoryDecisionWorkflow = { type?: string; repositoryState?: string; completionState?: string; currentStep?: { id?: string } };

export const repositoryDecisionExecutionAgents: ExecutionAgent[] = ['Claude', 'Codex', 'ChatGPT', 'Gemini', 'Generic'];

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


export function repositoryDecisionPackageType(input: Pick<RepositoryDecisionInput, 'recommendation' | 'selectedCandidate' | 'workflow'>): DecisionPackageType {
  if (input.recommendation?.packageType === 'product-decision') return 'product-decision';
  if (input.recommendation?.packageType === 'validation-experiment') return 'validation-experiment';
  if (input.recommendation?.packageType === 'implementation') return 'implementation';
  const text = `${input.selectedCandidate?.category ?? ''} ${input.selectedCandidate?.title ?? ''} ${input.selectedCandidate?.ownerAction ?? ''} ${input.recommendation?.title ?? ''} ${input.workflow?.type ?? ''}`;
  if (/documentation|docs/i.test(text)) return 'documentation';
  if (/investigat|unknown|risk|explain/i.test(text)) return 'investigation';
  return 'implementation';
}

function formatRepositoryStatus(status: RepositoryDecisionStatus | undefined) {
  return [status?.repositoryName, status?.overallHealth, status?.repositoryHandoffReadiness, status?.currentConfidence].filter(Boolean).join(' · ') || 'Repository intelligence not loaded';
}

function isExternalWorkStep(step: { id?: string } | null | undefined) {
  return Boolean(step?.id && ['open-codex', 'run-implementation', 'open-chatgpt', 'paste-response', 'edit-documentation'].includes(step.id));
}

export function repositoryOwnerActionFor(input: Pick<RepositoryDecisionInput, 'isRefreshing' | 'workflow' | 'hasOutcomeEvidenceForCurrentDecision'>, packageType: DecisionPackageType): RequiredOwnerAction {
  if (input.isRefreshing) return 'Refresh repository intelligence';
  const workflow = input.workflow;
  if (!workflow) return 'Refresh repository intelligence';
  if (workflow.repositoryState === 'Refresh Repository' || workflow.completionState === 'Ready To Refresh') return 'Refresh repository intelligence';
  if (isExternalWorkStep(workflow.currentStep)) return input.hasOutcomeEvidenceForCurrentDecision ? 'Perform external work' : 'Record outcome evidence';
  if (packageType === 'product-decision') return 'Approve canonical intent';
  return 'Choose execution agent';
}

export function repositoryReadinessFor(input: Pick<RepositoryDecisionInput, 'isRefreshing' | 'recommendation'>, ownerAction: RequiredOwnerAction): ExecutionReadiness {
  if (input.isRefreshing) return 'refresh-running';
  if (ownerAction === 'Refresh repository intelligence') return 'refresh-ready';
  if (ownerAction === 'Perform external work') return 'external-work-pending';
  if (ownerAction === 'Record outcome evidence') return 'outcome-needed';
  return input.recommendation ? 'ready' : 'blocked';
}

export type RepositoryDecisionInput = {
  repositoryName?: string;
  status?: RepositoryDecisionStatus;
  recommendation?: RepositoryDecisionRecommendation | null;
  activeRecommendation?: RepositoryDecisionRecommendation | null;
  selectedCandidate?: RepositoryDecisionCandidate | null;
  decisionRanking?: any;
  workflow?: RepositoryDecisionWorkflow | null;
  isRefreshing?: boolean;
  hasOutcomeEvidenceForCurrentDecision?: boolean;
  debugReferences?: string[];
  quality?: any;
  aiHandoffValidation?: any;
  healthMarkdown?: string;
};

export function createRepositoryDecision(input: RepositoryDecisionInput): RepositoryDecision {
  const selectedCandidate = input.selectedCandidate as any;
  const recommendation = input.recommendation as any;
  const packageType = repositoryDecisionPackageType(input);
  const recommendedOwnerAction = repositoryOwnerActionFor(input, packageType);
  const repositoryName = firstValue(input.repositoryName, input.status?.repositoryName, 'Connected repository');
  const repositoryStatus = formatRepositoryStatus(input.status);
  const selectedDecision = selectedCandidate?.title ?? recommendation?.displayTitle ?? recommendation?.title ?? 'Refresh repository intelligence';
  const fallbackSummary = 'Repository intelligence needs to be generated before a decision can be selected.';
  const decisionSummary = firstValue(selectedCandidate?.reason, recommendation?.displaySummary, recommendation?.explanation, recommendation?.whyItMatters, fallbackSummary);
  const model = {
    available: selectedDecision !== 'Refresh repository intelligence' && selectedDecision !== emptyDecision,
    repositoryName,
    repositoryStatus,
    selectedDecision: selectedDecision === 'Refresh repository intelligence' ? emptyDecision : selectedDecision,
    packageType,
    confidence: formatConfidence(recommendation, selectedCandidate, input.quality, input.status),
    handoffReadiness: formatHandoffReadiness(input.aiHandoffValidation, input.healthMarkdown ?? '', input.status),
    executionAgents: Object.freeze([...repositoryDecisionExecutionAgents]),
    executionReady: repositoryReadinessFor(input, recommendedOwnerAction),
    decisionSummary,
    recommendedOwnerAction,
  };
  return Object.freeze(model);
}

export function createRepositoryDecisionFromArtifacts(input: RepositoryDecisionInput): RepositoryDecision {
  const selectedCandidate = input.selectedCandidate ?? selectedRankingCandidate(input.decisionRanking);
  const recommendation = input.recommendation ?? input.activeRecommendation ?? (selectedCandidate ? { title: (selectedCandidate as any).title, packageType: (selectedCandidate as any).packageType, explanation: (selectedCandidate as any).reason } : null);
  return createRepositoryDecision({ ...input, recommendation, selectedCandidate });
}

export { emptyDecision as emptyRepositoryDecision };
