# RFC: Agent IDE Execution Model Review and Redesign

**Status:** Draft  
**Author:** Principal Software Architect  
**Date:** 2026-06-27  
**Branch context:** `claude/validation-completion-refresh-bug-tqtevt`

---

## Preface

This RFC is an architectural design review, not an implementation audit. It was produced by reading the full repository implementation cold, with no prior conversation context. Code is treated as the primary source of evidence. Bug fixes are out of scope. The question is whether the execution model is capable of delivering the intended product.

All conclusions carry an explicit confidence rating (0–100%). Low confidence is not evasion — it is an honest signal about where the model has gaps.

---

## 1. Product Thesis

Agent IDE is trying to become the first **deterministic repository understanding layer** that replaces guesswork about what to do next with a single, ranked, evidenced recommendation derived entirely from local repository signals. The system should be invisible: the user experiences a sequence of concrete tasks, each accompanied by the exact artifact they need to complete it, and each completion automatically generates the next task. Repository intelligence, workflows, quality scores, and finite state machines are implementation details the user should never encounter. The long-term bet is that if enough repository structure and intent can be made machine-readable without an LLM, an entire class of developer productivity problems collapses into a single question: *what is the highest-leverage thing a human should do in this repository right now?*

**Confidence: 90%** — The codebase strongly supports this reading. The 10% uncertainty is that the product may have a secondary thesis around making repositories "AI-hand-off-ready" that is not yet fully realized.

---

## 2. Current Execution Model

### 2.1 Canonical Entities

| Entity | Where Defined | Owner |
|---|---|---|
| Repository Path | React state (`repositoryPath`) | User input |
| Connected Path | React state (`connectedPath`) | Server-resolved at refresh |
| Repository Intelligence | `.ai/*.md` files on disk | Server generators (except `.ai/goals.md`, human-owned) |
| Control Plane | In-memory JSON, persisted to disk | Server (`persistControlPlane`) |
| Decision Ranking | `decision-ranking.json` on disk | `next-improvement.mjs` |
| Recommendation | Field inside Control Plane | `next-improvement.mjs` |
| Workflow State | `localStorage["agent-ide:workflow-state"]` | Client |
| Validation Completions | `localStorage["agent-ide:validation-completions"]` | Client |
| Current Workflow | Derived in-memory (`createWorkflow`) | Client (derived) |
| Context Package Hash | Computed both client and server | Ambiguous (see §6) |

### 2.2 Ownership Map

```
┌──────────────────────────────────────────────────────┐
│  CANONICAL OWNER: Human                              │
│  .ai/goals.md                                        │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  OWNER: Server Generators (scripts/*.mjs)            │
│  .ai/architecture.md    .ai/strategy.md              │
│  .ai/backlog.md         .ai/decisions.md             │
│  .ai/validation.md      .ai/repository-health.md     │
│  .ai/context-package.md .ai/prompts/*.md             │
│  .ai/*.json (quality, ranking, lineage, timeline)    │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  OWNER: Server Control Plane (server.mjs)            │
│  Aggregated JSON snapshot of current state           │
│  Recommendation, quality scores, decision ranking    │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  OWNER: Client (App.tsx)                             │
│  WorkflowState (localStorage)                        │
│  ValidationCompletions (localStorage)                │
│  currentWorkflow (derived, in-memory)                │
│  UI state (isWorkItemOpen, finishNotice, etc.)       │
└──────────────────────────────────────────────────────┘
```

### 2.3 Orchestration

**Refresh pipeline** (server.mjs, `handleRefresh`):

```
POST /api/repository/refresh
  { repositoryPath, validationCompletions }
        │
        ▼
  resolve path, create .ai/ baseline
        │
        ▼ (sequential)
  [audit] → [backlog] → [validate-intel] → [decisions]
      → [strategy] → [prompt×4] → [health]
      → [context-package] → [ai-handoff-validation]
        │
        ▼
  persistControlPlane(resolvedPath, validationCompletions)
    ├── computeQualitySnapshot()
    ├── verifyArtifacts()
    ├── chooseNextImprovementWithCandidates()   ← uses validationCompletions
    ├── generateNextImprovementPrompt()
    ├── computeEvidenceLineage()
    └── write all JSON artifacts to disk
        │
        ▼
  stream: { type: 'success', summary, aiPath, repositoryPath }
```

**Client workflow lifecycle**:

```
User enters path → clicks "Refresh Repository Intelligence"
        │
        ▼
POST /api/repository/refresh (with localStorage validationCompletions)
        │
        ▼ NDJSON stream
setSteps() for each step-started / step-finished event
        │
        ▼ stream closes
loadIntelligenceFiles() + GET /api/repository/control-plane
        │
        ▼
setControlPlane(data)  ← derives currentWorkflow via createWorkflow()
        │
User sees: CurrentTaskCard with one recommendation
        │
User clicks primary action button
        │
        ▼
performWorkflowStepAction()  ← copies artifact to clipboard
advanceWorkflow()            ← computes next WorkflowState
setWorkflowState()           ← persists to localStorage
        │
        ├── if next.repositoryState === 'Refresh Repository':
        │     persistValidationCompletion()  ← write to localStorage
        │     refreshIntelligence({ clearWorkflow: true })
        │
        └── else: render next step in CurrentTaskCard
```

### 2.4 Persistence

| What | Where | Format | Owner |
|---|---|---|---|
| Repository Intelligence | `.ai/*.md` | Markdown | Server generators |
| Quality/verification metadata | `.ai/*.json` | JSON | Server (`persistControlPlane`) |
| Workflow progress | `localStorage["agent-ide:workflow-state"]` | JSON | Client |
| Validation completions | `localStorage["agent-ide:validation-completions"]` | JSON array | Client |
| Selected sidebar tab | `localStorage["agent-ide:selected-intelligence-tab"]` | String | Client |

There is no server-side session state. The server is stateless between requests.

### 2.5 Recommendation Lifecycle

```
1. Server reads .ai/*.md + *.json signal files
2. next-improvement.mjs detects candidate issues (9 issue types)
3. Each candidate is scored: base priority + severity boost + actionability boost
4. Candidates ranked by (priorityScore, expectedImprovement, actionability, severity, title)
5. Rank #1 is the recommendation
6. Suppression check: if validation-experiment and matching ValidationCompletionRecord exists → skip
7. Recommendation + all candidates persisted to disk
8. Control plane returns recommendation to client
```

### 2.6 Workflow Lifecycle

```
createWorkflow(input, workflowState) in workflow.ts:
  ├── if no workflowState → new workflow at step 0
  ├── if workflowState.workflowKey matches → resume from saved step
  └── if workflowKey differs (new recommendation) → new workflow at step 0

Each workflow type has hardcoded step definitions:
  Validation:       6 steps (copy-context-package → ... → refresh-repository)
  Implementation:   5 steps (copy-implementation-prompt → ... → refresh-repository)
  ProductDecision:  5 steps (review-canonical-edit → ... → refresh-repository)
  Investigation:    5 steps
  Documentation:    5 steps

advanceWorkflow(input, workflowState):
  ├── finds current step index
  ├── marks current step complete
  ├── moves to next step
  ├── updates repositoryState, completionState, progressPercentage
  └── returns new WorkflowState
```

### 2.7 Completion Lifecycle

```
When step advances to 'Refresh Repository':
  1. Client persists ValidationCompletionRecord to localStorage
     (workflowKey, completedAt, repositoryPath, selectedIssueId,
      recommendationTitle, contextPackageHash)
  2. Client calls refreshIntelligence({ clearWorkflow: true })
  3. refreshIntelligence() reads validationCompletions from localStorage
  4. Sends to POST /api/repository/refresh
  5. Server checks: does any completion match current context?
     Match = repositoryPath + workflowKey + selectedIssueId + contextPackageHash
  6. If match found → skip 'ai-handoff-validation' recommendation
  7. After refresh: client sets workflowState = null, controlPlane = new value
```

### 2.8 Refresh Lifecycle

```
refreshIntelligence() in App.tsx:
  1. setControlPlane(null)      ← removes old state (UI shows loading)
  2. setIsRefreshing(true)
  3. POST /api/repository/refresh
  4. Consume NDJSON stream → update step progress UI
  5. Stream closes → load intelligence files + control plane
  6. setControlPlane(refreshedControlPlane)
  7. if clearWorkflow: removeItem(workflowStateStorageKey), setWorkflowState(null)
  8. else: preserve workflow if workflowKey still matches
  9. setProgressSummary(delta)
  10. setIsRefreshing(false)
```

### 2.9 Validation Lifecycle

```
Validation experiment type:
  Step 1: copy-context-package   → copies data.packages.context to clipboard
  Step 2: copy-understanding-check → copies buildValidationPrompt() to clipboard
  Step 3: open-chatgpt           → no artifact, user opens ChatGPT manually
  Step 4: paste-response         → no artifact, user pastes manually
  Step 5: run-validation         → no artifact, advances to refresh-repository
  Step 6: refresh-repository     → triggers server refresh

Suppression:
  - stableContextPackageHash strips "Generated: <timestamp>" line, hashes rest
  - Stored in ValidationCompletionRecord.contextPackageHash
  - Server checks hash against current context package content
  - Match → validation already done for this context → skip recommendation
```

### 2.10 UI Lifecycle

```
App render decision tree:
  if !connectedPath → WelcomeDashboard
  if selected !== 'Control Plane' → section markdown content
  if isWorkItemOpen && workflow → WorkItemPage
  else → ControlPlaneDashboard
    └── CurrentTaskCard (workflow ? WorkflowPrimaryButton : refresh button)
        └── TaskArtifact (inline: context pkg, validation prompt, impl prompt, canonical edit)
        └── Advanced disclosure (AfterThis, ProgressSummary, health, quality, etc.)
```

---

## 3. Canonical Sources of Truth

### What has exactly one owner

| Concept | Owner | Confidence |
|---|---|---|
| Product intent | `.ai/goals.md` (human-edited) | 95% |
| Repository file structure | The repository itself | 100% |
| Generator outputs | Server refresh pipeline | 90% |
| Quality scores | `intelligence-quality.mjs` via `persistControlPlane` | 85% |
| Decision ranking | `next-improvement.mjs` | 85% |
| Sidebar navigation | `src/sections.ts` | 100% |
| Workflow step definitions | `src/workflow.ts` | 95% |

### What has multiple owners (architecturally significant)

**Context Package Hash**
- Computed client-side in `App.tsx` using `stableContextPackageHash()` when persisting completion records
- Also computed server-side in `next-improvement.mjs` using `stableContextPackageHash()` to check suppression
- Both implementations must remain identical; any divergence silently breaks suppression
- **Impact:** The client is computing a derived artifact that the server also owns. These two computations must stay synchronized across code changes. If they diverge, either validations are never suppressed (recommendation loops) or always suppressed (recommendations never appear).

**Recommendation Title**
- Generated by `next-improvement.mjs` as `recommendation.title`
- Stored in `ValidationCompletionRecord.recommendationTitle` by client
- Compared by client to detect `sameRecommendationLoop`
- **Impact:** The string used for comparison is human-readable and potentially unstable across generator changes. A cosmetic change to a recommendation title string breaks loop detection.

**Workflow Type → Step Mapping**
- Derived from `packageType` in `src/workflow.ts` (`workflowDefinitions`)
- `packageType` is set by `next-improvement.mjs` on the recommendation object
- Client maps `packageType` → workflow type → step list
- **Impact:** Two modules define complementary halves of the same concept (what type of work this is). They are coupled by an untyped string contract (`'validation-experiment'`, `'product-decision'`, `'implementation'`).

**"What the user should do right now"**
- Server owns: the recommendation and its `packageType`
- Client owns: the workflow state, current step, current step artifact
- Client owns: the user-facing instruction string (in `stepToUserTask()`)
- **Impact:** The server says "do a validation experiment" but the client decides what that means step-by-step. Adding a new workflow step requires updating `src/workflow.ts` (client) and potentially `scripts/next-improvement.mjs` (server). These can drift.

**Validation Completion State**
- Stored in client localStorage
- Passed to server at every refresh
- Server uses it to compute the recommendation
- **Impact:** The server's recommendation depends on client state. A new browser, a localStorage clear, or a different device will result in different recommendations, violating the "deterministic" invariant.

---

## 4. Architectural Invariants

### Explicit invariants (asserted in code or tests)

1. **Exactly one active recommendation** — `firstCandidate(data, 1)` selects rank #1; no provision for multiple simultaneous recommendations
2. **Recommendations are deterministic** — `assert.doesNotMatch(workflowSource, /Math\.random|Date\.now/)` enforced by test
3. **Workflow derives from recommendation** — `createWorkflow(workflowInputForTask(recommendation, task), workflowState)` always called from current controlPlane
4. **Workflow state persists in localStorage** — explicit read on mount, write on every state change
5. **Refresh clears workflow** — `clearWorkflow: true` removes workflow state and localStorage atomically with control plane update
6. **Context hash strips timestamps** — `stableContextPackageHash` removes `Generated:` line before hashing; enforced by suppression tests
7. **Copy-only buttons cannot be primary CTA** — test asserts `WorkflowPrimaryButton` does not call `copyText`

### Implicit invariants (not explicitly asserted, but assumed throughout)

1. **Server is always localhost** — `serverBaseUrl` is hardcoded to `http://localhost:5174`; no provision for remote server
2. **One repository at a time** — no multi-repo support; `repositoryPath` is a single string
3. **Refresh is the only path to a new recommendation** — there is no mechanism to get a new recommendation without running the full refresh pipeline
4. **Workflow type is stable within a recommendation** — if `packageType` changes after a partial workflow, the workflow key changes and the old progress is discarded silently
5. **ValidationCompletionRecords accumulate** — capped at 100 but never explicitly pruned; old records for deleted/renamed repos persist indefinitely
6. **The context package exists at completion time** — `stableContextPackageHash(contextPackage)` is called with `data.packages.context || documents['context-package.md']?.content || ''`; an empty context package hash would permanently suppress the validation recommendation
7. **Generators are stateless and order-independent** — the refresh pipeline runs them sequentially and assumes each is pure; actually `context-package.mjs` depends on outputs of `strategy.mjs`, `backlog.mjs`, etc.
8. **The `.ai/` folder is writable** — no error path for read-only repositories
9. **localStorage is available and not full** — no error handling for storage quota exceptions

---

## 5. State Machine

### Complete execution state machine

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER STATES                               │
│                                                                     │
│   [Idle] ──── POST /refresh ────► [Running Generators]             │
│      ▲                                    │                         │
│      │                             10 steps sequentially           │
│      │                                    │                         │
│      │                            [persistControlPlane]             │
│      │                                    │                         │
│      └──────────── response ─────────── [Done]                     │
│                                                                     │
│   Server has no persistent state between requests.                 │
│   All state is in .ai/ files on disk.                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT STATES                               │
│                                                                     │
│   [No Repository]                                                   │
│        │                                                            │
│        │  user enters path + clicks Refresh                        │
│        ▼                                                            │
│   [Refreshing] ──── stream ────► [Loading Control Plane]           │
│        │                                    │                       │
│        │  error                    setControlPlane()                │
│        ▼                                    │                       │
│   [Error State]              createWorkflow() from recommendation   │
│                                             │                       │
│                                             ▼                       │
│                              ┌──── [Recommendation Ready] ────┐    │
│                              │    (no workflow state)         │    │
│                              │                                │    │
│                              │   user clicks Refresh          │    │
│                              │   Repository Intelligence      │    │
│                              │                                │    │
│                              │         ▼                      │    │
│                              │    [Refreshing] ────────────► ─┘    │
│                              │                                      │
│                              │   OR: user clicks workflow CTA      │
│                              │                                      │
│                              ▼                                      │
│                     [Workflow In Progress]                          │
│                      step 0 of N                                   │
│                              │                                      │
│                     user clicks CTA each step                      │
│                              │                                      │
│                              ▼                                      │
│                     [step 1 of N] → [step 2 of N] → ...           │
│                              │                                      │
│                              ▼ (terminal step)                     │
│                     [Refresh Repository]  ◄── CYCLE POINT         │
│                              │                                      │
│                     persistValidationCompletion()                  │
│                              │                                      │
│                     refreshIntelligence({ clearWorkflow: true })   │
│                              │                                      │
│                     [Refreshing] ─────────────────────────────────►│
│                              │                                      │
│               ┌──────────────┤                                      │
│               │              │                                      │
│     same      │       different                                     │
│  recommendation│      recommendation                                │
│               │              │                                      │
│               ▼              ▼                                      │
│    [Loop Detected]   [New Recommendation Ready]  ◄── RESTART       │
│    (diagnostic only;                                                │
│     no exit path)                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### State transition annotations

| Transition | Deterministic? | Reversible? |
|---|---|---|
| No Repository → Refreshing | User-triggered | Yes (cancel not implemented) |
| Refreshing → Recommendation Ready | Server-determined | No (re-run is not rollback) |
| Recommendation Ready → Workflow In Progress | User-triggered | Yes (localStorage preserved) |
| Workflow step N → step N+1 | User-triggered + copy action | No (advanceWorkflow has no rewind) |
| Terminal step → Refreshing | Auto-triggered | No |
| Refreshing → Same Recommendation | Server-determined | No exit path today |
| Refreshing → New Recommendation | Server-determined | Yes |

**Highlighted cycle:** `[Workflow Complete] → [Refresh] → [Recommendation Ready] → [Workflow In Progress] → [Workflow Complete]`

This is the intended cycle. It is healthy if every complete-refresh pair produces a different recommendation. It degrades to a stuck state if the recommendation does not change.

**State with no deterministic exit:** The `[Loop Detected]` state (same recommendation after refresh) has no automated resolution path. A `loopDiagnostic` is emitted to the dev panel, but the user has no action they can take. The system can only be rescued by: clearing localStorage manually, making a repository change that shifts the recommendation, or changing the suppression logic.

---

## 6. Architectural Problems

### P1: Completion state lives on the wrong side of the network boundary

**What exists:** `ValidationCompletionRecord` is generated and stored by the client (localStorage), then passed to the server at refresh time. The server's recommendation depends on this client-supplied history.

**Why it exists:** The completion event happens in the browser (user clicks a button), and the server is stateless, so there was nowhere else to put it.

**Complexity introduced:** 
- The system is no longer deterministic from the server's perspective. Running `POST /api/refresh` with the same `repositoryPath` produces different results depending on what the client happens to hold in localStorage.
- A new browser, device, or cleared localStorage produces a different recommendation for the same repository — violating the product's core promise.
- The client must pass its own history back to the server, creating a circular information flow.
- The client must compute the same hash (`stableContextPackageHash`) as the server to produce matching keys. If either implementation changes, suppression silently breaks.

**Fundamental or accidental?** Fundamental. The design choice to make the server stateless pushed completion state onto the client. Fixing this requires adding server-side completion persistence or removing the suppression mechanism entirely.

---

### P2: The context package hash is computed twice with synchronized implementations

**What exists:** `stableContextPackageHash()` exists identically in `src/workflow.ts` (TypeScript, client) and `scripts/next-improvement.mjs` (JavaScript, server).

**Why it exists:** P1 above. The client needs to compute the hash to create the completion record; the server needs to compute it to verify suppression.

**Complexity introduced:**
- Two implementations that must stay identical are a maintenance liability.
- The hash algorithm (DJB2) is not a standard library — it is copy-pasted, meaning both copies must be updated together.
- A one-character change in either implementation silently breaks suppression for all future completions.

**Fundamental or accidental?** Accidental consequence of P1. If completion state moved server-side, the hash would only exist in one place.

---

### P3: The workflow type → step mapping is split across a network boundary

**What exists:** The server assigns `packageType` to each recommendation (`'validation-experiment'`, `'product-decision'`, `'implementation'`). The client maps `packageType` → workflow type → step list in `src/workflow.ts`.

**Why it exists:** Historical layering. The server was built first; the client workflow engine was layered on top using the `packageType` field as a hook.

**Complexity introduced:**
- The server decides "what kind of work this is"; the client decides "what steps that implies". These are halves of the same decision.
- Adding a new task type requires updating both `next-improvement.mjs` (to emit a new `packageType`) and `src/workflow.ts` (to define its steps). The connection is an untyped string.
- The `stepToUserTask()` function in `App.tsx` adds a third layer: it maps step IDs to user-facing instructions. Now the same concept has three owners.

**Fundamental or accidental?** Accidental. The server could emit the full step list, or the client could derive it purely locally. Currently it is split without a clear rationale.

---

### P4: Refresh produces an intermediate null state that creates render races

**What exists:** `refreshIntelligence()` begins with `setControlPlane(null)`. This nullifies the UI immediately and forces the entire control plane to reload from scratch after the stream closes.

**Why it exists:** Prevents the user from seeing stale state during refresh. The control plane is loaded fresh from the server after the pipeline completes.

**Complexity introduced:**
- During refresh, the control plane is null. Any component that reads `controlPlane` must handle null. This spreads null-handling throughout the codebase.
- The refresh is not atomic from the user's perspective: old state disappears, then new state appears after a delay.
- If the refresh fails mid-stream, the old state is gone and the new state was never loaded. The user sees an error with no recovery path back to the previous recommendation.
- The workflow state is cleared on `setControlPlane(null)` transition, making it impossible to resume an in-progress workflow if the refresh fails.

**Fundamental or accidental?** Mostly accidental. The null pattern could be replaced with a "shadow refresh" that loads new state before replacing old state.

---

### P5: Generated files depend on other generated files (hidden dependency graph)

**What exists:** The refresh pipeline runs generators sequentially. Some generators read other generated files:
- `context-package.mjs` reads `.ai/strategy.md`, `.ai/backlog.md`, `.ai/architecture.md`
- `health.mjs` reads all `.ai/*.md`
- `next-improvement.mjs` reads `.ai/repository-health.md`, `.ai/strategy.md`

These are not canonical files — they are outputs of earlier generators in the same pipeline.

**Why it exists:** Natural layering. The context package needs strategy and backlog, which are themselves generated.

**Complexity introduced:**
- The pipeline ordering is a dependency graph that is implicit, not declared. Reordering generators could produce stale inputs without any error.
- The "generated files should be regenerated from canonical" invariant is violated: some generated files are generated from other generated files, creating a multi-hop dependency from canonical to final output.
- If any intermediate generator fails, downstream generators silently read stale data from a previous run.

**Fundamental or accidental?** Fundamental to the architecture. The multi-stage pipeline structure is correct, but the dependency graph should be explicit rather than implied by execution order.

---

### P6: Workflow has no rewind, no error recovery, and no ambiguity resolution

**What exists:** `advanceWorkflow()` is a one-way function. Once a step is advanced, there is no `revertWorkflow()`. If a step action fails (e.g., clipboard copy), the step is still advanced (the failure is caught but the workflow continues).

**Why it exists:** Simplicity. The original design assumed steps are advisory and cheap.

**Complexity introduced:**
- A user who accidentally clicks the wrong button advances past a step with no recovery.
- If the user completes a validation experiment but then realizes they pasted the wrong text into ChatGPT, there is no way to redo the step without clearing localStorage.
- The workflow has no way to signal "this step requires user confirmation before advancing."

**Fundamental or accidental?** Accidental. A `previousStepId` field in WorkflowState would enable rewind.

---

### P7: The "loop detected" state has no automated exit

**What exists:** After a validation completion, if the server returns the same recommendation, `sameRecommendationLoop` is set to `true` in diagnostics. No user-visible resolution is presented.

**Why it exists:** This is a newly added detection mechanism. Resolution was not yet implemented.

**Complexity introduced:**
- The user sees the same task again with no explanation (from their perspective). The diagnostic is dev-only.
- No automated resolution exists (e.g., "your validation passed — here is the next task").
- The system cannot distinguish between "validation completed and suppressed but new higher-priority task exists" vs. "suppression failed and the same validation keeps reappearing."

**Fundamental or accidental?** Partially fundamental. The detection is correct, but the lack of resolution path is a gap in the design.

---

### P8: LocalStorage as the sole persistence layer creates a single-device constraint

**What exists:** All user progress state (workflow, completions) is stored in `localStorage`. The server is stateless.

**Why it exists:** Simplicity and local-first philosophy. No user accounts, no database.

**Complexity introduced:**
- Multiple devices cannot share progress.
- Browser incognito mode, privacy settings, or localStorage quota failures silently lose all progress.
- There is no export/import mechanism for workflow state or completion history.
- The 100-record cap on completions is a soft limit with no eviction policy by repository or age.

**Fundamental or accidental?** Mostly intentional (local-first philosophy) but the single-device constraint is a future product ceiling.

---

## 7. Can This Architecture Deliver The Product?

**Short answer: Partially, with one fatal constraint.**

The architecture delivers on several product promises:

- **Deterministic recommendations**: The server pipeline is fully deterministic for a given repository + validationCompletions pair. ✓
- **Local-only operation**: No LLM, no cloud, no authentication. ✓
- **One recommendation at a time**: The control plane exposes exactly one ranked winner. ✓
- **Task-oriented UI**: The recent UX redesign (CurrentTaskCard, stepToUserTask) moves toward exposing only user tasks, not FSM internals. ✓

**The fatal constraint:** The product promise "deterministic repository improvement engine" is violated by **P1** — the server's recommendation depends on client-side localStorage state. This means:

> For the same repository at the same point in time, two different browsers will receive different recommendations.

This is not a bug. It is a structural consequence of the current ownership model. Fixing it requires either:

1. Making the server stateful (persist completion records per repository path), or
2. Removing the suppression mechanism entirely and relying purely on recommendation ranking to avoid infinite loops.

Option (2) would require the recommendation engine to be smart enough to never recommend a completed validation for the same repository context — which means the "already done" signal must come from somewhere besides client-supplied records.

Until P1 is resolved, "deterministic" cannot be truthfully claimed as a product invariant.

**Confidence: 80%** that P1 is fatal. The 20% uncertainty is that the practical impact may be low (single-user, single-browser usage is the primary use case), making the theoretical violation tolerable.

---

**Secondary concern: Section 5 identified a stuck state with no exit.** The `[Loop Detected]` state has no automated resolution. For a product that promises "always tells you exactly one thing to do next," being stuck in a loop is a product failure. This is not a bug — it is a gap in the execution model design.

**Confidence: 95%** that this gap exists.

---

**The architecture can deliver the product with two targeted changes:** move completion state server-side, and define an exit path from the loop state. Everything else is refinement.

---

## 8. Execution Model v2

This section designs the execution model from scratch, ignoring the current implementation.

### 8.1 Core Design Principles

1. **The server owns everything that affects the recommendation.** The client is a view layer.
2. **Completion is a repository-level concept, not a browser-level concept.** A completed validation is a fact about the repository, not about a session.
3. **The recommendation pipeline is the only path to any state change.** There is no parallel update channel.
4. **Every task has exactly one deterministic completion event.** "Done" is unambiguous.
5. **Refresh is atomic.** Old state is never removed until new state is confirmed available.

### 8.2 Entities

```
Repository
  └── path (string, canonical identifier)
  └── snapshot (hash of .ai/ content, computed at read time)

RepositoryIntelligence
  └── owner: Repository
  └── canonical: goals.md (human-editable)
  └── generated: all other .ai/ files
  └── qualityScore, decisionRanking, recommendation

Task
  └── id (stable, deterministic — "ai-handoff-validation")
  └── title (human-readable)
  └── type: Validation | Implementation | ProductDecision
  └── steps: Step[]
  └── contextSnapshotHash (hash of intelligence at task-creation time)
  └── completionCriteria: deterministic rule set

Step
  └── id (stable — "copy-context-package")
  └── userInstruction: string
  └── artifactType: ContextPackage | ValidationPrompt | ImplementationPrompt | CanonicalEdit | None
  └── completionTrigger: UserAction | AutoComplete

CompletionRecord
  └── owner: Repository (not browser)
  └── taskId
  └── contextSnapshotHash
  └── completedAt
  └── stored: .ai/completions.json (on disk, not localStorage)

ActiveProgress
  └── taskId
  └── currentStepIndex
  └── startedAt
  └── stored: .ai/progress.json (on disk, not localStorage)
```

### 8.3 Ownership

```
┌────────────────────────────────────────────────────────────┐
│  .ai/goals.md                     Owner: Human             │
│  .ai/completions.json             Owner: Server (append)   │
│  .ai/progress.json                Owner: Server (update)   │
│  .ai/*.md (generated)             Owner: Server generators │
│  .ai/*.json (quality, ranking)    Owner: Server            │
└────────────────────────────────────────────────────────────┘

Client owns:
  - UI display state (selected tab, loading flags)
  - Nothing that affects the recommendation
```

### 8.4 Recommendation Semantics

```
chooseNextTask(repository):
  1. Read .ai/completions.json
  2. Compute contextSnapshotHash of current .ai/ state
  3. For each candidate issue:
     a. Check completions: was this task completed for this snapshot?
     b. If yes → skip
  4. Return rank-1 candidate
  5. Return null if all candidates completed (repository is up to date)
```

The recommendation is now deterministic for a given repository state, independent of which client or browser initiates the refresh.

### 8.5 Task Step Definitions (server-owned)

The server emits the complete step list for each task. The client renders it:

```
GET /api/repository/control-plane
Response includes:
  recommendation: {
    taskId: 'ai-handoff-validation',
    title: 'Validate AI Understanding',
    type: 'Validation',
    steps: [
      { id: 'copy-context-package', instruction: 'Copy this repository context into ChatGPT.', artifactType: 'ContextPackage' },
      { id: 'copy-validation-prompt', instruction: 'Copy this validation prompt.', artifactType: 'ValidationPrompt' },
      { id: 'open-chatgpt', instruction: 'Open a fresh ChatGPT window and paste both texts.', artifactType: 'None' },
      { id: 'review-response', instruction: 'Review ChatGPT\'s response, then continue.', artifactType: 'None' },
    ],
    completionAction: { type: 'POST', endpoint: '/api/repository/complete-task' }
  }
```

The client is now a dumb renderer. Adding a new task type requires changing only the server.

### 8.6 Completion Semantics

```
POST /api/repository/complete-task
  { repositoryPath, taskId }

Server:
  1. Compute contextSnapshotHash of current .ai/ state
  2. Append to .ai/completions.json:
     { taskId, contextSnapshotHash, completedAt }
  3. Re-run recommendation engine (suppression now applies)
  4. Return: { nextTask } or { upToDate: true }

Client receives the next task immediately.
No separate refresh is required for simple task completion.
Refresh is only needed when repository content has changed.
```

### 8.7 Refresh Semantics

```
POST /api/repository/refresh
  { repositoryPath }   ← no client state needed

Server:
  1. Run generators (updates .ai/*.md)
  2. Compute new contextSnapshotHash
  3. Run recommendation engine (reads .ai/completions.json locally)
  4. Return complete next task

Atomicity: old .ai/ → new .ai/ via write-then-rename at each file.
If generation fails, old files are not corrupted.
```

### 8.8 Progress Semantics

```
POST /api/repository/progress
  { repositoryPath, taskId, currentStepIndex }

Server writes .ai/progress.json (or updates it if taskId matches).
Any client can resume from the correct step.
```

### 8.9 Orchestration

```
┌──────────────────┐     ┌─────────────────────────────────────────┐
│   Client (View)  │     │          Server (Everything Else)        │
│                  │     │                                          │
│  render(task)    │◄────│  GET /control-plane → current task      │
│                  │     │                                          │
│  user completes  │────►│  POST /progress → .ai/progress.json     │
│  a step          │     │                                          │
│                  │     │                                          │
│  user clicks     │────►│  POST /complete-task                    │
│  "done"          │     │   └── writes .ai/completions.json       │
│                  │     │   └── re-runs recommendation engine     │
│                  │◄────│   └── returns next task                 │
│                  │     │                                          │
│  render(nextTask)│     │                                          │
│                  │     │                                          │
│  user makes      │     │                                          │
│  repo changes,   │────►│  POST /refresh                          │
│  clicks refresh  │     │   └── runs all generators               │
│                  │◄────│   └── returns next task                 │
│                  │     │                                          │
└──────────────────┘     └─────────────────────────────────────────┘
```

### 8.10 v2 State Machine

```
[No Repository]
     │ user enters path
     ▼
[Loading Task]
     │ GET /control-plane
     ▼
[Task Ready] ◄────────────────────────────────────┐
     │                                            │
     │ user works through steps                  │
     ▼                                           │
[Step 0] → [Step 1] → ... → [Step N]            │
                                  │              │
                        POST /complete-task      │
                                  │              │
                    ┌─────────────┴────────┐     │
                    │                      │     │
             [Next Task]           [Up To Date]  │
                    │                      │     │
                    └──────────────────────┘─────┘

[Task Ready]
     │ user makes repo changes, clicks Refresh
     ▼
[Refreshing] (shadow: old task still visible)
     │ POST /refresh completes
     ▼
[Task Ready] (new task replaces old)
```

**No stuck states.** Every state has a deterministic exit. Refresh always returns either a new task or "up to date." Completing the last task returns "up to date."

---

## 9. Migration Strategy

The following refactors are ordered by dependency. Each refactor should leave tests passing and the product functional.

### Step 1: Move completion records to disk (prerequisite for everything else)

**What:** Add `POST /api/repository/complete-task` endpoint that writes to `.ai/completions.json`. Client sends completion event to server instead of writing to localStorage.

**Why first:** This unblocks determinism. Once completion state is on disk, the server recommendation is independent of client state.

**How the client changes:** After POST, re-fetch control plane. LocalStorage completion records are still read as fallback during migration.

**Dependency:** None. Can be done with current server structure.

### Step 2: Move progress tracking to disk

**What:** Add `POST /api/repository/progress` that writes `taskId + currentStepIndex` to `.ai/progress.json`. Client sends progress events. On load, client reads `.ai/progress.json` via control plane to restore step position.

**Why:** Enables multi-device and removes localStorage as a required state store.

**Dependency:** Step 1 (completion and progress both live on disk).

### Step 3: Emit step definitions from server

**What:** Control plane includes the full step list for the current task. Client renders the server-provided steps rather than deriving them from `packageType` in `src/workflow.ts`.

**Why:** Eliminates the split ownership of task type → step mapping (P3). Enables the server to change step definitions without a client deploy.

**Dependency:** Step 1 (so the server knows which task is active).

### Step 4: Implement shadow refresh (atomic control plane transition)

**What:** `refreshIntelligence()` loads new control plane into a staging variable before replacing the current one. Only when the new control plane is fully loaded does it replace the old one. The control plane is never null.

**Why:** Eliminates the intermediate null state that breaks UI and makes error recovery impossible (P4).

**Dependency:** None. Can be done independently.

### Step 5: Define the loop-exit path

**What:** When `POST /complete-task` determines the next task is identical to the completed task, the server response includes `{ loopDetected: true, reason: string, nextTask: alternativeTask | null }`. The client shows the user an explanation and, if an alternative task exists, offers it as the next action.

**Why:** Eliminates the stuck state identified in §5.

**Dependency:** Step 1.

### Step 6: Declare the generator dependency graph

**What:** Create a `pipeline.json` that explicitly lists generator inputs, outputs, and dependencies. The server validates ordering against this graph before running.

**Why:** Makes the implicit ordering (P5) explicit and prevents silent failures from reordering.

**Dependency:** None. Can be done alongside any other step.

---

## 10. Could Agent IDE Generate This RFC Automatically?

This is the most important question this RFC asks.

### 10.1 Section-by-Section Derivability

| Section | Derivability | Evidence |
|---|---|---|
| §1 Product Thesis | **Partially derivable** | `.ai/strategy.md` already contains product thesis; could be extracted |
| §2 Current Execution Model | **Requires new intelligence** | No artifact currently describes the execution model |
| §3 Canonical Sources of Truth | **Partially derivable** | `evidence-lineage.json` tracks canonical vs generated; ownership of concepts is not tracked |
| §4 Architectural Invariants | **Requires new intelligence** | Invariants are implicit in test assertions and code patterns |
| §5 State Machine | **Partially derivable** | `src/workflow.ts` encodes the client FSM explicitly; server states are implicit |
| §6 Architectural Problems | **Requires product-owner intent** | Identifying "problems" requires a normative view of what the architecture should be |
| §7 Can This Architecture Deliver | **Requires product-owner intent** | This is a judgment call against stated product goals |
| §8 Execution Model v2 | **Requires product-owner intent** | Design work; not derivable from current state |
| §9 Migration Strategy | **Requires product-owner intent** | Depends on v2 design |
| §10 Self-generation | **Partially derivable** | The analysis can be bootstrapped from existing artifacts |

**Overall:** ~3 of 10 sections are meaningfully derivable today. ~4 require new intelligence artifacts. ~3 require product-owner intent that cannot be derived from repository signals alone.

### 10.2 What Is Currently Missing

The repository lacks several intelligence artifacts that would make architectural analysis deterministic:

**1. Execution Model Trace**
An artifact that describes, in machine-readable form, which module owns which concept, what the data flow is between modules, and what the entry and exit conditions of each state are. This is different from architecture.md (which describes the system design intent) — it describes the *actual* runtime behavior.

**2. Ownership Map**
A structured record of: for each concept (Recommendation, Workflow, Completion, etc.), which module writes it, which modules read it, and across which boundary (network, localStorage, disk). Today this is implicit in the code.

**3. Invariant Registry**
A structured list of what the system guarantees, with a classification of each invariant as explicit (tested) or implicit (assumed). Agent IDE's test suite enforces some invariants, but they are not aggregated into a single artifact.

**4. Inter-module Coupling Map**
A graph of which scripts depend on which other scripts' outputs, with directionality and coupling type (file I/O, HTTP, shared localStorage key, shared type). The pipeline ordering in `server.mjs` implies this graph but does not declare it.

**5. Decision Boundary Registry**
For each important system decision (where does completion state live? who owns context hash?), a record of the decision made, the alternatives considered, and the constraints that drove the choice. This is different from `.ai/decisions.md` (technical tradeoffs) — it is specifically about the execution model's ownership decisions.

### 10.3 Recommended New Intelligence Artifacts

The following additions to Agent IDE's refresh pipeline would make architectural RFCs like this one meaningfully auto-generatable:

**`execution-model.json`** — Machine-readable execution model trace:
```json
{
  "entities": [
    {
      "name": "ValidationCompletionRecord",
      "canonicalOwner": "client",
      "persistedIn": "localStorage",
      "usedBy": ["server:chooseNextImprovement"],
      "invariant": "must be passed to server at refresh time"
    }
  ],
  "boundaries": [
    {
      "type": "HTTP",
      "from": "client",
      "to": "server",
      "endpoint": "/api/repository/refresh",
      "statePassedAcross": ["validationCompletions"]
    }
  ]
}
```

**`ownership-map.json`** — For each concept, its single canonical owner:
```json
{
  "Recommendation": { "owner": "server:next-improvement.mjs", "dependsOn": ["validationCompletions from client"] },
  "WorkflowState": { "owner": "client:localStorage", "derivedFrom": ["server:recommendation"] }
}
```

**`invariant-registry.json`** — Explicit and implicit invariants with test coverage status:
```json
{
  "explicit": [
    { "id": "deterministic-workflow", "description": "No Math.random or Date.now in workflow.ts", "testedIn": "workflow-engine.test.mjs" }
  ],
  "implicit": [
    { "id": "server-recommendation-determinism", "description": "Same repository + validationCompletions always yields same recommendation", "tested": false, "risk": "high" }
  ]
}
```

**`dependency-graph.json`** — Generator input/output graph:
```json
{
  "nodes": [
    { "id": "strategy.mjs", "reads": ["goals.md", "architecture.md"], "writes": ["strategy.md"] },
    { "id": "context-package.mjs", "reads": ["strategy.md", "backlog.md", "architecture.md"], "writes": ["context-package.md"] }
  ]
}
```

**`decision-boundary-registry.json`** — Ownership decisions with rationale:
```json
{
  "decisions": [
    {
      "concept": "CompletionRecords",
      "currentOwner": "client",
      "alternativesConsidered": ["server-persisted", "repository-file"],
      "chosenBecause": "server is stateless by design",
      "architecturalRisk": "breaks determinism across browsers"
    }
  ]
}
```

### 10.4 Roadmap for Self-Generating Architectural RFCs

With the artifacts above, Agent IDE's next major capability would be:

**Phase 1: Instrument the execution model**  
Add generators that scan the codebase and produce `execution-model.json`, `ownership-map.json`, `dependency-graph.json`. These can be generated deterministically by static analysis of `server.mjs`, `App.tsx`, and `workflow.ts`.

**Phase 2: Detect architectural drift**  
On each refresh, compare the current `ownership-map.json` against the previous version. Flag when a concept's owner changes (e.g., completion records move from client to server) or when a new implicit invariant is detected. Add to `intelligence-diff.json`.

**Phase 3: Generate the invariant registry**  
Cross-reference test assertions with the execution model to classify which invariants are tested and which are assumed. Surface untested implicit invariants as high-priority recommendations.

**Phase 4: Generate the RFC skeleton**  
With `execution-model.json`, `ownership-map.json`, `invariant-registry.json`, and `.ai/strategy.md`, Agent IDE can generate §1–§5 of this RFC automatically on every refresh. Sections §6–§9 require product-owner intent and would be seeded by Agent IDE, then completed by the owner.

**The end state:** Every Agent IDE refresh produces, as a side effect, a machine-readable architectural health check that can be diffed over time. When ownership changes or new implicit invariants appear, Agent IDE flags them as a recommendation before they become architectural debt. The RFC becomes a living document, not a one-time audit.

This is the correct next major capability for Agent IDE: **not just "what should I improve next in this repository?" but "is the architecture of this repository still coherent with its product goals?"**

---

## Appendix: Confidence Summary

| Claim | Confidence |
|---|---|
| Product thesis (§1) | 90% |
| Execution model description (§2) | 95% |
| P1 (completion on wrong side of network) is real | 95% |
| P1 is fatal to determinism claim | 80% |
| Loop state has no exit (§5) | 95% |
| P3 split ownership is real | 90% |
| P4 null state race is real | 85% |
| Architecture can deliver product with two fixes (§7) | 75% |
| v2 design is better than current (§8) | 70% |
| ~3 of 10 sections are derivable today (§10) | 80% |
| New artifacts would enable auto-generation (§10) | 65% |

*Low confidence on §8 and the automation claims reflects genuine uncertainty about second-order effects of the v2 design and the difficulty of static analysis of a React + Node codebase. Neither of these is a reason to avoid the design — it is a reason to validate with prototypes.*
