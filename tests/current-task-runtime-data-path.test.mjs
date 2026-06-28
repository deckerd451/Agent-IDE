import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createWorkflow, workflowKey } from '../src/workflow.ts';

const workflowSource = await readFile(new URL('../src/workflow.ts', import.meta.url), 'utf8');

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('CurrentTaskCard Preview Prompt reads controlPlane.recommendation.implementationPrompt exclusively', () => {
  const taskArtifactFn = appSource.match(/function TaskArtifact[\s\S]*?(?=\nfunction )/)?.[0] ?? '';
  assert.ok(taskArtifactFn, 'TaskArtifact function must exist');
  assert.match(taskArtifactFn, /artifactType === 'implementation-prompt'/, 'TaskArtifact must handle implementation-prompt');
  assert.match(taskArtifactFn, /implementationPrompt\(data, documents\)/, 'Preview Prompt must use the shared implementationPrompt helper');

  const implPromptFn = appSource.match(/function implementationPrompt[\s\S]*?(?=\nfunction )/)?.[0] ?? '';
  assert.ok(implPromptFn, 'implementationPrompt function must exist');
  assert.match(implPromptFn, /data\.recommendation\.implementationPrompt/, 'must read from recommendation.implementationPrompt');
  assert.match(implPromptFn, /Single source of truth/, 'must carry the single-source-of-truth comment');
  // The comment mentions these names; only check that no actual code expression uses them
  const implPromptCode = implPromptFn.replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(implPromptCode, /data\.packages\.builder|data\.packages\.reviewer|documents\[|recommendation\.prompt/, 'must not fall back to stale sources in executable code');
});

test('Do Next title derives from controlPlane.recommendation, not from workflow state', () => {
  const displayTitleFn = appSource.match(/function recommendationDisplayTitle[\s\S]*?(?=\nfunction )/)?.[0] ?? '';
  assert.ok(displayTitleFn, 'recommendationDisplayTitle must exist');
  assert.match(displayTitleFn, /data\.recommendation\.engineeringTask/, 'must use data.recommendation.engineeringTask');
  assert.match(displayTitleFn, /data\.recommendation\.displayTitle/, 'must use data.recommendation.displayTitle');
  assert.doesNotMatch(displayTitleFn, /workflowState|localStorage/, 'must not read from persisted workflow state');
});

test('workflow key for currentWorkflow is derived from controlPlane.recommendation, not from persisted localStorage value', () => {
  assert.match(appSource, /workflowInputForTask\(controlPlane\.recommendation, null\)/, 'currentWorkflow must be seeded from controlPlane.recommendation');
  assert.match(appSource, /current\?\.workflowKey === refreshedKey \? current : null/, 'stale workflow state must be nulled when workflowKey does not match refreshed recommendation');
});

test('persisted workflowState cannot inject implementationPrompt content', () => {
  assert.match(workflowSource, /workflowKey: string/, 'WorkflowState persists only workflowKey, not prompt content');
  assert.match(workflowSource, /currentStepId: string/, 'WorkflowState persists only currentStepId');
  assert.match(workflowSource, /completedStepIds: string\[\]/, 'WorkflowState persists only completedStepIds');
  const workflowStateType = workflowSource.match(/export type WorkflowState[\s\S]*?\};/)?.[0] ?? '';
  assert.ok(workflowStateType, 'WorkflowState type must be exported from workflow.ts');
  assert.doesNotMatch(
    workflowStateType,
    /implementationPrompt|packages/,
    'WorkflowState type must not include prompt content fields',
  );
});

test('createWorkflow ignores stale persisted state when workflowKey does not match current recommendation', () => {
  const staleState = {
    workflowKey: 'Implementation:implementation:Advance strategy: Control Plane reports repository handoff readiness as Ready',
    currentStepId: 'open-codex',
    repositoryState: 'Workflow In Progress',
    status: 'In Progress',
    completedStepIds: ['copy-implementation-prompt'],
  };
  const freshInput = {
    packageType: 'implementation',
    title: 'Add backlog quality',
    recommendationTitle: 'Add backlog quality',
  };
  const freshKey = workflowKey(freshInput);
  assert.notEqual(freshKey, staleState.workflowKey, 'different recommendations must produce different workflow keys');

  const workflow = createWorkflow(freshInput, staleState);
  assert.equal(workflow.workflowKey, freshKey, 'workflow must carry the fresh key');
  assert.equal(workflow.currentStep.id, 'copy-implementation-prompt', 'stale step must be discarded — workflow must restart from first step');
  assert.equal(workflow.completedSteps.length, 0, 'stale completed steps must be discarded');
});

test('createWorkflow preserves step position only when workflowKey matches', () => {
  const input = { packageType: 'implementation', title: 'Add backlog quality', recommendationTitle: 'Add backlog quality' };
  const key = workflowKey(input);
  const matchingState = {
    workflowKey: key,
    currentStepId: 'open-codex',
    repositoryState: 'Workflow In Progress',
    status: 'In Progress',
    completedStepIds: ['copy-implementation-prompt'],
  };
  const workflow = createWorkflow(input, matchingState);
  assert.equal(workflow.currentStep.id, 'open-codex', 'matching workflowKey must preserve step position');
  assert.equal(workflow.completedSteps.length, 1, 'matching workflowKey must preserve completed steps');
});

test('Preview Prompt, Copy Prompt, and Open Codex all use the same implementationPrompt helper on the same data object', () => {
  assert.match(appSource, /'copy-implementation-prompt': implementationPrompt\(data, documents\)/, 'Copy Prompt must use implementationPrompt helper');
  assert.match(appSource, /'open-codex': implementationPrompt\(data, documents\)/, 'Open Codex must use implementationPrompt helper');
  assert.match(appSource, /TaskArtifact artifactType=\{userTask\?\.artifactType \?\? 'implementation-prompt'\} data=\{data\}/, 'Preview Prompt TaskArtifact must receive data from same controlPlane prop');
});

test('workflowInputForTask uses recommendation.displayTitle for key derivation, not raw title', () => {
  const workflowInputFn = appSource.match(/function workflowInputForTask[\s\S]*?(?=\n\nfunction )/)?.[0] ?? '';
  assert.ok(workflowInputFn, 'workflowInputForTask must exist');
  assert.match(workflowInputFn, /recommendation\.displayTitle/, 'title field must prefer recommendation.displayTitle');
  assert.match(workflowInputFn, /recommendation\.originalRecommendationTitle \?\? recommendation\.title/, 'recommendationTitle must use originalRecommendationTitle with fallback');
});
