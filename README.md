# Agent IDE

Agent IDE is a prototype developer environment where the primary interface is repository understanding instead of the file tree. Traditional IDEs start with files, folders, search, Git, and terminals. Agent IDE starts with the context engineers and agents need before touching code:

- Goals
- Architecture
- Strategy
- Backlog
- Decisions
- Validation
- Agents
- Code
- Repository Health

V1 is intentionally small: a local Vite + React + TypeScript app with a sidebar for these repository-understanding sections. Each tab renders the matching markdown file from the repository-local `.ai/` folder.

## How Agent IDE differs from a traditional IDE

A traditional IDE is optimized for direct code manipulation. The file tree is usually the default navigation model, and project intent lives somewhere else: tickets, documents, chat threads, architecture diagrams, and memory.

Agent IDE treats repository understanding as the primary surface:

- **Goals** explain what the repository is trying to accomplish.
- **Architecture** explains how the system is shaped and where boundaries are.
- **Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.
- **Backlog** connects future work to goals and implementation context.
- **Decisions** preserve technical tradeoffs and why they were made.
- **Validation** describes how the team proves the repository still works.
- **Agents** describes planned agent roles and constraints before automation is added.
- **Code** remains available, but it is framed by the surrounding product and engineering context.
- **Repository Health** summarizes whether the intelligence layer is complete, reliable, and actionable.

This prototype does not include authentication, a database, a code editor, real agents, CLI packaging, cloud services, or LLM integration. Repository scanning is limited to local deterministic commands such as `npm run audit` for `.ai/architecture.md`, `npm run backlog` for `.ai/backlog.md`, and `npm run decisions` for `.ai/decisions.md`, all without calling an LLM. The local Node server can also run those generators against any local repository path and write the generated intelligence into that repository, even when the target repository has never heard of Agent IDE.


## Repository intelligence ownership

Agent IDE separates human-owned canonical intelligence from machine-generated intelligence:

```text
Human-owned intelligence
.ai/goals.md

↓

Generated intelligence
.ai/strategy.md
.ai/architecture.md
.ai/repository-health.md
.ai/context-package.md
.ai/intelligence-quality.json
.ai/intelligence-history.json
.ai/intelligence-snapshot.json
.ai/intelligence-diff.json
.ai/prompts/*
.ai/next-improvement-prompt.md

↓

Repository intelligence products
Control Plane recommendations, implementation packages, product decision packages, validation packages, and assistant handoffs
```

Repository owners edit only `.ai/goals.md` for Product Purpose, Product Thesis, Current Focus, Current Product Bet, Strategic Bet, Product Differentiator, Long-Term Vision, Manual Goals, Manual Strategy Notes, Success Criteria, and What Not To Build. Generated artifacts are deterministic outputs and must not be used as manual editing surfaces; refresh intelligence to rebuild them from `.ai/goals.md` and repository-local evidence. This preserves local-first operation, reproducible outputs, no LLM dependency, no cloud services, and no telemetry.

## `.ai/` folder contract

Agent IDE reads repository understanding from plain markdown files in `.ai/`:

```text
.ai/
  goals.md
  architecture.md
  strategy.md
  backlog.md
  decisions.md
  validation.md
  agents.md
  code.md
  repository-health.md
  context-package.md
  next-improvement-prompt.md
  prompts/
    architect.md
    builder.md
    reviewer.md
    debugger.md
```

Each sidebar tab maps directly to one file. If a file is missing, the app shows an empty state that names the missing file and suggests running the initializer.

The contract is intentionally plain-text, reviewable, and version-controlled. Human-owned repository intent flows from `.ai/goals.md` into deterministic generated intelligence; generated files should be regenerated, not manually edited.


## Analyze any local repository

Agent IDE includes a small local Node server so the Vite UI can connect to any repository on your machine. The target repository does not need Agent IDE installed. Enter an absolute repository path in the UI and click **Refresh Intelligence**. Agent IDE validates that the path exists, runs its own deterministic generators against that path, and writes outputs into:

```text
<repo>/.ai/
  goals.md
  agents.md
  code.md
  architecture.md
  strategy.md
  backlog.md
  validation.md
  decisions.md
  prompts/
    architect.md
    builder.md
    reviewer.md
    debugger.md
  repository-health.md
  context-package.md
  next-improvement-prompt.md
```

Refresh first creates any missing baseline files for `goals.md`, `agents.md`, and `code.md` without overwriting existing repository notes, then runs the deterministic architecture, strategy, backlog, validation, decisions, prompt, repository health, context package, intelligence quality, and next improvement prompt generators. The refresh stays local-first: no LLM calls, cloud services, authentication, or databases are used. Progress and success/failure summaries, including the Baseline Files step, are shown in the UI while the generators run.

Run the API server only:

```bash
npm run server
```

Run the local server and Vite UI together:

```bash
npm run dev:all
```


## Prompt Center and Context Package

The Control Plane also generates `.ai/next-improvement-prompt.md`, a deterministic next-improvement Implementation Package for exactly one highest-leverage issue. Each selected issue is classified by actionability: `code-fixable`, `manual`, or `validation-experiment`. Selection prefers code-fixable issues over manual issues unless no code-fixable issue exists or the manual issue is critical; if only manual repository intent gaps remain, the recommended title is **Complete Manual Repository Intent Notes** and the Implementation Package clearly warns that it is a manual product-owner task. If no code-fixable or manual issues remain, it recommends **Run AI Handoff Validation**. The **Recommended Implementation Package** card shows the prompt title, actionability, source risk or recommendation, reason, and one-click **Copy Implementation Package** / **View Implementation Package** actions. The existing **Generate Implementation Package** action copies this generated artifact instead of a generic package.

The **Prompt Center** makes generated role prompts available directly in the Agent IDE UI. After **Refresh Intelligence** completes, Agent IDE shows a **Next actions** panel with buttons to view Strategy, copy the Context Package, and copy the Architect Prompt. Open **Prompt Center** to view rendered markdown cards for Architect, Builder, Reviewer, and Debugger. Each card shows its `.ai/prompts/<role>.md` source path and provides **Copy Prompt** and **Download Prompt** actions. Missing prompt files show an in-app file-not-found state instead of requiring terminal inspection.

The **Copy Architect Context** action copies `.ai/prompts/architect.md` immediately from Prompt Center without requiring users to expand or inspect the Architect card. This supports the fast handoff workflow:

```text
Repository → Refresh Intelligence → Prompt Center → Copy Architect Context → Paste into Claude, GPT, Cursor, Codex, Gemini, Windsurf, or another assistant
```

Agent IDE also generates `.ai/context-package.md`, a compact assistant handoff containing Product Thesis, Current Focus, Core Systems, Key Decisions, Validation Summary, Current Backlog, and Repository Health Summary. Open **Context Package** in the sidebar to view the rendered package, then use **Copy Context Package**, **Copy for Claude/GPT**, or **Download Context Package** when a shorter cross-assistant context bundle is more useful than a role prompt.

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

The audit infers repository understanding from the selected target repository's own local signals: `README.md`, `docs/**/*.md`, `.ai/goals.md`, prominent project files, top-level folders, Swift/TypeScript source file names and symbols, package scripts, and dependencies. It writes product thesis, product thesis evidence, evidence-backed core systems, primary flows, current focus, current focus evidence, key commands, known gaps, and a lower repository-structure section while preserving the timestamp, confidence score, and anything already written under `## Manual Notes`. Current focus extraction first reads `.ai/goals.md` and surfaces the body of `## Current Focus` verbatim with `.ai/goals.md` as evidence; if that explicit section is missing, the audit falls back to deterministic backlog or roadmap-style inference without LLM calls. Product thesis extraction prefers `.ai/goals.md`, README/project overview, and goals language over status notes, filters implementation/audit/validation-only disclaimers, and falls back to deterministic domain-system inference when no strong written thesis is present. For arbitrary target repositories, architecture generation stays deterministic, does not call an LLM, and avoids hardcoding Agent IDE systems unless the target repository is Agent IDE itself.

Generate or refresh `.ai/strategy.md` locally:

```bash
npm run strategy
```

The strategy generator deterministically reads canonical owner intent from `.ai/goals.md` first, then uses `.ai/architecture.md`, `.ai/decisions.md`, `README.md`, and docs whose names include STRATEGY, PRODUCT, ROADMAP, or VISION as supporting evidence. It writes Product Thesis, North Star Metric, Strategic Differentiator, Current Product Bet, Current Experiment, What Not To Build, Success Definition, Strategy Confidence, Strategy Evidence Sources, and Strategy Warnings without treating `.ai/strategy.md` as a manual editing surface. Explicit `.ai/goals.md` sections win over inferred documentation signals. Repository-specific strategy concepts are only emitted when supported by those evidence sources, Current Experiment is derived from Current Focus and Current Priorities, and unsupported relationship-product terms such as relationship memory, encounters, overlap, reconnect, or follow-ups produce a Strategy Leakage warning.

Generate or refresh `.ai/backlog.md` locally:

```bash
npm run backlog
```

The backlog generator only scans source comments when they start with an explicit task marker followed by a colon: TODO, FIXME, BUG, HACK, ROADMAP, FUTURE WORK, KNOWN GAP, IMPLEMENT, or ACTION. Generic comment harvesting is disabled, so section labels, headings, architecture comments, explanatory comments, generated markdown, validation output, and comments such as `// Buttons` or `// TODO support later` are omitted. README and `.ai/` markdown extraction is preserved for Future Work, Known Gaps, Manual Backlog, and explicit implementation recommendations. It writes prioritized backlog items with source, reason, and suggested next step while preserving anything already written under `## Manual Backlog`.


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

Generate or refresh `.ai/repository-health.md` locally from deterministic intelligence checks:

```bash
npm run health
```

The health generator reads goals, architecture, backlog, decisions, validation, agents, code, and the exported architect prompt to summarize intelligence completeness, quality signals, strategy quality score, strategy leakage status, strategy confidence, detected risks, strategy quality warnings, and one recommended next step while preserving anything already written under `## Manual Health Notes`. It uses local file checks only and does not call an LLM, cloud service, or agent.

Export a role-specific prompt from the local `.ai/` repository context:

```bash
npm run prompt -- architect
npm run prompt -- builder
npm run prompt -- reviewer
npm run prompt -- debugger
```

The prompt exporter reads the local `.ai/*.md` intelligence files, including `.ai/strategy.md`, and writes deterministic markdown prompts to `.ai/prompts/architect.md`, `.ai/prompts/builder.md`, `.ai/prompts/reviewer.md`, and `.ai/prompts/debugger.md`. Each prompt includes role instructions, product thesis, architecture summary, backlog priorities, validation status, known constraints, task guidance, and the complete local `.ai/` context. It does not call an LLM and does not execute agents.


Generate or refresh `.ai/context-package.md` locally:

```bash
npm run context:package
```

The context package generator reads local `.ai/` intelligence and writes a compact assistant handoff with product thesis, current focus, strategy, strategy confidence, strategy evidence sources, core systems, key decisions, validation summary, backlog, and repository health summary. It is deterministic and does not call an LLM.


Generate the next implementation prompt locally from Control Plane intelligence:

```bash
npm run next:improvement
```

The next-improvement generator reads `.ai/goals.md` plus repository health, intelligence quality, intelligence audit, backlog, generated strategy, and context package artifacts, then writes `.ai/next-improvement-prompt.md`. The generated prompt is local-first, deterministic, uses no LLM calls, no cloud services, and no telemetry, and always reminds builders to preserve manual sections while keeping changes small and reviewable.

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
- `npm run strategy` for generating `.ai/strategy.md` from local product and roadmap signals without LLM calls or agent execution.
- `npm run backlog` for generating and maintaining `.ai/backlog.md` from local code comments plus README and `.ai/` gaps without LLM calls.
- `npm run decisions` for generating and maintaining `.ai/decisions.md` from README, architecture, backlog, and package metadata without LLM calls.
- `npm run validate:intel` for generating and maintaining `.ai/validation.md` from safe local deterministic validation commands without LLM calls.
- `npm run prompt -- <role>` for exporting local, role-specific prompts for architect, builder, reviewer, and debugger workflows without LLM calls or agent execution.
- `npm run health` for generating `.ai/repository-health.md` from deterministic completeness, quality, and risk checks across the repository intelligence layer.
- `npm run next:improvement` for generating `.ai/next-improvement-prompt.md`, the single highest-leverage Codex-ready implementation package shown in the Control Plane.
- Prompt Center for viewing, copying, and downloading generated Architect, Builder, Reviewer, and Debugger prompts from the UI.
- Context Package for viewing, copying, copying with the Claude/GPT handoff wrapper, and downloading `.ai/context-package.md` as a compact assistant handoff.
- `npm run context:package` for generating `.ai/context-package.md` without LLM calls or agent execution.

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
- Expand repository health checks as more intelligence artifacts are added.

## Repository-intelligence-first primary workflow

Agent IDE's primary workflow is now a continuous repository decision loop rather than a task-first prompt browser. At every refresh, the Control Plane should answer one question: **Given everything the repository currently knows, what single decision most increases confidence in the current Product Bet?**

The primary Control Plane surface is intentionally limited to four answers:

1. **Where are we?** Current repository state, current experiment, health, confidence, and evidence readiness.
2. **Why are we here?** Product Thesis, Current Product Bet, strategic context, and repository alignment.
3. **What decision should we make next?** Exactly one repository decision, with evidence, tradeoffs, expected outcome, confidence, and invalidation evidence.
4. **How do we execute it?** Implementation guidance, primary files, supporting files, validation, expected artifacts, and estimated scope.

The execution loop is:

```text
Repository State
↓
Current Product Thesis
↓
Current Product Bet
↓
Current Experiment
↓
Current Repository Decision
↓
Implementation Guidance
↓
Outcome
↓
Refresh Repository Intelligence
↓
Repeat
```

Existing deterministic generators and recommendation selection semantics remain intact. The redesign is an incremental developer-experience projection over existing repository-local intelligence; it does not add LLM calls, cloud services, telemetry, or new generated-intelligence ownership rules. Advanced artifacts such as raw prompts, Context Package, Strategy, Architecture, Repository Health, Decision Ranking, Repository Judgment, Product Judgment, and Recommendation Trace remain available as Library/Advanced evidence instead of driving the primary workflow.

If an implementation recommendation does not identify enough information to begin without browsing the file tree, the Control Plane must identify the first missing repository intelligence, explain why that gap forced exploration, and propose the smallest deterministic intelligence addition that would avoid the same exploration in a future refresh.

See `docs/repository-intelligence-first-workflow.md` for the architectural migration plan and deterministic validation strategy.
