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

This prototype does not include authentication, a database, a code editor, real agents, CLI packaging, cloud services, or LLM integration. Repository scanning is limited to local deterministic commands such as `npm run audit` for `.ai/architecture.md`, `npm run backlog` for `.ai/backlog.md`, and `npm run decisions` for `.ai/decisions.md`, all without calling an LLM. The local Node server can also run those generators against any local repository path and write the generated intelligence into that repository, even when the target repository has never heard of Agent IDE.

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


## Analyze any local repository

Agent IDE includes a small local Node server so the Vite UI can connect to any repository on your machine. The target repository does not need Agent IDE installed. Enter an absolute repository path in the UI and click **Refresh Intelligence**. Agent IDE validates that the path exists, runs its own deterministic generators against that path, and writes outputs into:

```text
<repo>/.ai/
  architecture.md
  backlog.md
  validation.md
  decisions.md
  prompts/
    architect.md
    builder.md
    reviewer.md
    debugger.md
```

The refresh stays local-first: no LLM calls, cloud services, authentication, or databases are used. Progress and success/failure summaries are shown in the UI while the generators run.

Run the API server only:

```bash
npm run server
```

Run the local server and Vite UI together:

```bash
npm run dev:all
```

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


Generate or refresh `.ai/decisions.md` locally:

```bash
npm run decisions
```

The decisions generator reads README, `.ai/architecture.md`, `.ai/backlog.md`, and `package.json` to infer durable repository decisions from documented constraints, principles, and recurring themes. It writes active decisions with context, reason, and consequences while preserving anything already written under `## Manual Decisions`. Decisions explain why the repository is built this way; they are not backlog items. The command stays local-first, deterministic, and does not call an LLM.

Generate or refresh `.ai/validation.md` locally from deterministic repository checks:

```bash
npm run validate:intel
```

The validation generator runs safe local validation scripts such as `npm run build` plus detected test, lint, check, or typecheck scripts. It records last validation time, confidence, overall status, commands run, results, and known validation gaps while preserving anything already written under `## Manual Validation Notes`. This is repository intelligence validation, not app runtime validation, and it does not call an LLM.

Export a role-specific prompt from the local `.ai/` repository context:

```bash
npm run prompt -- architect
npm run prompt -- builder
npm run prompt -- reviewer
npm run prompt -- debugger
```

The prompt exporter reads all seven `.ai/*.md` files and writes deterministic markdown prompts to `.ai/prompts/architect.md`, `.ai/prompts/builder.md`, `.ai/prompts/reviewer.md`, and `.ai/prompts/debugger.md`. Each prompt includes role instructions, product thesis, architecture summary, backlog priorities, validation status, known constraints, task guidance, and the complete local `.ai/` context. It does not call an LLM and does not execute agents.

Start the Vite development server only:

```bash
npm run dev
```

For repository-path refresh from the UI, run both the Vite app and local Node server:

```bash
npm run dev:all
```

Create a production build:

```bash
npm run build
```

## Current scope

Implemented now:

- Local `.ai/` starter folder and markdown files.
- Sidebar tabs that load and render the matching `.ai/*.md` file.
- Repository path input and Refresh Intelligence button for analyzing any local repository through the local Node server.
- `npm run server` and `npm run dev:all` for local repository refresh workflows.
- Helpful empty states for missing markdown files.
- `npm run init:ai` for creating starter files without overwriting existing content.
- `npm run audit` for generating and maintaining `.ai/architecture.md` as local repository understanding from README, `.ai/` files, package scripts, repository structure, and dependencies.
- `npm run backlog` for generating and maintaining `.ai/backlog.md` from local code comments plus README and `.ai/` gaps without LLM calls.
- `npm run decisions` for generating and maintaining `.ai/decisions.md` from README, architecture, backlog, and package metadata without LLM calls.
- `npm run validate:intel` for generating and maintaining `.ai/validation.md` from safe local deterministic validation commands without LLM calls.
- `npm run prompt -- <role>` for exporting local, role-specific prompts for architect, builder, reviewer, and debugger workflows without LLM calls or agent execution.

Intentionally not included:

- CLI packaging
- Agents
- LLM calls
- Code editing
- Chat
- Database
- Authentication

## Future work

- Add backlog quality filtering.
- Add richer validation detection for additional ecosystems.
- Improve markdown rendering.
- Add cross-links between `.ai` documents.
