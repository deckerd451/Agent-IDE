export type SectionId =
  | 'Goals'
  | 'Architecture'
  | 'Backlog'
  | 'Decisions'
  | 'Validation'
  | 'Agents'
  | 'Code';

export type Section = {
  id: SectionId;
  eyebrow: string;
  summary: string;
  content: string[];
};

export const sections: Section[] = [
  {
    id: 'Goals',
    eyebrow: 'Repository intent',
    summary: 'What this codebase is trying to accomplish, why it exists, and what success looks like.',
    content: [
      '# Goals',
      '- Capture the product outcomes this repository is responsible for.',
      '- Keep active goals close to engineering context instead of buried in chat or tickets.',
      '- Make every coding session start from intent, not from a file tree.',
      '## V1 placeholder',
      'A future scan will read `.ai/goals.md` and summarize active, deferred, and completed goals.',
    ],
  },
  {
    id: 'Architecture',
    eyebrow: 'System map',
    summary: 'The current shape of the application, boundaries, dependencies, and important flows.',
    content: [
      '# Architecture',
      '- Show the major modules and the contracts between them.',
      '- Highlight risky coupling, ownership boundaries, and runtime assumptions.',
      '- Preserve architecture knowledge as the repository changes.',
      '## V1 placeholder',
      'Architecture notes will eventually come from `.ai/architecture.md` and repo-derived context.',
    ],
  },
  {
    id: 'Backlog',
    eyebrow: 'Next work',
    summary: 'A focused engineering backlog connected to goals and implementation context.',
    content: [
      '# Backlog',
      '- Prioritize work by goal, risk, and validation status.',
      '- Keep tasks small enough for a human or agent to execute safely.',
      '- Separate prototype ideas from committed engineering work.',
      '## V1 placeholder',
      'Backlog items will later be represented in `.ai/backlog.md` with links to decisions and validation.',
    ],
  },
  {
    id: 'Decisions',
    eyebrow: 'Technical memory',
    summary: 'Architectural decisions, tradeoffs, constraints, and the reasons behind them.',
    content: [
      '# Decisions',
      '- Record what was decided and what alternatives were rejected.',
      '- Make future changes easier by preserving context.',
      '- Keep decision records close to the code they affect.',
      '## V1 placeholder',
      'Decision records will map to `.ai/decisions/` in a later version.',
    ],
  },
  {
    id: 'Validation',
    eyebrow: 'Confidence system',
    summary: 'How the team proves the repository still works: tests, checks, releases, and review gates.',
    content: [
      '# Validation',
      '- Surface the commands that establish confidence.',
      '- Track known gaps in test coverage and manual verification.',
      '- Connect validation evidence back to goals and backlog items.',
      '## V1 placeholder',
      'Validation metadata will eventually live in `.ai/validation.md`.',
    ],
  },
  {
    id: 'Agents',
    eyebrow: 'Execution partners',
    summary: 'Planned agent roles, responsibilities, constraints, and handoff points.',
    content: [
      '# Agents',
      '- Define agent responsibilities before real automation exists.',
      '- Keep permissions and operating boundaries explicit.',
      '- Show which tasks are safe for agents and which require human judgment.',
      '## V1 placeholder',
      'No real agents run in V1. Future roles may be described in `.ai/agents.md`.',
    ],
  },
  {
    id: 'Code',
    eyebrow: 'Implementation view',
    summary: 'Code remains available, but it is framed by repository understanding instead of replacing it.',
    content: [
      '# Code',
      '- Provide a lightweight implementation entry point without becoming a full code editor.',
      '- Link code areas to goals, architecture, decisions, and validation status.',
      '- Keep file-level work subordinate to repository-level understanding.',
      '## V1 placeholder',
      'V1 intentionally does not include a code editor, repo scanner, CLI, or LLM integration.',
    ],
  },
];
