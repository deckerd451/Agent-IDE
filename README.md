# Agent IDE

Agent IDE is a prototype developer environment where the primary interface is repository understanding instead of the file tree. Traditional IDEs start with files, folders, search, Git, and terminals. Agent IDE starts with the context engineers and agents need before touching code:

- Goals
- Architecture
- Backlog
- Decisions
- Validation
- Agents
- Code

V1 is intentionally small: a local Vite + React + TypeScript app with a sidebar for these repository-understanding sections and markdown-like placeholder content in the main panel.

## How Agent IDE differs from a traditional IDE

A traditional IDE is optimized for direct code manipulation. The file tree is usually the default navigation model, and project intent lives somewhere else: tickets, documents, chat threads, architecture diagrams, and memory.

Agent IDE treats repository understanding as the primary surface:

- **Goals** explain what the repository is trying to accomplish.
- **Architecture** explains how the system is shaped and where boundaries are.
- **Backlog** connects future work to goals and implementation context.
- **Decisions** preserve technical tradeoffs and why they were made.
- **Validation** describes how the team proves the repository still works.
- **Agents** describes planned agent roles and constraints before automation is added.
- **Code** remains available, but it is framed by the surrounding product and engineering context.

This prototype does not include authentication, a database, a code editor, real agents, repository scanning, a CLI, or LLM integration.

## Run locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

## Future `.ai/` folder contract

Future versions can use a repository-local `.ai/` folder as the durable contract between humans, agents, and the IDE. The folder is not implemented in V1, but the intended shape is:

```text
.ai/
  goals.md
  architecture.md
  backlog.md
  validation.md
  agents.md
  decisions/
    0001-example-decision.md
```

The contract should stay plain-text, reviewable, and version-controlled. Agent IDE should read from it before taking action, update it when repository understanding changes, and connect every agent task back to goals, architecture, decisions, and validation evidence.
