import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { generateExecutionModel } from '../scripts/execution-model.mjs';

async function makeRepo(aiFiles = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'exec-model-test-'));
  const aiDir = join(dir, '.ai');
  await mkdir(aiDir, { recursive: true });
  for (const [name, content] of Object.entries(aiFiles)) {
    await writeFile(join(aiDir, name), content, 'utf8');
  }
  return { dir, aiDir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const minimalAi = {
  'goals.md': `# Goals\n\n## Product Purpose\nLocal-first AI coding assistant.\n\n## Success Criteria\n- All intelligence is deterministic\n- No cloud dependencies\n`,
  'architecture.md': `# Architecture\n\n## Core Systems\n- Server: HTTP API and file watcher\n- Client: React SPA\n\n## Primary Flows\n- User → Server → AI Generator → .ai/\n`,
  'strategy.md': `# Strategy\n\n## Product Thesis\nLet developers own their AI context.\n`,
  'decisions.md': `# Decisions\n\n## Active Decisions\n- All generators must be deterministic — no Math.random, no Date.now\n- Single canonical source for each intelligence artifact\n`,
  'validation.md': `# Validation\n\n## Commands Run\n- \`npm run build\`\n- \`npm test\`\n- \`npm run lint\`\n`,
  'repository-health.md': `# Repository Health\n\n## Risks\n- Context package grows stale if not refreshed\n`,
  'backlog.md': `# Backlog\n\n## Prioritized Backlog\n- Initialize repository intelligence on first connect\n- Refresh intelligence after each implementation\n`,
};

test('execution-model.md is byte-for-byte deterministic across two sequential calls', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateExecutionModel(dir);
    const first = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    await generateExecutionModel(dir);
    const second = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    assert.equal(first, second, 'Two sequential calls must produce byte-for-byte identical output');
  } finally {
    await cleanup();
  }
});

test('identical repositories generate identical execution models', async () => {
  const { dir: dirA, cleanup: cleanA } = await makeRepo(minimalAi);
  const { dir: dirB, cleanup: cleanB } = await makeRepo(minimalAi);
  try {
    await generateExecutionModel(dirA);
    await generateExecutionModel(dirB);
    const a = await readFile(join(dirA, '.ai', 'execution-model.md'), 'utf8');
    const b = await readFile(join(dirB, '.ai', 'execution-model.md'), 'utf8');
    assert.equal(a, b, 'Identical repository inputs must produce identical execution models');
  } finally {
    await Promise.all([cleanA(), cleanB()]);
  }
});

test('ownership table is deterministic and covers the 9 canonical concepts', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const expectedConcepts = [
      'Product Intent',
      'Architecture Description',
      'Product Strategy',
      'Prioritized Work',
      'Technical Decisions',
      'Validation Evidence',
      'Intelligence Quality',
      'Ranked Recommendation',
      'Handoff Artifact',
    ];
    for (const concept of expectedConcepts) {
      assert.ok(output.includes(concept), `Ownership table must include concept: ${concept}`);
    }
    // Determinism: call again and compare the Sources of Truth section
    await generateExecutionModel(dir);
    const output2 = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const extractSection = (text) => {
      const start = text.indexOf('## Sources of Truth');
      const end = text.indexOf('\n## ', start + 1);
      return end === -1 ? text.slice(start) : text.slice(start, end);
    };
    assert.equal(extractSection(output), extractSection(output2), 'Sources of Truth section must be byte-for-byte deterministic');
  } finally {
    await cleanup();
  }
});

test('inferred state transitions are deterministic and backed by architecture or validation evidence', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const stateSection = (() => {
      const start = output.indexOf('## Repository State Transitions');
      const end = output.indexOf('\n## ', start + 1);
      return end === -1 ? output.slice(start) : output.slice(start, end);
    })();
    // The minimalAi has validation commands — expect CI transitions
    assert.ok(stateSection.includes('Source Changed') || stateSection.includes('Validation Running') || stateSection.includes('architecture.md'),
      'State transitions must cite architecture.md or validation evidence');
    // Determinism
    await generateExecutionModel(dir);
    const output2 = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const stateSection2 = (() => {
      const start = output2.indexOf('## Repository State Transitions');
      const end = output2.indexOf('\n## ', start + 1);
      return end === -1 ? output2.slice(start) : output2.slice(start, end);
    })();
    assert.equal(stateSection, stateSection2, 'Repository State Transitions section must be byte-for-byte deterministic');
  } finally {
    await cleanup();
  }
});

test('architectural risks cite evidence sources and are not invented', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const risksSection = (() => {
      const start = output.indexOf('## Architectural Risks');
      const end = output.indexOf('\n## ', start + 1);
      return end === -1 ? output.slice(start) : output.slice(start, end);
    })();
    // If risks are present, each must reference an evidence source from the .ai/ directory or a known category
    const riskBlocks = risksSection.split('\n- **').slice(1);
    for (const block of riskBlocks) {
      const hasEvidence = block.includes('Evidence:') && (block.includes('.ai/') || block.includes('directory'));
      assert.ok(hasEvidence, `Risk block must cite evidence from .ai/ directory:\n${block}`);
    }
  } finally {
    await cleanup();
  }
});

test('execution model output contains no repository-specific recommendations or action instructions', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    // Must not contain recommendation-style directives aimed at the user/agent
    const forbiddenPatterns = [
      /you should/i,
      /you must/i,
      /recommended action:/i,
      /next step:/i,
      /action required/i,
      /implement this/i,
    ];
    for (const pat of forbiddenPatterns) {
      assert.doesNotMatch(output, pat, `execution-model.md must not contain recommendation directives matching: ${pat}`);
    }
  } finally {
    await cleanup();
  }
});

test('generator produces all 7 required sections', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const requiredSections = [
      '## Repository Execution Model',
      '## Canonical Entities',
      '## Sources of Truth',
      '## Repository State Transitions',
      '## Architectural Invariants',
      '## Architectural Risks',
      '## Execution Confidence',
      '## Manual Execution Notes',
    ];
    for (const section of requiredSections) {
      assert.ok(output.includes(section), `execution-model.md must include section: ${section}`);
    }
  } finally {
    await cleanup();
  }
});

test('generator preserves existing Manual Execution Notes across regenerations', async () => {
  const { dir, aiDir, cleanup } = await makeRepo(minimalAi);
  try {
    // First run — creates file
    await generateExecutionModel(dir);
    // Append manual notes
    const first = await readFile(join(aiDir, 'execution-model.md'), 'utf8');
    const withNotes = first + '\nHand-written invariant: do not use LLMs at runtime.\n';
    await writeFile(join(aiDir, 'execution-model.md'), withNotes, 'utf8');
    // Second run — must preserve the manual note
    await generateExecutionModel(dir);
    const second = await readFile(join(aiDir, 'execution-model.md'), 'utf8');
    assert.ok(second.includes('Hand-written invariant: do not use LLMs at runtime.'),
      'Manual Execution Notes must be preserved across regenerations');
  } finally {
    await cleanup();
  }
});

test('empty repository produces a valid skeleton with all section headings', async () => {
  const { dir, cleanup } = await makeRepo({});
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    assert.ok(output.startsWith('# Execution Model'), 'Must start with # Execution Model heading');
    assert.ok(output.includes('## Canonical Entities'), 'Must include ## Canonical Entities');
    assert.ok(output.includes('## Sources of Truth'), 'Must include ## Sources of Truth');
    assert.ok(output.includes('## Execution Confidence'), 'Must include ## Execution Confidence');
  } finally {
    await cleanup();
  }
});
