# Improve Validation Confidence

## Implementation Instructions
Implement this Implementation Package exactly as written.
Use the cited repository evidence to identify the root cause before making changes.
Keep the implementation narrowly scoped.
Do not broaden scope beyond the selected issue.
Preserve deterministic, local-first behavior.
Preserve manual intelligence sections.
Avoid unrelated refactoring.
Use only repository-local evidence.
Do not make LLM calls, use cloud services, or add telemetry.
Ensure execution and validation are fully reproducible.

## Selected Issue
- ID: validation
- Category: validation detector gaps
- Severity: medium
- Actionability: code-fixable
- Package Type: implementation
- Source: Medium
- Title: Improve Validation Confidence
- Evidence: Medium
- Reason: Implementation packages should be backed by known local checks that prove changes still work.
- Recommended Action: Update validation intelligence with deterministic local checks and known gaps.

## Why This Issue Was Selected

Rule: Select the highest deterministic priority issue that is actionable and backed by repository-local evidence.

Candidate Issues
- Improve Validation Confidence: Priority 92

Selected: Improve Validation Confidence
Reason: Highest deterministic priority requiring action.

## Decision Ranking

Selected issue: Improve Validation Confidence
Selection explanation: Improve Validation Confidence is ranked #1 with priority 92 and total expected improvement +27.

1. Improve Validation Confidence (selected)
   - ID: validation
   - Priority: 92
   - Expected Improvement: +27 total (+7 Repository Health, +0 Canonical Completeness, +5 Quality, +10 Verification, +5 Handoff Readiness)
   - Reason: Implementation packages should be backed by known local checks that prove changes still work.
   - Evidence: Medium
## Motivation
Agent IDE should close the loop from repository intelligence to one safe next builder task. This Implementation Package was generated deterministically from the selected issue above.

## Current Evidence
- Source risk/recommendation: Medium
- Reason: Implementation packages should be backed by known local checks that prove changes still work.

## Problem
Validation confidence is weak or missing, so generated implementation work lacks clear deterministic checks.

## Goal
Update validation intelligence with deterministic local checks and known gaps.

## Requirements
- Identify the strongest deterministic local validation commands available in this repository.
- Update validation intelligence so confidence reflects real commands and known gaps.
- Keep validation safe for local execution.

## Acceptance Criteria
- Validation intelligence lists deterministic local checks and known gaps.
- Validation confidence is evidence-backed and no longer mismatched with the selected issue.
- Manual sections remain intact.
- The final diff is small, deterministic, and reviewable.

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

## Expected Repository Improvement
- Repository Health should improve.
- Intelligence Quality should improve.
- The selected issue should disappear or downgrade.
- No new contradictions with `.ai/goals.md` should be introduced.

## After Implementation
- Refresh Repository Intelligence.
- Compare Repository Health before and after.
- Compare Intelligence Quality before and after.
- Verify whether the selected issue was resolved.
- Summarize any newly discovered issues.
- Generate the next Implementation Package.
