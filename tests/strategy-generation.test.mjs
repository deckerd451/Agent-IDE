import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/strategy.mjs');
const dir = await mkdtemp(join(tmpdir(), 'agent-ide-strategy-'));
await mkdir(join(dir, '.ai'), { recursive: true });
await writeFile(join(dir, '.ai/goals.md'), `# Goals

## Product Thesis
Nearify helps people maintain real-world relationships through timely follow-up workflows.

## North Star Metric
Follow-Ups Completed

## Strategic Differentiator
Relationship memory from real-world encounters

## Current Product Bet
Between Events experience

## What Not To Build
Do not treat Nearify as primarily an event app

## Success Definition
User knows who to reach out to today and completes more follow-ups
`);
await writeFile(join(dir, '.ai/architecture.md'), '# Architecture\n\n## North Star Metric\nWrong Metric\n');
await writeFile(join(dir, '.ai/strategy.md'), '# Strategy\n\n## Manual Strategy Notes\nKeep this human note.\n');

const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const strategy = await readFile(join(dir, '.ai/strategy.md'), 'utf8');

assert.match(strategy, /## North Star Metric\nFollow-Ups Completed/);
assert.doesNotMatch(strategy, /Wrong Metric/);
assert.match(strategy, /## Strategic Differentiator\nRelationship memory from real-world encounters/);
assert.match(strategy, /## Current Product Bet\nBetween Events experience/);
assert.match(strategy, /## What Not To Build\nDo not treat Nearify as primarily an event app/);
assert.match(strategy, /## Success Definition\nUser knows who to reach out to today and completes more follow-ups/);
assert.match(strategy, /## Manual Strategy Notes\nKeep this human note\./);

const successDir = await mkdtemp(join(tmpdir(), 'agent-ide-strategy-success-'));
await mkdir(join(successDir, '.ai'), { recursive: true });
await writeFile(join(successDir, '.ai/goals.md'), `# Goals

## Product Thesis
Repository intelligence helps developers share AI-ready project context.

## Success Criteria
- A fresh AI assistant can explain a repository.
- A user can copy useful AI context.

## Current Focus
Reusable AI context handoff
`);

const successResult = spawnSync(process.execPath, [script], { cwd: successDir, encoding: 'utf8' });
assert.equal(successResult.status, 0, successResult.stderr);
const successStrategy = await readFile(join(successDir, '.ai/strategy.md'), 'utf8');
assert.match(successStrategy, /## Success Definition\n- A fresh AI assistant can explain a repository\.\n- A user can copy useful AI context\./);
assert.doesNotMatch(successStrategy, /## Success Definition\nSuccess Criteria\b/);
