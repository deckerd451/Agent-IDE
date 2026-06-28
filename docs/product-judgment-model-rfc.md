# RFC: Deterministic Product Judgment Model

## Status

Proposed. This document is an RFC, evaluation, and migration design only. It does **not** modify production recommendation logic, Repository Judgment scoring, the Work Queue, implementation package generation, or current behavior.

## Core question

The Product Judgment Model answers:

> What single implementation would create the greatest improvement to the product?

It intentionally does **not** answer:

> What repository artifact deserves work?

The model remains deterministic, repository-local, reproducible, explainable, and auditable. It adds no LLM calls, embeddings, vector search, cloud services, subjective scoring, manual ranking, or hidden heuristics.

---

## 1. Critique of the current Repository Judgment algorithm

The current production recommendation is deterministic and auditable, but it is optimized for repository readiness rather than product value.

### Current production behavior observed in this repository

The active production ranking selects `Run AI Handoff Validation` because the repository has no serious intelligence issue and the fallback maintenance action is considered actionable. The decision ranking explains that priority is derived from issue base priority, severity boost, and actionability boost; expected improvement is a deterministic lookup by issue type; ties break by expected improvement, actionability, severity, title, and id. The only production candidate is an AI handoff validation experiment with priority `10` and expected improvement `+11`.

### Where the current algorithm optimizes repository state instead of product value

| Current optimization point | Repository-state behavior | Product-value limitation |
| --- | --- | --- |
| Serious-issue detection | Prefers missing intelligence, validation gaps, or health risks when present. | Treats product opportunity as secondary to artifact condition. |
| Healthy-repository fallback | Selects validation when no serious issue is detected. | A healthy repository can still have high-value product work. |
| Priority score | Uses issue priority, severity, and actionability. | Does not measure user impact, strategic leverage, or capability unlock. |
| Expected improvement lookup | Scores repository health, canonical completeness, quality, verification, and handoff readiness. | These are control-plane outcomes, not product outcomes. |
| Candidate generation | Production ranking can collapse to a single maintenance candidate. | Competing product opportunities are not compared against maintenance. |
| Evidence framing | Evidence can be `No serious repository intelligence issue detected.` | Absence of repository risk is not evidence of greatest product value. |
| Tie breaking | Uses deterministic metadata such as title and id after repository scores. | Tie breakers can decide work without product-value rationale. |
| Implementation package typing | Package type follows maintenance/actionability classification. | Package type does not distinguish product capability, acceleration, UX, infrastructure, research, and strategic initiative value. |
| Recommendation explanation | Explains why the issue was selected under repository scoring. | Does not explain why it creates greater product value than backlog or strategy candidates. |
| Shadow evaluation | Shadow Repository Judgment already identifies a higher-value backlog candidate. | It remains non-authoritative and still uses repository-value dimensions rather than a full product-value model. |

---

## 2. Deterministic repository signals that can estimate product value

The Product Judgment Model uses only repository-local evidence. Each signal is deterministic because it is extracted from checked-in text, generated artifacts, command metadata, file paths, scripts, static structure, or prior judgment records.

| Product-value concept | Deterministic repository signals |
| --- | --- |
| Product leverage | Candidate appears in backlog, strategy, current bet, current experiment, context package, decision history, and/or Repository Judgment history; candidate unlocks other candidates; candidate improves the recommendation loop itself. |
| Strategic alignment | Exact or normalized phrase overlap with Product Thesis, Current Product Bet, Success Definition, North Star Metric, Current Experiment, Strategy, Decisions, and Context Package. |
| User impact | Candidate is user-visible, improves primary workflow, improves generated handoff quality, improves recommendation quality, or maps to stated product intent and success criteria. |
| Bottleneck reduction | Execution Model bottlenecks, repeated manual steps, validation friction, refresh-loop blockers, missing cross-links, package reconstruction gaps, and health-check blind spots. |
| Capability unlock | Candidate enables future backlog items, makes a new recommendation class safe, opens platform/ecosystem coverage, or removes a dependency blocker named in artifacts. |
| Implementation cost | Candidate scope inferred from source path count, package/script surface, category cost table, backlog phrasing, affected artifact count, and whether tests/build already exist. |
| Confidence of success | Evidence count, evidence diversity, artifact freshness, strategy confidence, health readiness, validation status, deterministic test availability, and candidate specificity. |
| Dependency blocking | Candidate is prerequisite for other items, required by success criteria, or reduces known blockers before broad automation or cloud features. |
| Product momentum | Candidate advances the current experiment, changes the primary loop, wins shadow evaluation, appears repeatedly in history, or improves follow-on recommendation quality. |
| Expected product value | Deterministic weighted composition of strategic alignment, user impact, product leverage, bottleneck reduction, capability unlock, confidence, momentum, dependency blocking, cost, and opportunity cost. |
| Opportunity cost | Penalty when candidate is maintenance-only, not aligned with current bet, blocked by `What Not To Build`, duplicates lower-value artifact work, or consumes effort without advancing product outcomes. |

---

## 3. Candidate classes

Every candidate receives one primary class and optional secondary classes. Classes are deterministic labels derived from evidence source, keywords, paths, package type, and affected surface.

| Class | Definition | Examples |
| --- | --- | --- |
| Repository maintenance | Keeps intelligence, validation, or generated artifacts healthy without directly advancing a user-visible or strategy-visible product outcome. | AI handoff validation dry run; refresh generated artifacts. |
| Architectural cleanup | Improves boundaries, module shape, dependency direction, or design consistency. | Resolve architectural risk; split coupled modules. |
| Product capability | Adds or completes behavior that directly supports the product thesis or primary user workflow. | Backlog quality filtering; richer validation detection. |
| Product acceleration | Improves the loop that chooses, packages, validates, or compounds future implementation work. | Product Judgment promotion; better decision ranking evidence. |
| Strategic initiative | Directly advances Product Thesis, Current Product Bet, Success Definition, North Star Metric, or Current Experiment. | Repository understanding as primary surface. |
| Infrastructure | Improves local scripts, build, validation, persistence, generated artifacts, or platform foundations. | Expanded repository health checks. |
| Research | Produces deterministic evidence needed before implementation can be ranked safely. | Evaluation protocol for recommendation quality. |
| UX improvement | Improves clarity, rendering, navigation, empty states, explanation, or user confidence. | Markdown rendering; cross-linked intelligence docs. |
| Quality improvement | Improves correctness, testing, reliability, consistency, evidence quality, or auditability. | Validation detection; health checks. |

---

## 4. Deterministic Product Judgment Model

### 4.1 Inputs

The model reads these repository-local sources:

- Product Thesis, Current Product Bet, Success Definition, North Star Metric, Current Experiment, Strategy, Architecture, Decisions, Backlog, Execution Model, Validation, Repository Health, Repository Judgment history, Repository Judgment evaluation, Decision Ranking, and Context Package.
- Source metadata such as scripts, routes, modules, package commands, generated artifact paths, tests, static TODO markers, and markdown references.

### 4.2 Candidate generation

Candidates are generated deterministically from five buckets:

1. **Backlog candidates**: each actionable backlog item becomes one candidate.
2. **Strategy candidates**: each unmet or active strategy/success/current-experiment statement becomes one candidate only if it can be expressed as a buildable implementation.
3. **Decision candidates**: each decision consequence that implies implementation work becomes one candidate.
4. **Execution/validation candidates**: each bottleneck, command gap, validation gap, or manual workflow gap becomes one candidate.
5. **Judgment/history candidates**: prior shadow winners, recurring recommendations, evaluation deltas, and recommendation-quality gaps become candidates.

The generator must not invent candidates from vague prose. If an item cannot be converted to a buildable title with evidence, it is excluded or classified as research.

### 4.3 Evidence normalization

Each evidence item is normalized into:

```json
{
  "source": ".ai/backlog.md",
  "section": "Medium Priority",
  "claim": "Add Backlog Quality Filtering",
  "evidenceType": "backlog-item",
  "freshness": "current",
  "supports": ["product-capability", "product-acceleration"],
  "deterministicAssumption": "Backlog items in Medium Priority are actionable unless marked deferred or blocked."
}
```

### 4.4 Deterministic assumptions

The model explicitly separates assumptions into two types:

- **Deterministic assumptions**: rules defined by the model, such as category cost tables, source weights, exact phrase matching, and penalty thresholds.
- **Inferred-from-evidence assumptions**: conclusions derived from repository artifacts, such as `Backlog Quality Filtering improves recommendation quality because it is a backlog item and shadow judgment ranked it highest.`

No hidden or subjective assumptions are allowed. Every assumption must cite the rule or the source evidence.

---

## 5. Transparent scoring model

All dimensions are integers from `0` to `100`. The final score is deterministic and rounded to two decimals.

### 5.1 Dimension formulas

| Dimension | Weight | Deterministic formula summary |
| --- | ---: | --- |
| Strategic alignment | 0.18 | Max source match from Product Thesis, Current Product Bet, Success Definition, North Star Metric, Current Experiment, Strategy, Decisions, and Context Package, plus exact/current-focus bonuses. |
| User impact | 0.16 | Class score plus user-facing workflow evidence plus primary-loop evidence. Maintenance-only candidates are capped at `45`. |
| Product leverage | 0.14 | Number and quality of downstream candidates unlocked, recommendation-loop improvement, and cross-artifact evidence diversity. |
| Bottleneck reduction | 0.10 | Execution-model, validation, workflow, missing-link, or health-check bottleneck evidence. |
| Capability unlock | 0.10 | Enables new product capability, new candidate class, new ecosystem coverage, or future work explicitly named in backlog/decisions. |
| Confidence of success | 0.10 | Evidence count, evidence diversity, strategy confidence, health readiness, validation availability, and implementation specificity. |
| Product momentum | 0.08 | Advances current experiment, repeats in history, wins shadow evaluation, or improves recommendation iteration. |
| Dependency blocking | 0.06 | Unblocks other work or satisfies explicit prerequisite/non-goal constraints. |
| Implementation cost benefit | 0.05 | `100 - effortCost`; effort is from deterministic class/scope table. |
| Opportunity-cost avoidance | 0.03 | Penalty avoidance for not being maintenance-only, blocked, duplicative, or misaligned. |

Final score:

```text
Expected Product Value =
  0.18 * strategicAlignment +
  0.16 * userImpact +
  0.14 * productLeverage +
  0.10 * bottleneckReduction +
  0.10 * capabilityUnlock +
  0.10 * confidenceOfSuccess +
  0.08 * productMomentum +
  0.06 * dependencyBlocking +
  0.05 * implementationCostBenefit +
  0.03 * opportunityCostAvoidance
```

### 5.2 Deterministic tie breakers

1. Higher Expected Product Value.
2. Higher strategic alignment.
3. Higher user impact.
4. Higher product leverage.
5. Higher confidence of success.
6. Lower implementation cost.
7. Higher evidence diversity.
8. Candidate class order: product capability, product acceleration, strategic initiative, UX improvement, quality improvement, infrastructure, architectural cleanup, research, repository maintenance.
9. Title ascending.
10. Stable id ascending.

### 5.3 Explanation requirements

Every selected recommendation must explain:

- Why it creates the greatest product value.
- Why it outranks every competing candidate.
- Which repository evidence supports the conclusion.
- Which assumptions are deterministic.
- Which assumptions are inferred from repository evidence.
- Why each lower-ranked candidate lost.

---

## 6. Current algorithm vs. proposed Product Judgment Model

| Area | Current production algorithm | Proposed Product Judgment Model |
| --- | --- | --- |
| Primary question | Highest deterministic repository issue. | Greatest deterministic product improvement. |
| Top-level objective | Repository health, completeness, validation, readiness. | Expected product value. |
| Candidate pool | Repository intelligence issues and maintenance fallback. | Backlog, strategy, decisions, execution, validation, health, judgment history, evaluation, context. |
| Healthy repo behavior | Selects validation fallback. | Still ranks product opportunities. |
| User impact | Indirect. | Explicit scored dimension. |
| Strategic alignment | Indirect through generated artifacts. | Explicit scored dimension. |
| Opportunity cost | Not explicit. | Explicit penalty/avoidance score. |
| Explanation | Why issue selected under priority rules. | Why candidate creates the most product value and why every loser lost. |
| Determinism | Deterministic. | Deterministic. |
| Behavior change | Current behavior unchanged until migration. | Shadow-only until promoted. |

---

## 7. Application to this repository: top 10 opportunities

### Evidence base

The current repository evidence says Agent IDE's thesis is repository understanding as the primary developer interface for AI-ready handoffs; the North Star is repository handoff readiness with high canonical intelligence consistency; the current product bet is making repository understanding the primary surface; success requires Control Plane readiness and no avoidable canonical contradictions; the backlog has five medium-priority actionable items; production ranking selects AI handoff validation; shadow judgment ranks `Add Backlog Quality Filtering` first; Repository Judgment Evaluation says shadow beats production by `23` points and is ready for promotion.

### Ranked scoring table

| Rank | Candidate | Class | Strategic | User impact | Leverage | Bottleneck | Unlock | Confidence | Momentum | Blocking | Cost benefit | Opp. cost avoidance | Expected product value |
| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Add Backlog Quality Filtering | Product acceleration | 88 | 84 | 95 | 82 | 90 | 88 | 96 | 76 | 65 | 90 | **86.31** |
| 2 | Promote Product Judgment shadow evaluation into an auditable shadow-to-production gate | Product acceleration | 92 | 78 | 94 | 76 | 86 | 84 | 94 | 82 | 55 | 88 | **84.02** |
| 3 | Add Richer Validation Detection | Quality improvement | 84 | 76 | 82 | 85 | 82 | 84 | 78 | 74 | 62 | 84 | **79.82** |
| 4 | Add Cross-links Between `.ai` Documents | UX improvement | 78 | 72 | 84 | 80 | 76 | 86 | 72 | 68 | 78 | 86 | **77.42** |
| 5 | Expand Repository Health Checks | Infrastructure | 82 | 68 | 82 | 78 | 80 | 82 | 70 | 74 | 60 | 82 | **75.74** |
| 6 | Improve Markdown Rendering | UX improvement | 72 | 76 | 70 | 68 | 64 | 86 | 66 | 58 | 78 | 82 | **71.98** |
| 7 | Make Control Plane readiness the primary product surface | Strategic initiative | 94 | 70 | 72 | 62 | 70 | 74 | 76 | 64 | 45 | 78 | **71.78** |
| 8 | Add deterministic decision-ranking loser explanations | Product acceleration | 80 | 66 | 78 | 72 | 74 | 78 | 74 | 66 | 58 | 84 | **73.00** |
| 9 | Add generated-artifact freshness and provenance cross-checks | Quality improvement | 76 | 58 | 74 | 76 | 72 | 80 | 64 | 70 | 62 | 82 | **70.62** |
| 10 | Run AI Handoff Validation | Repository maintenance | 66 | 42 | 52 | 48 | 42 | 92 | 52 | 44 | 82 | 40 | **56.18** |

After applying the tie breakers, candidate 8 ranks ahead of candidate 9 despite narrower evidence because it has higher user impact, leverage, and momentum. Candidate 7 has very high strategic alignment but loses to candidates 3 through 6 because it is less implementation-specific and has lower cost benefit.

### Why the #1 candidate wins

`Add Backlog Quality Filtering` creates the greatest expected product value because it improves the system's ability to distinguish actionable product opportunities from raw repository artifacts. That directly advances the product thesis of repository understanding as the developer interface, improves the recommendation loop, reduces the opportunity cost of low-value maintenance recommendations, and is already supported by backlog evidence, shadow Repository Judgment evidence, and Repository Judgment Evaluation evidence.

### Why each lower-ranked candidate lost

| Losing rank | Candidate | Why it lost to rank #1 |
| ---: | --- | --- |
| 2 | Promote Product Judgment shadow evaluation into an auditable shadow-to-production gate | Stronger strategic alignment, but lower cost benefit and narrower direct backlog signal than backlog filtering. |
| 3 | Add Richer Validation Detection | Strong quality and bottleneck value, but validation quality is less central to product opportunity selection than filtering the backlog candidate source. |
| 4 | Add Cross-links Between `.ai` Documents | Useful UX and navigation improvement, but it mainly improves comprehension rather than candidate quality. |
| 5 | Expand Repository Health Checks | Important infrastructure, but health checks optimize repository state more than product value. |
| 6 | Improve Markdown Rendering | User-visible, but less tied to current success definition and recommendation quality. |
| 7 | Make Control Plane readiness the primary product surface | Strategically aligned, but less implementation-specific and likely larger than the backlog filtering candidate. |
| 8 | Add deterministic decision-ranking loser explanations | Strong explainability value, but less directly tied to the backlog source of implementation opportunities. |
| 9 | Add generated-artifact freshness and provenance cross-checks | Improves auditability, but mostly protects repository intelligence rather than advancing product selection. |
| 10 | Run AI Handoff Validation | High confidence and low cost, but maintenance-only, low user impact, low unlock value, and selected mainly because production ranking lacks higher-value product candidates. |

---

## 8. Would the current production recommendation change?

Yes, if the Product Judgment Model became authoritative, the recommendation would change from `Run AI Handoff Validation` to `Add Backlog Quality Filtering`.

The production recommendation is valid under current repository-state scoring: the repository is healthy, so validating handoff quality is a deterministic maintenance action. Under product-value scoring, however, the maintenance validation loses because it does not create the greatest product improvement. `Add Backlog Quality Filtering` better improves the product's core loop: identifying high-value, repository-local implementation opportunities and preventing raw artifact work from crowding out product-value work.

---

## 9. Migration constraints

The Product Judgment Model should be introduced only through shadow artifacts, evaluation fixtures, and documentation until promotion criteria are met. The migration must not change existing Work Queue behavior, production recommendation ranking, implementation package generation, UI behavior, or Repository Judgment scoring until an explicit later implementation milestone.
