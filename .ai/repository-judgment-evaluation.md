# Repository Judgment Evaluation

Generated: 2026-06-28T00:39:25.555Z

Repository Judgment remains shadow-only. This evaluation compares the production recommendation engine with the shadow Repository Judgment engine without promoting Repository Judgment or changing the Work Queue.

## Recommendation Comparison

### Production recommendation

- Title: Run AI Handoff Validation
- Evidence: .ai/next-improvement-prompt.md (Current Evidence): No serious repository intelligence issue detected.

### Shadow recommendation

- Title: **Add Backlog Quality Filtering**
- Evidence: .ai/backlog.md (Backlog): **Add Backlog Quality Filtering**

## Deterministic Metrics

| Metric | Production | Shadow |
| --- | ---: | ---: |
| actionability | 80 | 86 |
| expectedRepositoryImpact | 11 | 99 |
| evidenceQuality | 64 | 64 |
| determinism | 92 | 92 |
| implementationSize | 60 | 30 |
| repositoryWideLeverage | 52 | 71 |
| userValue | 42 | 86 |
| total | 56 | 79 |

## Overall Winner

Shadow

The winner is selected by comparing weighted deterministic totals. A difference under 3 points is a tie; otherwise the higher total wins. Current shadow delta: 23.

## Repository Judgment Score

Readiness score: 100/100

- +20: 4 consecutive shadow win(s) at 5 points each, capped at 20.
- +15: Shadow recommendation has evidence for every cited claim.
- +15: Shadow determinism score is 92.
- +15: Current deterministic winner is Shadow.
- +10: 4 historical refresh(es) checked for production-quality regression.
- +10: Shadow user value 86 versus production 42.

## Promotion Criteria

- Shadow wins at least 3 consecutive refreshes.
- Readiness score is at least 85/100.
- Shadow has no unsupported evidence.
- Shadow produces deterministic output across repeated refreshes.
- Shadow recommendations successfully resolve after implementation.
- No regression in existing recommendation quality across the latest 10 refreshes.

## Promotion Status

Ready for Promotion
