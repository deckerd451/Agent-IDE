import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const starterFiles = {
  'goals.md': `# Goals

- Define the product and engineering outcomes this repository is responsible for.
- Keep intent visible before implementation details.
- Connect future work to measurable repository success.
`,
  'architecture.md': `# Architecture

- Describe the system shape, boundaries, dependencies, and important flows.
- Keep architecture notes close to the code they explain.
`,
  'backlog.md': `# Backlog

- Track focused work items connected to goals and implementation context.
- Keep tasks small enough to review and validate.
`,
  'decisions.md': `# Decisions

- Record technical decisions, tradeoffs, alternatives, and consequences.

## Template

- Decision:
- Context:
- Alternatives:
- Consequences:
`,
  'validation.md': `# Validation

- List the tests, checks, release steps, and review gates that prove the repository still works.
- Record known gaps and manual verification steps.
`,
  'agents.md': `# Agents

- Describe planned agent roles, responsibilities, constraints, and handoff points.
- Keep this as planning context until real automation is intentionally added.
`,
  'code.md': `# Code

- Capture implementation notes that should be framed by goals, architecture, decisions, and validation.
- This prototype does not include a code editor.
`,
};

const aiDir = join(process.cwd(), '.ai');
await mkdir(aiDir, { recursive: true });

await Promise.all(
  Object.entries(starterFiles).map(([fileName, content]) =>
    writeFile(join(aiDir, fileName), content, { flag: 'wx' }).catch((error) => {
      if (error?.code === 'EEXIST') {
        return;
      }

      throw error;
    }),
  ),
);

console.log('Initialized .ai/ starter files. Existing files were left unchanged.');
