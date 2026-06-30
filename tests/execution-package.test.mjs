import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExecutionPackage, defaultExecutionAgents } from '../src/decision-flow.ts';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const workflowSource = await readFile(new URL('../src/workflow.ts', import.meta.url), 'utf8');

test('each execution agent receives one complete deterministic execution package', () => {
  for (const executionAgent of defaultExecutionAgents) {
    const pkg = createExecutionPackage({
      packageType: 'implementation',
      executionAgent,
      repositoryMetadata: { Repository: 'Agent IDE', Health: 'Ready' },
      repositoryContextPackage: 'Repository Context Package Body',
      understandingPrompt: 'Understanding / Validation Prompt Body\n\n---\n\nRepository Context Package Body',
      implementationPrompt: 'Implementation Prompt Body',
      decisionTitle: 'Repository Decision Title',
      decisionReason: 'Decision reason',
    });
    assert.equal(pkg.executionAgent, executionAgent);
    assert.equal(pkg.packageVersion, 'execution-package/v1');
    assert.match(pkg.packageBody, /^## Task\nRepository Decision Title\n\nDecision reason/);
    assert.match(pkg.packageBody, /## Context Package\nRepository Context Package Body/);
    assert.equal((pkg.packageBody.match(/Repository Context Package Body/g) ?? []).length, 1);
    assert.match(pkg.packageBody, /## Understanding Check\nUnderstanding \/ Validation Prompt Body/);
    assert.match(pkg.packageBody, /## Implementation Instructions\nImplementation Prompt Body/);
    assert.match(pkg.packageBody, /Do not ask the repository owner for a second clipboard package/);
  }
});

test('primary action surface exposes one package copy per supported agent', () => {
  for (const agent of ['Claude', 'ChatGPT', 'Codex', 'Gemini', 'Generic']) {
    assert.match(appSource, new RegExp(`Copy \\{agent\\} Package|Copy ${agent} Package`));
  }
  assert.match(appSource, /copyText\(pkg\.packageBody/);
  assert.doesNotMatch(appSource, /Cursor|Copy Package/);
});

test('workflow states represent repository decisions instead of clipboard logistics', () => {
  for (const state of ['Repository Decision Ready', 'Execution Package Ready', 'Waiting For External AI', 'Record Outcome', 'Refresh Repository']) {
    assert.match(workflowSource, new RegExp(state));
  }
  for (const clipboardStep of ['copy-context-package', 'copy-understanding-check', 'copy-implementation-prompt', 'open-codex', 'open-chatgpt', 'paste-response']) {
    assert.doesNotMatch(workflowSource, new RegExp(clipboardStep));
  }
});
