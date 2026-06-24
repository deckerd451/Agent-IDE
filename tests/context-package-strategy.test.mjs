import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = await mkdtemp(join(tmpdir(), 'agent-ide-context-'));
await mkdir(join(dir, '.ai'), { recursive: true });
await writeFile(join(dir, '.ai/strategy.md'), `# Strategy

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
for (const file of ['goals.md','architecture.md','decisions.md','validation.md','backlog.md','repository-health.md']) await writeFile(join(dir, '.ai', file), `# ${file}\n`);
const result = spawnSync(process.execPath, [resolve('scripts/context-package.mjs')], { cwd: dir, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const pkg = await readFile(join(dir, '.ai/context-package.md'), 'utf8');
assert.match(pkg, /## Strategy/);
assert(pkg.indexOf('## Strategy') < pkg.indexOf('## Core Systems'));
assert.match(pkg, /Follow-Ups Completed/);
assert.match(pkg, /Between Events experience/);
