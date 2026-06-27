export type WorkflowType = 'Product Decision' | 'Implementation' | 'Validation' | 'Investigation' | 'Documentation';
export type WorkflowStatus = 'Not Started' | 'In Progress' | 'Waiting For User' | 'Ready To Refresh' | 'Complete';

export type WorkflowStep = {
  id: string;
  label: string;
  primaryAction: string;
  status: WorkflowStatus;
};

export type Workflow = {
  type: WorkflowType;
  goal: string;
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
  status: WorkflowStatus;
  completedStepIds: string[];
};

export const workflowStateStorageKey = 'agent-ide:workflow-state';

type WorkflowInput = {
  packageType?: 'implementation' | 'product-decision' | 'validation-experiment';
  category?: string;
  title?: string;
  ownerAction?: string;
  recommendationTitle?: string;
};

const workflowDefinitions: Record<WorkflowType, { goal: string; steps: Array<Omit<WorkflowStep, 'status'>> }> = {
  'Product Decision': {
    goal: 'Clarify the current product bet.',
    steps: [
      { id: 'review-canonical-edit', label: 'Review Canonical Edit', primaryAction: 'Review Canonical Edit' },
      { id: 'edit-proposal', label: 'Edit Proposal', primaryAction: 'Edit Proposal' },
      { id: 'apply-canonical-edit', label: 'Apply Canonical Edit', primaryAction: 'Apply Canonical Edit' },
      { id: 'refresh-intelligence', label: 'Refresh Intelligence', primaryAction: 'Refresh Intelligence' },
    ],
  },
  Implementation: {
    goal: 'Implement the deterministic improvement.',
    steps: [
      { id: 'launch-builder', label: 'Launch Builder', primaryAction: 'Launch Builder' },
      { id: 'review-output', label: 'Review', primaryAction: 'Continue' },
      { id: 'run-tests', label: 'Run Tests', primaryAction: 'Continue' },
      { id: 'refresh-intelligence', label: 'Refresh Intelligence', primaryAction: 'Refresh Intelligence' },
    ],
  },
  Validation: {
    goal: 'Verify repository intelligence with a fresh AI handoff.',
    steps: [
      { id: 'copy-context-package', label: 'Copy Context Package', primaryAction: 'Copy Context Package' },
      { id: 'copy-validation-prompt', label: 'Copy Validation Prompt', primaryAction: 'Copy Validation Prompt' },
      { id: 'open-fresh-ai', label: 'Open Fresh AI', primaryAction: 'Continue' },
      { id: 'paste-prompt', label: 'Paste Prompt', primaryAction: 'Continue' },
      { id: 'refresh-intelligence', label: 'Refresh Intelligence', primaryAction: 'Refresh Intelligence' },
    ],
  },
  Investigation: {
    goal: 'Resolve ambiguity before implementation.',
    steps: [
      { id: 'review-question', label: 'Review Question', primaryAction: 'Review Question' },
      { id: 'inspect-evidence', label: 'Inspect Evidence', primaryAction: 'Continue' },
      { id: 'record-finding', label: 'Record Finding', primaryAction: 'Continue' },
      { id: 'refresh-intelligence', label: 'Refresh Intelligence', primaryAction: 'Refresh Intelligence' },
    ],
  },
  Documentation: {
    goal: 'Improve repository documentation.',
    steps: [
      { id: 'review-documentation-gap', label: 'Review Documentation Gap', primaryAction: 'Review Documentation Gap' },
      { id: 'edit-documentation', label: 'Edit Documentation', primaryAction: 'Continue' },
      { id: 'review-diff', label: 'Review Diff', primaryAction: 'Continue' },
      { id: 'refresh-intelligence', label: 'Refresh Intelligence', primaryAction: 'Refresh Intelligence' },
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
  const status = stateMatches ? state.status : 'Not Started';
  const completedIds = new Set(stateMatches ? state.completedStepIds : definition.steps.slice(0, currentIndex).map((step) => step.id));
  const checklist = definition.steps.map((step, index) => ({
    ...step,
    status: completedIds.has(step.id) || index < currentIndex ? 'Complete' : index === currentIndex ? status : 'Not Started',
  }));
  const currentStep = checklist[currentIndex] ?? checklist[0];
  const completedSteps = checklist.filter((step) => step.status === 'Complete');
  return {
    type,
    goal: definition.goal,
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
  const completedStepIds = Array.from(new Set([...(current?.workflowKey === key ? current.completedStepIds : []), definition.steps[currentIndex].id]));
  const nextStep = definition.steps[currentIndex + 1];
  return { workflowKey: key, currentStepId: nextStep?.id ?? definition.steps[currentIndex].id, completedStepIds, status: nextStep ? 'In Progress' : 'Ready To Refresh' };
}

export function workflowDefinitionsForTests() {
  return workflowDefinitions;
}
