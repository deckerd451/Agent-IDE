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
assert.match(health, /Strategy missing North Star Metric/);
assert.match(health, /Strategy missing Current Product Bet/);
