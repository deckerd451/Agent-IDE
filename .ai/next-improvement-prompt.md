# Reduce severe backlog noise.

## Motivation
Agent IDE should close the loop from repository intelligence to one safe next builder task. This prompt was generated deterministically from the Control Plane inputs.

## Current Evidence
- Source risk/recommendation: Fill in `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.
- Reason: A noisy backlog hides the highest-leverage next implementation work.

## Problem
The repository needs exactly one next improvement selected from current intelligence signals so implementation work starts from the highest-leverage issue instead of a generic request.

## Goal
Reduce severe backlog noise.

## Requirements
- Address only the issue named in Current Evidence.
- Update the smallest set of source files or `.ai/` intelligence files needed to resolve it.
- Preserve existing manual sections and reviewability.

## Acceptance Criteria
- The selected issue is resolved or explicitly documented with evidence.
- Relevant generated intelligence can be refreshed without introducing contradictions.
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
