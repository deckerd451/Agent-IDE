# No `npm run lint` script was detected; style/static lint coverage

## Validation Instructions
Run this Validation Experiment as a deterministic local check.
Use the cited repository evidence to validate handoff quality without broadening scope.
Do not make product-owner decisions, LLM calls, cloud calls, or telemetry changes.

## Strategic Context

**Product Thesis:** Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs
**Current Product Bet:** making repository understanding the primary surface of Agent IDE
**Repository Alignment:** Weak Alignment — Selected candidate "No `npm run lint` script was detected; style/static lint coverage" does not overlap with the Current Product Bet text.
**Highest-Leverage Milestone:** Can the system reliably deliver the current focus: The repository is currently focused on making repository understanding the primary surface of Agent IDE?

## Strategic Gap

The selected candidate does not directly advance the Current Product Bet.

Alternative direction: No backlog or architecture gap with direct bet overlap found; review .ai/goals.md §Current Focus for strategic candidates.
## Selected Issue
- ID: validation-no-script-was-detected-style-static-lint-coverage
- Category: .ai/validation.md candidate expansion
- Severity: medium
- Actionability: validation-experiment
- Package Type: validation-experiment
- Source: .ai/validation.md Known Gaps
- Title: No `npm run lint` script was detected; style/static lint coverage
- Evidence: No `npm run lint` script was detected; style/static lint coverage is unknown
- Reason: Candidate expansion selected this actionable item from .ai/validation.md (Known Gaps).
- Recommended Action: No `npm run lint` script was detected; style/static lint coverage is unknown

## Why This Issue Was Selected

Rule: Select the highest deterministic priority issue that is actionable and backed by repository-local evidence.

Candidate Issues
- No `npm run lint` script was detected; style/static lint coverage: Priority 42
- No standalone typecheck script was detected; type validation is covered: Priority 42

Selected: No `npm run lint` script was detected; style/static lint coverage
Reason: Highest deterministic priority requiring action.

## Decision Ranking

Selected issue: No `npm run lint` script was detected; style/static lint coverage
Selection explanation: No `npm run lint` script was detected; style/static lint coverage is ranked #1 with priority 42 and total expected improvement +8. Advancement: No implemented + worked outcome matched this recommendation.

1. No `npm run lint` script was detected; style/static lint coverage (selected)
   - ID: validation-no-script-was-detected-style-static-lint-coverage
   - Priority: 42
   - Expected Improvement: +8 total (+3 Repository Health, +0 Canonical Completeness, +2 Quality, +1 Verification, +2 Handoff Readiness)
   - Reason: Candidate expansion selected this actionable item from .ai/validation.md (Known Gaps).
   - Evidence: No `npm run lint` script was detected; style/static lint coverage is unknown
2. No standalone typecheck script was detected; type validation is covered
   - ID: validation-no-standalone-typecheck-script-was-detected-type-validation-is-covered
   - Priority: 42
   - Expected Improvement: +8 total (+3 Repository Health, +0 Canonical Completeness, +2 Quality, +1 Verification, +2 Handoff Readiness)
   - Reason: Candidate expansion selected this actionable item from .ai/validation.md (Known Gaps).
   - Evidence: No standalone typecheck script was detected; type validation is covered only insofar as the build runs it
## Current Evidence
- Source risk/recommendation: No `npm run lint` script was detected; style/static lint coverage is unknown
- Reason: Candidate expansion selected this actionable item from .ai/validation.md (Known Gaps).

## Experiment
Repository intelligence is missing, preventing generated prompts and handoffs from relying on the `.ai/goals.md` source of truth and generated context.

## Requirements
- Restore only the missing intelligence named in Current Evidence.
- Use repository-local evidence and preserve existing manual sections.
- Do not mix this work with backlog, strategy, validation, or handoff issues.

## Acceptance Criteria
- The missing intelligence is restored or explicitly documented.
- Generated intelligence can be refreshed without introducing contradictions.
- Manual sections remain intact.
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
