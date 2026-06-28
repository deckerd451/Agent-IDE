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

## Root cause of the mismatch

The UI previously allowed the Do Next card/workflow path to derive from `decisionRanking.candidates[0]` while the preview/copy/open prompt body derived from the decorated Control Plane recommendation. That created two runtime sources of truth: a selected backlog candidate and a separate prompt-bearing recommendation object. When Repository Judgment readiness and generated prompt artifacts were also present, stale or differently decorated fields could surface in Preview Prompt even though the server had selected the backlog recommendation.

The fix is to keep the card, workflow key, Preview Prompt, Copy Prompt, and Open Codex on the decorated `controlPlane.recommendation` object returned by `GET /api/repository/control-plane`.
