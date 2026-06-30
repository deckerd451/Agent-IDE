import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDecisionFlow } from '../src/decision-flow.ts';
import { createWorkflow } from '../src/workflow.ts';

const workflowSourceBeforeAdapter = await readFile(new URL('../src/workflow.ts', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const adapterSource = await readFile(new URL('../src/decision-flow.ts', import.meta.url), 'utf8');

function baseInput(overrides = {}) {
  return {
    status: { repositoryName: 'Agent IDE', overallHealth: 'Improving', repositoryHandoffReadiness: 'Ready', currentConfidence: '82%' },
    recommendation: {
      title: 'Tighten execution package',
      displayTitle: 'Tighten execution package',
      explanation: 'It removes handoff ambiguity.',
      whyItMatters: 'It is highest leverage.',
      packageType: 'implementation',
      evidenceSource: '.ai/recommendations.md',
    },
    selectedCandidate: { title: 'Tighten execution package', category: 'Implementation', reason: 'It removes handoff ambiguity.', ownerAction: 'Implement the change.' },
    ...overrides,
  };
}

test('decision-flow adapter is read-only UI seam and does not alter workflow engine source', async () => {
  assert.match(adapterSource, /export function createDecisionFlow/);
  assert.doesNotMatch(adapterSource, /writeFile|spawn|execFile|execSync|fetch\(|localStorage|advanceWorkflow\(/);
  assert.match(appSource, /createDecisionFlow\(\{ status: data\.status, recommendation: data\.recommendation, selectedCandidate: task, workflow \}\)/);
  assert.equal(workflowSourceBeforeAdapter, await readFile(new URL('../src/workflow.ts', import.meta.url), 'utf8'));
});

test('adapter maps implementation packages into repository-decision language without changing workflow output', () => {
  const input = { packageType: 'implementation', title: 'Tighten execution package' };
  const before = createWorkflow(input, null);
  const flow = createDecisionFlow(baseInput({ workflow: before }));
  const after = createWorkflow(input, null);
  assert.deepEqual(after, before);
  assert.equal(flow.packageType, 'implementation');
  assert.equal(flow.selectedDecisionTitle, 'Tighten execution package');
  assert.equal(flow.whyThisDecisionExists, 'It removes handoff ambiguity.');
  assert.equal(flow.currentRequiredOwnerAction, 'Choose execution agent');
  assert.equal(flow.executionReadiness, 'ready');
  assert.deepEqual(flow.availableExecutionAgents, ['Claude', 'ChatGPT', 'Codex', 'Gemini', 'Generic']);
});

test('adapter maps validation-experiment packages into repository-decision states', () => {
  const workflow = createWorkflow({ packageType: 'validation-experiment', title: 'Validate context package' }, null);
  const flow = createDecisionFlow(baseInput({
    recommendation: { title: 'Validate context package', explanation: 'A fresh AI must verify handoff quality.', packageType: 'validation-experiment' },
    selectedCandidate: { title: 'Validate context package', category: 'Validation', reason: 'A fresh AI must verify handoff quality.' },
    workflow,
  }));
  assert.equal(workflow.type, 'Validation');
  assert.equal(flow.packageType, 'validation-experiment');
  assert.equal(flow.currentRequiredOwnerAction, 'Choose execution agent');
  assert.equal(flow.refresh.ready, false);
});

test('adapter maps product-decision packages into canonical owner approval', () => {
  const workflow = createWorkflow({ packageType: 'product-decision', title: 'Approve canonical intent', canonicalIntelligenceState: 'existing' }, null);
  const flow = createDecisionFlow(baseInput({
    recommendation: { title: 'Approve canonical intent', explanation: 'Repository intent needs owner approval.', packageType: 'product-decision', canonicalIntelligenceState: 'existing' },
    selectedCandidate: { title: 'Approve canonical intent', category: 'Product Decision', reason: 'Repository intent needs owner approval.' },
    workflow,
  }));
  assert.equal(workflow.type, 'Product Decision');
  assert.equal(flow.packageType, 'product-decision');
  assert.equal(flow.currentRequiredOwnerAction, 'Approve canonical intent');
  assert.equal(flow.executionReadiness, 'ready');
});

test('adapter maps investigation and documentation packages from workflow metadata', () => {
  const investigationWorkflow = createWorkflow({ category: 'Investigation', title: 'Investigate unknown risk' }, null);
  const investigationFlow = createDecisionFlow(baseInput({
    recommendation: { title: 'Investigate unknown risk', explanation: 'A risk blocks safe implementation.' },
    selectedCandidate: { title: 'Investigate unknown risk', category: 'Investigation', reason: 'A risk blocks safe implementation.' },
    workflow: investigationWorkflow,
  }));
  assert.equal(investigationWorkflow.type, 'Investigation');
  assert.equal(investigationFlow.packageType, 'investigation');

  const documentationWorkflow = createWorkflow({ category: 'Documentation', title: 'Document setup gap' }, null);
  const documentationFlow = createDecisionFlow(baseInput({
    recommendation: { title: 'Document setup gap', explanation: 'Documentation gap slows handoff.' },
    selectedCandidate: { title: 'Document setup gap', category: 'Documentation', reason: 'Documentation gap slows handoff.' },
    workflow: documentationWorkflow,
  }));
  assert.equal(documentationWorkflow.type, 'Documentation');
  assert.equal(documentationFlow.packageType, 'documentation');
});
