import assert from 'node:assert/strict';
import { recommendationDetails, summarizeSnapshot, understandingSummary } from '../scripts/server.mjs';

const docs = {
  'goals.md': '# Goals\n\n## Product Purpose\nNearify helps people maintain real-world relationships.\n\n## Current Focus\nEvent-aware follow-up workflows.\n',
  'architecture.md': '# Architecture\n\n## Product Thesis\nNearify helps people maintain real-world relationships through timely follow-up workflows.\n\n## Current Focus\nEvent-aware follow-up workflows.\n\n## Core Systems\nRelationship context engine.\n',
  'strategy.md': '# Strategy\n\n## Product Thesis\nNearify helps people maintain real-world relationships through timely follow-up workflows.\n\n## Current Product Bet\nBetween-events relationship workflows.\n',
  'validation.md': '# Validation\n\n## Last Validation\n2026-06-24T00:00:00.000Z\n\n## Confidence\n- Medium\n\n## Overall Status\n- Xcode metadata detected; full simulator/device build not run by default.\n\n## Commands Run\n- None detected.\n\n## Xcode Project Validation\n- Xcode project validation metadata detected.\n- `xcodebuild -list -project Nearify.xcodeproj`\n- Full simulator/device build: Not run by default.\n',
  'decisions.md': '# Decisions\n\n## Active Decisions\n- Relationship context is canonical.\n',
  'repository-health.md': '# Repository Health\nOverall Health: Needs Attention\nConfidence: Medium\n\n## Quality Signals\n- Strategy quality score 90/100\n- Product Signal Quality strong\n- Core systems present\n- Validation commands not detected\n- Xcode validation metadata detected\n\n## Risks\n- Backlog contains possible noise\n\n## Recommended Next Step\nReview `.ai/backlog.md`, remove validation/status noise, then rerun `npm run backlog` and `npm run health`.\n',
  'context-package.md': '# Context Package\n\n## Product Thesis\nNearify helps people maintain real-world relationships.\n',
  'prompts/architect.md': '# Architect',
  'prompts/builder.md': '# Builder',
  'prompts/reviewer.md': '# Reviewer',
  'prompts/debugger.md': '# Debugger',
  'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Low-priority cleanup.\n',
};

const summary = understandingSummary(docs);
assert.equal(summary.find((item) => item.label === 'Product Thesis')?.state, 'Present');
assert.equal(summary.find((item) => item.label === 'Current Focus')?.state, 'Present');
assert.equal(summary.find((item) => item.label === 'Strategy')?.state, 'Present');
assert.equal(summary.find((item) => item.label === 'Architecture')?.state, 'Present');
assert.equal(summary.find((item) => item.label === 'Validation Artifact')?.state, 'Partial');
assert.equal(summary.find((item) => item.label === 'Decisions')?.state, 'Present');

const snapshot = summarizeSnapshot(docs, '/tmp/Nearify');
assert.equal(snapshot.repositoryHandoffReadiness, 'Ready');
assert.equal(snapshot.recommendedNextStep, 'Run an AI handoff test.');
assert.equal(snapshot.targetValidation.repositoryType, 'Xcode/iOS');
assert.equal(snapshot.targetValidation.primaryBuildSystem, 'Xcode');

const recommendation = recommendationDetails(docs);
assert.equal(recommendation.title, 'Run an AI handoff test.');

const presentValidationDocs = {
  ...docs,
  'validation.md': '# Validation\n\n## Commands Run\n- `npm run build`\n\n## Overall Status\n- Validation passed.\n',
  'repository-health.md': docs['repository-health.md'].replace('- Backlog contains possible noise', '- No repository health risks detected.'),
};
assert.equal(understandingSummary(presentValidationDocs).find((item) => item.label === 'Validation Artifact')?.state, 'Present');
assert.equal(summarizeSnapshot(presentValidationDocs, '/tmp/Agent-IDE').repositoryHandoffReadiness, 'Ready');
