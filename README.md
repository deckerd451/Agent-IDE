# Agent IDE

Agent IDE is a prototype developer environment where the primary interface is repository understanding instead of the file tree. Traditional IDEs start with files, folders, search, Git, and terminals. Agent IDE starts with the context engineers and agents need before touching code:

- Goals
- Architecture
- Backlog
- Decisions
- Validation
- Agents
- Code

V1 is intentionally small: a local Vite + React + TypeScript app with a sidebar for these repository-understanding sections. Each tab renders the matching markdown file from the repository-local `.ai/` folder.

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

This prototype does not include authentication, a database, a code editor, real agents, CLI packaging, or LLM integration. Repository scanning is limited to local deterministic commands such as `npm run audit` for `.ai/architecture.md` and `npm run backlog` for `.ai/backlog.md`, both without calling an LLM.

## `.ai/` folder contract

Agent IDE reads repository understanding from plain markdown files in `.ai/`:

```text
.ai/
  goals.md
  architecture.md
  backlog.md
  decisions.md
  validation.md
  agents.md
  code.md
```

Each sidebar tab maps directly to one file. If a file is missing, the app shows an empty state that names the missing file and suggests running the initializer.

The contract is intentionally plain-text, reviewable, and version-controlled. It should help humans and future automation share the same repository context before any code changes happen.

## Run locally

Install dependencies:

```bash
npm install
```

Initialize the `.ai/` starter files if they are not already present:

```bash
npm run init:ai
```

Audit the repository and update `.ai/architecture.md` locally:

```bash
npm run audit
```

The audit infers repository understanding from local README, `.ai/` documents, `package.json` scripts, source structure, and dependencies. It writes product thesis, core systems, primary flows, current focus, key commands, known gaps, and a lower repository-structure section while preserving the timestamp, confidence score, and anything already written under `## Manual Notes`.

Generate or refresh `.ai/backlog.md` locally:

```bash
npm run backlog
```

The backlog generator scans local code comments for TODO, FIXME, HACK, XXX, and NOTE markers, then scans README and `.ai/` markdown for known gaps, future work, limitations, and missing capabilities. It writes prioritized backlog items with source, reason, and suggested next step while preserving anything already written under `## Manual Backlog`.

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

## Current scope

Implemented now:

- Local `.ai/` starter folder and markdown files.
- Sidebar tabs that load and render the matching `.ai/*.md` file.
- Helpful empty states for missing markdown files.
- `npm run init:ai` for creating starter files without overwriting existing content.
- `npm run audit` for generating and maintaining `.ai/architecture.md` as local repository understanding from README, `.ai/` files, package scripts, repository structure, and dependencies.
- `npm run backlog` for generating and maintaining `.ai/backlog.md` from local code comments plus README and `.ai/` gaps without LLM calls.

Intentionally not included:

- CLI packaging
- Agents
- LLM calls
- Code editing
- Chat
- Database
- Authentication
