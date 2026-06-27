import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { generateExecutionModel } from '../scripts/execution-model.mjs';
import { analyzeImprovements, analyzeImprovementsWithTrace } from '../scripts/improvement-analyzer.mjs';

async function makeRepo(aiFiles = {}, srcFiles = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'exec-model-own-test-'));
  const aiDir = join(dir, '.ai');
  const srcDir = join(dir, 'src');
  const scriptsDir = join(dir, 'scripts');
  await mkdir(aiDir, { recursive: true });
  await mkdir(srcDir, { recursive: true });
  await mkdir(scriptsDir, { recursive: true });
  for (const [name, content] of Object.entries(aiFiles)) {
    await writeFile(join(aiDir, name), content, 'utf8');
  }
  for (const [name, content] of Object.entries(srcFiles)) {
    const dest = name.startsWith('src/') ? join(dir, name)
      : name.startsWith('scripts/') ? join(dir, name)
      : join(srcDir, name);
    await writeFile(dest, content, 'utf8');
  }
  return { dir, aiDir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const minimalAi = {
  'goals.md': '# Goals\n\n## Product Purpose\nLocal-first AI coding assistant.\n',
  'architecture.md': '# Architecture\n\n## Core Systems\n- Server\n- Client\n\n## Primary Flows\n- User → Server\n',
  'strategy.md': '# Strategy\n\n## Product Thesis\nOwn your AI context.\n',
  'decisions.md': '# Decisions\n\n## Active Decisions\n- All generators must be deterministic.\n',
  'validation.md': '# Validation\n\n## Commands Run\n- `npm test`\n',
  'repository-health.md': '# Repository Health\n\n## Risks\n- No risks detected.\n',
  'backlog.md': '# Backlog\n\n## Prioritized Backlog\n- Add feature.\n',
};

const workflowSrcWithLocalStorage = `
export const workflowStateStorageKey = 'agent-ide:workflow-state';
export const validationCompletionStorageKey = 'agent-ide:validation-completions';
export type ValidationCompletionRecord = { repositoryPath: string; workflowKey: string; };
`;

const appSrcWithLocalStorage = `
// App.tsx stub
import { validationCompletionStorageKey, workflowStateStorageKey } from './workflow';
window.localStorage.setItem(workflowStateStorageKey, JSON.stringify(state));
window.localStorage.setItem(validationCompletionStorageKey, JSON.stringify(completions));
const payload = { repositoryPath, validationCompletions: completionsBeforeRefresh };
fetch('/api/repository/refresh', { method: 'POST', body: JSON.stringify(payload) });
`;

const nextImprovementSrcWithCompletions = `
// next-improvement.mjs stub
export async function generateNextImprovement(repositoryPath, options = {}) {
  const validationCompletions = options.validationCompletions ?? [];
  const validationAlreadyCompleted = validationCompletions.some(r => r);
  return {};
}
`;

// ---------------------------------------------------------------------------
// Workflow persistence detection
// ---------------------------------------------------------------------------

test('execution-model detects workflow state persistence in localStorage', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, {
    'src/workflow.ts': workflowSrcWithLocalStorage,
    'src/App.tsx': appSrcWithLocalStorage,
    'scripts/next-improvement.mjs': nextImprovementSrcWithCompletions,
    'scripts/server.mjs': '// server stub\nconst validationCompletions = [];\n',
  });
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    assert.ok(output.includes('## Ownership Risks'), 'must include ## Ownership Risks section');
    assert.ok(
      output.includes('workflowStateStorageKey') || output.includes('workflow') && output.includes('localStorage'),
      'must detect workflow state localStorage persistence',
    );
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Validation completion ownership detection
// ---------------------------------------------------------------------------

test('execution-model detects validation completion records as client-owned', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, {
    'src/workflow.ts': workflowSrcWithLocalStorage,
    'src/App.tsx': appSrcWithLocalStorage,
    'scripts/next-improvement.mjs': nextImprovementSrcWithCompletions,
    'scripts/server.mjs': '// server stub\nconst validationCompletions = [];\n',
  });
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    assert.ok(
      output.includes('validationCompletionStorageKey') || output.includes('completion') && output.includes('client'),
      'must detect validation completion records as client-owned',
    );
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Client-owned recommendation state detection
// ---------------------------------------------------------------------------

test('execution-model detects client-owned recommendation state affecting server generation', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, {
    'src/workflow.ts': workflowSrcWithLocalStorage,
    'src/App.tsx': appSrcWithLocalStorage,
    'scripts/next-improvement.mjs': nextImprovementSrcWithCompletions,
    'scripts/server.mjs': '// server stub\nconst validationCompletions = [];\n',
  });
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    // Should detect that client supplies completions to server affecting recommendation suppression
    assert.ok(
      output.includes('Determinism') || output.includes('client-owned') || output.includes('client-supplied'),
      'must detect client-owned recommendation state',
    );
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Ownership Risks section is emitted
// ---------------------------------------------------------------------------

test('execution-model emits ## Ownership Risks section', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, {
    'src/workflow.ts': workflowSrcWithLocalStorage,
    'src/App.tsx': appSrcWithLocalStorage,
    'scripts/next-improvement.mjs': nextImprovementSrcWithCompletions,
    'scripts/server.mjs': '// server stub\nconst validationCompletions = [];\n',
  });
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    assert.ok(output.includes('## Ownership Risks'), 'execution-model.md must include ## Ownership Risks section');
  } finally {
    await cleanup();
  }
});

test('Ownership Risks section appears before Architectural Risks section', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, {
    'src/workflow.ts': workflowSrcWithLocalStorage,
    'src/App.tsx': appSrcWithLocalStorage,
    'scripts/next-improvement.mjs': nextImprovementSrcWithCompletions,
    'scripts/server.mjs': '// server stub\nconst validationCompletions = [];\n',
  });
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const ownershipPos = output.indexOf('## Ownership Risks');
    const archRisksPos = output.indexOf('## Architectural Risks');
    assert.ok(ownershipPos !== -1, '## Ownership Risks must be present');
    assert.ok(archRisksPos !== -1, '## Architectural Risks must be present');
    assert.ok(ownershipPos < archRisksPos, '## Ownership Risks must appear before ## Architectural Risks');
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Improvement Analyzer produces candidates from Ownership Risks
// ---------------------------------------------------------------------------

test('Improvement Analyzer produces at least one improvement candidate from execution-model ownership risks', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, {
    'src/workflow.ts': workflowSrcWithLocalStorage,
    'src/App.tsx': appSrcWithLocalStorage,
    'scripts/next-improvement.mjs': nextImprovementSrcWithCompletions,
    'scripts/server.mjs': '// server stub\nconst validationCompletions = [];\n',
  });
  try {
    await generateExecutionModel(dir);
    const executionModel = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const candidates = analyzeImprovements({ executionModel });
    assert.ok(candidates.length > 0, 'analyzer must produce at least one improvement candidate');
    assert.ok(candidates.every((c) => c.class === 'improvement'), 'all candidates must have class:improvement');
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Improvement candidates outrank validation maintenance
// ---------------------------------------------------------------------------

test('improvement candidates have higher priority score than ai-handoff-validation maintenance', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi, {
    'src/workflow.ts': workflowSrcWithLocalStorage,
    'src/App.tsx': appSrcWithLocalStorage,
    'scripts/next-improvement.mjs': nextImprovementSrcWithCompletions,
    'scripts/server.mjs': '// server stub\nconst validationCompletions = [];\n',
  });
  try {
    await generateExecutionModel(dir);
    const executionModel = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    const { candidates } = analyzeImprovementsWithTrace({ executionModel });
    assert.ok(candidates.length > 0, 'must have improvement candidates');
    const topCandidate = candidates[0];
    assert.equal(topCandidate.class, 'improvement', 'top candidate must be class:improvement');
    // ai-handoff-validation has base priority 10; improvements have 84+
    assert.ok((topCandidate.priority ?? 0) > 10, `improvement priority ${topCandidate.priority} must exceed ai-handoff-validation base priority 10`);
  } finally {
    await cleanup();
  }
});

// ---------------------------------------------------------------------------
// Empty repo produces skeleton without errors
// ---------------------------------------------------------------------------

test('execution-model with no source files produces skeleton without Ownership Risks content', async () => {
  const { dir, cleanup } = await makeRepo(minimalAi);
  try {
    await generateExecutionModel(dir);
    const output = await readFile(join(dir, '.ai', 'execution-model.md'), 'utf8');
    assert.ok(output.includes('## Ownership Risks'), 'section heading must still be present');
    assert.ok(
      output.includes('No ownership risks detected') || output.includes('- No ownership risks'),
      'must indicate no risks when source files absent',
    );
  } finally {
    await cleanup();
  }
});
