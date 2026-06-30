export type DecisionPackageType = 'implementation' | 'validation-experiment' | 'product-decision' | 'investigation' | 'documentation';
export type RequiredOwnerAction = 'Review decision' | 'Choose execution agent' | 'Perform external work' | 'Record outcome evidence' | 'Approve canonical intent' | 'Refresh repository intelligence';
export type ExecutionReadiness = 'ready' | 'external-work-pending' | 'outcome-needed' | 'refresh-ready' | 'refresh-running' | 'blocked';
export type ExecutionAgent = 'Claude' | 'Codex' | 'ChatGPT' | 'Gemini' | 'Generic';

export type ExecutionPackage = {
  packageType: DecisionPackageType;
  executionAgent: ExecutionAgent;
  packageBody: string;
  packageSections: Array<{ title: string; body: string }>;
  validationRequired: boolean;
  implementationRequired: boolean;
  packageVersion: string;
};

export type ExecutionPackageInput = {
  packageType: DecisionPackageType;
  executionAgent: ExecutionAgent;
  repositoryMetadata?: Record<string, string | undefined>;
  repositoryContextPackage?: string;
  understandingPrompt?: string;
  implementationPrompt?: string;
  decisionTitle?: string;
  decisionReason?: string;
};

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

export type DecisionFlow = {
  repositoryStatus: string;
  selectedDecisionTitle: string;
  whyThisDecisionExists: string;
  currentRequiredOwnerAction: RequiredOwnerAction;
  executionReadiness: ExecutionReadiness;
  availableExecutionAgents: ExecutionAgent[];
  executionPackages?: ExecutionPackage[];
  packageType: DecisionPackageType;
  outcomeRecordingNeeded: boolean;
  refresh: { ready: boolean; running: boolean };
  advancedDebugDataReferences: string[];
};

export const defaultExecutionAgents: ExecutionAgent[] = ['Claude', 'ChatGPT', 'Codex', 'Gemini', 'Generic'];
export const executionPackageVersion = 'execution-package/v1';

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

export function createDecisionFlow(input: DecisionFlowInput): DecisionFlow {
  const status = input.status ?? {};
  const recommendation = input.recommendation;
  const selectedCandidate = input.selectedCandidate;
  const packageType = decisionPackageType(input);
  const currentRequiredOwnerAction = ownerActionFor(input, packageType);
  const executionReadiness = readinessFor(input, currentRequiredOwnerAction);
  const repositoryStatus = [status.repositoryName, status.overallHealth, status.repositoryHandoffReadiness, status.currentConfidence].filter(Boolean).join(' · ') || 'Repository intelligence not loaded';
  const selectedDecisionTitle = selectedCandidate?.title ?? recommendation?.displayTitle ?? recommendation?.title ?? 'Refresh repository intelligence';
  const whyThisDecisionExists = selectedCandidate?.reason ?? recommendation?.explanation ?? recommendation?.whyItMatters ?? 'Repository intelligence needs to be generated before a decision can be selected.';
  const outcomeRecordingNeeded = executionReadiness === 'outcome-needed' || executionReadiness === 'external-work-pending';
  return {
    repositoryStatus,
    selectedDecisionTitle,
    whyThisDecisionExists,
    currentRequiredOwnerAction,
    executionReadiness,
    availableExecutionAgents: defaultExecutionAgents,
    executionPackages: [],
    packageType,
    outcomeRecordingNeeded,
    refresh: { ready: currentRequiredOwnerAction === 'Refresh repository intelligence', running: Boolean(input.isRefreshing) },
    advancedDebugDataReferences: input.debugReferences ?? ['workflow', 'decisionRanking', 'repositoryJudgment', 'productJudgment', 'generatedArtifacts', 'promptPackages'],
  };
}


function removeEmbeddedContextPackage(prompt: string, contextPackage: string) {
  const trimmedContext = contextPackage.trim();
  if (!trimmedContext) return prompt.trim();
  return prompt.replace(trimmedContext, '').replace(/\n?---\s*$/m, '').trim();
}

export function createExecutionPackage(input: ExecutionPackageInput): ExecutionPackage {
  const repositoryContextPackage = input.repositoryContextPackage?.trim() ?? '';
  const understandingPrompt = input.understandingPrompt?.trim() && repositoryContextPackage ? removeEmbeddedContextPackage(input.understandingPrompt, repositoryContextPackage) : input.understandingPrompt?.trim();
  const validationRequired = input.packageType === 'validation-experiment' || Boolean(understandingPrompt);
  const implementationRequired = input.packageType !== 'validation-experiment' && Boolean(input.implementationPrompt?.trim());
  const sections: Array<{ title: string; body: string }> = [];
  if (input.decisionTitle || input.decisionReason) sections.push({ title: 'Task', body: [input.decisionTitle, input.decisionReason].filter(Boolean).join('\n\n') });
  sections.push({ title: 'Required Execution Instructions', body: 'Use this single execution package as the complete repository-local artifact. Do not ask the repository owner for a second clipboard package before responding. Return your result so the owner can record the outcome in Agent IDE and refresh Repository Intelligence.' });
  if (implementationRequired && input.implementationPrompt?.trim()) sections.push({ title: 'Implementation Instructions', body: input.implementationPrompt.trim() });
  if (validationRequired && understandingPrompt) sections.push({ title: 'Understanding Check', body: understandingPrompt });
  if (repositoryContextPackage) sections.push({ title: 'Context Package', body: repositoryContextPackage });
  sections.push({ title: 'Execution Agent', body: input.executionAgent });
  sections.push({ title: 'Package Metadata', body: [`Package Type: ${input.packageType}`, `Package Version: ${executionPackageVersion}`, ...Object.entries(input.repositoryMetadata ?? {}).filter(([, value]) => Boolean(value)).map(([key, value]) => `${key}: ${value}`)].join('\n') });
  return {
    packageType: input.packageType,
    executionAgent: input.executionAgent,
    packageBody: sections.map((section) => `## ${section.title}\n${section.body}`).join('\n\n'),
    packageSections: sections,
    validationRequired,
    implementationRequired,
    packageVersion: executionPackageVersion,
  };
}
