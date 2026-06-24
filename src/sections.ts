export type SectionId =
  | 'Goals'
  | 'Architecture'
  | 'Backlog'
  | 'Decisions'
  | 'Validation'
  | 'Agents'
  | 'Code'
  | 'Repository Health'
  | 'Prompt Center'
  | 'Context Package';

export type Section = {
  id: SectionId;
  eyebrow: string;
  summary: string;
  markdownFile: string;
};

export const sections: Section[] = [
  {
    id: 'Goals',
    eyebrow: 'Repository intent',
    summary: 'What this codebase is trying to accomplish, why it exists, and what success looks like.',
    markdownFile: 'goals.md',
  },
  {
    id: 'Architecture',
    eyebrow: 'System map',
    summary: 'The current shape of the application, boundaries, dependencies, and important flows.',
    markdownFile: 'architecture.md',
  },
  {
    id: 'Backlog',
    eyebrow: 'Next work',
    summary: 'A focused engineering backlog connected to goals and implementation context.',
    markdownFile: 'backlog.md',
  },
  {
    id: 'Decisions',
    eyebrow: 'Technical memory',
    summary: 'Architectural decisions, tradeoffs, constraints, and the reasons behind them.',
    markdownFile: 'decisions.md',
  },
  {
    id: 'Validation',
    eyebrow: 'Confidence system',
    summary: 'How the team proves the repository still works: tests, checks, releases, and review gates.',
    markdownFile: 'validation.md',
  },
  {
    id: 'Agents',
    eyebrow: 'Execution partners',
    summary: 'Planned agent roles, responsibilities, constraints, and handoff points.',
    markdownFile: 'agents.md',
  },
  {
    id: 'Code',
    eyebrow: 'Implementation view',
    summary: 'Code remains available, but it is framed by repository understanding instead of replacing it.',
    markdownFile: 'code.md',
  },
  {
    id: 'Repository Health',
    eyebrow: 'Intelligence audit',
    summary: 'Quality, completeness, reliability, and next steps for the repository intelligence layer.',
    markdownFile: 'repository-health.md',
  },
  {
    id: 'Prompt Center',
    eyebrow: 'One-click prompts',
    summary: 'View, copy, and download generated Architect, Builder, Reviewer, and Debugger prompts.',
    markdownFile: 'prompts/architect.md',
  },
  {
    id: 'Context Package',
    eyebrow: 'Assistant handoff',
    summary: 'A compact generated context package for pasting repository intelligence into GPT, Claude, Cursor, Codex, and other assistants.',
    markdownFile: 'context-package.md',
  },
];
