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

## Stale prompt diagnosis

When Preview Prompt renders stale text after a browser refresh:

1. Check `GET /api/repository/control-plane` response body in DevTools — inspect `recommendation.implementationPrompt` directly. If it contains the old text, the bug is in the server `readControlPlane` function, not in client state.

2. `readControlPlane` computes the recommendation from `repositoryJudgment.candidates[0]` when `activeRecommendationSource === 'Repository Judgment'`. If `decisionRanking.candidates[0].engineeringTask` is absent or `'preserved'`, `implementationPromptForRecommendation` falls back to `recommendation.prompt` (generated from the repository judgment candidate), which may differ from the `nextImprovement` choice written by `persistControlPlane`. This is the identified root cause of the mismatch.

3. Client localStorage cannot cause the wrong prompt body to appear — only the wrong workflow step or a missing artifact type (`'none'`) that hides the prompt entirely.

## Root cause of the mismatch

`persistControlPlane` (run at the end of `POST /api/repository/refresh`) calls `generateNextImprovement()` which selects a recommendation via `decisionRanking` advancement logic, then regenerates `repository-judgment.json`. The subsequent `GET /api/repository/control-plane` call invokes `readControlPlane`, which reads `repositoryJudgment.candidates[0]` from the just-written file. If `generateRepositoryJudgment` ranks a different candidate at position 0 than what `generateNextImprovement` selected, and if `decisionRanking.candidates[0].engineeringTask` is absent or `'preserved'`, `readControlPlane` returns the old candidate's `implementationPrompt` even though the server logs reported the new selection during refresh.

The client fix is complete: `implementationPrompt()` reads only `data.recommendation.implementationPrompt` and `workflowState` from localStorage cannot override it.
