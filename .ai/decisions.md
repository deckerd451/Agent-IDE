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
