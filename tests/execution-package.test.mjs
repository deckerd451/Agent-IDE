import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExecutionPackage, defaultExecutionAgents } from '../src/decision-flow.ts';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const workflowSource = await readFile(new URL('../src/workflow.ts', import.meta.url), 'utf8');
const decisionFlowSource = await readFile(new URL('../src/decision-flow.ts', import.meta.url), 'utf8');
const stylesSource = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');

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

test('repository decision action card uses decision-first labels and no normal start CTA', () => {
  for (const label of ['Execute With', 'Choose where to send this decision.', 'Claude', 'Codex', 'ChatGPT', 'Gemini', 'Copy Package']) {
    const source = ['Claude', 'Codex', 'ChatGPT', 'Gemini'].includes(label) ? decisionFlowSource : appSource;
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(appSource, /Start Repository Decision/);
  assert.doesNotMatch(appSource, /Repository Decision Action/);
});

test('primary action surface exposes one short package copy button per supported agent', () => {
  assert.match(appSource, /copyText\(pkg\.packageBody/);
  assert.match(appSource, /agent === 'Generic' \? 'Copy Package' : agent/);
  for (const overflowProneLabel of ['Copy Claude Package', 'Copy ChatGPT Package', 'Copy Codex Package', 'Copy Gemini Package', 'Copy Generic Package']) {
    assert.doesNotMatch(appSource, new RegExp(overflowProneLabel));
  }
  assert.doesNotMatch(appSource, /Cursor/);
});

test('post-copy state tells the user to paste into the selected AI and record outcome', () => {
  assert.match(appSource, /Waiting for AI/);
  assert.match(appSource, /Record Outcome/);
  assert.match(appSource, /\$\{copiedAgent\} package copied\. Paste it into \$\{copiedAgent\}, then return here to record the outcome\./);
  assert.match(appSource, /Paste the package into \$\{copiedAgent\}\. When finished, record the outcome\./);
});

test('action card css guards against overflow in the narrow sidebar', () => {
  assert.match(stylesSource, /\.repositoryDecisionActions[\s\S]*overflow-wrap: anywhere/);
  assert.match(stylesSource, /\.repositoryDecisionActions[\s\S]*min-width: 0/);
  assert.match(stylesSource, /\.executionAgentGrid[\s\S]*repeat\(auto-fit, minmax\(88px, 1fr\)\)/);
  assert.match(stylesSource, /\.compactCta[\s\S]*white-space: normal/);
});

test('workflow states represent repository decisions instead of clipboard logistics', () => {
  for (const state of ['Repository Decision Ready', 'Execution Package Ready', 'Waiting For External AI', 'Record Outcome', 'Refresh Repository']) {
    assert.match(workflowSource, new RegExp(state));
  }
  for (const clipboardStep of ['copy-context-package', 'copy-understanding-check', 'copy-implementation-prompt', 'open-codex', 'open-chatgpt', 'paste-response']) {
    assert.doesNotMatch(workflowSource, new RegExp(clipboardStep));
  }
});
