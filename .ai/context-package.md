# Context Package

Generated: 2026-06-24T16:35:14.591Z

## Product Thesis
Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.

Product Thesis Evidence:
README.md, .ai/goals.md, scripts/audit.mjs

## Current Focus
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

Current Focus Evidence:
.ai/goals.md

## Strategy
**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md

**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md

**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md

The strategy generator deterministically reads `.ai/goals.md`, `.ai/architecture.md`, `.ai/decisions.md`, `README.md`, and docs whose names include STRATEGY, PRODUCT, ROADMAP, or VISION. It writes Product Thesis, North Star Metric, Strategic Differentiator, Current Product Bet, Current Experiment, What Not To Build, and Success Definition while preserving everything under `## Manual Strategy Notes`. Explicit `.ai/goals.md` sections win over inferred documentation signals. For Nearify-style relationship products, it surfaces Follow-Ups Completed, relationship memory from real-world encounters, the Between Events experience, the warning not to treat the product as primarily an event app, and the success test that users know who to reach out to today and complete more follow-ups.

Evidence: README.md

**Strategy** surfaces the product thesis, North Star Metric, strategic differentiator, current product bet, current experiment, anti-goals, and success definition.

Evidence: README.md

## Core Systems
- Dashboard UI: Inferred from target repository structure and naming.
  Evidence: src/App.tsx, src/sections.ts, package.json
- Repository Intelligence Contract: Inferred from target repository structure and naming.
  Evidence: .ai/*.md, scripts/init-ai.mjs, README.md
- Local Audit Engine: Inferred from target repository structure and naming.
  Evidence: scripts/audit.mjs, package.json

## Key Decisions
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

## Validation Summary
- Medium

- `npm run build`

## Current Backlog
- No generated content available yet.

## Repository Health Summary
- Goals: Present
- Architecture: Present
- Backlog: Present
- Decisions: Present
- Validation: Present
- Agents: Present
- Code: Present
- Architect Prompt: Present

- Product thesis present
- Current focus present
- Core systems present
- Evidence lines present
- Backlog noise detected
- Validation commands detected
- Manual sections preserved

- Backlog contains possible noise
- Missing manual goals

Fill in `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.
