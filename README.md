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

Generate or refresh `.ai/validation.md` locally from deterministic repository checks:

```bash
npm run validate:intel
```

The validation generator runs safe local validation scripts such as `npm run build` plus detected test, lint, check, or typecheck scripts. It records last validation time, confidence, overall status, commands run, results, and known validation gaps while preserving anything already written under `## Manual Validation Notes`. This is repository intelligence validation, not app runtime validation, and it does not call an LLM.

Export copy/paste-ready agent prompts from the local `.ai/` repository intelligence layer:

```bash
npm run prompt -- architect
npm run prompt -- builder
npm run prompt -- reviewer
npm run prompt -- debugger
```

The prompt exporter reads all seven `.ai/*.md` intelligence files and writes role-specific prompts to `.ai/prompts/<role>.md`. Supported roles are `architect`, `builder`, `reviewer`, and `debugger`. Prompt export is local-first and deterministic: it does not call an LLM, does not execute agents, and preserves the existing dashboard behavior. Use the generated markdown as model-ready context for Claude, GPT, Codex, Gemini, Cursor, Windsurf, or another coding assistant. Unknown roles fail with a usage message listing supported roles.

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
- `npm run validate:intel` for generating and maintaining `.ai/validation.md` from safe local deterministic validation commands without LLM calls.
- `npm run prompt -- <role>` for exporting copy/paste-ready prompts to `.ai/prompts/<role>.md` for architect, builder, reviewer, and debugger roles without LLM calls or agent execution.

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
