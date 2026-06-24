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
