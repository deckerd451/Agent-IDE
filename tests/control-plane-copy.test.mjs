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
  assert.doesNotMatch(source, /Builder Prompt/);
});
