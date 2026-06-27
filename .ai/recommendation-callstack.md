# Recommendation Callstack

Deterministic execution trace. Commit fded108. Produced by static analysis + direct script execution.

---

## Call Stack: Refresh Repository Intelligence

### 1. HTTP POST /api/repository/refresh

- **File**: scripts/server.mjs
- **Line**: ~575 (handleRefresh)
- **Executed**: YES

### 2. ensureBaselineFiles(resolvedPath)

- **File**: scripts/server.mjs
- **Line**: 593
- **Executed**: YES
- **Result**: exitCode 0

### 3. runStep(generatorSteps[0..N], resolvedPath) — loop over all generator steps

- **File**: scripts/server.mjs
- **Line**: 596–601
- **Executed**: YES (all 12 steps are spawned as child processes)

Steps executed in order:

| # | Step ID             | Script                          | Exit Code | Executed |
|---|---------------------|---------------------------------|-----------|----------|
| 1 | architecture        | scripts/audit.mjs               | 0         | YES      |
| 2 | backlog             | scripts/backlog.mjs             | 0         | YES      |
| 3 | validation          | scripts/validate-intel.mjs      | **1**     | YES — FAILS |
| 4 | decisions           | scripts/decisions.mjs           | 0         | YES      |
| 5 | strategy            | scripts/strategy.mjs            | 0         | YES      |
| 6 | prompts:architect   | scripts/prompt.mjs architect    | 0         | YES      |
| 7 | prompts:builder     | scripts/prompt.mjs builder      | 0         | YES      |
| 8 | prompts:reviewer    | scripts/prompt.mjs reviewer     | 0         | YES      |
| 9 | prompts:debugger    | scripts/prompt.mjs debugger     | 0         | YES      |
| 10| repository-health  | scripts/health.mjs              | 0         | YES      |
| 11| context-package    | scripts/context-package.mjs     | 0         | YES      |
| 12| execution-model    | scripts/execution-model.mjs     | 0         | YES      |
| 13| ai-handoff-validation | scripts/ai-handoff-validation.mjs | 0     | YES      |

### 4. failed = results.filter(r => r.exitCode !== 0)

- **File**: scripts/server.mjs
- **Line**: 603
- **Executed**: YES
- **Result**: failed.length === 1 (validate-intel.mjs exited 1)

### 5. if (failed.length === 0) { persistControlPlane(...) }

- **File**: scripts/server.mjs
- **Line**: 604
- **Executed**: YES — condition is FALSE
- **Result**: THE ENTIRE BLOCK IS SKIPPED

### 6. persistControlPlane(resolvedPath, ...)  ← NEVER CALLED

- **File**: scripts/server.mjs
- **Line**: 606
- **Executed**: **NO — skipped because failed.length === 1**

### 7. generateNextImprovement(repositoryPath, ...)  ← NEVER CALLED

- **File**: scripts/next-improvement.mjs
- **Line**: 443
- **Executed**: **NO — persistControlPlane never called**

### 8. renderRecommendationTrace(...)  ← NEVER CALLED

- **File**: scripts/next-improvement.mjs
- **Line**: ~480 (inside generateNextImprovement)
- **Executed**: **NO**

### 9. writeFile(..., 'recommendation-trace.md')  ← NEVER CALLED

- **File**: scripts/next-improvement.mjs
- **Line**: 570
- **Executed**: **NO — fs.writeFile is never reached**
- **Output path (if called)**: {repositoryPath}/.ai/recommendation-trace.md

---

## Root Cause: validate-intel.mjs exits 1

`scripts/validate-intel.mjs` runs `npm run build` as a validation command (line 155–156: detects `build` in package.json scripts). `npm run build` invokes `tsc -b && vite build`. The TypeScript compiler (`tsc -b`) fails with pre-existing type errors in `src/App.tsx`:

- TS2307: Cannot find module 'react'
- TS2339: Property 'env' does not exist on type 'ImportMeta'
- TS7026: JSX element implicitly has type 'any'

These errors have existed since before commit e3817e0. `npm run build` exits 1.

`validate-intel.mjs` line 285: `overallStatus = 'Failing'`
`validate-intel.mjs` line 319: `process.exitCode = 1`

Server line 603: `failed = [{ id: 'validation', exitCode: 1, ... }]`
Server line 604: `failed.length === 0` → **false** → entire `persistControlPlane` block is skipped.

---

## Skipped Functions (complete list)

All of the following are skipped on every refresh against this repository:

- `persistControlPlane` (server.mjs:606)
- `readControlPlane` (server.mjs:606 via persistControlPlane)
- `generateNextImprovement` (next-improvement.mjs:443)
- `chooseNextImprovementWithCandidates` (next-improvement.mjs:227)
- `analyzeImprovementsWithTrace` (improvement-analyzer.mjs)
- `analyzeImprovements` (improvement-analyzer.mjs)
- `renderRecommendationTrace` (next-improvement.mjs:~480)
- `fs.writeFile` for recommendation-trace.md (next-improvement.mjs:570)
- `fs.writeFile` for next-improvement-prompt.md (next-improvement.mjs:568)
- `fs.writeFile` for decision-ranking.json (next-improvement.mjs:569)
- `persistQuality` (server.mjs:405)
- `verifyIntelligence` (server.mjs:406)
- `persistIntelligenceExplanations` (server.mjs:413)
- `validateAIHandoff` (server.mjs:404)

---

## Final Recommendation Displayed

Because `persistControlPlane` never runs, the server returns the **pre-existing** `next-improvement-prompt.md` and `decision-ranking.json` from the `.ai/` directory (last written in a previous successful refresh or committed directly to the repository). The recommendation displayed in the UI is stale, not freshly generated.

---

## Conclusion

**The trace generator never executes.**

`generateNextImprovement()` is never called during a live refresh because `scripts/validate-intel.mjs` exits with code 1 (caused by pre-existing TypeScript build errors in `src/App.tsx`), which causes the server's `failed.length === 0` guard at line 604 to evaluate false, skipping `persistControlPlane` and everything it calls.

The implementation in commit e3817e0 / 7e86b7b is correct. The wiring is correct. The file is never written because the function that writes it is gated behind a generator-success check that is never true for this repository.

**Commit SHA actually executing**: fded108
