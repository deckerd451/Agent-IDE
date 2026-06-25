# Context Package

Generated: 2026-06-25T18:50:50.052Z

## Product Thesis
Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.

## Current Focus
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

## Canonical Intelligence Ownership
Human-owned source of truth: `.ai/goals.md`. Generated artifacts are regenerated from canonical intelligence and are not manual editing targets.

## Strategy
Repository handoff readiness is Ready with high canonical intelligence consistency.

Evidence: .ai/goals.md

Repository intelligence that turns repository understanding into reusable AI context for developer workflows.

Evidence: .ai/goals.md, .ai/architecture.md, .ai/decisions.md, README.md

The repository is currently focused on making repository understanding the primary surface of Agent IDE.

Evidence: .ai/goals.md

Do not build broad automation before repository understanding is consistently reliable for handoffs.

Evidence: .ai/goals.md

- Control Plane reports repository handoff readiness as Ready.
- Canonical intelligence consistency has no avoidable contradictions or duplicate generated sections.

Evidence: .ai/goals.md

Strategy Confidence: High

Strategy Evidence Sources:
- .ai/goals.md
- .ai/architecture.md
- .ai/decisions.md
- README.md

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

### .ai/goals.md is canonical repository intent

Context:
The repository intelligence contract separates human-owned `.ai/goals.md` from generated `.ai/` artifacts.

Reason:
Plain markdown keeps repository-owner intent local and reviewable while deterministic generators rebuild derived context for humans and future automation.

Consequences:
Repository owners should edit `.ai/goals.md`; generated intelligence should be regenerated from that canonical source and remain diffable.

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
- `npm run test`

## Current Backlog
- No generated content available yet.

## Repository Health Summary
- Goals: Present
- Architecture: Present
- Strategy: Present
- Backlog: Present
- Decisions: Present
- Validation: Present
- Agents: Present
- Code: Present
- Architect Prompt: Present

- Product thesis present
- Current focus present
- Core systems present
- Strategy present
- North Star Metric present
- Strategic Differentiator present
- Current Product Bet present
- Current Experiment present
- What Not To Build present
- Success Definition present
- Strategy quality score 100/100
- Product Signal Quality strong
- Strategy leakage not detected
- Implementation Leakage Warning not detected
- Strategy confidence High
- Evidence lines present
- Backlog noise not detected
- Validation commands detected
- Validation confidence Medium
- Xcode validation metadata not detected
- Canonical editing target .ai/goals.md
- Manual sections not detected in canonical goals
- Generated artifacts are regenerated, not manually edited.

- Missing manual goals

Fill in `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.
