# Current Task Runtime Data Path

## Runtime path

1. **Refresh Repository Intelligence** calls `POST /api/repository/refresh`.
2. The refresh response is newline-delimited JSON progress events only. It does not carry the card prompt body.
3. After a successful refresh event, the UI calls `GET /api/repository/control-plane?repositoryPath=<absolute-path>`.
4. That endpoint returns the complete Control Plane JSON. `response.recommendation` is the selected recommendation object used by the Do Next card, Preview Prompt, Copy Prompt, and Open Codex.
5. React stores that exact response object with `setControlPlane(refreshedControlPlane)`.
6. `CurrentTaskCard` renders display text from `data.recommendation`.
7. `TaskArtifact` renders Preview Prompt by calling `implementationPrompt(data, documents)`, which reads `data.recommendation.implementationPrompt` only.
8. `performWorkflowStepAction` handles Copy Prompt and Open Codex by calling the same `implementationPrompt(data, documents)` helper on the same `data` object passed into the workflow action.

## Endpoint that provides CurrentTaskCard data

`CurrentTaskCard` is rendered from the JSON returned by:

```http
GET /api/repository/control-plane?repositoryPath=<absolute-path>
```

The refresh endpoint is only a progress stream:

```http
POST /api/repository/refresh
Content-Type: application/json

{"repositoryPath":"<absolute-path>"}
```

## Exact selected recommendation object in the response

The selected recommendation is the `recommendation` property of the Control Plane response. Runtime consumers must treat this as the single object of record:

```json
{
  "recommendation": {
    "title": "Repository documentation identifies actionable follow-up work from: Add backlog quality",
    "originalRecommendationTitle": "Repository documentation identifies actionable follow-up work from: Add backlog quality",
    "displayTitle": "Repository documentation identifies actionable follow-up work from: Add backlog quality",
    "displaySummary": "Repository documentation identifies actionable follow-up work from: Add backlog quality",
    "explanation": "Source risk/recommendation: <selected source evidence>",
    "whyItMatters": "<selected recommendation reason>",
    "evidenceSource": ".ai/next-improvement-prompt.md",
    "prompt": "<same string as implementationPrompt>",
    "implementationPrompt": "# Repository documentation identifies actionable follow-up work from: Add backlog quality\n\n<implementation package markdown>",
    "id": "<selected recommendation id>",
    "promptHash": "<hash of prompt>",
    "actionability": "code-fixable",
    "packageType": "implementation"
  }
}
```

The complete endpoint response also includes `decisionRanking`, `packages`, `status`, `quality`, verification data, and shadow judgment artifacts, but none of those are allowed to override `recommendation.implementationPrompt` for the card prompt body.

## Field consumers

- **Do Next card title:** `data.recommendation.engineeringTask?.title || data.recommendation.displayTitle || data.recommendation.title`.
- **Do Next card summary:** `data.recommendation.engineeringTask?.rootCause || data.recommendation.engineeringTask?.implementationTarget || data.recommendation.displaySummary || data.recommendation.whyItMatters`.
- **Preview Prompt:** `data.recommendation.implementationPrompt`.
- **Copy Prompt:** `data.recommendation.implementationPrompt` through the shared helper.
- **Open Codex:** `data.recommendation.implementationPrompt` through the shared helper.
- **Workflow key:** `workflowKey(workflowInputForTask(controlPlane.recommendation, null))` — derived from `recommendation.displayTitle` and `recommendation.originalRecommendationTitle`.

## Persisted workflow state isolation

`WorkflowState` is persisted to `localStorage` under `agent-ide:workflow-state`. It stores only workflow step position (`currentStepId`, `completedStepIds`, `status`) and a `workflowKey` string derived from the active recommendation. It never stores `implementationPrompt` content.

After `GET /api/repository/control-plane` resolves, `createWorkflow` is called with the fresh `controlPlane.recommendation` and the persisted `workflowState`. Inside `createWorkflow`, `state.workflowKey === workflowKey(input)` is checked. If the key does not match (i.e., the recommendation changed), the persisted state is ignored and the workflow restarts from step 1.

During refresh (`refreshIntelligence`):
- **Terminal refresh step** (`clearWorkflow: true`): `localStorage` entry is removed and `workflowState` is set to `null`.
- **Non-terminal refresh**: `setWorkflowState((current) => current?.workflowKey === refreshedKey ? current : null)` — preserves workflow position only when the new recommendation has the same key, and nulls it otherwise.

The `implementationPrompt` content is never read from `workflowState`. The persisted state cannot inject a stale prompt body.

## Server-side recommendation persistence (the fix)

`readControlPlane` must not recompute the active recommendation from `repositoryJudgment.candidates[0]` when a persisted decorated recommendation exists.

`persistControlPlane` (called at the end of `POST /api/repository/refresh`) writes the fully-decorated recommendation to `.ai/active-recommendation.json` after `generateNextImprovement()` selects the correct candidate and `data.decisionRanking` is updated. `readControlPlane` reads this file first; if it exists, the persisted recommendation is used as-is and the `repositoryJudgment.candidates[0]` recomputation is skipped. If the file does not exist (first run before any refresh), `readControlPlane` falls back to the prior logic.

This ensures `GET /api/repository/control-plane` returns the same recommendation object that was selected during `POST /api/repository/refresh`, regardless of which candidate ranks first in `repository-judgment.json`.

The outcome-warning check and `id`/`promptHash` fields are still derived at read time so they stay current with `outcomeEvidence` and `decisionRanking`.

## Stale prompt diagnosis

If Preview Prompt renders stale text after a browser refresh:

1. Check `GET /api/repository/control-plane` response body in DevTools — inspect `recommendation.implementationPrompt` directly. If it contains the old text, the bug is on the server.

2. Verify `.ai/active-recommendation.json` exists in the repository's `.ai` directory. If it is missing, `readControlPlane` falls back to `repositoryJudgment.candidates[0]`, which may not match the `generateNextImprovement` selection. Run a full refresh (`POST /api/repository/refresh`) to write the file.

3. Client `localStorage` cannot cause the wrong prompt body — only the wrong workflow step or a missing `artifactType: 'none'` that hides the preview entirely.

## Root cause of the original mismatch (fixed)

`persistControlPlane` called `generateNextImprovement()` which selected "Add backlog quality" via `decisionRanking`, but `readControlPlane` ignored that result and recomputed from `repositoryJudgment.candidates[0]` which still ranked "Advance strategy: Control Plane reports repository handoff readiness as Ready." first. Because `decisionRanking.candidates[0].engineeringTask` was absent, `implementationPromptForRecommendation` returned the raw Repository Judgment prompt containing `## Goal\nAdvance strategy: …` instead of the actionable candidate title.

The fix persists the `generateNextImprovement` selection to `.ai/active-recommendation.json` so `readControlPlane` can return it unchanged.
