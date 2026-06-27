# Execution Model

## Repository Execution Model

### Repository Purpose

Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.

### Primary Execution Pipeline

1. **Build**: `npm run build`
2. **Test**: `npm run test`
3. **Repository -> .ai files -> Dashboard**: architecture.md
4. **npm run init**: architecture.md
5. **npm run audit -> generated architecture.md**: architecture.md
6. **npm run backlog -> generated backlog.md**: architecture.md

### Major Execution Stages

- Build
- Test
- Repository -> .ai files -> Dashboard
- npm run init
- npm run audit -> generated architecture.md
- npm run backlog -> generated backlog.md

## Canonical Entities

| Entity | Owner | Persistence | Type | Confidence |
|---|---|---|---|---|
| Canonical Goals | Human (repository owner) | Disk (.ai/goals.md) | Canonical | High |
| Architecture | Generator (audit.mjs) | Disk (.ai/architecture.md) | Generated | High |
| Strategy | Generator (strategy.mjs) | Disk (.ai/strategy.md) | Generated | High |
| Backlog | Generator (backlog.mjs) | Disk (.ai/backlog.md) | Generated | High |
| Decisions | Generator (decisions.mjs) | Disk (.ai/decisions.md) | Generated | High |
| Validation | Generator (validate-intel.mjs) | Disk (.ai/validation.md) | Generated | High |
| Repository Health | Generator (health.mjs) | Disk (.ai/repository-health.md) | Generated | High |
| Context Package | Generator (context-package.mjs) | Disk (.ai/context-package.md) | Generated | High |
| Decision Ranking | Generator (next-improvement.mjs) | Disk (.ai/decision-ranking.json) | Generated | High |
| AI Handoff Validation | Generator (ai-handoff-validation.mjs) | Disk (.ai/ai-handoff-validation.json) | Generated | High |
| Evidence Lineage | Generator (evidence-lineage.mjs) | Disk (.ai/evidence-lineage.json) | Generated | High |
| Intelligence Quality | Generator (intelligence-quality.mjs) | Disk (.ai/intelligence-quality.json) | Generated | High |
| Dashboard UI | See .ai/architecture.md | Inferred from architecture | Inferred | Medium |
| Repository Intelligence Contract | See .ai/architecture.md | Inferred from architecture | Inferred | Medium |
| Local Audit Engine | See .ai/architecture.md | Inferred from architecture | Inferred | Medium |

## Sources of Truth

| Concept | Canonical Owner | Notes |
|---|---|---|
| Product Intent | .ai/goals.md | — |
| Architecture Description | .ai/architecture.md | — |
| Product Strategy | .ai/strategy.md | — |
| Prioritized Work | .ai/backlog.md | — |
| Technical Decisions | .ai/decisions.md | — |
| Validation Evidence | .ai/validation.md | — |
| Intelligence Quality | .ai/repository-health.md | — |
| Ranked Recommendation | .ai/decision-ranking.json | — |
| Handoff Artifact | .ai/context-package.md | — |

## Repository State Transitions

| From | Trigger | To | Deterministic |
|---|---|---|---|
| Source Changed | Developer pushes code | Validation Running | Yes |
| Validation Running | All validation commands pass | Validated | Yes |
| Validation Running | Any validation command fails | Validation Failed | Yes |
| Repository | System operation | Dashboard | Yes |
| npm run init:ai | System operation | starter intelligence files | Yes |
| npm run audit | System operation | generated architecture.md | Yes |
| npm run backlog | System operation | generated backlog.md | Yes |

## Architectural Invariants

- **.ai/goals.md is canonical repository intent**
  - Confidence: High
  - Evidence: .ai/decisions.md
- **Plain markdown keeps repository-owner intent local and reviewable while deterministic generators rebuild derived context for humans and future automation.**
  - Confidence: High
  - Evidence: .ai/decisions.md
- **Repository owners should edit `.ai/goals.md`; generated intelligence should be regenerated from that canonical source and remain diffable.**
  - Confidence: High
  - Evidence: .ai/decisions.md
- **No LLM dependency in core intelligence generation**
  - Confidence: High
  - Evidence: .ai/decisions.md
- **Generation scripts must not call LLM APIs, should document deterministic inputs, and should treat future LLM features as optional layers rather than core requirements.**
  - Confidence: High
  - Evidence: .ai/decisions.md
- **Deterministic generation preferred over inference**
  - Confidence: High
  - Evidence: .ai/decisions.md
- **Deterministic generation makes repository intelligence auditable, repeatable, and suitable for version control review.**
  - Confidence: High
  - Evidence: .ai/decisions.md
- **Success criterion: Control Plane reports repository handoff readiness as Ready.**
  - Confidence: Medium
  - Evidence: .ai/goals.md (Success Criteria)
- **Success criterion: Canonical intelligence consistency has no avoidable contradictions or duplicate generated sections.**
  - Confidence: Medium
  - Evidence: .ai/goals.md (Success Criteria)
- **No LLM integration**
  - Confidence: Medium
  - Evidence: .ai/architecture.md
- **11 intelligence artifacts are generated deterministically and not manually edited**
  - Confidence: High
  - Evidence: .ai/ directory structure
- **Repository correctness is verified by 2 deterministic validation commands**
  - Confidence: High
  - Evidence: .ai/validation.md (Commands Run)

## Ownership Risks

- **Workflow progression state is persisted in browser localStorage under a client-owned key. This means workflow state is invisible to the server and non-reproducible across browsers.**
  - Category: Ownership
  - Confidence: High
  - Evidence: src/workflow.ts: workflowStateStorageKey = "agent-ide:workflow-state"
  - Source Files: src/workflow.ts, src/App.tsx
- **Recommendation-affecting completion state is client-owned. Validation completion records that suppress server-side recommendation selection are stored in browser localStorage, not on disk.**
  - Category: Ownership
  - Confidence: High
  - Evidence: src/workflow.ts: validationCompletionStorageKey = "agent-ide:validation-completions"
  - Source Files: src/workflow.ts, src/App.tsx, scripts/next-improvement.mjs
- **Recommendation generation is not fully server-deterministic. The server receives client-supplied completion records that suppress recommendation selection. Two clients with different localStorage state will produce different recommendations from the same repository.**
  - Category: Determinism
  - Confidence: High
  - Evidence: src/App.tsx sends validationCompletions in /api/repository/refresh payload; scripts/next-improvement.mjs uses these to set validationAlreadyCompleted and suppress ai-handoff-validation
  - Source Files: src/App.tsx, scripts/server.mjs, scripts/next-improvement.mjs
- **Client persists 4 distinct state write(s) to localStorage. Browser-local persistence means repository recommendation state is not reproducible from a fresh browser session.**
  - Category: Persistence
  - Confidence: High
  - Evidence: src/App.tsx: 4 localStorage.setItem calls
  - Source Files: src/App.tsx
- **Multiple ownership boundaries affect recommendation selection. ValidationCompletionRecord is a client-defined type that crosses the client/server boundary to influence server-side recommendation suppression. The canonical source of recommendation state is split: current recommendation lives in .ai/decision-ranking.json (server) but suppression state lives in browser localStorage (client).**
  - Category: Source of Truth
  - Confidence: High
  - Evidence: src/workflow.ts defines ValidationCompletionRecord; scripts/next-improvement.mjs consumes it via validationCompletions option
  - Source Files: src/workflow.ts, scripts/next-improvement.mjs

## Architectural Risks

- **Validation has low confidence**
  - Category: Repository Health
  - Evidence: .ai/repository-health.md (Risks)
- **Workflow progression state is persisted in browser localStorage under a client-owned key. This means workflow state is invisible to the server and non-reproducible across browsers.**
  - Category: Ownership
  - Evidence: src/workflow.ts: workflowStateStorageKey = "agent-ide:workflow-state"
- **Recommendation-affecting completion state is client-owned. Validation completion records that suppress server-side recommendation selection are stored in browser localStorage, not on disk.**
  - Category: Ownership
  - Evidence: src/workflow.ts: validationCompletionStorageKey = "agent-ide:validation-completions"
- **Recommendation generation is not fully server-deterministic. The server receives client-supplied completion records that suppress recommendation selection. Two clients with different localStorage state will produce different recommendations from the same repository.**
  - Category: Determinism
  - Evidence: src/App.tsx sends validationCompletions in /api/repository/refresh payload; scripts/next-improvement.mjs uses these to set validationAlreadyCompleted and suppress ai-handoff-validation
- **Client persists 4 distinct state write(s) to localStorage. Browser-local persistence means repository recommendation state is not reproducible from a fresh browser session.**
  - Category: Persistence
  - Evidence: src/App.tsx: 4 localStorage.setItem calls
- **Multiple ownership boundaries affect recommendation selection. ValidationCompletionRecord is a client-defined type that crosses the client/server boundary to influence server-side recommendation suppression. The canonical source of recommendation state is split: current recommendation lives in .ai/decision-ranking.json (server) but suppression state lives in browser localStorage (client).**
  - Category: Source of Truth
  - Evidence: src/workflow.ts defines ValidationCompletionRecord; scripts/next-improvement.mjs consumes it via validationCompletions option

## Execution Confidence

- Overall Confidence: **High** (100% of intelligence files present)
- Evidence Count: 6 populated sources
- Invariant Count: 12
- Architectural Risk Count: 6

**Evidence Sources:**
- .ai/goals.md
- .ai/architecture.md
- .ai/strategy.md
- .ai/decisions.md
- .ai/validation.md
- .ai/repository-health.md

**Unresolved Ambiguities:**
- Multiple ownership detected for at least one concept

**Inferred Assumptions:**
- Generated intelligence files are regenerated atomically on each refresh
- .ai/goals.md is the only file edited directly by repository owners
- Validation commands reflect the complete required execution pipeline

## Manual Execution Notes
