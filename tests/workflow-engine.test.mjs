import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { advanceWorkflow, classifyWorkflowStep, createWorkflow, workflowStepRequiresUserClick } from '../src/workflow.ts';

const workflowSource = await readFile(new URL('../src/workflow.ts', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('workflow engine supports every package type with one deterministic workflow', () => {
  for (const expected of [
    "'Product Decision'",
    "'Implementation'",
    "'Validation'",
    "'Investigation'",
    "'Documentation'",
    "packageType === 'product-decision'",
    "packageType === 'validation-experiment'",
    'return \'Implementation\'',
  ]) assert.match(workflowSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('finite state machine enumerates every repository state and forces state-changing primary actions', () => {
  for (const expected of [
    'Repository Not Connected',
    'Refresh Repository Intelligence',
    'Repository Analysis Running',
    'Repository Decision Ready',
    'Execution Package Ready',
    'Waiting For External AI',
    'Record Outcome',
    'Refresh Repository',
    'Complete',
    'Next Recommendation Ready',
  ]) assert.match(workflowSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(workflowSource, /repositoryState: RepositoryWorkflowState/);
  assert.match(workflowSource, /nextState: RepositoryWorkflowState/);
  assert.match(workflowSource, /currentPrimaryAction: currentStep\.primaryAction/);
  assert.match(workflowSource, /nextRepositoryState: currentStep\.nextState/);
  assert.doesNotMatch(workflowSource, /Math\.random|Date\.now/);
});

test('workflow state persists locally and resumes after reload', () => {
  assert.match(workflowSource, /WorkflowState/);
  assert.match(workflowSource, /'Not Started' \| 'In Progress' \| 'Waiting For User' \| 'Ready To Refresh' \| 'Complete'/);
  assert.match(appSource, /window\.localStorage\.getItem\(workflowStateStorageKey\)/);
  assert.match(appSource, /window\.localStorage\.setItem\(workflowStateStorageKey, JSON\.stringify\(workflowState\)\)/);
});

test('work queue presents one repository-decision action surface while diagnostics remain advanced', () => {
  for (const expected of ['Work Queue', 'Repository improving', 'recommendationReason', 'singleRecommendationCard', 'Advanced Repository Intelligence', 'Refresh Repository Intelligence', 'stepToUserTask', 'currentTaskCard', 'Repository is up to date']) {
    assert.match(appSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(appSource, /function primaryHomepageAction\(workflow\?: Workflow \| null\)/);
  assert.match(appSource, /return outcomeWorkflowText\(workflow\.currentPrimaryAction\)/);
  assert.match(appSource, /function RepositoryDecisionActionSurface/);
  assert.match(appSource, /data-decision-flow-primary-action="true"/);
  assert.match(appSource, /<details className="controlCard disclosureCard advancedIntelligence" aria-label="Advanced Repository Intelligence"><summary>Advanced<\/summary>/);
});


test('clicking the visible repository-decision primary action routes through workflow advancement', () => {
  assert.match(appSource, /function WorkflowPrimaryButton\(\{ workflow, onPrimaryAction \}: \{ workflow: Workflow; onPrimaryAction: \(\) => void \}\)/);
  assert.match(appSource, /data-workflow-primary-action="true" onClick=\{onPrimaryAction\}/);
  assert.match(appSource, /function RepositoryDecisionActionSurface/);
  assert.match(appSource, /data-decision-flow-primary-action="true"[^>]*onClick=\{isRefreshDecision \? onRefresh : onPrimaryAction\}/);
  assert.match(appSource, /\{workflow && <WorkflowProgress workflow=\{workflow\} onPrimaryAction=\{onPrimaryAction\} actionFeedback=\{actionFeedback\} \/>\}/);
  assert.match(appSource, /await performWorkflowStepAction\(currentWorkflow, controlPlane\);[\s\S]*const next = advanceWorkflow\(workflowInputForTask\(controlPlane\.recommendation, task\), workflowState\);[\s\S]*window\.localStorage\.setItem\(workflowStateStorageKey, JSON\.stringify\(next\)\);[\s\S]*setWorkflowState\(next\);/);
  assert.match(workflowSource, /\{ id: 'prepare-execution-package', label: 'Execution Package Ready', primaryAction: 'Choose Execution Agent', state: 'Repository Decision Ready', nextState: 'Execution Package Ready' \}/);
  for (const expected of ['Development Diagnostics', 'lastPrimaryActionClicked', 'performWorkflowStepActionRan', 'advanceWorkflowRan', 'setWorkflowStateRan', 'localStoragePersistenceSucceeded', 'currentLocalStorageValue']) {
    assert.match(appSource, new RegExp(expected));
  }
});

test('copy-only buttons are demoted and cannot be the sole primary CTA', () => {
  const workflowPrimaryStart = appSource.indexOf('function WorkflowPrimaryButton');
  const workflowPrimaryEnd = appSource.indexOf('function WorkflowProgress', workflowPrimaryStart);
  const workflowPrimarySource = appSource.slice(workflowPrimaryStart, workflowPrimaryEnd);
  assert.doesNotMatch(workflowPrimarySource, /copyText\(/);
  assert.match(workflowPrimarySource, /onClick=\{onPrimaryAction\}/);
  assert.match(appSource, /Copy-only: \{label\}/);
  assert.doesNotMatch(appSource, /<button className="primaryCta"[^>]*copyText/);
});


test('workflow actions expose visible feedback for primary CTA advancement and clipboard results', () => {
  assert.match(appSource, /workflowActionFeedback/);
  assert.match(appSource, /className="summary workflowActionFeedback" role="status"/);
  assert.match(appSource, /Copied implementation prompt/);
  assert.match(appSource, /Workflow advanced to \$\{outcomeWorkflowText\(advancedStep\.label\)\}\. Next: \$\{outcomeWorkflowText\(advancedStep\.primaryAction\)\}/);
  assert.match(appSource, /Outcome evidence was not saved; use Save Outcome/);
  assert.match(appSource, /Refresh started\. Next: wait for repository intelligence to finish updating\./);
  assert.match(appSource, /Refresh completed\. Next: review the updated Control Plane recommendation\./);
  assert.match(appSource, /Refresh failed: \$\{msg\}\. Next: fix the error and refresh again\./);
});

test('deterministic no-input bridge steps are relabeled as confirmations instead of URL or paste actions', () => {
  for (const expected of ['Confirm ChatGPT Is Open', 'Confirm Validation Response Reviewed', 'Confirm Validation Reviewed', 'Copy Prompt and Confirm Coding Agent Is Open']) {
    assert.ok(appSource.includes(expected), `${expected} should be rendered from workflow text normalization`);
  }
  assert.match(appSource, /replace\(\/Open ChatGPT\/gi, 'Confirm ChatGPT Is Open'\)/);
  assert.match(appSource, /replace\(\/Paste Validation Response\/gi, 'Confirm Validation Response Reviewed'\)/);
  assert.match(appSource, /replace\(\/Run Validation\/gi, 'Confirm Validation Reviewed'\)/);
});

test('terminal refresh step does not persist recommendation-affecting validation completion state before refresh and clears workflow state after', () => {
  assert.doesNotMatch(appSource, /localStorage\.setItem\(validationCompletionStorageKey/);
  assert.doesNotMatch(appSource, /persistValidationCompletion/);
  assert.match(appSource, /completionRecordPersistedBeforeRefresh: false/);
  assert.match(appSource, /clearWorkflow: isTerminalRefreshStep/);
  assert.match(appSource, /window\.localStorage\.removeItem\(workflowStateStorageKey\)/);
  assert.match(appSource, /workflowStateCleared: true/);
  assert.match(appSource, /refreshStepDetected/);
  assert.match(appSource, /refreshStarted/);
  assert.match(appSource, /refreshCompleted/);
  assert.match(appSource, /refreshError/);
  assert.match(appSource, /controlPlaneUpdated/);
  assert.match(appSource, /finalRecommendationTitle/);
  assert.match(appSource, /suppressionApplied/);
  for (const expected of ['refresh step detected', 'refresh started', 'refresh completed', 'refresh error', 'control plane updated', 'workflow state cleared', 'final recommendation title', 'suppression applied']) {
    assert.match(appSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('repository intelligence, rankings, and prompts are preserved by workflow-layer refactor', () => {
  assert.doesNotMatch(workflowSource, /writeFile|spawn|\bexec\(|fetch\(/);
  for (const expected of ['decisionRanking', 'data.recommendation.prompt', 'data.packages.builder', 'data.packages.reviewer', 'data.packages.debugger', 'buildValidationPrompt']) {
    assert.match(appSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('same recommendation after refresh emits visible loop diagnostic', () => {
  assert.match(appSource, /sameRecommendationLoop/);
  assert.match(appSource, /loopDiagnostic/);
  assert.match(appSource, /same recommendation loop detected/);
  assert.match(appSource, /loop diagnostic/);
  assert.match(appSource, /refreshedTitle === prevTitle/);
});

test('UX hides all FSM internals and exposes only user tasks', () => {
  assert.match(appSource, /function stepToUserTask/);
  assert.match(appSource, /function CurrentTaskCard/);
  assert.match(appSource, /function UpToDateCard/);
  assert.match(appSource, /Repository is up to date/);
  assert.match(appSource, /Copy this repository context into ChatGPT/);
  assert.match(appSource, /Copy this validation prompt into ChatGPT/);
  assert.match(appSource, /Copy this implementation prompt into your coding agent/);
  assert.doesNotMatch(appSource, /Recommendation Ready/);
  assert.doesNotMatch(appSource, /Workflow In Progress/);
  assert.doesNotMatch(appSource, /Waiting for External Work/);
});

test('workflow step classification is deterministic and preserves required user clicks', () => {
  assert.equal(classifyWorkflowStep({ id: 'prepare-execution-package' }), 'user-action-required');
  assert.equal(classifyWorkflowStep({ id: 'refresh-repository' }), 'refresh-only');
  for (const id of ['prepare-execution-package']) {
    assert.equal(classifyWorkflowStep({ id }), 'user-action-required', `${id} must require user action`);
    assert.equal(workflowStepRequiresUserClick({ id }), true, `${id} must require a click`);
  }
  for (const id of ['waiting-for-external-ai', 'record-outcome']) {
    assert.equal(classifyWorkflowStep({ id }), 'external-work-required', `${id} must wait for external/user completion`);
    assert.equal(workflowStepRequiresUserClick({ id }), true, `${id} must require a click`);
  }
});

test('repository-decision steps advance to refresh without clipboard-only states', () => {
  const input = { packageType: 'implementation', title: 'Execution package bridge' };
  let state = advanceWorkflow(input, null);
  state = advanceWorkflow(input, state);
  state = advanceWorkflow(input, state);
  const workflow = createWorkflow(input, state);
  assert.equal(workflow.currentStep.id, 'refresh-repository');
  assert.equal(classifyWorkflowStep(workflow.currentStep), 'refresh-only');
});

test('automatic workflow effect advances bridge steps and triggers refresh-only once', () => {
  assert.match(appSource, /function workflowStepClassification\(workflow\?: Workflow \| null\)/);
  assert.match(appSource, /function isAutomaticWorkflowStep\(workflow\?: Workflow \| null\)/);
  assert.match(appSource, /classification !== 'auto-advance' && classification !== 'refresh-only'/);
  assert.match(appSource, /lastStepActionResult: 'Auto-advanced acknowledgement-only bridge step'/);
  assert.match(appSource, /lastStepActionResult: 'Auto-started refresh-only workflow step'/);
  assert.match(appSource, /void refreshIntelligence\(\{ clearWorkflow: true, previousTitle \}\)/);
  assert.match(appSource, /autoWorkflowStepKeyRef\.current === autoKey/);
});

test('auto-advance preserves manual diagnostics fallback and visible refresh completion', () => {
  assert.match(workflowSource, /export type WorkflowStepClassification = 'user-action-required' \| 'external-work-required' \| 'auto-advance' \| 'refresh-only'/);
  assert.match(appSource, /data-workflow-manual-fallback="true"/);
  assert.match(appSource, /current step classification/);
  assert.match(appSource, /Refresh completed\. Next: review the updated Control Plane recommendation\./);
  assert.match(appSource, /window\.localStorage\.removeItem\(workflowStateStorageKey\)/);
});

test('implementation workflow first step prepares one execution package', () => {
  const workflow = createWorkflow({ packageType: 'implementation', title: 'Test' }, null);
  assert.equal(workflow.currentStep.id, 'prepare-execution-package');
});

test('implementation prompt is visible at both copy-implementation-prompt and open-codex steps', () => {
  const copyStep = appSource.match(/case 'copy-implementation-prompt':[^\n]+/)?.[0] ?? '';
  const openCodexStep = appSource.match(/case 'open-codex':[^\n]+/)?.[0] ?? '';
  assert.match(copyStep, /artifactType: 'implementation-prompt'/, 'copy-implementation-prompt must show implementation-prompt artifact');
  assert.match(openCodexStep, /artifactType: 'implementation-prompt'/, 'open-codex must keep implementation-prompt artifact visible');
});

test('implementation prompt artifact renders recommendation implementationPrompt instead of builder package fallback', () => {
  const artifactFn = appSource.match(/function TaskArtifact[\s\S]*?(?=\nfunction )/)?.[0] ?? '';
  assert.match(artifactFn, /artifactType === 'implementation-prompt'/, 'TaskArtifact must handle implementation-prompt');
  assert.match(artifactFn, /implementationPrompt\(data, documents\)/, 'Preview Prompt must render through the shared implementationPrompt helper');
  assert.doesNotMatch(artifactFn.replace(/Regression guard:[^\n]+/, ''), /data\.packages\.builder/, 'Preview Prompt body must not use packages.builder as a fallback when recommendation.implementationPrompt is present');
});
