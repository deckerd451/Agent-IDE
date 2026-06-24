import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = process.cwd();
const aiDir = join(root, '.ai');
const validationPath = join(aiDir, 'validation.md');
const packageJsonPath = join(root, 'package.json');
const manualHeader = '## Manual Validation Notes';
const ignoredProjectDirs = new Set(['.git', 'node_modules', '.ai', 'dist', 'build', 'DerivedData']);
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


async function detectXcodeProjects(dir = root) {
  const entries = await readdir(dir, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT' || error?.code === 'EACCES' || error?.code === 'EPERM') return [];
    throw error;
  });
  const projects = [];
  const workspaces = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const absolutePath = join(dir, entry.name);
    const relativePath = relative(root, absolutePath) || entry.name;

    if (entry.name.endsWith('.xcodeproj')) {
      projects.push(relativePath);
      continue;
    }
    if (entry.name.endsWith('.xcworkspace')) {
      workspaces.push(relativePath);
      continue;
    }
    if (ignoredProjectDirs.has(entry.name)) continue;

    const nested = await detectXcodeProjects(absolutePath);
    projects.push(...nested.projects);
    workspaces.push(...nested.workspaces);
  }

  return { projects: projects.sort(), workspaces: workspaces.sort() };
}

function detectXcodeCommands(xcodeProjects) {
  return xcodeProjects.projects.map((project) => ({
    project,
    command: `xcodebuild -list -project ${JSON.stringify(project)}`,
  }));
}

function parseXcodeSchemes(output) {
  const lines = stripAnsi(output).split('\n');
  const schemes = [];
  let inSchemes = false;

  for (const line of lines) {
    if (/^\s*Schemes:\s*$/.test(line)) {
      inSchemes = true;
      continue;
    }
    if (inSchemes) {
      const scheme = line.trim();
      if (!scheme) continue;
      if (scheme.endsWith(':')) break;
      schemes.push(scheme);
    }
  }

  return schemes;
}

function formatXcodeMetadata(xcodeProjects, xcodeResults) {
  if (xcodeProjects.projects.length === 0 && xcodeProjects.workspaces.length === 0) {
    return '- No Xcode project or workspace metadata detected.';
  }

  const sections = ['- Xcode project validation metadata detected.'];
  if (xcodeProjects.projects.length > 0) {
    sections.push('- Projects detected:');
    sections.push(...xcodeProjects.projects.map((project) => `  - \`${project}\``));
  }
  if (xcodeProjects.workspaces.length > 0) {
    sections.push('- Workspaces detected:');
    sections.push(...xcodeProjects.workspaces.map((workspace) => `  - \`${workspace}\``));
  }

  sections.push('- Safe validation candidates:');
  if (xcodeResults.length > 0) {
    sections.push(...xcodeResults.map((result) => `  - \`${result.command}\``));
  } else {
    sections.push('  - None; no `.xcodeproj` bundle was detected for `xcodebuild -list -project`.');
  }
  sections.push('- Full simulator/device build: Not run by default; no full `xcodebuild build` command was executed.');

  return sections.join('\n');
}

function formatXcodeResults(results) {
  if (results.length === 0) return '- No `xcodebuild -list` commands were run.';

  return results
    .map((result) => {
      const status = result.exitCode === 0 ? 'PASS' : 'UNAVAILABLE';
      const schemes = parseXcodeSchemes(result.output);
      return [
        `### ${result.command}`,
        `- Status: ${status}`,
        `- Exit code: ${result.exitCode}`,
        `- Duration: ${(result.durationMs / 1000).toFixed(1)}s`,
        `- Schemes detected: ${schemes.length > 0 ? schemes.map((scheme) => `\`${scheme}\``).join(', ') : 'None available from command output.'}`,
        '- Output summary:',
        '```text',
        summarizeOutput(result.output),
        '```',
      ].join('\n');
    })
    .join('\n\n');
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

function formatKnownGaps(scripts, commands, xcodeProjects) {
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
  if (xcodeProjects.projects.length > 0 || xcodeProjects.workspaces.length > 0) {
    gaps.push('Xcode metadata validation is partial: `xcodebuild -list` is safe and deterministic, but full simulator/device builds are not run by default.');
  }

  return gaps.map((gap) => `- ${gap}`).join('\n') || '- No validation gaps detected from package scripts.';
}

function confidenceFor(results, commands, xcodeProjects) {
  if (results.some((result) => result.exitCode !== 0)) return 'Low';
  if (commands.length >= 3) return 'High';
  if (commands.some(({ scriptName }) => scriptName === 'build')) return 'Medium';
  if (xcodeProjects.projects.length > 0 || xcodeProjects.workspaces.length > 0) return 'Medium';
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
  const xcodeProjects = await detectXcodeProjects();
  const xcodeCommands = detectXcodeCommands(xcodeProjects);
  const manualNotes = await readExistingManualNotes();
  const results = [];
  const xcodeResults = [];

  for (const { command } of commands) {
    console.log(`\n> ${command}`);
    results.push(await runCommand(command));
  }

  for (const { command } of xcodeCommands) {
    console.log(`\n> ${command}`);
    xcodeResults.push(await runCommand(command));
  }

  const overallStatus = results.every((result) => result.exitCode === 0) ? 'Passing' : 'Failing';
  const content = [
    '# Validation',
    '',
    '## Last Validation',
    `- ${new Date().toISOString()}`,
    '',
    '## Confidence',
    `- ${confidenceFor(results, commands, xcodeProjects)}`,
    '',
    `## Overall Status: ${overallStatus}`,
    '',
    '## Commands Run',
    commands.length > 0 ? commands.map(({ command }) => `- \`${command}\``).join('\n') : '- None',
    '',
    '## Results',
    formatResults(results),
    '',
    '## Xcode Project Validation',
    formatXcodeMetadata(xcodeProjects, xcodeResults),
    '',
    '## Xcode List Results',
    formatXcodeResults(xcodeResults),
    '',
    '## Known Gaps',
    formatKnownGaps(scripts, commands, xcodeProjects),
    '',
    manualNotes,
  ].join('\n');

  await mkdir(aiDir, { recursive: true });
  await writeFile(validationPath, content);
  console.log(`\nWrote ${validationPath}`);

  if (overallStatus === 'Failing') process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  detectXcodeCommands,
  detectXcodeProjects,
  formatXcodeMetadata,
  formatXcodeResults,
  parseXcodeSchemes,
};
