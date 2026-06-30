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
      understandingPrompt: 'Understanding / Validation Prompt Body',
      implementationPrompt: 'Implementation Prompt Body',
      decisionTitle: 'Repository Decision Title',
      decisionReason: 'Decision reason',
    });
    assert.equal(pkg.executionAgent, executionAgent);
    assert.equal(pkg.packageVersion, 'execution-package/v1');
    assert.match(pkg.packageBody, /## Repository Context\nRepository Context Package Body/);
    assert.match(pkg.packageBody, /## Understanding Check\nUsing the Repository Context above\.\.\.\n\nUnderstanding \/ Validation Prompt Body/);
    assert.match(pkg.packageBody, /## Action First\nTask: implement the selected issue\./);
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


test('execution package composes context once and references it from understanding check', () => {
  const context = 'CONTEXT PACKAGE UNIQUE BODY';
  const pkg = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'Codex',
    repositoryMetadata: { Repository: 'Agent IDE', Health: 'Ready' },
    repositoryContextPackage: context,
    understandingPrompt: `Using only this Context Package:\n\n1. Explain it.\n\nOnly use evidence present in the Context Package.\n\n---\n\n${context}`,
    decisionTitle: 'Validate AI Understanding',
    decisionReason: 'Confirm handoff quality before implementation.',
  });

  assert.equal((pkg.packageBody.match(new RegExp(context, 'g')) ?? []).length, 1);
  assert.match(pkg.packageBody, /## Repository Context\nCONTEXT PACKAGE UNIQUE BODY/);
  assert.match(pkg.packageBody, /## Understanding Check\nUsing the Repository Context above\.\.\./);
  assert.doesNotMatch(pkg.packageSections.find((section) => section.title === 'Understanding Check')?.body ?? '', /CONTEXT PACKAGE UNIQUE BODY/);
});

test('validation execution packages put concrete validation task instructions near the top', () => {
  const pkg = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'ChatGPT',
    repositoryMetadata: { Repository: 'Agent IDE' },
    repositoryContextPackage: 'Context body',
    understandingPrompt: 'Using only this Context Package:\nRun `npm test`.\n\n---\n\nContext body',
    decisionTitle: 'Validate generated handoff',
    decisionReason: 'Check whether the package is sufficient.',
  });

  const titles = pkg.packageSections.map((section) => section.title);
  assert.deepEqual(titles.slice(0, 4), ['Execution Agent', 'Package Metadata', 'Repository Decision', 'Action First']);
  const action = pkg.packageSections.find((section) => section.title === 'Action First')?.body ?? '';
  assert.match(action, /Task: run the validation experiment\./);
  assert.match(action, /Validation target: Validate generated handoff/);
  assert.match(action, /Suggested commands:\n- npm test/);
  assert.match(action, /What to report back:/);
  assert.match(action, /Do not modify source unless required for validation\./);
});

test('execution package still includes metadata, decision, context, and required instructions', () => {
  const pkg = createExecutionPackage({
    packageType: 'product-decision',
    executionAgent: 'Generic',
    repositoryMetadata: { Repository: 'Agent IDE', Health: 'Ready' },
    repositoryContextPackage: 'Repository context stays present',
    decisionTitle: 'Review canonical intent',
    decisionReason: 'Decide whether `.ai/goals.md` still describes the product.',
  });

  assert.match(pkg.packageBody, /## Package Metadata[\s\S]*Package Type: product-decision[\s\S]*Repository: Agent IDE/);
  assert.match(pkg.packageBody, /## Repository Decision[\s\S]*Review canonical intent/);
  assert.match(pkg.packageBody, /## Action First[\s\S]*Task: review or update canonical repository intent\./);
  assert.match(pkg.packageBody, /File to review: \.ai\/goals\.md/);
  assert.match(pkg.packageBody, /## Repository Context\nRepository context stays present/);
  assert.match(pkg.packageBody, /## Required Execution Instructions[\s\S]*Do not ask the repository owner for a second clipboard package/);
});
