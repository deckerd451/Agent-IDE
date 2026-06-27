# Agent IDE Reviewer Prompt

## Role Instructions

- Review changes against product goals, architecture, backlog intent, validation evidence, and constraints.
- Look for hidden scope expansion, missing documentation, unvalidated behavior, and inconsistency across `.ai/` files.
- Prefer actionable findings tied to specific repository context over broad style feedback.

## Product Thesis

# Goals

## Product Thesis
Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.

## North Star Metric
Repository handoff readiness is Ready with high canonical intelligence consistency.

## Current Focus
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

## What Not To Build
Do not build broad automation before repository understanding is consistently reliable for handoffs.

## Success Criteria
- Control Plane reports repository handoff readiness as Ready.
- Canonical intelligence consistency has no avoidable contradictions or duplicate generated sections.

## Manual Goals
- Product intent: Nearify should help people transform real-world encounters into lasting professional relationships through accurate relationship memory and timely follow-up recommendations.
- Current focus: Make repository understanding the primary surface of Agent IDE for Nearify handoffs.
- Success criteria: Manual Goals completeness reaches 100%, Canonical Completeness reports Manual Goals as Complete, and Repository Intelligence regenerates successfully with Verification Status remaining Verified with zero failures.
- Long-term vision: Nearify should become the world's most trusted relationship intelligence system, helping people transform real-world encounters into lasting professional relationships through accurate relationship memory, timely follow-up recommendations, and continuously improving relationship intelligence.

## Active

- Make repository understanding the primary surface of Agent IDE.

## Deferred

- Add automation only after the local `.ai/` contract is useful on its own.

## Strategy

# Strategy

## Product Thesis
Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.

Evidence: .ai/goals.md
## North Star Metric
Repository handoff readiness is Ready with high canonical intelligence consistency.

Evidence: .ai/goals.md
## Strategic Differentiator
Repository intelligence that turns repository understanding into reusable AI context for developer workflows.

Evidence: .ai/goals.md, .ai/architecture.md, .ai/decisions.md, README.md, docs/repository-improvement-product-redesign.md
## Current Product Bet
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

Evidence: .ai/goals.md
## Current Experiment
Can the system reliably deliver the current focus: The repository is currently focused on making repository understanding the primary surface of Agent IDE?

Evidence: .ai/goals.md
## What Not To Build
Do not build broad automation before repository understanding is consistently reliable for handoffs.

Evidence: .ai/goals.md
## Success Definition
- Control Plane reports repository handoff readiness as Ready.
- Canonical intelligence consistency has no avoidable contradictions or duplicate generated sections.

Evidence: .ai/goals.md
## Strategy Confidence
High
## Strategy Evidence Sources
- .ai/goals.md
- .ai/architecture.md
- .ai/decisions.md
- README.md
- docs/repository-improvement-product-redesign.md
## Strategy Warnings
- No strategy leakage detected.
- No implementation leakage detected.

## Architecture Summary

# Architecture

Last Audit: 2026-06-27T21:12:47.221Z
Confidence: 95%

## Product Thesis
Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.

Product Thesis Evidence:
.ai/goals.md

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
- docs/
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

Last Audit: 2026-06-27T21:12:47.377Z
Confidence: 95%

## High Priority
- None detected

## Medium Priority
- **Add Backlog Quality Filtering**
  - Source: README.md:292
  - Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.
- **Add Cross-links Between .ai Documents**
  - Source: README.md:295
  - Reason: Repository documentation identifies actionable follow-up work from: Add cross-links between `.ai` documents.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add cross-links between `.ai` documents.
- **Add Expand Repository Health Checks**
  - Source: README.md:296
  - Reason: Repository documentation identifies actionable follow-up work from: Expand repository health checks as more intelligence artifacts are added.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add expand repository health checks as more intelligence artifacts are added.
- **Add Richer Validation Detection**
  - Source: README.md:293
  - Reason: Repository documentation identifies actionable follow-up work from: Add richer validation detection for additional ecosystems.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add richer validation detection for additional ecosystems.
- **Improve Markdown Rendering**
  - Source: README.md:294
  - Reason: Repository documentation identifies actionable follow-up work from: Improve markdown rendering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to improve markdown rendering.

## Low Priority
- None detected

## Manual Backlog

## Validation Status

# Validation

## Last Validation
- 2026-06-27T21:13:13.073Z

## Confidence
- Low

## Overall Status: Failing

## Commands Run
- `npm run build`
- `npm run test`

## Results
### npm run build
- Status: FAIL
- Exit code: 1
- Duration: 1.4s
- Output summary:
```text
  src/App.tsx(1501,177): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1501,292): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1504,139): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1504,181): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1504,193): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1504,198): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1507,7): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1508,5): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/main.tsx(1,28): error TS2307: Cannot find module 'react' or its corresponding type declarations.
  src/main.tsx(2,28): error TS2307: Cannot find module 'react-dom/client' or its corresponding type declarations.
  src/main.tsx(4,8): error TS2882: Cannot find module or type declarations for side-effect import of './styles.css'.
  src/main.tsx(7,3): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
```

### npm run test
- Status: PASS
- Exit code: 0
- Duration: 2.6s
- Output summary:
```text
    duration_ms: 0.273195
    type: 'test'
    ...
  1..160
  # tests 160
  # suites 0
  # pass 160
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 2354.092571
```

## Xcode Project Validation
- No Xcode project or workspace metadata detected.

## Xcode List Results
- No `xcodebuild -list` commands were run.

## Known Gaps
- No `npm run lint` script was detected; style/static lint coverage is unknown.
- No standalone typecheck script was detected; type validation is covered only insofar as the build runs it.

## Manual Validation Notes

## Repository Health

# Repository Health

Last Audit: 2026-06-26T13:59:08.292Z
Overall Health: Healthy
Confidence: High

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

### Canonical Intelligence
- Overall: Partial (83%)
- Manual Goals: Complete (100%)
- Product Thesis: Complete (100%)
- Current Focus: Complete (100%)
- Success Criteria: Strong (100%)
- Current Product Bet: Missing (0%)
  - Missing: Current Product Bet
- What Not To Build: Complete (100%)

### Evidence Synthesis
- Evidence Synthesis: Strong
- Canonical fields supported by repository evidence: 2 / 2

## Evidence Lineage
- Canonical Sources: Goals, README
- Independent Evidence: Architecture, Decision Log, Validation
- Generated Evidence: Context Package, Repository Health, Strategy
- Confidence calculation: Canonical and independent evidence groups increase confidence; generated confirmations verify consistency but do not increase confidence.
- Evidence ancestry: Generated artifacts descend from canonical owner intent plus independent repository evidence.

## Quality Signals
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
- Manual sections preserved in canonical goals
- Canonical Intelligence Partial (83%)
- Manual Goals Complete (100%)
- Evidence Synthesis Strong
- Canonical fields supported by repository evidence 2 / 2
- Generated artifacts are regenerated, not manually edited.

## Risks
- No repository health risks detected.

## Repository Intelligence Explanation
### Evidence Synthesis: Current Product Bet
- Sources: Strategy
- Confidence: None
- Independent evidence: None
- Generated confirmations: Strategy
- Suggested Canonical Wording: The repository is currently focused on making repository understanding the primary surface of Agent IDE.
- Selection rule: Selected the most frequent exact normalized wording across repository-local sources; ties sort by wording. Confidence is None from 0 independent evidence groups. Generated confirmations do not increase confidence.

### Evidence Synthesis: Strategic Differentiator
- Sources: Strategy
- Confidence: None
- Independent evidence: None
- Generated confirmations: Strategy
- Suggested Canonical Wording: Repository intelligence that turns repository understanding into reusable AI context for developer workflows.
- Selection rule: Selected the most frequent exact normalized wording across repository-local sources; ties sort by wording. Confidence is None from 0 independent evidence groups. Generated confirmations do not increase confidence.

- No repository health findings require explanation.

## AI Handoff Validation
- Overall score: 88/100 (Ready)

### Recoverable Information
- Repository explanation
- Product thesis
- Current product bet
- Current focus
- Strategy
- Architecture
- Decision ranking
- Highest-priority issue
- Next implementation step
- Validation status
- Canonical ownership
- Confidence explanation

### Hidden Information
- None detected.

### Contradictions
- None detected.

### Missing Explanations
- Decision ranking rationale
- Recommendation rationale

### Suggested Improvements
- Add decision ranking rationale to generated explanations.
- Add recommendation rationale to generated explanations.

## Recommended Next Step
Keep the intelligence layer current by running Refresh Intelligence after meaningful repository changes.

## Manual Health Notes

## Known Constraints

- Do not make LLM calls.
- Do not execute agents.
- Treat the `.ai/` markdown files as the source of repository-understanding context.
- Prefer local, deterministic commands and reviewable file changes.

# Decisions

Last Audit: 2026-06-27T21:12:52.312Z
Confidence: 95%

## Active Decisions

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

## Manual Decisions

# Agents

- Describe intended agent responsibilities and limits before adding automation.
- Keep permissions, review expectations, and handoff points explicit.

## Current status

- No real agents run in this app.
- This file is planning context only.

## Task Guidance

- Check whether the change preserves the local-first repository-understanding contract.
- Verify that validation evidence is current and proportional to the change.
- Flag places where decisions, backlog, or code notes should be updated.

## Complete Repository Context

### .ai/goals.md

```markdown
# Goals

## Product Thesis
Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.

## North Star Metric
Repository handoff readiness is Ready with high canonical intelligence consistency.

## Current Focus
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

## What Not To Build
Do not build broad automation before repository understanding is consistently reliable for handoffs.

## Success Criteria
- Control Plane reports repository handoff readiness as Ready.
- Canonical intelligence consistency has no avoidable contradictions or duplicate generated sections.

## Manual Goals
- Product intent: Nearify should help people transform real-world encounters into lasting professional relationships through accurate relationship memory and timely follow-up recommendations.
- Current focus: Make repository understanding the primary surface of Agent IDE for Nearify handoffs.
- Success criteria: Manual Goals completeness reaches 100%, Canonical Completeness reports Manual Goals as Complete, and Repository Intelligence regenerates successfully with Verification Status remaining Verified with zero failures.
- Long-term vision: Nearify should become the world's most trusted relationship intelligence system, helping people transform real-world encounters into lasting professional relationships through accurate relationship memory, timely follow-up recommendations, and continuously improving relationship intelligence.

## Active

- Make repository understanding the primary surface of Agent IDE.

## Deferred

- Add automation only after the local `.ai/` contract is useful on its own.
```

### .ai/architecture.md

```markdown
# Architecture

Last Audit: 2026-06-27T21:12:47.221Z
Confidence: 95%

## Product Thesis
Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.

Product Thesis Evidence:
.ai/goals.md

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
- docs/
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
Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.

Evidence: .ai/goals.md
## North Star Metric
Repository handoff readiness is Ready with high canonical intelligence consistency.

Evidence: .ai/goals.md
## Strategic Differentiator
Repository intelligence that turns repository understanding into reusable AI context for developer workflows.

Evidence: .ai/goals.md, .ai/architecture.md, .ai/decisions.md, README.md, docs/repository-improvement-product-redesign.md
## Current Product Bet
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

Evidence: .ai/goals.md
## Current Experiment
Can the system reliably deliver the current focus: The repository is currently focused on making repository understanding the primary surface of Agent IDE?

Evidence: .ai/goals.md
## What Not To Build
Do not build broad automation before repository understanding is consistently reliable for handoffs.

Evidence: .ai/goals.md
## Success Definition
- Control Plane reports repository handoff readiness as Ready.
- Canonical intelligence consistency has no avoidable contradictions or duplicate generated sections.

Evidence: .ai/goals.md
## Strategy Confidence
High
## Strategy Evidence Sources
- .ai/goals.md
- .ai/architecture.md
- .ai/decisions.md
- README.md
- docs/repository-improvement-product-redesign.md
## Strategy Warnings
- No strategy leakage detected.
- No implementation leakage detected.
```

### .ai/backlog.md

```markdown
# Backlog

Last Audit: 2026-06-27T21:12:47.377Z
Confidence: 95%

## High Priority
- None detected

## Medium Priority
- **Add Backlog Quality Filtering**
  - Source: README.md:292
  - Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.
- **Add Cross-links Between .ai Documents**
  - Source: README.md:295
  - Reason: Repository documentation identifies actionable follow-up work from: Add cross-links between `.ai` documents.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add cross-links between `.ai` documents.
- **Add Expand Repository Health Checks**
  - Source: README.md:296
  - Reason: Repository documentation identifies actionable follow-up work from: Expand repository health checks as more intelligence artifacts are added.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add expand repository health checks as more intelligence artifacts are added.
- **Add Richer Validation Detection**
  - Source: README.md:293
  - Reason: Repository documentation identifies actionable follow-up work from: Add richer validation detection for additional ecosystems.
  - Suggested Next Step: Define the smallest local, deterministic change needed to add richer validation detection for additional ecosystems.
- **Improve Markdown Rendering**
  - Source: README.md:294
  - Reason: Repository documentation identifies actionable follow-up work from: Improve markdown rendering.
  - Suggested Next Step: Define the smallest local, deterministic change needed to improve markdown rendering.

## Low Priority
- None detected

## Manual Backlog
```

### .ai/decisions.md

```markdown
# Decisions

Last Audit: 2026-06-27T21:12:52.312Z
Confidence: 95%

## Active Decisions

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

## Manual Decisions
```

### .ai/validation.md

```markdown
# Validation

## Last Validation
- 2026-06-27T21:13:13.073Z

## Confidence
- Low

## Overall Status: Failing

## Commands Run
- `npm run build`
- `npm run test`

## Results
### npm run build
- Status: FAIL
- Exit code: 1
- Duration: 1.4s
- Output summary:
```text
  src/App.tsx(1501,177): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1501,292): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1504,139): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1504,181): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1504,193): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1504,198): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1507,7): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/App.tsx(1508,5): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
  src/main.tsx(1,28): error TS2307: Cannot find module 'react' or its corresponding type declarations.
  src/main.tsx(2,28): error TS2307: Cannot find module 'react-dom/client' or its corresponding type declarations.
  src/main.tsx(4,8): error TS2882: Cannot find module or type declarations for side-effect import of './styles.css'.
  src/main.tsx(7,3): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
```

### npm run test
- Status: PASS
- Exit code: 0
- Duration: 2.6s
- Output summary:
```text
    duration_ms: 0.273195
    type: 'test'
    ...
  1..160
  # tests 160
  # suites 0
  # pass 160
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 2354.092571
```

## Xcode Project Validation
- No Xcode project or workspace metadata detected.

## Xcode List Results
- No `xcodebuild -list` commands were run.

## Known Gaps
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

Last Audit: 2026-06-26T13:59:08.292Z
Overall Health: Healthy
Confidence: High

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

### Canonical Intelligence
- Overall: Partial (83%)
- Manual Goals: Complete (100%)
- Product Thesis: Complete (100%)
- Current Focus: Complete (100%)
- Success Criteria: Strong (100%)
- Current Product Bet: Missing (0%)
  - Missing: Current Product Bet
- What Not To Build: Complete (100%)

### Evidence Synthesis
- Evidence Synthesis: Strong
- Canonical fields supported by repository evidence: 2 / 2

## Evidence Lineage
- Canonical Sources: Goals, README
- Independent Evidence: Architecture, Decision Log, Validation
- Generated Evidence: Context Package, Repository Health, Strategy
- Confidence calculation: Canonical and independent evidence groups increase confidence; generated confirmations verify consistency but do not increase confidence.
- Evidence ancestry: Generated artifacts descend from canonical owner intent plus independent repository evidence.

## Quality Signals
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
- Manual sections preserved in canonical goals
- Canonical Intelligence Partial (83%)
- Manual Goals Complete (100%)
- Evidence Synthesis Strong
- Canonical fields supported by repository evidence 2 / 2
- Generated artifacts are regenerated, not manually edited.

## Risks
- No repository health risks detected.

## Repository Intelligence Explanation
### Evidence Synthesis: Current Product Bet
- Sources: Strategy
- Confidence: None
- Independent evidence: None
- Generated confirmations: Strategy
- Suggested Canonical Wording: The repository is currently focused on making repository understanding the primary surface of Agent IDE.
- Selection rule: Selected the most frequent exact normalized wording across repository-local sources; ties sort by wording. Confidence is None from 0 independent evidence groups. Generated confirmations do not increase confidence.

### Evidence Synthesis: Strategic Differentiator
- Sources: Strategy
- Confidence: None
- Independent evidence: None
- Generated confirmations: Strategy
- Suggested Canonical Wording: Repository intelligence that turns repository understanding into reusable AI context for developer workflows.
- Selection rule: Selected the most frequent exact normalized wording across repository-local sources; ties sort by wording. Confidence is None from 0 independent evidence groups. Generated confirmations do not increase confidence.

- No repository health findings require explanation.

## AI Handoff Validation
- Overall score: 88/100 (Ready)

### Recoverable Information
- Repository explanation
- Product thesis
- Current product bet
- Current focus
- Strategy
- Architecture
- Decision ranking
- Highest-priority issue
- Next implementation step
- Validation status
- Canonical ownership
- Confidence explanation

### Hidden Information
- None detected.

### Contradictions
- None detected.

### Missing Explanations
- Decision ranking rationale
- Recommendation rationale

### Suggested Improvements
- Add decision ranking rationale to generated explanations.
- Add recommendation rationale to generated explanations.

## Recommended Next Step
Keep the intelligence layer current by running Refresh Intelligence after meaningful repository changes.

## Manual Health Notes
```
