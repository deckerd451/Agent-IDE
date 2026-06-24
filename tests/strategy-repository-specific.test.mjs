import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/strategy.mjs');

async function runFixture(prefix, files) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(dir, '.ai'), { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    await mkdir(fullPath.slice(0, fullPath.lastIndexOf('/')), { recursive: true });
    await writeFile(fullPath, content);
  }
  const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return readFile(join(dir, '.ai/strategy.md'), 'utf8');
}

const nearifyStrategy = await runFixture('nearify-strategy-', {
  '.ai/goals.md': `# Goals

## Product Thesis
Nearify helps people maintain real-world relationships through timely follow-up workflows.

## Current Focus
Between Events reconnection intelligence

## Current Priorities
- identify who the user should reconnect with today
- use recent encounter evidence
`,
  '.ai/architecture.md': `# Architecture

## Core Systems
Relationship memory anchored in encounter evidence and real-world overlap.
`,
  'README.md': '# Nearify\n',
});
assert.match(nearifyStrategy, /Relationship memory anchored in encounter evidence and real-world overlap\./);
assert.match(nearifyStrategy, /Can the system reliably identify who a user should reconnect with today\?/);
assert.match(nearifyStrategy, /## Strategy Warnings\n- No strategy leakage detected\./);

const agentIdeStrategy = await runFixture('agent-ide-strategy-', {
  '.ai/goals.md': `# Goals

## Product Thesis
Agent IDE keeps local repository intelligence refreshed for assistant handoffs.

## Current Focus
Improve evidence-driven strategy generation for each repository.

## Current Priorities
- derive strategic differentiators from goals, architecture, decisions, README, and product docs
- warn when generated strategy contains unsupported repository concepts
`,
  '.ai/architecture.md': `# Architecture

## Product Thesis
Agent IDE generates local-first intelligence files for software repositories.

## Core Systems
Refresh orchestration, deterministic generators, repository health, and context packaging.
`,
  '.ai/decisions.md': `# Decisions

## Active Decisions
Strategy inference must be repository-specific and evidence-driven.
`,
  'README.md': '# Agent IDE\n\nLocal-first repository intelligence for coding agents.\n',
});
assert.doesNotMatch(agentIdeStrategy, /relationship memory|real-world overlap|reconnect with today|follow-ups/i);
assert.match(agentIdeStrategy, /Repository intelligence that turns repository understanding into reusable AI context for developer workflows\./);
const agentIdeFieldText = agentIdeStrategy.replace(/^Evidence:.*$/gim, '').replace(/^## Strategy Evidence Sources[\s\S]*?(?=^## Strategy Warnings)/m, '');
assert.doesNotMatch(agentIdeFieldText, /strategy\.mjs|audit\.mjs|markdown parsing|file scanning|generator internals|deterministically reads|\.ai\//i);
assert.match(agentIdeStrategy, /Can the system reliably deliver the current focus: Improve evidence-driven strategy generation for each repository\?/);
assert.match(agentIdeStrategy, /## Strategy Confidence\nHigh|## Strategy Confidence\nMedium/);
