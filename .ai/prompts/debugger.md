# Agent IDE Debugger Prompt

## Role Instructions

- Diagnose failures using repository context, deterministic commands, and the documented validation surface.
- Separate observed facts from hypotheses and avoid agent execution or LLM-dependent debugging steps.
- Prefer narrow fixes that preserve existing behavior and make future validation clearer.

## Product Thesis

# Goals

- Define the product and engineering outcomes this repository is responsible for.
- Keep intent visible before implementation details.
- Connect future work to measurable repository success.

## Active

- Make repository understanding the primary surface of Agent IDE.

## Deferred

- Add automation only after the local `.ai/` contract is useful on its own.

## Strategy

# Strategy

## Product Thesis
Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.
Product Thesis Evidence:
README.md, .ai/goals.md, scripts/audit.mjs

Evidence: .ai/architecture.md
## North Star Metric
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## Strategic Differentiator
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## Current Product Bet
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## Current Experiment
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## What Not To Build
The strategy generator deterministically reads `.ai/goals.md`, `.ai/architecture.md`, `.ai/decisions.md`, `README.md`, and docs whose names include STRATEGY, PRODUCT, ROADMAP, or VISION. It writes Product Thesis, North Star Metric, Strategic Differentiator, Current Product Bet, Current Experiment, What Not To Build, and Success Definition while preserving everything under `## Manual Strategy Notes`. Explicit `.ai/goals.md` sections win over inferred documentation signals. For Nearify-style relationship products, it surfaces Follow-Ups Completed, relationship memory from real-world encounters, the Between Events experience, the warning not to treat the product as primarily an event app, and the success test that users know who to reach out to today and complete more follow-ups.

Evidence: README.md
## Success Definition
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## Manual Strategy Notes

## Architecture Summary

# Architecture

Last Audit: 2026-06-24T00:16:59.907Z
Confidence: 95%

## Product Thesis
Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.

Product Thesis Evidence:
README.md, .ai/goals.md, scripts/audit.mjs

## Core Systems
- Dashboard UI: Inferred from target repository structure and naming.
  Evidence: src/App.tsx, src/sections.ts, package.json
- Repository Intelligence Contract: Inferred from target repository structure and naming.
  Evidence: .ai/*.md, scripts/init-ai.mjs, README.md
- Local Audit Engine: Inferred from target repository structure and naming.
  Evidence: scripts/audit.mjs, package.json

## Primary Flows
- Repository -> .ai files -> Dashboard
- npm run init:ai -> starter intelligence files
- npm run audit -> generated architecture.md
- npm run backlog -> generated backlog.md

## Current Focus
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

Current Focus Evidence:
.ai/goals.md

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
- tests/

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

## Backlog Priorities

# Backlog

Last Audit: 2026-06-24T01:30:47.539Z
Confidence: 95%

## High Priority
- None detected

## Medium Priority
- **Add Backlog Quality Filtering**
  - Source: README.md:189
  - Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.
- **Add Cross-links Between .ai Documents**
  - Source: README.md:192
  - Reason: Repository documentation identifies actionable follow-up work from: Add cross-links between `.ai` documents.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add cross-links between `.ai` documents.
- **Add Richer Validation Detection**
  - Source: README.md:190
  - Reason: Repository documentation identifies actionable follow-up work from: Add richer validation detection for additional ecosystems.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add richer validation detection for additional ecosystems.
- **Improve Markdown Rendering**
  - Source: README.md:191
  - Reason: Repository documentation identifies actionable follow-up work from: Improve markdown rendering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to improve markdown rendering.

## Low Priority
- None detected

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

## Repository Health

# Repository Health

Last Audit: 2026-06-24T16:35:15.860Z
Overall Health: Needs Attention
Confidence: Medium

## Intelligence Completeness
- Goals: Present
- Architecture: Present
- Strategy: Present
- Backlog: Present
- Decisions: Present
- Validation: Present
- Agents: Present
- Code: Present
- Architect Prompt: Present

## Quality Signals
- Product thesis present
- Current focus present
- Core systems present
- Strategy present
- North Star Metric present
- Strategic Differentiator present
- Current Product Bet present
- What Not To Build present
- Evidence lines present
- Backlog noise detected
- Validation commands detected
- Xcode validation metadata not detected
- Manual sections preserved

## Risks
- Backlog contains possible noise
- Missing manual goals

## Recommended Next Step
Fill in `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.

## Manual Health Notes

## Known Constraints

- Do not make LLM calls.
- Do not execute agents.
- Treat the `.ai/` markdown files as the source of repository-understanding context.
- Prefer local, deterministic commands and reviewable file changes.

# Decisions

Last Audit: 2026-06-23T21:34:57.307Z
Confidence: 95%

## Active Decisions

### Repository understanding is primary

Context:
The README and architecture describe Agent IDE as a developer environment where repository understanding is the primary interface rather than the file tree.

Reason:
Starting from goals, architecture, backlog, decisions, validation, agents, and code notes gives humans and automation the context needed before changing implementation details.

Consequences:
The UI and generation scripts should prioritize repository context surfaces, and feature work should preserve the dashboard-oriented understanding workflow.

### .ai markdown is canonical repository memory

Context:
The repository contract maps sidebar sections directly to version-controlled markdown files in `.ai/`.

Reason:
Plain markdown keeps product, architecture, backlog, decisions, validation, agents, and code context local, reviewable, and shared by humans and future automation.

Consequences:
Repository intelligence should be generated into `.ai/*.md`, manual sections must be preserved, and changes to repository memory should remain diffable.

### Local-first before cloud

Context:
The documented scope emphasizes a local Vite app, repository-local `.ai/` files, and local npm scripts for intelligence generation.

Reason:
Local-first workflows keep the prototype simple, inspectable, and usable without external services while the repository-understanding contract matures.

Consequences:
New intelligence commands should read local files, write local markdown, avoid cloud dependencies, and remain safe to run from the repository checkout.

### No LLM dependency in core intelligence generation

Context:
README and architecture repeatedly state that audit, backlog, validation, and prompt generation do not call an LLM, and LLM integration is intentionally out of scope.

Reason:
Core repository intelligence should be reproducible and understandable from checked-in source material instead of depending on model availability or hidden inference.

Consequences:
Generation scripts must not call LLM APIs, should document deterministic inputs, and should treat future LLM features as optional layers rather than core requirements.

### Deterministic generation preferred over inference

Context:
Existing commands derive architecture, backlog, validation, and prompts from explicit local repository signals such as README content, `.ai/` documents, package scripts, source structure, comments, and dependencies.

Reason:
Deterministic generation makes repository intelligence auditable, repeatable, and suitable for version control review.

Consequences:
Decision generation should use transparent heuristics, avoid opaque summarization, preserve manual decisions, and prefer stable output over speculative conclusions.

### Decisions explain why rather than what to build next

Context:
The README distinguishes decisions from backlog by describing decisions as technical tradeoffs and why they were made, while backlog captures future work items.

Reason:
Separating rationale from tasks prevents decision records from becoming another task list and keeps architectural intent visible.

Consequences:
Generated decision records should include context, reason, and consequences, and should not duplicate backlog items or suggested next steps.

## Manual Decisions

# Agents

- Describe intended agent responsibilities and limits before adding automation.
- Keep permissions, review expectations, and handoff points explicit.

## Current status

- No real agents run in this app.
- This file is planning context only.

## Task Guidance

- Reproduce failures with local commands before proposing code changes.
- Use architecture and code notes to identify likely fault boundaries.
- Update validation or known gaps when the debugging process reveals missing coverage.

## Complete Repository Context

### .ai/goals.md

```markdown
# Goals

- Define the product and engineering outcomes this repository is responsible for.
- Keep intent visible before implementation details.
- Connect future work to measurable repository success.

## Active

- Make repository understanding the primary surface of Agent IDE.

## Deferred

- Add automation only after the local `.ai/` contract is useful on its own.
```

### .ai/architecture.md

```markdown
# Architecture

Last Audit: 2026-06-24T00:16:59.907Z
Confidence: 95%

## Product Thesis
Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.

Product Thesis Evidence:
README.md, .ai/goals.md, scripts/audit.mjs

## Core Systems
- Dashboard UI: Inferred from target repository structure and naming.
  Evidence: src/App.tsx, src/sections.ts, package.json
- Repository Intelligence Contract: Inferred from target repository structure and naming.
  Evidence: .ai/*.md, scripts/init-ai.mjs, README.md
- Local Audit Engine: Inferred from target repository structure and naming.
  Evidence: scripts/audit.mjs, package.json

## Primary Flows
- Repository -> .ai files -> Dashboard
- npm run init:ai -> starter intelligence files
- npm run audit -> generated architecture.md
- npm run backlog -> generated backlog.md

## Current Focus
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

Current Focus Evidence:
.ai/goals.md

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
- tests/

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
```

### .ai/strategy.md

```markdown
# Strategy

## Product Thesis
Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.
Product Thesis Evidence:
README.md, .ai/goals.md, scripts/audit.mjs

Evidence: .ai/architecture.md
## North Star Metric
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## Strategic Differentiator
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## Current Product Bet
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## Current Experiment
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## What Not To Build
The strategy generator deterministically reads `.ai/goals.md`, `.ai/architecture.md`, `.ai/decisions.md`, `README.md`, and docs whose names include STRATEGY, PRODUCT, ROADMAP, or VISION. It writes Product Thesis, North Star Metric, Strategic Differentiator, Current Product Bet, Current Experiment, What Not To Build, and Success Definition while preserving everything under `## Manual Strategy Notes`. Explicit `.ai/goals.md` sections win over inferred documentation signals. For Nearify-style relationship products, it surfaces Follow-Ups Completed, relationship memory from real-world encounters, the Between Events experience, the warning not to treat the product as primarily an event app, and the success test that users know who to reach out to today and complete more follow-ups.

Evidence: README.md
## Success Definition
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md
## Manual Strategy Notes
```

### .ai/backlog.md

```markdown
# Backlog

Last Audit: 2026-06-24T01:30:47.539Z
Confidence: 95%

## High Priority
- None detected

## Medium Priority
- **Add Backlog Quality Filtering**
  - Source: README.md:189
  - Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.
- **Add Cross-links Between .ai Documents**
  - Source: README.md:192
  - Reason: Repository documentation identifies actionable follow-up work from: Add cross-links between `.ai` documents.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add cross-links between `.ai` documents.
- **Add Richer Validation Detection**
  - Source: README.md:190
  - Reason: Repository documentation identifies actionable follow-up work from: Add richer validation detection for additional ecosystems.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add richer validation detection for additional ecosystems.
- **Improve Markdown Rendering**
  - Source: README.md:191
  - Reason: Repository documentation identifies actionable follow-up work from: Improve markdown rendering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to improve markdown rendering.

## Low Priority
- None detected

## Manual Backlog
```

### .ai/decisions.md

```markdown
# Decisions

Last Audit: 2026-06-23T21:34:57.307Z
Confidence: 95%

## Active Decisions

### Repository understanding is primary

Context:
The README and architecture describe Agent IDE as a developer environment where repository understanding is the primary interface rather than the file tree.

Reason:
Starting from goals, architecture, backlog, decisions, validation, agents, and code notes gives humans and automation the context needed before changing implementation details.

Consequences:
The UI and generation scripts should prioritize repository context surfaces, and feature work should preserve the dashboard-oriented understanding workflow.

### .ai markdown is canonical repository memory

Context:
The repository contract maps sidebar sections directly to version-controlled markdown files in `.ai/`.

Reason:
Plain markdown keeps product, architecture, backlog, decisions, validation, agents, and code context local, reviewable, and shared by humans and future automation.

Consequences:
Repository intelligence should be generated into `.ai/*.md`, manual sections must be preserved, and changes to repository memory should remain diffable.

### Local-first before cloud

Context:
The documented scope emphasizes a local Vite app, repository-local `.ai/` files, and local npm scripts for intelligence generation.

Reason:
Local-first workflows keep the prototype simple, inspectable, and usable without external services while the repository-understanding contract matures.

Consequences:
New intelligence commands should read local files, write local markdown, avoid cloud dependencies, and remain safe to run from the repository checkout.

### No LLM dependency in core intelligence generation

Context:
README and architecture repeatedly state that audit, backlog, validation, and prompt generation do not call an LLM, and LLM integration is intentionally out of scope.

Reason:
Core repository intelligence should be reproducible and understandable from checked-in source material instead of depending on model availability or hidden inference.

Consequences:
Generation scripts must not call LLM APIs, should document deterministic inputs, and should treat future LLM features as optional layers rather than core requirements.

### Deterministic generation preferred over inference

Context:
Existing commands derive architecture, backlog, validation, and prompts from explicit local repository signals such as README content, `.ai/` documents, package scripts, source structure, comments, and dependencies.

Reason:
Deterministic generation makes repository intelligence auditable, repeatable, and suitable for version control review.

Consequences:
Decision generation should use transparent heuristics, avoid opaque summarization, preserve manual decisions, and prefer stable output over speculative conclusions.

### Decisions explain why rather than what to build next

Context:
The README distinguishes decisions from backlog by describing decisions as technical tradeoffs and why they were made, while backlog captures future work items.

Reason:
Separating rationale from tasks prevents decision records from becoming another task list and keeps architectural intent visible.

Consequences:
Generated decision records should include context, reason, and consequences, and should not duplicate backlog items or suggested next steps.

## Manual Decisions
```

### .ai/validation.md

```markdown
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
```

### .ai/agents.md

```markdown
# Agents

- Describe intended agent responsibilities and limits before adding automation.
- Keep permissions, review expectations, and handoff points explicit.

## Current status

- No real agents run in this app.
- This file is planning context only.
```

### .ai/code.md

```markdown
# Code

- Use this page as an implementation-oriented entry point framed by goals, architecture, decisions, and validation.
- Keep code notes high-level; this prototype does not include a code editor.

## Areas

- `src/App.tsx` renders the application shell.
- `src/sections.ts` defines sidebar section metadata.
```

### .ai/repository-health.md

```markdown
# Repository Health

Last Audit: 2026-06-24T16:35:15.860Z
Overall Health: Needs Attention
Confidence: Medium

## Intelligence Completeness
- Goals: Present
- Architecture: Present
- Strategy: Present
- Backlog: Present
- Decisions: Present
- Validation: Present
- Agents: Present
- Code: Present
- Architect Prompt: Present

## Quality Signals
- Product thesis present
- Current focus present
- Core systems present
- Strategy present
- North Star Metric present
- Strategic Differentiator present
- Current Product Bet present
- What Not To Build present
- Evidence lines present
- Backlog noise detected
- Validation commands detected
- Xcode validation metadata not detected
- Manual sections preserved

## Risks
- Backlog contains possible noise
- Missing manual goals

## Recommended Next Step
Fill in `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.

## Manual Health Notes
```
