import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'agent-ide-health-'));
await mkdir(join(dir, '.ai/prompts'), { recursive: true });
for (const file of ['goals.md','architecture.md','backlog.md','decisions.md','validation.md','agents.md','code.md']) await writeFile(join(dir, '.ai', file), `# ${file}\n\n## Manual Goals\nPresent\n`);
await writeFile(join(dir, '.ai/prompts/architect.md'), '# Architect\n');
await writeFile(join(dir, '.ai/strategy.md'), `# Strategy

## North Star Metric
- Not detected yet.

## Product Thesis
Relationship memory

## Strategic Differentiator
Relationship memory

## Current Product Bet
- Not detected yet.

## What Not To Build
Do not treat it as just events.
`);
const result = spawnSync(process.execPath, [resolve('scripts/health.mjs')], { cwd: dir, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const health = await readFile(join(dir, '.ai/repository-health.md'), 'utf8');
assert.match(health, /- Strategy present/);
assert.match(health, /- North Star Metric missing/);
assert.match(health, /- Current Product Bet missing/);
assert.match(health, /- Strategy quality score \d+\/100/);
assert.match(health, /Strategy missing North Star Metric/);
assert.match(health, /Strategy missing Current Product Bet/);
assert.match(health, /Missing differentiator warning/);
assert.match(health, /Weak success definition warning/);

const leakageDir = await mkdtemp(join(tmpdir(), 'agent-ide-health-leakage-'));
await mkdir(join(leakageDir, '.ai'), { recursive: true });
await writeFile(join(leakageDir, '.ai/strategy.md'), `# Strategy

## Product Thesis
Repository intelligence for developer workflows.

## North Star Metric
Reusable AI context adoption

## Strategic Differentiator
The strategy generator deterministically reads .ai/goals.md to generate repository understanding.

## Current Product Bet
The team is testing whether reusable AI context improves developer workflow.

## Current Experiment
Can repository understanding improve assistant handoffs?

## What Not To Build
Cloud-only repository indexing.

## Success Definition
Developers reuse repository context across assistants.
`);
await writeFile(join(leakageDir, '.ai/goals.md'), '# Goals\n\n## Manual Goals\nKeep repository context reusable.\n');
await writeFile(join(leakageDir, '.ai/architecture.md'), '# Architecture\n\n## Product Thesis\nRepository intelligence.\n\n## Current Focus\nReusable AI context.\n\n## Core Systems\nContext packages.\n');
for (const file of ['backlog.md', 'decisions.md', 'validation.md', 'agents.md', 'code.md']) await writeFile(join(leakageDir, '.ai', file), '# Empty\n');
await mkdir(join(leakageDir, '.ai/prompts'), { recursive: true });
await writeFile(join(leakageDir, '.ai/prompts/architect.md'), '# Architect\n');
const leakageResult = spawnSync(process.execPath, [resolve('scripts/health.mjs')], { cwd: leakageDir, encoding: 'utf8' });
assert.equal(leakageResult.status, 0, leakageResult.stderr);
const leakageHealth = await readFile(join(leakageDir, '.ai/repository-health.md'), 'utf8');
assert.match(leakageHealth, /Product Signal Quality/);
assert.match(leakageHealth, /Implementation Leakage Warning detected in Strategic Differentiator/);


const headingOnlyDir = await mkdtemp(join(tmpdir(), 'agent-ide-health-heading-only-'));
await mkdir(join(headingOnlyDir, '.ai/prompts'), { recursive: true });
for (const file of ['goals.md','architecture.md','backlog.md','decisions.md','validation.md','agents.md','code.md']) await writeFile(join(headingOnlyDir, '.ai', file), `# ${file}

## Manual Goals
Present
`);
await writeFile(join(headingOnlyDir, '.ai/prompts/architect.md'), '# Architect\n');
await writeFile(join(headingOnlyDir, '.ai/strategy.md'), `# Strategy

## Success Definition
Success Criteria
`);
const headingOnlyResult = spawnSync(process.execPath, [resolve('scripts/health.mjs')], { cwd: headingOnlyDir, encoding: 'utf8' });
assert.equal(headingOnlyResult.status, 0, headingOnlyResult.stderr);
const headingOnlyHealth = await readFile(join(headingOnlyDir, '.ai/repository-health.md'), 'utf8');
assert.match(headingOnlyHealth, /- Success Definition missing/);
assert.match(headingOnlyHealth, /Strategy missing Success Definition/);

const backlogNoiseDir = await mkdtemp(join(tmpdir(), 'agent-ide-health-backlog-noise-'));
await mkdir(join(backlogNoiseDir, '.ai/prompts'), { recursive: true });
await writeFile(join(backlogNoiseDir, '.ai/goals.md'), '# Goals\n\n## Manual Goals\nPresent\n');
await writeFile(join(backlogNoiseDir, '.ai/architecture.md'), '# Architecture\n\n## Product Thesis\nRepository intelligence.\n\n## Current Focus\nReusable AI context.\n\n## Core Systems\nContext packages.\n');
await writeFile(join(backlogNoiseDir, '.ai/backlog.md'), `# Backlog

Last Audit: 2026-06-24T01:30:47.539Z
Confidence: 95%

## High Priority
- None detected

## Medium Priority
- **Add Backlog Quality Filtering**
  - Source: README.md:189
  - Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.

## Low Priority
- None detected

## Manual Backlog
`);
await writeFile(join(backlogNoiseDir, '.ai/strategy.md'), `# Strategy

## Product Thesis
Repository intelligence.

## North Star Metric
Reusable context adoption.

## Strategic Differentiator
Local deterministic repository intelligence.

## Current Product Bet
Reusable AI context.

## Current Experiment
Can repository understanding improve assistant handoffs?

## What Not To Build
Cloud-only repository indexing.

## Success Definition
Developers reuse repository context across assistants.
`);
for (const file of ['decisions.md', 'validation.md', 'agents.md', 'code.md']) await writeFile(join(backlogNoiseDir, '.ai', file), '# Notes\n');
await writeFile(join(backlogNoiseDir, '.ai/validation.md'), '# Validation\n\n## Commands Run\n- `npm run build`\n');
await writeFile(join(backlogNoiseDir, '.ai/prompts/architect.md'), '# Architect\n');
const backlogNoiseResult = spawnSync(process.execPath, [resolve('scripts/health.mjs')], { cwd: backlogNoiseDir, encoding: 'utf8' });
assert.equal(backlogNoiseResult.status, 0, backlogNoiseResult.stderr);
const backlogNoiseHealth = await readFile(join(backlogNoiseDir, '.ai/repository-health.md'), 'utf8');
assert.match(backlogNoiseHealth, /- Backlog noise not detected/);
assert.doesNotMatch(backlogNoiseHealth, /Backlog contains possible noise/);
