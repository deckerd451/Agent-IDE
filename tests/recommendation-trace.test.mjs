import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { generateNextImprovement } from '../scripts/next-improvement.mjs';

async function makeRepo(aiFiles = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'rec-trace-test-'));
  const aiDir = join(dir, '.ai');
  await mkdir(aiDir, { recursive: true });
  for (const [name, content] of Object.entries(aiFiles)) {
    await writeFile(join(aiDir, name), content, 'utf8');
  }
  return { dir, aiDir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const minimalAi = {
  'goals.md': '# Goals\n\n## Product Purpose\nLocal-first AI coding assistant.\n\n## Success Criteria\n- Deterministic\n',
  'architecture.md': '# Architecture\n\n## Core Systems\n- Server: HTTP API\n- Client: React SPA\n\n## Primary Flows\n- User → Server → .ai/\n',
  'strategy.md': '# Strategy\n\n## Product Thesis\nOwn your AI context.\n',
  'decisions.md': '# Decisions\n\n## Active Decisions\n- All generators must be deterministic.\n',
  'validation.md': '# Validation\n\n## Commands Run\n- `npm test`\n',
  'repository-health.md': '# Repository Health\n\n## Risks\n- No repository health risks detected.\n',
  'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Add deterministic generator.\n',
  'context-package.md': '# Context Package\n\nReady.\n',
};

test('recommendation-trace.md is produced on every generateNextImprovement call', async () => {
  const { dir, aiDir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dir);
    const trace = await readFile(join(aiDir, 'recommendation-trace.md'), 'utf8');
    assert.ok(trace.length > 0, 'trace must not be empty');
    assert.ok(trace.startsWith('# Recommendation Trace'), 'trace must start with # Recommendation Trace');
  } finally {
    await cleanup();
  }
});

test('recommendation-trace.md contains all required sections', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dir);
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    const requiredSections = [
      '## Files Read',
      '## Improvement Analyzer — Stage Results',
      '## Improvement Candidates',
      '## Maintenance Candidates',
      '## Full Decision Ranking',
      '## Selected Recommendation',
    ];
    for (const section of requiredSections) {
      assert.ok(trace.includes(section), `trace must include section: ${section}`);
    }
  } finally {
    await cleanup();
  }
});

test('recommendation-trace.md is byte-for-byte deterministic across two sequential calls', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dir);
    const first = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    await generateNextImprovement(dir);
    const second = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    assert.equal(first, second, 'Two sequential calls must produce identical trace output');
  } finally {
    await cleanup();
  }
});

test('identical repositories produce identical recommendation traces', async () => {
  const { dir: dirA, cleanup: cleanA } = await makeRepo(minimalAi);
  const { dir: dirB, cleanup: cleanB } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dirA);
    await generateNextImprovement(dirB);
    const a = await readFile(join(dirA, '.ai', 'recommendation-trace.md'), 'utf8');
    const b = await readFile(join(dirB, '.ai', 'recommendation-trace.md'), 'utf8');
    assert.equal(a, b, 'Identical repository inputs must produce identical traces');
  } finally {
    await Promise.all([cleanA(), cleanB()]);
  }
});

test('trace lists all 6 analyzer stages', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dir);
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    const expectedStages = [
      'Ownership Risks',
      'Implicit Persistence',
      'Execution Model Risks',
      'Strategic Drift',
      'Technical Debt',
      'Architectural Complexity',
    ];
    for (const stage of expectedStages) {
      assert.ok(trace.includes(stage), `trace must include stage: ${stage}`);
    }
  } finally {
    await cleanup();
  }
});

test('trace explains why 0 improvement candidates were produced for clean repository', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dir);
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    // With no localStorage, no exec-model risks, no debt — all stages should be 0
    assert.ok(
      trace.includes('None produced') || trace.includes('0 candidates'),
      'trace must explain that no improvement candidates were produced',
    );
  } finally {
    await cleanup();
  }
});

test('trace shows improvement candidate when localStorage present in decisions', async () => {
  const { dir, cleanup } = await makeRepo({
    ...minimalAi,
    'decisions.md': '# Decisions\n\n## Active Decisions\n- Validation completions stored in localStorage.\n',
  });
  try {
    await generateNextImprovement(dir);
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    assert.ok(trace.includes('implicit-persistence-0'), 'trace must show localStorage improvement candidate');
    assert.ok(trace.includes('improvement'), 'trace must show class:improvement');
  } finally {
    await cleanup();
  }
});

test('trace selected recommendation section cites the winning candidate id and title', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dir);
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    const selectedSection = (() => {
      const start = trace.indexOf('## Selected Recommendation');
      const end = trace.indexOf('\n## ', start + 1);
      return end === -1 ? trace.slice(start) : trace.slice(start, end);
    })();
    assert.ok(selectedSection.includes('**ID**'), 'selected section must include **ID**');
    assert.ok(selectedSection.includes('**Title**'), 'selected section must include **Title**');
    assert.ok(selectedSection.includes('Why This Recommendation Was Selected'), 'selected section must include why explanation');
  } finally {
    await cleanup();
  }
});

test('trace Files Read table lists all required intelligence files', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateNextImprovement(dir);
    const trace = await readFile(join(dir, '.ai', 'recommendation-trace.md'), 'utf8');
    const filesSection = (() => {
      const start = trace.indexOf('## Files Read');
      const end = trace.indexOf('\n## ', start + 1);
      return end === -1 ? trace.slice(start) : trace.slice(start, end);
    })();
    const requiredFiles = ['goals.md', 'repository-health.md', 'backlog.md', 'strategy.md', 'architecture.md', 'decisions.md', 'execution-model.md'];
    for (const file of requiredFiles) {
      assert.ok(filesSection.includes(file), `Files Read table must include ${file}`);
    }
  } finally {
    await cleanup();
  }
});
