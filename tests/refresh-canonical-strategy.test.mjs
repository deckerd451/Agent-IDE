import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { persistQuality } from '../scripts/intelligence-quality.mjs';
import { generateNextImprovement } from '../scripts/next-improvement.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(new URL('..', import.meta.url).pathname);

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

async function runScript(repo, script, ...args) {
  await execFileAsync(process.execPath, [join(root, 'scripts', script), ...args], { cwd: repo });
}

test('refresh pipeline carries canonical Current Product Bet through quality, next improvement, and product decisions', async () => {
  const repo = await mkdtemp(join(tmpdir(), 'agent-ide-canonical-refresh-'));
  await write(join(repo, 'README.md'), '# Sample Product\n\nA local-first product for deterministic repository intelligence.\n');
  await write(join(repo, 'package.json'), JSON.stringify({ name: 'sample-product', scripts: { test: 'node --version' } }, null, 2));
  await write(join(repo, 'src/index.js'), 'export const ready = true;\n');
  await write(join(repo, '.ai/goals.md'), `# Goals

## Product Thesis
Sample Product turns repository intelligence into safe local work selection.

## North Star Metric
Useful deterministic handoffs.

## Current Focus
Keep canonical strategy completeness synchronized across generated artifacts.

## Current Product Bet
Canonical completeness should prevent duplicate Current Product Bet recommendations.

## What Not To Build
Do not add cloud calls, telemetry, or LLM evaluation.

## Long-Term Vision
Repository intelligence becomes the default local development control plane.

## Manual Goals
- Product intent: Sample Product turns repository intelligence into safe local work selection.
- Current focus: Keep canonical strategy completeness synchronized across generated artifacts.
- Success criteria: Current Product Bet is not recommended when it is already owner-authored.
- Long-term vision: Repository intelligence becomes the default local development control plane.

## Manual Strategy Notes

- Current Product Bet: Canonical completeness should prevent duplicate Current Product Bet recommendations.

## Success Criteria
Current Product Bet remains present throughout refresh intelligence.
`);

  for (const script of ['audit.mjs', 'backlog.mjs', 'validate-intel.mjs', 'decisions.mjs', 'strategy.mjs']) await runScript(repo, script);
  for (const role of ['architect', 'builder', 'reviewer', 'debugger']) await runScript(repo, 'prompt.mjs', role);
  await runScript(repo, 'health.mjs');
  await runScript(repo, 'context-package.mjs');
  await runScript(repo, 'ai-handoff-validation.mjs');
  await persistQuality(repo);
  const result = await generateNextImprovement(repo);

  const quality = JSON.parse(await readFile(join(repo, '.ai/intelligence-quality.json'), 'utf8'));
  const currentProductBet = quality.canonicalIntelligenceQuality.strategyFields.requiredFields.find((field) => field.key === 'currentProductBet');
  assert.equal(currentProductBet.classification, 'Present');

  const rankingText = JSON.stringify(result.decisionRanking);
  assert.doesNotMatch(rankingText, /Add Current Product Bet|Missing: Current Product Bet/);
  assert.equal(result.candidates.some((candidate) => candidate.id === 'strategy-quality' && candidate.strategyField?.key === 'currentProductBet'), false);

  const prompt = await readFile(join(repo, '.ai/next-improvement-prompt.md'), 'utf8');
  assert.doesNotMatch(prompt, /Decision Needed\nAdd Current Product Bet|Recommended Action: Add Current Product Bet|Missing strategy field: Current Product Bet|## Missing Field\n\nCurrent Product Bet/);
});
