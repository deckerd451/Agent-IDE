import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Control Plane renders package labels based on packageType', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const expected of [
    'Recommended Implementation Package',
    'Copy Implementation Package',
    'Recommended Product Decision Package',
    'Copy Product Decision Package',
    'Recommended Validation Experiment',
    'Repository Owner edits:',
    '.ai/goals.md',
    'Everything else will be regenerated.',
    'Copy Validation Package',
    "packageType?: 'implementation' | 'product-decision' | 'validation-experiment'",
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const expected of ['Review and Apply Canonical Edit', 'Proposed markdown block', 'Supporting evidence', 'Apply Edit', 'Canonical edit applied. Refresh Intelligence to verify the task was resolved.', '/api/repository/apply-canonical-edit']) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /Copy Builder Prompt/);
});

test('Control Plane renders a dedicated validation work item workspace', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const expected of [
    'Validation Workspace',
    'Validation Goal',
    'Why this validation matters',
    'Current validation score',
    'Previous validation score',
    'Expected outcome',
    'Repository evidence used',
    'Validation inputs',
    'Run Validation',
    'Copy Validation Prompt',
    'Validation Complete',
    'Repository Quality Delta',
    'Verification Delta',
    'AI Handoff Delta',
    'Completed Validation',
    'Next Task',
    'Finish Validation',
    'Do not assume source-code access.',
    'Only use evidence present in the Context Package.',
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Control Plane separates verification status, score, count, and reason', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const expected of ['Verification Status', 'Verification Score', 'Pass/Fail State', 'Failures', 'Failure Reason', '⚠ Failed']) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
