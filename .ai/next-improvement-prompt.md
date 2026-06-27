# Run AI Handoff Validation

## Validation Instructions
Run this Validation Experiment as a deterministic local check.
Use the cited repository evidence to validate handoff quality without broadening scope.
Do not make product-owner decisions, LLM calls, cloud calls, or telemetry changes.

## Selected Issue
- ID: ai-handoff-validation
- Category: AI handoff validation
- Severity: low
- Actionability: validation-experiment
- Package Type: validation-experiment
- Source: No serious repository intelligence issue detected.
- Title: Run AI Handoff Validation
- Evidence: No serious repository intelligence issue detected.
- Reason: When the control plane is healthy, validate that a fresh assistant can use the handoff package successfully.
- Recommended Action: Run and document a local AI handoff validation dry run.

## Why This Issue Was Selected

Rule: Select the highest deterministic priority issue that is actionable and backed by repository-local evidence.

Candidate Issues
- Run AI Handoff Validation: Priority 10

Selected: Run AI Handoff Validation
Reason: Highest deterministic priority requiring action.

## Decision Ranking

Selected issue: Run AI Handoff Validation
Selection explanation: Run AI Handoff Validation is ranked #1 with priority 10 and total expected improvement +11.

1. Run AI Handoff Validation (selected)
   - ID: ai-handoff-validation
   - Priority: 10
   - Expected Improvement: +11 total (+2 Repository Health, +0 Canonical Completeness, +2 Quality, +4 Verification, +3 Handoff Readiness)
   - Reason: When the control plane is healthy, validate that a fresh assistant can use the handoff package successfully.
   - Evidence: No serious repository intelligence issue detected.
## Current Evidence
- Source risk/recommendation: No serious repository intelligence issue detected.
- Reason: When the control plane is healthy, validate that a fresh assistant can use the handoff package successfully.

## Experiment
No serious repository intelligence issue is detected, so the safest next step is validating that the generated AI handoff package is usable as-is.

## Requirements
- Run a local AI handoff dry run using the generated context package and prompts as static inputs.
- Document whether the package contains enough context for an outside builder to choose safe first edits.
- Do not request code changes unless adding or documenting a validation workflow.

## Acceptance Criteria
- AI handoff validation is documented with deterministic local evidence.
- Any missing context or acceptance-test gaps are recorded in the appropriate manual section of `.ai/goals.md`.
- No unrelated code changes are requested.
- The validation result is deterministic, local-first, and reviewable.

## Testing Commands
- npm test
- npm run build

## Constraints
- local-first
- deterministic
- no LLM calls
- no cloud
- no telemetry
- preserve manual sections
- keep changes small and reviewable

## After Validation
- Refresh Repository Intelligence.
- Record any gaps in the appropriate manual section of `.ai/goals.md`.
- Generate the next correctly typed package.
