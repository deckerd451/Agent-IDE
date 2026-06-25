# Complete Manual Repository Intent Notes

## Selected Issue
- ID: missing-manual-goals
- Category: missing manual goals
- Severity: high
- Actionability: manual
- Source: Missing manual goals
- Title: Complete Manual Repository Intent Notes
- Evidence: Missing manual goals
- Reason: Manual Goals are the source of truth for product intent and success criteria.
- Recommended Action: Populate `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.

## Motivation
This is a manual product-owner task, not a Codex implementation task.

Agent IDE should close the loop from repository intelligence to one safe next builder task. This prompt was generated deterministically from the selected issue above.

## Current Evidence
- Source risk/recommendation: Missing manual goals
- Reason: Manual Goals are the source of truth for product intent and success criteria.

## Problem
The repository is missing populated Manual Goals, so generated intelligence cannot reliably identify current product intent, success criteria, or the safest next implementation target.

## Goal
Populate `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.

## Requirements
- Populate `.ai/goals.md` under `## Manual Goals` with current product intent and success criteria.
- Base the entry on repository-local evidence only.
- Do not rewrite unrelated manual or generated intelligence sections.

## Acceptance Criteria
- Manual Goals are populated with current product intent and success criteria.
- Generated intelligence can be refreshed without mixing Manual Goals with backlog, strategy, validation, or handoff issues.
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
