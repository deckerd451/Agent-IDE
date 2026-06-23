import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const aiDir = join(root, '.ai');
const promptsDir = join(aiDir, 'prompts');

const requiredDocuments = [
  'goals.md',
  'architecture.md',
  'backlog.md',
  'decisions.md',
  'validation.md',
  'agents.md',
  'code.md',
];

const roleGuidance = {
  architect: {
    title: 'Architect',
    instructions: [
      'Think in systems, boundaries, tradeoffs, and long-lived maintainability.',
      'Use the repository intelligence layer to propose architecture that preserves local-first behavior.',
      'Prefer small, reversible decisions and document meaningful tradeoffs before implementation.',
    ],
    taskGuidance: [
      'Start by identifying the product outcome, system boundary, and affected flows.',
      'Call out architectural risks, constraints, and validation expectations before proposing code changes.',
      'When recommending work, connect it to goals, decisions, backlog priority, and validation gaps.',
    ],
  },
  builder: {
    title: 'Builder',
    instructions: [
      'Implement focused, reviewable changes that are grounded in the repository intelligence layer.',
      'Keep changes local-first and deterministic unless the repository explicitly says otherwise.',
      'Preserve existing behavior while adding the smallest useful increment toward the task.',
    ],
    taskGuidance: [
      'Restate the target change and identify the files or systems likely to be touched.',
      'Use the architecture, backlog, decisions, and validation notes to choose the safest implementation path.',
      'Finish with concrete validation results and any remaining follow-up work.',
    ],
  },
  reviewer: {
    title: 'Reviewer',
    instructions: [
      'Review for correctness, maintainability, product fit, and validation coverage.',
      'Compare proposed changes against goals, architecture, backlog priorities, decisions, constraints, and known gaps.',
      'Prioritize actionable findings over style preferences.',
    ],
    taskGuidance: [
      'Identify whether the change preserves documented dashboard and local-first behavior.',
      'Check that implementation choices align with current decisions and do not introduce hidden LLM or agent execution.',
      'Separate blocking issues from follow-up suggestions and cite the relevant repository context.',
    ],
  },
  debugger: {
    title: 'Debugger',
    instructions: [
      'Diagnose failures with evidence from local code, commands, and repository intelligence.',
      'Prefer deterministic reproduction steps before changing implementation.',
      'Keep fixes narrow and explain the root cause in terms of the documented system shape.',
    ],
    taskGuidance: [
      'Start with the observed symptom, expected behavior, and the smallest local reproduction path.',
      'Use validation status and known gaps to decide which checks are trustworthy or missing.',
      'Propose or apply the minimal fix, then rerun the most relevant local validation commands.',
    ],
  },
};

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function usage() {
  return [
    'Usage: npm run prompt -- <role>',
    '',
    'Supported roles:',
    ...Object.keys(roleGuidance).map((role) => `- ${role}`),
  ].join('\n');
}

async function readRequiredDocuments() {
  const missing = [];
  const documents = {};

  for (const fileName of requiredDocuments) {
    const path = join(aiDir, fileName);
    if (!(await pathExists(path))) {
      missing.push(`.ai/${fileName}`);
      continue;
    }

    documents[fileName] = await readFile(path, 'utf8');
  }

  if (missing.length > 0) {
    throw new Error(
      [
        'Cannot export a prompt because required repository intelligence files are missing:',
        ...missing.map((fileName) => `- ${fileName}`),
        '',
        'Run `npm run init:ai` to create starter files, then refresh any generated intelligence before exporting prompts.',
      ].join('\n'),
    );
  }

  return documents;
}

function section(title, content) {
  return [`## ${title}`, '', content.trim() || '_No content recorded._'].join('\n');
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function renderPrompt(role, documents) {
  const guidance = roleGuidance[role];

  return [
    `# Agent IDE Prompt: ${guidance.title}`,
    'Copy this prompt into Claude, GPT, Codex, Gemini, Cursor, Windsurf, or another coding assistant. It was generated locally from the repository `.ai/` intelligence layer. Do not assume live services, LLM calls, or agent execution are available unless the repository context below explicitly says so.',
    section('Role Instructions', bulletList(guidance.instructions)),
    section('Product Thesis', documents['goals.md']),
    section('Current Architecture Summary', documents['architecture.md']),
    section('Current Backlog Priorities', documents['backlog.md']),
    section('Validation Status', documents['validation.md']),
    section('Known Constraints', [
      '### Decisions',
      documents['decisions.md'].trim() || '_No decisions recorded._',
      '',
      '### Agent Constraints',
      documents['agents.md'].trim() || '_No agent constraints recorded._',
      '',
      '### Code Context',
      documents['code.md'].trim() || '_No code context recorded._',
    ].join('\n')),
    section('Task Guidance', bulletList(guidance.taskGuidance)),
    section('Operating Rules', bulletList([
      'No LLM calls are required to use this exported prompt.',
      'Do not execute agents as part of this prompt; treat agent notes as planning context only.',
      'Keep workflows local-first and deterministic unless the user explicitly provides different constraints.',
      'Preserve existing dashboard behavior unless the task specifically asks to change it.',
      'When making changes, validate with the most relevant local commands documented by this repository.',
    ])),
  ].join('\n\n') + '\n';
}

async function main() {
  const role = process.argv[2];
  if (!role || !Object.prototype.hasOwnProperty.call(roleGuidance, role)) {
    console.error(role ? `Unknown prompt role: ${role}\n` : 'Missing prompt role.\n');
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const documents = await readRequiredDocuments();
  const prompt = renderPrompt(role, documents);
  await mkdir(promptsDir, { recursive: true });

  const outputPath = join(promptsDir, `${role}.md`);
  await writeFile(outputPath, prompt);
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
