import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const aiDir = join(root, '.ai');
const outputDir = join(aiDir, 'prompts');
const aiFiles = [
  'goals.md',
  'architecture.md',
  'backlog.md',
  'decisions.md',
  'validation.md',
  'agents.md',
  'code.md',
];

const roles = {
  architect: {
    title: 'Architect',
    instructions: [
      'Protect the repository architecture and make system boundaries explicit before implementation starts.',
      'Prefer small, local, deterministic changes that strengthen the `.ai/` repository-understanding contract.',
      'Identify tradeoffs, dependencies, validation needs, and follow-up decisions for any proposed change.',
    ],
    taskGuidance: [
      'Start from product goals and architecture before recommending implementation details.',
      'Call out architectural risks, missing context, and decision records that should be updated.',
      'Keep suggestions compatible with the current local-only, no-agent-execution scope.',
    ],
  },
  builder: {
    title: 'Builder',
    instructions: [
      'Implement focused repository changes using the existing project shape and scripts.',
      'Keep work reviewable, deterministic, and aligned with the `.ai/` documents.',
      'Update relevant documentation and validation notes when behavior or workflow changes.',
    ],
    taskGuidance: [
      'Translate backlog items into the smallest useful code or documentation change.',
      'Use existing local scripts and file conventions before introducing new tools.',
      'Run the documented validation commands for the files or behavior you change.',
    ],
  },
  reviewer: {
    title: 'Reviewer',
    instructions: [
      'Review changes against product goals, architecture, backlog intent, validation evidence, and constraints.',
      'Look for hidden scope expansion, missing documentation, unvalidated behavior, and inconsistency across `.ai/` files.',
      'Prefer actionable findings tied to specific repository context over broad style feedback.',
    ],
    taskGuidance: [
      'Check whether the change preserves the local-first repository-understanding contract.',
      'Verify that validation evidence is current and proportional to the change.',
      'Flag places where decisions, backlog, or code notes should be updated.',
    ],
  },
  debugger: {
    title: 'Debugger',
    instructions: [
      'Diagnose failures using repository context, deterministic commands, and the documented validation surface.',
      'Separate observed facts from hypotheses and avoid agent execution or LLM-dependent debugging steps.',
      'Prefer narrow fixes that preserve existing behavior and make future validation clearer.',
    ],
    taskGuidance: [
      'Reproduce failures with local commands before proposing code changes.',
      'Use architecture and code notes to identify likely fault boundaries.',
      'Update validation or known gaps when the debugging process reveals missing coverage.',
    ],
  },
};

const roleName = process.argv[2];

if (!roleName || !(roleName in roles)) {
  console.error(`Usage: npm run prompt -- <${Object.keys(roles).join('|')}>`);
  process.exit(1);
}

async function readAiFiles() {
  const entries = await Promise.all(
    aiFiles.map(async (fileName) => {
      const path = join(aiDir, fileName);
      const content = await readFile(path, 'utf8');
      return [fileName, content.trim()];
    }),
  );

  return Object.fromEntries(entries);
}

function section(title, body) {
  return `## ${title}\n\n${body.trim()}\n`;
}

function bullets(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function fenced(fileName, content) {
  return `### .ai/${fileName}\n\n\`\`\`markdown\n${content}\n\`\`\``;
}

function buildPrompt(role, docs) {
  const constraints = [
    'Do not make LLM calls.',
    'Do not execute agents.',
    'Treat the `.ai/` markdown files as the source of repository-understanding context.',
    'Prefer local, deterministic commands and reviewable file changes.',
  ];

  return `# Agent IDE ${role.title} Prompt\n\n${[
    section('Role Instructions', bullets(role.instructions)),
    section('Product Thesis', docs['goals.md']),
    section('Architecture Summary', docs['architecture.md']),
    section('Backlog Priorities', docs['backlog.md']),
    section('Validation Status', docs['validation.md']),
    section('Known Constraints', [bullets(constraints), docs['decisions.md'], docs['agents.md']].join('\n\n')),
    section('Task Guidance', bullets(role.taskGuidance)),
    section('Complete Repository Context', aiFiles.map((fileName) => fenced(fileName, docs[fileName])).join('\n\n')),
  ].join('\n')}`;
}

const docs = await readAiFiles();
await mkdir(outputDir, { recursive: true });
const outputPath = join(outputDir, `${roleName}.md`);
await writeFile(outputPath, buildPrompt(roles[roleName], docs));
console.log(`Wrote ${outputPath}`);
