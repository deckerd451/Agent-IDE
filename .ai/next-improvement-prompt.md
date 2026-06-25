# Complete Manual Repository Intent Notes

## Decision Instructions
This is a product-owner decision task, not a Codex implementation task.
Use repository-local evidence to decide or record the missing product, strategy, or manual-intelligence information.
Do not send this package to Codex as implementation work.
Do not edit files automatically; the repository owner should review, accept, or edit the suggested manual update in `.ai/goals.md`.
Repository Owner edits:

.ai/goals.md

Everything else will be regenerated.

## Selected Issue
- ID: missing-manual-goals
- Category: missing manual goals
- Severity: high
- Actionability: manual
- Package Type: product-decision
- Source: Missing manual goals
- Title: Complete Manual Repository Intent Notes
- Evidence: Missing manual goals
- Reason: Manual Goals are the source of truth for product intent and success criteria.
- Recommended Action: Populate `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.

## Why Human Judgment Is Required
The repository is missing populated Manual Goals, so generated intelligence cannot reliably identify current product intent, success criteria, or the safest next implementation target.

Manual Goals are the source of truth for product intent and success criteria. This requires repository-owner judgment about intent, strategy, priorities, or manual notes rather than a deterministic code fix.

## Current Evidence
- Source risk/recommendation: Missing manual goals
- Reason: Manual Goals are the source of truth for product intent and success criteria.

## Decision Needed
Populate `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.

## Suggested Manual Update
Add text like the following under `.ai/goals.md` `## Manual Goals`:

```md
- Product intent: [Repository owner: describe the product purpose this repository should serve.]
- Current focus: [Repository owner: describe the current product priority.]
- Success criteria: [Repository owner: describe how success should be judged.]
```

Do not edit automatically. The repository owner should review, accept, or edit this text before saving it.

## Acceptance Criteria
- Manual Goals are populated with current product intent and success criteria.
- Generated intelligence can be refreshed from `.ai/goals.md` without mixing Manual Goals with backlog, strategy, validation, or handoff issues.
- Manual sections in `.ai/goals.md` remain intact.
- The repository owner reviews the suggested manual text.
- The repository owner accepts, edits, or rejects the suggested text based on actual product intent.
- Any accepted decision is recorded in the correct manual section of `.ai/goals.md`.
- No manual work is labeled as Codex implementation work.

## After Decision
- Refresh Repository Intelligence.
- Compare Repository Health before and after.
- Compare Intelligence Quality before and after.
- Verify whether the selected manual issue was resolved or downgraded.
- Generate the next correctly typed package.

## Constraints
- local-first
- deterministic
- no LLM calls
- no cloud
- no telemetry
- preserve manual sections
- keep changes small and reviewable
