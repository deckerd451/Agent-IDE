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

test('every workflow step exposes exactly one primary action and deterministic progress', () => {
  assert.match(workflowSource, /currentPrimaryAction: currentStep\.primaryAction/);
  assert.match(workflowSource, /progressPercentage: Math\.round\(\(completedSteps\.length \/ checklist\.length\) \* 100\)/);
  assert.match(workflowSource, /estimatedRemainingSteps: Math\.max\(0, checklist\.length - completedSteps\.length\)/);
  assert.doesNotMatch(workflowSource, /Math\.random|Date\.now/);
});

test('workflow state persists locally and resumes after reload', () => {
  assert.match(workflowSource, /WorkflowState/);
  assert.match(workflowSource, /'Not Started' \| 'In Progress' \| 'Waiting For User' \| 'Ready To Refresh' \| 'Complete'/);
  assert.match(appSource, /window\.localStorage\.getItem\(workflowStateStorageKey\)/);
  assert.match(appSource, /window\.localStorage\.setItem\(workflowStateStorageKey, JSON\.stringify\(workflowState\)\)/);
});

test('homepage shows a single recommendation card while diagnostics remain collapsed', () => {
  for (const expected of ['Next Repository Improvement', 'Next Improvement', 'Repository improving', 'recommendationReason', 'singleRecommendationMeta', 'Advanced Repository Intelligence']) {
    assert.match(appSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const expected of ['Generate Implementation Prompt', 'Generate Validation Prompt', 'Review Decision', 'See Next Recommendation']) {
    assert.match(appSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(appSource, /<details className="controlCard disclosureCard advancedIntelligence" aria-label="Advanced Repository Intelligence"><summary>Advanced<\/summary>/);
});

test('repository intelligence, rankings, and prompts are preserved by workflow-layer refactor', () => {
  assert.doesNotMatch(workflowSource, /writeFile|spawn|exec|fetch\(/);
  for (const expected of ['decisionRanking', 'data.recommendation.prompt', 'data.packages.builder', 'data.packages.reviewer', 'data.packages.debugger', 'buildValidationPrompt']) {
    assert.match(appSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
