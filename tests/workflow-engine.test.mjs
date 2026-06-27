import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
    'Recommendation Ready',
    'Workflow In Progress',
    'Waiting for External Work (Codex / ChatGPT / User)',
    'Validate Result',
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

test('work queue presents one primary workflow action while diagnostics remain advanced', () => {
  for (const expected of ['Work Queue', 'Repository improving', 'recommendationReason', 'singleRecommendationMeta', 'Advanced Repository Intelligence', 'Refresh Repository Intelligence', 'Open Current Workflow']) {
    assert.match(appSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(appSource, /function primaryHomepageAction\(workflow\?: Workflow \| null\)/);
  assert.match(appSource, /return outcomeWorkflowText\(workflow\.currentPrimaryAction\)/);
  assert.match(appSource, /<details className="controlCard disclosureCard advancedIntelligence" aria-label="Advanced Repository Intelligence"><summary>Advanced<\/summary>/);
});


test('clicking the visible Work Queue primary CTA routes through workflow advancement', () => {
  assert.match(appSource, /function WorkflowPrimaryButton\(\{ workflow, onPrimaryAction \}: \{ workflow: Workflow; onPrimaryAction: \(\) => void \}\)/);
  assert.match(appSource, /data-workflow-primary-action="true" onClick=\{onPrimaryAction\}/);
  assert.match(appSource, /\{workflow \? <WorkflowPrimaryButton workflow=\{workflow\} onPrimaryAction=\{onPrimaryAction\} \/> : <button className="primaryCta"/);
  assert.match(appSource, /await performWorkflowStepAction\(currentWorkflow, controlPlane\);\s*const task = firstCandidate\(controlPlane, 1\);\s*const next = advanceWorkflow\(workflowInputForTask\(controlPlane\.recommendation, task\), workflowState\);\s*window\.localStorage\.setItem\(workflowStateStorageKey, JSON\.stringify\(next\)\);\s*setWorkflowState\(next\);/);
  assert.match(workflowSource, /\{ id: 'copy-context-package', label: 'Copy Context Package', primaryAction: 'Copy Context Package', state: 'Recommendation Ready', nextState: 'Workflow In Progress' \},\s*\{ id: 'copy-validation-prompt', label: 'Copy Validation Prompt', primaryAction: 'Copy Validation Prompt', state: 'Workflow In Progress'/);
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

test('repository intelligence, rankings, and prompts are preserved by workflow-layer refactor', () => {
  assert.doesNotMatch(workflowSource, /writeFile|spawn|exec|fetch\(/);
  for (const expected of ['decisionRanking', 'data.recommendation.prompt', 'data.packages.builder', 'data.packages.reviewer', 'data.packages.debugger', 'buildValidationPrompt']) {
    assert.match(appSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
