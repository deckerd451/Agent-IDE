export type RepositoryWorkflowState =
  | 'Repository Not Connected'
  | 'Refresh Repository Intelligence'
  | 'Repository Analysis Running'
  | 'Repository Decision Ready'
  | 'Execution Package Ready'
  | 'Waiting For External AI'
  | 'Record Outcome'
  | 'Refresh Repository'
  | 'Complete'
  | 'Next Recommendation Ready';

export type WorkflowType = 'Product Decision' | 'Implementation' | 'Validation' | 'Investigation' | 'Documentation';
export type WorkflowStatus = 'Not Started' | 'In Progress' | 'Waiting For User' | 'Ready To Refresh' | 'Complete';
export type WorkflowStepClassification = 'user-action-required' | 'external-work-required' | 'auto-advance' | 'refresh-only';

export type WorkflowStep = {
  id: string;
  label: string;
  primaryAction: string;
  state: RepositoryWorkflowState;
  nextState: RepositoryWorkflowState;
  status: WorkflowStatus;
};

export type Workflow = {
  workflowKey: string;
  type: WorkflowType;
  goal: string;
  repositoryState: RepositoryWorkflowState;
  nextRepositoryState: RepositoryWorkflowState;
  checklist: WorkflowStep[];
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  progressPercentage: number;
  estimatedRemainingSteps: number;
  currentPrimaryAction: string;
  completionState: WorkflowStatus;
};

export type WorkflowState = {
  workflowKey: string;
  currentStepId: string;
  repositoryState: RepositoryWorkflowState;
  status: WorkflowStatus;
  completedStepIds: string[];
};


export const workflowStateStorageKey = 'agent-ide:workflow-state';

export type WorkflowInput = {
  packageType?: 'implementation' | 'product-decision' | 'validation-experiment';
  category?: string;
  title?: string;
  ownerAction?: string;
  recommendationTitle?: string;
  canonicalIntelligenceState?: 'existing' | 'missing';
};

type StepDefinition = Omit<WorkflowStep, 'status'>;


const workflowStepClassifications: Record<string, WorkflowStepClassification> = {
  'prepare-execution-package': 'user-action-required',
  'waiting-for-external-ai': 'external-work-required',
  'record-outcome': 'external-work-required',
  'refresh-repository': 'refresh-only',
};

export function classifyWorkflowStep(step: Pick<WorkflowStep, 'id'> | null | undefined): WorkflowStepClassification {
  if (!step) return 'user-action-required';
  return workflowStepClassifications[step.id] ?? 'user-action-required';
}

export function workflowStepRequiresUserClick(step: Pick<WorkflowStep, 'id'> | null | undefined) {
  return classifyWorkflowStep(step) === 'user-action-required' || classifyWorkflowStep(step) === 'external-work-required';
}

const repositoryDecisionSteps = (goal: string): { goal: string; steps: StepDefinition[] } => ({
  goal,
  steps: [
    { id: 'prepare-execution-package', label: 'Execution Package Ready', primaryAction: 'Choose Execution Agent', state: 'Repository Decision Ready', nextState: 'Execution Package Ready' },
    { id: 'waiting-for-external-ai', label: 'Waiting For External AI', primaryAction: 'Waiting For External AI', state: 'Execution Package Ready', nextState: 'Waiting For External AI' },
    { id: 'record-outcome', label: 'Record Outcome', primaryAction: 'Record Outcome', state: 'Waiting For External AI', nextState: 'Record Outcome' },
    { id: 'refresh-repository', label: 'Refresh Repository Intelligence', primaryAction: 'Refresh Repository Intelligence', state: 'Record Outcome', nextState: 'Repository Analysis Running' },
  ],
});

const workflowDefinitions: Record<WorkflowType, { goal: string; steps: StepDefinition[] }> = {
  'Product Decision': repositoryDecisionSteps('Turn the recommended product decision into approved repository intent.'),
  Implementation: repositoryDecisionSteps('Execute the recommended repository improvement.'),
  Validation: repositoryDecisionSteps('Verify repository intelligence with a fresh AI handoff.'),
  Investigation: repositoryDecisionSteps('Resolve the ambiguity that blocks safe implementation.'),
  Documentation: repositoryDecisionSteps('Convert the documentation recommendation into a repository update.'),
};

export function workflowTypeForInput(input: WorkflowInput): WorkflowType {
  if (input.packageType === 'product-decision') return 'Product Decision';
  if (input.packageType === 'validation-experiment') return 'Validation';
  if (input.packageType === 'implementation') return 'Implementation';
  const text = `${input.category ?? ''} ${input.title ?? ''} ${input.ownerAction ?? ''} ${input.recommendationTitle ?? ''}`;
  if (/documentation|docs/i.test(text)) return 'Documentation';
  if (/investigat|unknown|risk|explain/i.test(text)) return 'Investigation';
  return 'Implementation';
}

export function workflowKey(input: WorkflowInput) {
  return [workflowTypeForInput(input), input.packageType ?? 'implementation', input.title ?? input.recommendationTitle ?? 'current-work'].join(':');
}

export function createWorkflow(input: WorkflowInput, state?: WorkflowState | null): Workflow {
  const type = workflowTypeForInput(input);
  const definition = workflowDefinitions[type];
  const stateMatches = state?.workflowKey === workflowKey(input);
  const currentStepId = stateMatches ? state.currentStepId : definition.steps[0].id;
  const currentIndex = Math.max(0, definition.steps.findIndex((step) => step.id === currentStepId));
  const currentDefinition = definition.steps[currentIndex] ?? definition.steps[0];
  const status = stateMatches ? state.status : 'Not Started';
  const completedIds = new Set(stateMatches ? state.completedStepIds : definition.steps.slice(0, currentIndex).map((step) => step.id));
  const checklist = definition.steps.map((step, index) => ({
    ...step,
    ...(type === 'Product Decision' && index === 0 && input.canonicalIntelligenceState === 'missing' ? { label: 'Create missing canonical intelligence', primaryAction: 'Create Canonical Intelligence' } : {}),
    ...(type === 'Product Decision' && index === 0 && input.canonicalIntelligenceState === 'existing' ? { label: 'Review existing canonical intelligence', primaryAction: 'Review Existing Canonical Intelligence' } : {}),
    status: completedIds.has(step.id) || index < currentIndex ? 'Complete' : index === currentIndex ? status : 'Not Started',
  }));
  const currentStep = checklist[currentIndex] ?? checklist[0];
  const completedSteps = checklist.filter((step) => step.status === 'Complete');
  return {
    workflowKey: workflowKey(input),
    type,
    goal: definition.goal,
    repositoryState: stateMatches ? state.repositoryState : currentDefinition.state,
    nextRepositoryState: currentStep.nextState,
    checklist,
    currentStep,
    completedSteps,
    progressPercentage: Math.round((completedSteps.length / checklist.length) * 100),
    estimatedRemainingSteps: Math.max(0, checklist.length - completedSteps.length),
    currentPrimaryAction: currentStep.primaryAction,
    completionState: status,
  };
}

export function advanceWorkflow(input: WorkflowInput, current?: WorkflowState | null): WorkflowState {
  const key = workflowKey(input);
  const definition = workflowDefinitions[workflowTypeForInput(input)];
  const currentIndex = Math.max(0, definition.steps.findIndex((step) => step.id === (current?.workflowKey === key ? current.currentStepId : definition.steps[0].id)));
  const currentStep = definition.steps[currentIndex];
  const completedStepIds = Array.from(new Set([...(current?.workflowKey === key ? current.completedStepIds : []), currentStep.id]));
  const nextStep = definition.steps[currentIndex + 1];
  return { workflowKey: key, currentStepId: nextStep?.id ?? currentStep.id, repositoryState: nextStep?.state ?? currentStep.nextState, completedStepIds, status: nextStep ? 'In Progress' : 'Ready To Refresh' };
}

export function contextSnapshotHash(value = '') {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  return `djb2-${hash.toString(16).padStart(8, '0')}`;
}

