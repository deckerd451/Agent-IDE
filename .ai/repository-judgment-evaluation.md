# Repository Judgment Evaluation

Generated: 2026-06-29T00:27:48.352Z

Repository Judgment remains shadow-only. This evaluation compares the production recommendation engine with the shadow Repository Judgment engine without promoting Repository Judgment or changing the Work Queue.

## Recommendation Comparison

### Production recommendation

- Title: Add backlog quality filtering
- Evidence: .ai/next-improvement-prompt.md (Current Evidence): Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering

### Shadow recommendation

- Title: Advance strategy: Control Plane reports repository handoff readiness as Ready.
- Evidence: .ai/strategy.md (Success Definition): Control Plane reports repository handoff readiness as Ready.

## Deterministic Metrics

| Metric | Production | Shadow |
| --- | ---: | ---: |
| actionability | 80 | 72 |
| expectedRepositoryImpact | 8 | 83 |
| evidenceQuality | 64 | 64 |
| determinism | 92 | 92 |
| implementationSize | 48 | 30 |
| repositoryWideLeverage | 53 | 85 |
| userValue | 41 | 78 |
| total | 55 | 74 |

## Overall Winner

Shadow

The winner is selected by comparing weighted deterministic totals. A difference under 3 points is a tie; otherwise the higher total wins. Current shadow delta: 19.

## Repository Judgment Score

Readiness score: 100/100

- +20: 10 consecutive shadow win(s) at 5 points each, capped at 20.
- +15: Shadow recommendation has evidence for every cited claim.
- +15: Shadow determinism score is 92.
- +15: Current deterministic winner is Shadow.
- +10: 10 historical refresh(es) checked for production-quality regression.
- +10: Shadow user value 78 versus production 41.

## Promotion Criteria

- Shadow wins at least 3 consecutive refreshes.
- Readiness score is at least 85/100.
- Shadow has no unsupported evidence.
- Shadow produces deterministic output across repeated refreshes.
- Shadow recommendations successfully resolve after implementation.
- No regression in existing recommendation quality across the latest 10 refreshes.

## Promotion Status

Ready for Promotion
