import { createDecisionFlow, defaultExecutionAgents, type DecisionFlowInput, type ExecutionAgent } from './decision-flow';

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
  const flow = createDecisionFlow(input);
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
