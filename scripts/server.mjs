import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, '..');
const port = Number(process.env.AGENT_IDE_PORT ?? 5174);

const allowedIntelligenceFiles = new Set(['goals.md', 'architecture.md', 'strategy.md', 'backlog.md', 'decisions.md', 'validation.md', 'agents.md', 'code.md', 'repository-health.md', 'context-package.md', 'prompts/architect.md', 'prompts/builder.md', 'prompts/reviewer.md', 'prompts/debugger.md']);

const baselineFiles = {
  'goals.md': `# Goals
## Product Purpose

## North Star Metric

## Current Focus

## Current Priorities

## Success Criteria

## Manual Goals
`,
  'strategy.md': `# Strategy

## Product Thesis

## North Star Metric

## Strategic Differentiator

## Current Product Bet

## Current Experiment

## What Not To Build

## Success Definition

## Manual Strategy Notes
`,
  'agents.md': `# Agents
## Current Status
No autonomous agents run in this repository.

## Intended Roles
- Architect
- Builder
- Reviewer
- Debugger

## Operating Constraints
- Use repository intelligence before editing code.
- Preserve local-first, reviewable changes.
`,
  'code.md': `# Code
## Implementation Entry Points
Generated placeholder. Use this file to record important code entry points.

## Notes
Code should be interpreted through Goals, Architecture, Decisions, Backlog, and Validation.
`,
};

const baselineStep = { id: 'baseline-files', label: 'Baseline Files' };

const generatorSteps = [
  { id: 'architecture', label: 'Architecture', command: ['node', [join(appRoot, 'scripts/audit.mjs')]] },
  { id: 'backlog', label: 'Backlog', command: ['node', [join(appRoot, 'scripts/backlog.mjs')]] },
  { id: 'validation', label: 'Validation', command: ['node', [join(appRoot, 'scripts/validate-intel.mjs')]] },
  { id: 'decisions', label: 'Decisions', command: ['node', [join(appRoot, 'scripts/decisions.mjs')]] },
  { id: 'strategy', label: 'Strategy', command: ['node', [join(appRoot, 'scripts/strategy.mjs')]] },
  ...['architect', 'builder', 'reviewer', 'debugger'].map((role) => ({
    id: `prompts:${role}`,
    label: `Prompts (${role})`,
    command: ['node', [join(appRoot, 'scripts/prompt.mjs'), role]],
  })),
  { id: 'repository-health', label: 'Repository Health', command: ['node', [join(appRoot, 'scripts/health.mjs')]] },
  { id: 'context-package', label: 'Context Package', command: ['node', [join(appRoot, 'scripts/context-package.mjs')]] },
];

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function validateRepositoryPath(repositoryPath) {
  if (!repositoryPath || typeof repositoryPath !== 'string') {
    throw new Error('Repository path is required.');
  }
  const resolvedPath = resolve(repositoryPath);
  const stats = await stat(resolvedPath).catch((error) => {
    if (error?.code === 'ENOENT') throw new Error(`Path does not exist: ${resolvedPath}`);
    throw error;
  });
  if (!stats.isDirectory()) throw new Error(`Path is not a directory: ${resolvedPath}`);
  return resolvedPath;
}

function runStep(step, cwd) {
  return new Promise((resolveStep) => {
    const startedAt = Date.now();
    const [command, args] = step.command;
    const child = spawn(command, args, { cwd, shell: false, env: { ...process.env, CI: process.env.CI ?? 'true' } });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk) => { output += chunk.toString(); });
    child.on('close', (exitCode) => {
      resolveStep({
        id: step.id,
        label: step.label,
        exitCode: exitCode ?? 1,
        durationMs: Date.now() - startedAt,
        output: output.trim(),
      });
    });
  });
}

function writeEvent(response, event) {
  response.write(`${JSON.stringify(event)}\n`);
}

async function ensureBaselineFiles(repositoryPath) {
  const startedAt = Date.now();
  const aiDir = join(repositoryPath, '.ai');
  const created = [];
  const preserved = [];

  await mkdir(aiDir, { recursive: true });

  for (const [fileName, content] of Object.entries(baselineFiles)) {
    try {
      await writeFile(join(aiDir, fileName), content, { flag: 'wx' });
      created.push(fileName);
    } catch (error) {
      if (error?.code === 'EEXIST') {
        preserved.push(fileName);
        continue;
      }
      throw error;
    }
  }

  const details = [
    created.length ? `Created: ${created.join(', ')}` : 'Created: none',
    preserved.length ? `Preserved existing: ${preserved.join(', ')}` : 'Preserved existing: none',
  ];

  return {
    id: baselineStep.id,
    label: baselineStep.label,
    exitCode: 0,
    durationMs: Date.now() - startedAt,
    output: details.join('\n'),
  };
}

async function handleRefresh(request, response) {
  const { repositoryPath } = await readJson(request);
  const resolvedPath = await validateRepositoryPath(repositoryPath);
  await mkdir(join(resolvedPath, '.ai'), { recursive: true });

  response.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  });
  writeEvent(response, { type: 'started', repositoryPath: resolvedPath, total: generatorSteps.length + 1 });

  const results = [];
  writeEvent(response, { type: 'step-started', id: baselineStep.id, label: baselineStep.label });
  const baselineResult = await ensureBaselineFiles(resolvedPath);
  results.push(baselineResult);
  writeEvent(response, { type: 'step-finished', ...baselineResult });
  for (const step of generatorSteps) {
    writeEvent(response, { type: 'step-started', id: step.id, label: step.label });
    const result = await runStep(step, resolvedPath);
    results.push(result);
    writeEvent(response, { type: 'step-finished', ...result });
  }

  const failed = results.filter((result) => result.exitCode !== 0);
  writeEvent(response, {
    type: failed.length === 0 ? 'success' : 'failure',
    repositoryPath: resolvedPath,
    aiPath: join(resolvedPath, '.ai'),
    results,
    summary: failed.length === 0 ? 'Repository intelligence refreshed.' : `${failed.length} generator(s) failed.`,
  });
  response.end();
}

async function handleFile(request, response, url) {
  const repositoryPath = url.searchParams.get('repositoryPath');
  const file = url.searchParams.get('file');
  if (!file || !allowedIntelligenceFiles.has(file)) return sendJson(response, 400, { error: 'Unsupported file.' });

  const resolvedPath = await validateRepositoryPath(repositoryPath);
  const sourcePath = join(resolvedPath, '.ai', file);
  const content = await readFile(sourcePath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });

  sendJson(response, 200, {
    repositoryPath: resolvedPath,
    file,
    sourcePath,
    exists: content !== null,
    content: content ?? '',
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') return sendJson(response, 204, {});
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (request.method === 'POST' && url.pathname === '/api/repository/refresh') return handleRefresh(request, response);
    if (request.method === 'GET' && url.pathname === '/api/repository/file') return handleFile(request, response, url);
    if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { ok: true });
    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, () => {
  console.log(`Agent IDE local server listening on http://localhost:${port}`);
});
