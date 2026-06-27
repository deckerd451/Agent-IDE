export type RepositoryWorkflowState =
  | 'Repository Not Connected'
  | 'Refresh Repository Intelligence'
  | 'Repository Analysis Running'
  | 'Recommendation Ready'
  | 'Workflow In Progress'
  | 'Waiting for External Work (Codex / ChatGPT / User)'
  | 'Validate Result'
  | 'Refresh Repository'
  | 'Complete'
  | 'Next Recommendation Ready';

export type WorkflowType = 'Product Decision' | 'Implementation' | 'Validation' | 'Investigation' | 'Documentation';
export type WorkflowStatus = 'Not Started' | 'In Progress' | 'Waiting For User' | 'Ready To Refresh' | 'Complete';

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
};

type StepDefinition = Omit<WorkflowStep, 'status'>;

const workflowDefinitions: Record<WorkflowType, { goal: string; steps: StepDefinition[] }> = {
  'Product Decision': {
    goal: 'Turn the recommended product decision into approved repository intent.',
    steps: [
      { id: 'review-canonical-edit', label: 'Review the proposed canonical decision', primaryAction: 'Review Canonical Edit', state: 'Recommendation Ready', nextState: 'Workflow In Progress' },
      { id: 'edit-proposal', label: 'Edit or approve the owner-authored decision', primaryAction: 'Approve Decision Text', state: 'Workflow In Progress', nextState: 'Waiting for External Work (Codex / ChatGPT / User)' },
      { id: 'apply-canonical-edit', label: 'Apply the canonical edit to repository intelligence', primaryAction: 'Apply Canonical Edit', state: 'Waiting for External Work (Codex / ChatGPT / User)', nextState: 'Validate Result' },
      { id: 'validate-result', label: 'Validate the updated repository intelligence', primaryAction: 'Validate Result', state: 'Validate Result', nextState: 'Refresh Repository' },
      { id: 'refresh-repository', label: 'Refresh repository intelligence', primaryAction: 'Refresh Repository Intelligence', state: 'Refresh Repository', nextState: 'Repository Analysis Running' },
    ],
  },
  Implementation: {
    goal: 'Execute the recommended repository improvement.',
    steps: [
      { id: 'copy-implementation-prompt', label: 'Copy the implementation prompt', primaryAction: 'Copy Implementation Prompt', state: 'Recommendation Ready', nextState: 'Workflow In Progress' },
      { id: 'open-codex', label: 'Open Codex or your coding agent', primaryAction: 'Open Codex', state: 'Workflow In Progress', nextState: 'Waiting for External Work (Codex / ChatGPT / User)' },
      { id: 'run-implementation', label: 'Complete the implementation outside Agent IDE', primaryAction: 'Mark External Work Complete', state: 'Waiting for External Work (Codex / ChatGPT / User)', nextState: 'Validate Result' },
      { id: 'validate-result', label: 'Run or review validation checks', primaryAction: 'Validate Result', state: 'Validate Result', nextState: 'Refresh Repository' },
      { id: 'refresh-repository', label: 'Refresh repository intelligence', primaryAction: 'Refresh Repository Intelligence', state: 'Refresh Repository', nextState: 'Repository Analysis Running' },
    ],
  },
  Validation: {
    goal: 'Verify repository intelligence with a fresh AI handoff.',
    steps: [
      { id: 'copy-context-package', label: 'Copy Context Package', primaryAction: 'Copy Context Package', state: 'Recommendation Ready', nextState: 'Workflow In Progress' },
      { id: 'copy-understanding-check', label: 'Copy Understanding Check', primaryAction: 'Copy Understanding Check', state: 'Workflow In Progress', nextState: 'Waiting for External Work (Codex / ChatGPT / User)' },
      { id: 'open-chatgpt', label: 'Open ChatGPT', primaryAction: 'Open ChatGPT', state: 'Waiting for External Work (Codex / ChatGPT / User)', nextState: 'Workflow In Progress' },
      { id: 'paste-response', label: 'Paste the AI response back into Agent IDE', primaryAction: 'Paste Validation Response', state: 'Workflow In Progress', nextState: 'Validate Result' },
      { id: 'run-validation', label: 'Run validation', primaryAction: 'Run Validation', state: 'Validate Result', nextState: 'Refresh Repository' },
      { id: 'refresh-repository', label: 'Refresh repository intelligence', primaryAction: 'Refresh Repository Intelligence', state: 'Refresh Repository', nextState: 'Repository Analysis Running' },
    ],
  },
  Investigation: {
    goal: 'Resolve the ambiguity that blocks safe implementation.',
    steps: [
      { id: 'review-question', label: 'Review the blocking question', primaryAction: 'Review Question', state: 'Recommendation Ready', nextState: 'Workflow In Progress' },
      { id: 'inspect-evidence', label: 'Inspect the cited evidence', primaryAction: 'Inspect Evidence', state: 'Workflow In Progress', nextState: 'Waiting for External Work (Codex / ChatGPT / User)' },
      { id: 'record-finding', label: 'Record the finding', primaryAction: 'Record Finding', state: 'Waiting for External Work (Codex / ChatGPT / User)', nextState: 'Validate Result' },
      { id: 'validate-result', label: 'Validate the finding', primaryAction: 'Validate Result', state: 'Validate Result', nextState: 'Refresh Repository' },
      { id: 'refresh-repository', label: 'Refresh repository intelligence', primaryAction: 'Refresh Repository Intelligence', state: 'Refresh Repository', nextState: 'Repository Analysis Running' },
    ],
  },
  Documentation: {
    goal: 'Convert the documentation recommendation into a repository update.',
    steps: [
      { id: 'review-documentation-gap', label: 'Review the documentation gap', primaryAction: 'Review Documentation Gap', state: 'Recommendation Ready', nextState: 'Workflow In Progress' },
      { id: 'edit-documentation', label: 'Edit documentation', primaryAction: 'Edit Documentation', state: 'Workflow In Progress', nextState: 'Waiting for External Work (Codex / ChatGPT / User)' },
      { id: 'review-diff', label: 'Review the documentation diff', primaryAction: 'Review Diff', state: 'Waiting for External Work (Codex / ChatGPT / User)', nextState: 'Validate Result' },
      { id: 'validate-result', label: 'Validate documentation output', primaryAction: 'Validate Result', state: 'Validate Result', nextState: 'Refresh Repository' },
      { id: 'refresh-repository', label: 'Refresh repository intelligence', primaryAction: 'Refresh Repository Intelligence', state: 'Refresh Repository', nextState: 'Repository Analysis Running' },
    ],
  },
};

export function workflowTypeForInput(input: WorkflowInput): WorkflowType {
  if (input.packageType === 'product-decision') return 'Product Decision';
  if (input.packageType === 'validation-experiment') return 'Validation';
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

export function workflowDefinitionsForTests() {
  return workflowDefinitions;
}
