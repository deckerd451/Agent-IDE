# Agent IDE Prompt: Debugger

Copy this prompt into Claude, GPT, Codex, Gemini, Cursor, Windsurf, or another coding assistant. It was generated locally from the repository `.ai/` intelligence layer. Do not assume live services, LLM calls, or agent execution are available unless the repository context below explicitly says so.

## Role Instructions

- Diagnose failures with evidence from local code, commands, and repository intelligence.
- Prefer deterministic reproduction steps before changing implementation.
- Keep fixes narrow and explain the root cause in terms of the documented system shape.

## Product Thesis

# Goals

- Define the product and engineering outcomes this repository is responsible for.
- Keep intent visible before implementation details.
- Connect future work to measurable repository success.

## Active

- Make repository understanding the primary surface of Agent IDE.

## Deferred

- Add automation only after the local `.ai/` contract is useful on its own.

## Current Architecture Summary

# Architecture

Last Audit: 2026-06-23T20:49:08.787Z
Confidence: 95%

## Product Thesis
Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.

## Core Systems
- Dashboard UI: React/Vite interface that makes repository-understanding markdown the primary navigation surface instead of a file tree.
- Repository Intelligence Contract: Version-controlled `.ai/*.md` files that define goals, architecture, backlog, decisions, validation, agent constraints, and code notes.
- Local Audit Engine: `scripts/audit.mjs` deterministically scans local repository signals and regenerates `.ai/architecture.md` without LLM calls.

## Primary Flows
- Repository -> .ai files -> Dashboard
- npm run init:ai -> starter intelligence files
- npm run audit -> generated architecture.md
- npm run backlog -> generated backlog.md

## Current Focus
The repository is currently evolving toward making repository understanding the primary surface of Agent IDE.

## Key Commands
- npm run dev
- npm run build
- npm run init:ai
- npm run audit
- npm run backlog

## Known Gaps
- No LLM integration
- No agent execution
- No validation generation
- No packaged CLI

## Repository Structure

### Languages
- CSS
- HTML
- JavaScript
- JSON
- Markdown
- React
- TypeScript

### Major Areas
- scripts/
- src/

### Major Files
- index.html
- package.json
- README.md
- tsconfig.app.json
- tsconfig.json
- vite.config.ts

### Dependencies
- @types/react
- @types/react-dom
- @vitejs/plugin-react
- react
- react-dom
- typescript
- vite

## Manual Notes

## Current Backlog Priorities

# Backlog

Last Audit: 2026-06-23T21:01:52.342Z
Confidence: 95%

## High Priority
- **Add Automated UI Interaction Tests**
  - Source: .ai/validation.md:12
  - Reason: Repository documentation identifies actionable follow-up work from: No automated UI interaction tests.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add automated ui interaction tests.
- **Add Packaged CLI**
  - Source: .ai/architecture.md:34
  - Reason: Repository documentation identifies actionable follow-up work from: No packaged CLI.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add packaged cli.
- **Add Validation Generation**
  - Source: .ai/architecture.md:33
  - Reason: Repository documentation identifies actionable follow-up work from: No validation generation.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add validation generation.

## Medium Priority
- **Add Agent Prompt Export**
  - Source: README.md:118
  - Reason: Repository documentation identifies actionable follow-up work from: Add agent prompt export.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add agent prompt export.
- **Add Backlog Quality Filtering**
  - Source: README.md:115
  - Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.
- **Add Cross-links Between .ai Documents**
  - Source: README.md:117
  - Reason: Repository documentation identifies actionable follow-up work from: Add cross-links between `.ai` documents.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add cross-links between `.ai` documents.

## Low Priority
- **Improve Markdown Rendering**
  - Source: README.md:116
  - Reason: Repository documentation identifies actionable follow-up work from: Improve markdown rendering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to improve markdown rendering.

## Manual Backlog

## Validation Status

# Validation

## Last Validation
- 2026-06-23T21:07:04.973Z

## Confidence
- Medium

## Overall Status: Passing

## Commands Run
- `npm run build`

## Results
### npm run build
- Status: PASS
- Exit code: 0
- Duration: 3.3s
- Output summary:
```text
  npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
  > agent-ide@0.1.0 build
  > tsc -b && vite build
  vite v8.1.0 building client environment for production...
  transforming...✓ 24 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.39 kB │ gzip:  0.26 kB
  dist/assets/index-0vGsD0nx.css    3.11 kB │ gzip:  1.22 kB
  dist/assets/index-CUIw0wFR.js   200.14 kB │ gzip: 63.43 kB
  ✓ built in 317ms
```

## Known Gaps
- No safe npm test script was detected; automated behavioral coverage is unknown.
- No `npm run lint` script was detected; style/static lint coverage is unknown.
- No standalone typecheck script was detected; type validation is covered only insofar as the build runs it.

## Manual Validation Notes

## Known Constraints

### Decisions
# Decisions

- Store repository understanding as version-controlled markdown in `.ai/`.
- Keep the first contract file-based and local-only.
- Avoid adding agents, LLM calls, databases, auth, code editing, or CLI packaging in this prototype step.

## Template

- Decision:
- Context:
- Alternatives:
- Consequences:

### Agent Constraints
# Agents

- Describe intended agent responsibilities and limits before adding automation.
- Keep permissions, review expectations, and handoff points explicit.

## Current status

- No real agents run in this app.
- This file is planning context only.

### Code Context
# Code

- Use this page as an implementation-oriented entry point framed by goals, architecture, decisions, and validation.
- Keep code notes high-level; this prototype does not include a code editor.

## Areas

- `src/App.tsx` renders the application shell.
- `src/sections.ts` defines sidebar section metadata.

## Task Guidance

- Start with the observed symptom, expected behavior, and the smallest local reproduction path.
- Use validation status and known gaps to decide which checks are trustworthy or missing.
- Propose or apply the minimal fix, then rerun the most relevant local validation commands.

## Operating Rules

- No LLM calls are required to use this exported prompt.
- Do not execute agents as part of this prompt; treat agent notes as planning context only.
- Keep workflows local-first and deterministic unless the user explicitly provides different constraints.
- Preserve existing dashboard behavior unless the task specifically asks to change it.
- When making changes, validate with the most relevant local commands documented by this repository.
