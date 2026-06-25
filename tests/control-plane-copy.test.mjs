import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Control Plane renders Implementation Package copy instead of Builder Prompt copy', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const expected of [
    'Recommended Implementation Package',
    'Copy Implementation Package',
    'View Implementation Package',
    'Generate Implementation Package',
    'aria-label="Recommended implementation package"',
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /Builder Prompt/);
});
