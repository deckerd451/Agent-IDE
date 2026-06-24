import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'agent-ide-strategy-quality-'));
await mkdir(join(dir, '.ai'), { recursive: true });
await writeFile(join(dir, '.ai/goals.md'), `# Goals

## Product Thesis
Nearify helps people maintain real-world relationships through timely follow-up workflows.

## Current Focus
Between Events reconnection intelligence

## Current Priorities
- identify who the user should reach out to today
- use recent encounter evidence

## Success Criteria
- User can see who to reconnect with today.
- User completes a follow-up from the recommendation.
`);
await writeFile(join(dir, '.ai/architecture.md'), `# Architecture

## Product Thesis
Nearify helps people maintain real-world relationships through timely follow-up workflows.

## Core Systems
Relationship memory, encounter evidence, and real-world overlap scoring.
`);
await writeFile(join(dir, 'README.md'), '# Nearify\n');

const result = spawnSync(process.execPath, [resolve('scripts/strategy.mjs')], { cwd: dir, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const strategy = await readFile(join(dir, '.ai/strategy.md'), 'utf8');

assert.match(strategy, /## Product Thesis\nNearify helps people maintain real-world relationships through timely follow-up workflows\./);
assert.match(strategy, /## Strategic Differentiator\nRelationship memory anchored in encounter evidence and real-world overlap\./);
assert.doesNotMatch(strategy, /## Strategic Differentiator\nNearify helps people maintain real-world relationships through timely follow-up workflows\./);
assert.match(strategy, /## Current Experiment\nCan the system reliably identify who a user should reconnect with today\?/);
assert.match(strategy, /## Success Definition\n- User can see who to reconnect with today\.\n- User completes a follow-up from the recommendation\./);
