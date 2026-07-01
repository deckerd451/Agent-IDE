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
  assert.match(appSource, /handleExecutionAgentClick\(agent, pkg\.packageBody\)/);
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



test('clicking Codex once copies without refreshing and immediately exposes outcome controls', () => {
  const actionStart = appSource.indexOf('function RepositoryDecisionActionSurface');
  const actionEnd = appSource.indexOf('function workflowInputForTask', actionStart);
  const actionSource = appSource.slice(actionStart, actionEnd);
  assert.match(actionSource, /async function handleExecutionAgentClick\(agent: ExecutionAgent, packageBody: string\)/);
  assert.match(actionSource, /await copyText\(packageBody, `\$\{agent\} package copied`\);\s*setCopiedAgent\(agent\);/);
  assert.match(actionSource, /onClick=\{\(\) => \{ if \(pkg\?\.packageBody\) void handleExecutionAgentClick\(agent, pkg\.packageBody\); \}\}/);
  assert.doesNotMatch(actionSource, /handleExecutionAgentClick[\s\S]*refreshIntelligence/);
  assert.doesNotMatch(actionSource, /handleExecutionAgentClick[\s\S]*onPrimaryAction\(\)/);
  assert.match(actionSource, /const actionTitle = isAwaitingExternalAi \? 'Waiting for AI'/);
  assert.match(actionSource, /isAwaitingExternalAi && !outcomeFormOpen && <button className="primaryCta" data-decision-flow-primary-action="true" onClick=\{\(\) => setOutcomeFormOpen\(true\)\} type="button">Record Outcome<\/button>/);
});

test('inline outcome form uses dark-card styling and avoids completion panel styling', () => {
  assert.match(stylesSource, /\.inlineOutcomeForm \{[\s\S]*background: transparent;[\s\S]*color: #e5edf8;/);
  assert.match(stylesSource, /\.inlineOutcomeForm label \{[\s\S]*color: #e5edf8;/);
  assert.match(stylesSource, new RegExp('\\.inlineOutcomeForm select,\\n\\.inlineOutcomeForm textarea \\{[\\s\\S]*box-sizing: border-box;[\\s\\S]*max-width: 100%;[\\s\\S]*background: rgba\\(15, 23, 42, 0\\.82\\);[\\s\\S]*color: #f8fafc;'));
  assert.match(stylesSource, /\.inlineOutcomeForm \.checkboxLabel \{[\s\S]*grid-template-columns: auto minmax\(0, 1fr\);[\s\S]*overflow-wrap: anywhere;/);
  assert.doesNotMatch(stylesSource, /\.inlineOutcomeForm[\s\S]*completionPanel/);
  assert.doesNotMatch(appSource, /completionPanel/);
});

test('workflow states represent repository decisions instead of clipboard logistics', () => {
  for (const state of ['Repository Decision Ready', 'Execution Package Ready', 'Waiting For External AI', 'Record Outcome', 'Refresh Repository']) {
    assert.match(workflowSource, new RegExp(state));
  }
  for (const clipboardStep of ['copy-context-package', 'copy-understanding-check', 'copy-implementation-prompt', 'open-codex', 'open-chatgpt', 'paste-response']) {
    assert.doesNotMatch(workflowSource, new RegExp(clipboardStep));
  }
});

test('validation-experiment execution package is action-first for Nearify-like Xcode validation gaps', () => {
  const pkg = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'Codex',
    repositoryMetadata: { Repository: 'Nearify', Health: 'Needs validation' },
    repositoryContextPackage: '# Context Package\n\nNearify is an iOS app. Repository files include `Nearify.xcodeproj` and `Nearify.xcworkspace`. Xcode validation notes say full simulator/device build was not run by default; no full `xcodebuild`.',
    understandingPrompt: 'Using only this Context Package, validate the selected issue.\n\n---\n\n# Context Package\n\nNearify is an iOS app. Repository files include `Nearify.xcodeproj` and `Nearify.xcworkspace`. Xcode validation notes say full simulator/device build was not run by default; no full `xcodebuild`.',
    implementationPrompt: 'Full simulator/device build: Not run by default; no full `xcodebuild`.',
    decisionTitle: 'Full simulator/device build: Not run by default; no full xcodebuild',
    decisionReason: 'Inspect the Xcode project/schemes and run or report the deterministic simulator/device build command.',
  });

  const sectionOrder = [
    '## Task',
    '## Required Execution Instructions',
    '## Validation Task',
    '## Suggested Commands',
    '## What To Report Back',
    '## Understanding Check',
    '## Context Package',
  ].map((heading) => pkg.packageBody.indexOf(heading));
  assert.ok(sectionOrder.every((index) => index >= 0), 'expected all action-first validation sections to exist');
  assert.deepEqual(sectionOrder, [...sectionOrder].sort((a, b) => a - b));
  assert.match(pkg.packageBody, /`xcodebuild -list -project Nearify\.xcodeproj`/);
  assert.match(pkg.packageBody, /`xcodebuild -list -workspace Nearify\.xcworkspace`/);
  assert.match(pkg.packageBody, /`xcodebuild build -workspace Nearify\.xcworkspace -scheme <Scheme> -destination 'platform=iOS Simulator,name=<Installed Simulator Name>'`/);
  assert.match(pkg.packageBody, /Run Xcode metadata discovery first/);
  assert.match(pkg.packageBody, /Do not modify source code unless/);
  assert.match(pkg.packageBody, /Commands run, in order/);
  assert.equal((pkg.packageBody.match(/Nearify is an iOS app/g) ?? []).length, 1);
});

test('non-Xcode validation-experiment execution package surfaces detected package scripts or absence', () => {
  const withScript = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'Codex',
    repositoryContextPackage: '# Context Package\n\n## Commands Run\n- `npm test`\n- `npm run build`\n',
    understandingPrompt: 'Validate the package.',
    decisionTitle: 'Run validation',
  });
  assert.match(withScript.packageBody, /## Suggested Commands\n- `npm test`\n- `npm run build`/);

  const withoutScript = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'Codex',
    repositoryContextPackage: '# Context Package\n\nNo known commands.\n',
    understandingPrompt: 'Validate the package.',
    decisionTitle: 'Run validation',
  });
  assert.match(withoutScript.packageBody, /No deterministic validation command detected/);
});

test('validation-experiment execution package injects detected Xcode scheme from validation evidence', () => {
  const pkg = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'Codex',
    repositoryContextPackage: '# Context Package\n\n## Validation Evidence\n.ai/validation.md reports `xcodebuild -list -project Beacon.xcodeproj`.\nScheme: `Beacon`\n',
    understandingPrompt: 'Validate the package.',
    decisionTitle: 'Full simulator/device build: Not run by default',
  });
  assert.match(pkg.packageBody, /`xcodebuild -list -project Beacon\.xcodeproj`/);
  assert.match(pkg.packageBody, /`xcodebuild build -project Beacon\.xcodeproj -scheme Beacon -destination 'platform=iOS Simulator,name=<Installed Simulator Name>'`/);
  assert.doesNotMatch(pkg.packageBody, /-scheme <Scheme>/);
});

test('validation-experiment execution package chooses first Xcode scheme by stable sort', () => {
  const pkg = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'Codex',
    repositoryContextPackage: '# Context Package\n\nRepository files include `Beacon.xcodeproj`.\nSchemes: Zebra, Beacon\n',
    understandingPrompt: 'Validate the package.',
    decisionTitle: 'Full simulator/device build: Not run by default',
  });
  assert.match(pkg.packageBody, /-scheme Beacon -destination/);
  assert.match(pkg.packageBody, /multiple schemes were detected, so this package chose the first scheme by stable alphabetical sort/i);
});

test('validation-experiment execution package keeps scheme placeholder when no scheme is detected', () => {
  const pkg = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'Codex',
    repositoryContextPackage: '# Context Package\n\nRepository files include `Beacon.xcodeproj`. No scheme evidence is present.\n',
    understandingPrompt: 'Validate the package.',
    decisionTitle: 'Full simulator/device build: Not run by default',
  });
  assert.match(pkg.packageBody, /-scheme <Scheme> -destination/);
  assert.match(pkg.packageBody, /replace `<Scheme>` with a scheme reported by `xcodebuild -list`/);
});

test('validation-experiment execution package emits deterministic project and workspace discovery commands', () => {
  const pkg = createExecutionPackage({
    packageType: 'validation-experiment',
    executionAgent: 'Codex',
    repositoryContextPackage: '# Context Package\n\nRepository files include `B.xcworkspace`, `A.xcodeproj`, and `B.xcodeproj`.\nScheme: `Beacon`\n',
    understandingPrompt: 'Validate the package.',
    decisionTitle: 'Full simulator/device build: Not run by default',
  });
  assert.match(pkg.packageBody, /`xcodebuild -list -project A\.xcodeproj`[\s\S]*`xcodebuild -list -project B\.xcodeproj`[\s\S]*`xcodebuild -list -workspace B\.xcworkspace`/);
  assert.match(pkg.packageBody, /`xcodebuild build -workspace B\.xcworkspace -scheme Beacon -destination 'platform=iOS Simulator,name=<Installed Simulator Name>'`/);
});
