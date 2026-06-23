import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const aiDir = join(root, '.ai');
const validationPath = join(aiDir, 'validation.md');
const packageJsonPath = join(root, 'package.json');
const manualHeader = '## Manual Validation Notes';
const safeValidationScriptNames = [
  'build',
  'typecheck',
  'type:check',
  'check',
  'lint',
  'test',
  'test:unit',
  'test:ci',
];

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readExistingManualNotes() {
  if (!(await pathExists(validationPath))) return `${manualHeader}\n`;

  const current = await readFile(validationPath, 'utf8');
  const manualIndex = current.indexOf(manualHeader);
  if (manualIndex === -1) return `${manualHeader}\n`;

  return `${current.slice(manualIndex).trimEnd()}\n`;
}

function detectCommands(scripts) {
  const commands = [];
  for (const scriptName of safeValidationScriptNames) {
    if (scriptName === 'validate:intel') continue;
    if (Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
      commands.push({ scriptName, command: `npm run ${scriptName}` });
    }
  }

  return commands;
}

function runCommand(command) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      env: { ...process.env, CI: process.env.CI ?? 'true' },
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      output += chunk.toString();
    });
    child.on('close', (exitCode) => {
      resolve({
        command,
        exitCode: exitCode ?? 1,
        durationMs: Date.now() - startedAt,
        output: output.trim(),
      });
    });
  });
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
}

function summarizeOutput(output) {
  if (!output) return 'No output captured.';

  const lines = stripAnsi(output)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const tail = lines.slice(-12);
  return tail.map((line) => `  ${line}`).join('\n');
}

function formatResults(results) {
  if (results.length === 0) return '- No deterministic validation commands were detected.';

  return results
    .map((result) => {
      const status = result.exitCode === 0 ? 'PASS' : 'FAIL';
      return [
        `### ${result.command}`,
        `- Status: ${status}`,
        `- Exit code: ${result.exitCode}`,
        `- Duration: ${(result.durationMs / 1000).toFixed(1)}s`,
        '- Output summary:',
        '```text',
        summarizeOutput(result.output),
        '```',
      ].join('\n');
    })
    .join('\n\n');
}

function formatKnownGaps(scripts, commands) {
  const commandNames = new Set(commands.map(({ scriptName }) => scriptName));
  const gaps = [];

  if (!commandNames.has('build')) {
    gaps.push('No `npm run build` script was detected, so production build validation could not run.');
  }
  if (!['test', 'test:unit', 'test:ci'].some((name) => commandNames.has(name))) {
    gaps.push('No safe npm test script was detected; automated behavioral coverage is unknown.');
  }
  if (!commandNames.has('lint')) {
    gaps.push('No `npm run lint` script was detected; style/static lint coverage is unknown.');
  }
  if (!['typecheck', 'type:check', 'check'].some((name) => commandNames.has(name)) && commandNames.has('build')) {
    gaps.push('No standalone typecheck script was detected; type validation is covered only insofar as the build runs it.');
  }
  if (Object.keys(scripts).length === 0) {
    gaps.push('No package scripts were detected in `package.json`.');
  }

  return gaps.map((gap) => `- ${gap}`).join('\n') || '- No validation gaps detected from package scripts.';
}

function confidenceFor(results, commands) {
  if (results.some((result) => result.exitCode !== 0)) return 'Low';
  if (commands.length >= 3) return 'High';
  if (commands.some(({ scriptName }) => scriptName === 'build')) return 'Medium';
  return 'Low';
}

async function main() {
  const packageText = await readFile(packageJsonPath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return '{}';
    throw error;
  });
  const packageJson = JSON.parse(packageText || '{}');
  const scripts = packageJson.scripts ?? {};
  const commands = detectCommands(scripts);
  const manualNotes = await readExistingManualNotes();
  const results = [];

  for (const { command } of commands) {
    console.log(`\n> ${command}`);
    results.push(await runCommand(command));
  }

  const overallStatus = results.every((result) => result.exitCode === 0) ? 'Passing' : 'Failing';
  const content = [
    '# Validation',
    '',
    '## Last Validation',
    `- ${new Date().toISOString()}`,
    '',
    '## Confidence',
    `- ${confidenceFor(results, commands)}`,
    '',
    `## Overall Status: ${overallStatus}`,
    '',
    '## Commands Run',
    commands.length > 0 ? commands.map(({ command }) => `- \`${command}\``).join('\n') : '- None',
    '',
    '## Results',
    formatResults(results),
    '',
    '## Known Gaps',
    formatKnownGaps(scripts, commands),
    '',
    manualNotes,
  ].join('\n');

  await mkdir(aiDir, { recursive: true });
  await writeFile(validationPath, content);
  console.log(`\nWrote ${validationPath}`);

  if (overallStatus === 'Failing') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
