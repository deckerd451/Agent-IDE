# RFC: Product Judgment Model

## Status

Proposed; documentation and planning only.

## Scope

This RFC critiques the current Repository Judgment algorithm and designs a deterministic Product Judgment Model that can run in shadow mode before replacing the current Repository Judgment engine. It does not modify production recommendation logic, Repository Judgment scoring, Work Queue behavior, implementation package generation, or UI behavior.

## Objective

Repository Judgment currently produces deterministic, evidence-backed implementation recommendations, but the current ranking tends to optimize for repository state rather than expected product improvement. The Product Judgment Model changes the optimization target from:

> What repository artifact deserves work?

To:

> What single implementation would create the greatest improvement to this product?

The model must remain deterministic, repository-local, reproducible, explainable, and auditable. It must not use LLM calls, embeddings, vector search, cloud services, subjective scoring, or manual ranking.

## Current Repository Judgment Algorithm Critique

### What the current algorithm does well

- It uses only repository-local inputs from `.ai/` artifacts and RFC documentation.
- It produces stable candidate IDs, deterministic scores, deterministic sorting, and shadow-only output.
- It separates production recommendations from shadow Repository Judgment output.
- It records evaluation artifacts and promotion readiness without changing the authoritative recommendation.
- It requires evidence text and source files for every generated shadow candidate.

### Where it optimizes repository health instead of product value

1. **Input shape favors repository artifacts.** Candidate generation starts from backlog entries, strategy sections, execution-model bullets, architecture bullets, and decision bullets. These are valid evidence sources, but the extraction process treats any artifact mention as a candidate rather than asking whether implementation would improve the product experience or product strategy.
2. **Category weights encode repository-oriented defaults.** `automation-opportunity`, `workflow-simplification`, `developer-experience`, `testing`, `missing-documentation`, `maintainability`, and `technical-debt` receive high leverage or effort scores even when they do not directly advance the current product bet.
3. **Health boosts reward a healthy repository.** A healthy repository increases scores for most non-testing and non-documentation categories. That makes a candidate stronger because the repository is healthy, not because the candidate creates product value.
4. **Evidence count is treated as value.** Evidence count and source count raise impact, urgency, leverage, and confidence. Multiple references can prove traceability, but they do not necessarily prove user impact, strategic leverage, or product momentum.
5. **Impact is category-derived, not product-derived.** Current `impactScore` starts from static category weights. A product capability usually scores higher than documentation, but the scoring does not deterministically inspect whether the capability supports the Product Thesis, Current Product Bet, Success Definition, North Star Metric, or Current Experiment.
6. **Urgency is evidence-derived, not opportunity-derived.** Current urgency rises with evidence count. It does not distinguish a stale artifact cleanup from a bottleneck that blocks the current experiment.
7. **Leverage is repository-wide, not product-specific.** Current leverage is derived from category defaults and source count. It does not separate product leverage, dependency removal, capability unlocks, or bottleneck reduction.
8. **Effort is reduced by evidence count.** More evidence lowers estimated effort. That is sometimes true for well-specified work, but evidence abundance can also indicate broad, expensive, cross-cutting work.
9. **The production comparison still uses repository-impact language.** Evaluation metrics include expected repository impact, evidence quality, determinism, implementation size, repository-wide leverage, and user value. User value is derived from repository impact, actionability, evidence quality, and repository-wide leverage rather than from product thesis alignment or expected product improvement.
10. **Fallback production behavior is validation-oriented.** When no serious issue is detected, production ranking selects AI handoff validation. That is valuable for confidence, but it is repository-maintenance work, not necessarily the highest product-value implementation.
11. **Candidate taxonomy mixes product, process, and maintenance.** Current categories can identify product capability and UX improvement, but they compete directly against maintenance and workflow candidates using repository-value weights rather than product-value weights.
12. **No explicit opportunity cost.** The current model does not penalize choosing maintenance or research when a similarly confident product capability directly advances the current bet.
13. **No explicit foundation-versus-feature reasoning.** Foundational work can outrank feature work when it unlocks product progress, but the current model does not require proof that foundation work unblocks a product outcome.
14. **No deterministic explanation of why every loser lost.** Current shadow candidates show why they matter, but they do not produce pairwise or rank-relative explanations covering why lower-ranked candidates lost to the selected candidate.

## Deterministic Product-Value Signals Already Available

The current repository already contains deterministic signals that can estimate product value without adding new services or inference:

| Signal | Source | Product-value use |
| --- | --- | --- |
| Product Thesis | `.ai/goals.md`, `.ai/strategy.md` | Detect whether a candidate improves repository understanding as the primary developer interface. |
| Current Product Bet | `.ai/strategy.md`, `.ai/goals.md` | Reward work that makes repository understanding the primary surface. |
| Success Definition | `.ai/strategy.md`, `.ai/goals.md` | Reward work that improves Ready handoff status or canonical intelligence consistency. |
| North Star Metric | `.ai/goals.md`, `.ai/strategy.md` | Reward work that improves repository handoff readiness with high canonical intelligence consistency. |
| Current Experiment | `.ai/strategy.md` | Reward candidates that can validate whether the current focus is reliably delivered. |
| What Not To Build | `.ai/goals.md`, `.ai/strategy.md` | Penalize broad automation before the `.ai/` contract and handoff reliability are mature. |
| Strategy Confidence | `.ai/strategy.md` | Increase confidence when strategy artifacts are complete and high confidence. |
| Known Gaps | `.ai/architecture.md` | Identify capability gaps such as validation generation and packaged CLI. |
| Backlog | `.ai/backlog.md`, README-derived entries | Identify buildable opportunities already documented by the repository. |
| Decisions | `.ai/decisions.md` | Enforce local-first, deterministic, no-LLM, and repository-understanding constraints. |
| Execution Model | `.ai/execution-model.md` | Identify bottlenecks, ownership risks, validation commands, and workflow stages. |
| Repository Health | `.ai/repository-health.md` | Detect whether maintenance is required or whether product acceleration can safely outrank validation. |
| AI Handoff Validation | `.ai/repository-health.md` | Estimate readiness and hidden-information risk for handoff-oriented opportunities. |
| Canonical Completeness | `.ai/repository-health.md` | Reward candidates that close canonical-intelligence gaps. |
| Repository Judgment history | `.ai/repository-judgment-history.json` | Penalize repeatedly losing candidates and measure shadow stability over time. |
| Repository Judgment evaluation | `.ai/repository-judgment-evaluation.md` | Compare production and shadow candidates without changing production behavior. |
| Current ranking | `.ai/decision-ranking.json` | Identify maintenance fallback behavior and compare product-value alternatives. |
| Source structure | `src/`, `scripts/`, `tests/`, `docs/` | Estimate implementation area, cost, testability, and affected user surfaces. |
| Package scripts | `package.json` | Confirm validation, build, and test commands. |

## Product Judgment Model

### Definition

Product Judgment is the deterministic selection of exactly one buildable implementation that maximizes expected product value under repository-local strategy, constraints, evidence, cost, dependencies, and confidence.

### Candidate classes

Every candidate receives one primary class and any number of secondary classes:

- Repository maintenance
- Architectural cleanup
- Product capability
- Product acceleration
- Strategic initiative
- Infrastructure
- Research
- UX improvement
- Quality improvement

### Candidate schema

```json
{
  "id": "stable-product-candidate-id",
  "title": "Buildable implementation title",
  "primaryClass": "product-capability",
  "secondaryClasses": ["quality-improvement"],
  "evidence": [
    {
      "sourceFile": ".ai/strategy.md",
      "sourceSection": "Current Product Bet",
      "claim": "Repository understanding is the primary surface."
    }
  ],
  "deterministicAssumptions": ["No LLM calls are allowed."],
  "inferredAssumptions": ["Improving cross-links helps users traverse repository understanding surfaces."],
  "blockedBy": [],
  "unlocks": ["faster handoff review", "higher canonical consistency"],
  "affectedAreas": ["docs/", "scripts/", "src/"],
  "costBand": "S",
  "score": {}
}
```

### Candidate extraction rules

Candidate extraction remains deterministic and repository-local:

1. Read the configured Product Judgment inputs in sorted order.
2. Extract explicit backlog titles, known gaps, success-definition clauses, current-experiment clauses, decision consequences, execution-model risks, repository-health gaps, current ranking candidates, judgment history candidates, and evaluation findings.
3. Normalize titles by lowercasing, stripping Markdown, replacing non-alphanumeric sequences with hyphens, and hashing the source evidence tuple.
4. Merge candidates with identical normalized implementation intent when they share at least one overlapping source file or equivalent title slug.
5. Attach evidence provenance for every source claim.
6. Classify candidates by deterministic keyword and source rules.
7. Score every candidate with the transparent scoring system below.
8. Sort by `expectedProductValue desc`, then `confidenceOfSuccess desc`, then `implementationCost asc`, then `opportunityCost asc`, then `title asc`, then `id asc`.

## Transparent Scoring System

All dimensions are integers from 0 to 100. Scores are deterministic lookups, counts, and rule outputs. No dimension may be manually overridden.

### Dimension definitions

| Dimension | Meaning | Deterministic calculation |
| --- | --- | --- |
| Product Leverage | Degree to which the implementation changes the product's ability to deliver its thesis. | Base by class plus bonuses for matching Product Thesis, Current Product Bet, North Star Metric, Success Definition, Current Experiment, and Strategic Differentiator. |
| Strategic Alignment | Fit with Product Thesis, Current Product Bet, Success Definition, North Star Metric, Current Experiment, What Not To Build, and decisions. | Count aligned canonical strategy fields and subtract conflicts with non-goals or decisions. |
| User Impact | Degree to which the implementation improves the user's product-facing workflow, understanding, confidence, or outcome. | Bonuses for UI/docs/user-facing surfaces, handoff readiness, fewer interpretation steps, clearer generated artifacts, or direct backlog feature language. |
| Bottleneck Reduction | Removal of current constraints that slow product progress. | Bonuses for execution-model risks, canonical gaps, validation gaps, workflow manual steps, hidden information, contradictions, or high-frequency refresh friction. |
| Capability Unlock | Future product capabilities enabled by the implementation. | Count downstream backlog items, strategy goals, known gaps, or workflow stages unlocked by the candidate. |
| Dependency Removal | Reduction of blockers, ordering constraints, duplicated ownership, or non-reproducible state. | Bonuses for removing ownership risks, generated/manual duplication, broad prerequisites, or localStorage-only workflow state. |
| Foundation vs Feature Fit | Whether the candidate is the right kind of work for current repository maturity. | Foundation work scores high only when it unlocks a product outcome; feature/UX work scores high when health is Ready and no serious risk blocks product work. |
| Product Momentum | Likelihood that the implementation quickly advances the current experiment or next product milestone. | Bonuses for small buildable slices, existing tests, high-readiness repo state, explicit backlog entry, and no blockedBy entries. |
| Implementation Cost | Estimated effort to implement safely. Higher score means lower cost. | Base by affected area count, file count, test impact, new artifact count, and whether work is documentation, script, UI, or architecture-only. |
| Confidence of Success | Confidence that implementation will achieve the predicted product outcome. | Evidence source diversity, source authority, validation coverage, prior history stability, and absence of unsupported assumptions. |
| Opportunity Cost | Penalty for choosing the candidate over better-aligned product opportunities. Higher score means lower opportunity cost. | Maintenance/research/infrastructure lose points when product capability or product acceleration candidates have comparable confidence and lower cost. |

### Weighted formula

`expectedProductValue` is computed as:

```text
expectedProductValue = round(
  productLeverage * 0.18 +
  strategicAlignment * 0.14 +
  userImpact * 0.14 +
  bottleneckReduction * 0.10 +
  capabilityUnlock * 0.12 +
  dependencyRemoval * 0.08 +
  foundationFeatureFit * 0.08 +
  productMomentum * 0.08 +
  implementationCost * 0.04 +
  confidenceOfSuccess * 0.10 +
  opportunityCost * 0.04
)
```

### Guardrails

- If a candidate conflicts with `What Not To Build`, cap `strategicAlignment` at 40 and `expectedProductValue` at 70.
- If a candidate lacks repository-local evidence, cap `confidenceOfSuccess` at 30 and do not select it.
- If repository health reports serious risks, maintenance or quality work may outrank product work only when it directly removes a blocker to the Success Definition or North Star Metric.
- If two candidates are within two points, prefer the candidate with higher `userImpact`; if still tied, prefer higher `strategicAlignment`; if still tied, prefer lower implementation cost.
- Foundation work cannot outrank feature or UX work unless its `capabilityUnlock` or `bottleneckReduction` is at least 20 points higher than the feature or UX candidate.

## How Product Judgment Differs from Repository Judgment

| Area | Current Repository Judgment | Proposed Product Judgment |
| --- | --- | --- |
| Optimization target | Repository value, health, evidence, leverage, actionability | Expected product value from one implementation |
| Primary question | Which repository artifact deserves work? | Which implementation most improves the product? |
| Evidence treatment | More evidence increases score broadly | Evidence increases confidence; value requires product-specific signals |
| Impact | Category-weighted repository impact | Product thesis, current bet, success definition, user impact, unlocks |
| Urgency | Evidence-count-driven | Bottleneck, current experiment, opportunity cost, strategy timing |
| Leverage | Repository-wide leverage | Product leverage and capability unlocks |
| Maintenance | Can win when repo is healthy because validation remains valuable | Wins only when it unlocks product outcomes or removes blockers |
| Explanation | Why candidate matters and shadow/prod comparison | Why rank #1 creates greatest product value and why every competitor lost |
| Shadow mode | Exists for Repository Judgment v2 | Starts shadow-only and records rank deltas against current engine |
| Promotion | Readiness score and consecutive shadow wins | Product-value stability, no behavior changes, explainability completeness, successful post-implementation evaluations |

## Applying the Model to the Current Repository

### Repository-local context used

- Product Thesis: Agent IDE makes repository understanding the primary developer interface for AI-ready developer handoffs.
- Current Product Bet: Make repository understanding the primary surface of Agent IDE.
- North Star Metric: Repository handoff readiness is Ready with high canonical intelligence consistency.
- Success Definition: Control Plane reports readiness as Ready and canonical intelligence consistency has no avoidable contradictions or duplicate generated sections.
- Current Experiment: Determine whether the system reliably delivers the current focus.
- Constraints: Do not build broad automation before the local `.ai/` contract is reliable; preserve local-first deterministic generation and no LLM dependency.
- Current health: Healthy, AI handoff validation score 96/100 Ready, no repository health risks detected, canonical intelligence partial at 83%, Current Product Bet missing from canonical intelligence completeness.
- Current production recommendation: Run AI Handoff Validation with total expected repository improvement +11.
- Backlog opportunities: Add backlog quality filtering, add cross-links between `.ai` documents, expand repository health checks, add richer validation detection, improve Markdown rendering.
- Architecture gaps: No validation generation, no packaged CLI, no agent execution, no LLM integration.
- Execution-model risk: Workflow progression state persisted in browser localStorage and invisible to server/non-reproducible across browsers.

### Top five implementation opportunities

#### 1. Add cross-links between `.ai` documents

Primary class: Product acceleration. Secondary classes: UX improvement, quality improvement.

| Dimension | Score | Explanation |
| --- | ---: | --- |
| Product Leverage | 92 | Directly improves repository understanding as the primary product surface by making generated intelligence traversable. |
| Strategic Alignment | 94 | Aligns with Product Thesis, Current Product Bet, North Star Metric, Success Definition, decisions favoring local deterministic intelligence, and the backlog. |
| User Impact | 88 | Users and agents can move from thesis, strategy, health, decisions, backlog, validation, and recommendations without reconstructing evidence paths manually. |
| Bottleneck Reduction | 82 | Reduces hidden context and handoff interpretation friction, directly supporting readiness and canonical consistency. |
| Capability Unlock | 78 | Unlocks clearer handoff packages, better evidence inspection, easier ranking explanations, and future Product Judgment explainability. |
| Dependency Removal | 62 | Removes dependence on readers manually knowing relationships among `.ai/` artifacts. |
| Foundation vs Feature Fit | 86 | The repository is healthy, so product-surface improvement can safely outrank more validation-only maintenance. |
| Product Momentum | 90 | Small, buildable, repository-local change with clear docs/scripts/test scope and explicit backlog support. |
| Implementation Cost | 84 | Likely a small-to-medium deterministic generator and Markdown output change. |
| Confidence of Success | 88 | Evidence exists in backlog, thesis, strategy, decisions, health, and handoff readiness artifacts. |
| Opportunity Cost | 86 | Low opportunity cost because it accelerates several later product-value opportunities rather than only cleaning a single artifact. |

Expected Product Value: **86**.

Why it ranks first: it most directly improves the product's core surface, repository understanding, while also supporting the North Star Metric and future explainability. It is product-facing without violating the non-goal against broad automation. It beats backlog quality filtering because cross-links improve user navigation and handoff recovery immediately, whereas filtering primarily improves candidate hygiene. It beats richer validation detection and health-check expansion because the repository is currently healthy and Ready, so additional validation depth is less urgent than making the primary product surface more useful. It beats Markdown rendering because rendering improves presentation, but cross-links improve the semantic structure and evidence traversal of the intelligence system.

#### 2. Add backlog quality filtering

Primary class: Quality improvement. Secondary classes: Product acceleration, recommendation-system quality.

| Dimension | Score | Explanation |
| --- | ---: | --- |
| Product Leverage | 84 | Better backlog quality improves the recommendation engine's ability to select product-relevant work. |
| Strategic Alignment | 88 | Aligns with deterministic intelligence, current focus, and the Success Definition's consistency requirement. |
| User Impact | 74 | Users receive less noisy future recommendations, but the immediate product surface changes less than cross-linking. |
| Bottleneck Reduction | 78 | Reduces noisy or duplicated candidate inputs that can distort ranking. |
| Capability Unlock | 82 | Unlocks stronger Product Judgment candidate extraction and better future ranking. |
| Dependency Removal | 68 | Reduces dependence on raw README-derived backlog wording. |
| Foundation vs Feature Fit | 80 | Foundation work is justified because recommendation quality is itself part of this product. |
| Product Momentum | 82 | Clear backlog item with existing tests likely nearby. |
| Implementation Cost | 78 | Requires deterministic filtering rules and test coverage across backlog generation. |
| Confidence of Success | 84 | Backlog artifact and tests already exist. |
| Opportunity Cost | 76 | Some opportunity cost because it improves internal recommendation quality more than the user's visible understanding surface. |

Expected Product Value: **79**.

Why it loses to rank 1: backlog filtering improves future selection quality, but cross-links improve the current primary product surface and handoff traversal immediately. Filtering is more engine-internal and has lower direct user impact.

#### 3. Improve Markdown rendering

Primary class: UX improvement. Secondary classes: Product capability, content quality.

| Dimension | Score | Explanation |
| --- | ---: | --- |
| Product Leverage | 80 | Repository understanding is displayed through Markdown-heavy intelligence artifacts, so rendering quality affects the primary interface. |
| Strategic Alignment | 82 | Supports the product thesis and current product bet but less directly affects canonical consistency. |
| User Impact | 86 | Improves readability and comprehension of repository intelligence in the dashboard. |
| Bottleneck Reduction | 60 | Reduces interpretation friction, but does not remove a structural intelligence or ranking bottleneck. |
| Capability Unlock | 58 | Unlocks richer presentation but not necessarily better decisions. |
| Dependency Removal | 42 | Does not remove major dependencies or blockers. |
| Foundation vs Feature Fit | 76 | Appropriate because repository health is good and UX can improve the primary surface. |
| Product Momentum | 82 | Clear user-visible slice likely constrained to UI components and tests. |
| Implementation Cost | 76 | UI rendering changes are moderate and testable. |
| Confidence of Success | 78 | Backlog evidence exists, but exact rendering requirements need deterministic acceptance criteria. |
| Opportunity Cost | 74 | Lower than cross-links because it improves presentation more than evidence structure. |

Expected Product Value: **72**.

Why it loses to ranks 1 and 2: it improves comprehension, but it does not improve canonical evidence relationships as strongly as cross-links or future recommendation quality as strongly as backlog filtering.

#### 4. Add richer validation detection for additional ecosystems

Primary class: Product capability. Secondary classes: Quality improvement, infrastructure.

| Dimension | Score | Explanation |
| --- | ---: | --- |
| Product Leverage | 76 | Broader ecosystem detection can improve handoff readiness for more repositories. |
| Strategic Alignment | 72 | Supports readiness, but the non-goal warns against broad automation before the local `.ai/` contract is consistently reliable. |
| User Impact | 66 | Useful for users with non-current ecosystems, but this repository already has detected validation commands. |
| Bottleneck Reduction | 64 | Reduces validation blind spots in future repositories, not a current local blocker. |
| Capability Unlock | 74 | Unlocks platform breadth and better future handoffs. |
| Dependency Removal | 56 | Reduces manual validation declaration needs for additional ecosystems. |
| Foundation vs Feature Fit | 62 | Partly foundational, but broad automation is constrained by current product maturity. |
| Product Momentum | 68 | Requires deterministic ecosystem rules and fixtures. |
| Implementation Cost | 60 | Cross-ecosystem support increases test matrix and fixture cost. |
| Confidence of Success | 72 | Backlog evidence exists, but affected ecosystems are not named in current canonical strategy. |
| Opportunity Cost | 58 | Higher opportunity cost than improving the current primary surface. |

Expected Product Value: **67**.

Why it loses to ranks 1-3: it is valuable product capability, but it expands breadth before the current `.ai/` understanding surface is maximally useful. It is also costlier and less directly tied to the current repository's Ready state.

#### 5. Expand repository health checks as more intelligence artifacts are added

Primary class: Repository maintenance. Secondary classes: Quality improvement, infrastructure.

| Dimension | Score | Explanation |
| --- | ---: | --- |
| Product Leverage | 68 | Health checks support trust in repository intelligence. |
| Strategic Alignment | 76 | Aligns with readiness and consistency, but less with direct product-surface improvement. |
| User Impact | 58 | Users benefit indirectly through higher trust and fewer stale artifacts. |
| Bottleneck Reduction | 66 | Could catch future gaps, but current health reports no risks. |
| Capability Unlock | 62 | Enables safer addition of more intelligence artifacts. |
| Dependency Removal | 48 | Does not remove an immediate known product dependency. |
| Foundation vs Feature Fit | 58 | Maintenance work is less favored while the repository is Healthy and Ready unless it removes a current blocker. |
| Product Momentum | 64 | Clear backlog item, but scope grows with artifact count. |
| Implementation Cost | 66 | Moderate deterministic script/test work. |
| Confidence of Success | 78 | Strong existing health artifact and tests. |
| Opportunity Cost | 52 | High opportunity cost because product-surface improvements are available and no health risk is present. |

Expected Product Value: **64**.

Why it loses to ranks 1-4: it supports quality but mostly optimizes repository health. Current repository health is already Healthy, so it should not outrank improvements that directly advance repository understanding as the product interface.

### Candidates considered but not top five

- Run AI Handoff Validation: loses because the repository already reports Ready with 96/100 and no hidden information. It remains a useful maintenance recommendation but has low incremental product value.
- Address workflow localStorage ownership risk: loses because it is an architectural/reproducibility issue with no current evidence that it blocks the product thesis or success definition. It should rise if workflow state becomes part of handoff readiness or cross-browser collaboration.
- Add validation generation: loses because it is listed as a known architecture gap but not an explicit current backlog item or success blocker, and richer validation detection is a more concrete near-term slice.
- Add packaged CLI: loses because it expands distribution before repository understanding is the primary reliable surface.
- Add agent execution or LLM integration: excluded or heavily penalized because current decisions and non-goals emphasize local-first deterministic intelligence and no LLM dependency in core generation.

## Why the Highest-ranked Opportunity Creates the Greatest Product Value

Adding cross-links between `.ai` documents creates the greatest product value because it improves the central product surface rather than a supporting maintenance loop. The Product Thesis and Current Product Bet both say repository understanding should be the primary interface. Cross-links turn isolated intelligence files into a navigable product surface where goals, strategy, health, validation, decisions, backlog, recommendations, and evidence can reinforce each other.

It also supports the North Star Metric because handoff readiness depends on a fresh reader or agent recovering context quickly and consistently. Cross-links make evidence ancestry, canonical ownership, generated confirmations, and recommendation rationale easier to audit. Unlike broad automation, this change stays local, deterministic, reviewable, and aligned with the `.ai/` contract. Unlike validation-only work, it improves the experience of using an already Ready repository. Unlike Markdown rendering, it improves the semantic relationship among artifacts rather than only the visual presentation.

## Required Recommendation Explanation Output

When Product Judgment becomes authoritative, every selected recommendation must include:

- Why this creates the greatest product value.
- Why it outranks every competing candidate.
- Which repository evidence supports the decision.
- Which assumptions are deterministic.
- Which assumptions are inferred from repository evidence.
- Why lower-ranked candidates lost.
- The exact score vector for the winner and each compared candidate.
- The deterministic tie-breakers used.
- The candidate class and whether it is maintenance, cleanup, capability, acceleration, initiative, infrastructure, research, UX, or quality work.

## Migration Plan

### Phase 0: Documentation-only design

- Add this RFC and do not modify production recommendation logic.
- Keep `.ai/decision-ranking.json`, `.ai/next-improvement-prompt.md`, Work Queue behavior, and Repository Judgment scoring unchanged.
- Run the existing test suite to verify no behavior changes.

### Phase 1: Shadow artifact schema

- Add a new Product Judgment artifact such as `.ai/product-judgment.json` and `.ai/product-judgment.md` generated by a new script.
- Do not read Product Judgment artifacts from production recommendation code.
- Include full candidate score vectors, evidence provenance, deterministic assumptions, inferred assumptions, and loser explanations.

### Phase 2: Shadow scoring parity checks

- Generate Product Judgment alongside Repository Judgment.
- Add tests that verify deterministic output, stable ordering, complete evidence references, and no production ranking changes.
- Compare Product Judgment rank #1 against Repository Judgment and production recommendations in an evaluation artifact.

### Phase 3: Evaluation window

- Track at least ten refreshes in Product Judgment history.
- Require no unsupported evidence, stable top candidates, complete loser explanations, and reproducible scores across repeated runs.
- Require successful post-implementation evaluation for at least three implemented Product Judgment recommendations while still manually choosing whether to implement them.

### Phase 4: Control-plane preview

- Display Product Judgment as a shadow recommendation in the Control Plane with explicit non-authoritative labeling.
- Keep production Work Queue and implementation package generation bound to the existing recommendation engine.
- Collect deterministic deltas: selected title, score vector, evidence count, loser explanations, and reason for divergence from production.

### Phase 5: Promotion gate

Product Judgment may replace Repository Judgment only when all gates pass:

- Existing tests pass.
- Product Judgment output is deterministic across repeated runs.
- Production recommendation behavior remains unchanged until the promotion commit.
- Every selected candidate includes complete score and evidence explanations.
- Shadow history shows stable or explainably changing top choices.
- At least three completed recommendations demonstrate expected product-value improvement without reducing repository health or handoff readiness.

### Phase 6: Controlled replacement

- Change production recommendation logic in a dedicated implementation after the shadow gate passes.
- Keep a rollback flag or artifact-level fallback to the current Repository Judgment ranking for one release window.
- Preserve historical Repository Judgment artifacts for auditability.
- Document the first authoritative Product Judgment selection and why it differs from the old engine.

## Non-goals

- No implementation in this RFC.
- No change to current Repository Judgment scoring.
- No change to production recommendation logic.
- No LLM calls, embeddings, vector search, cloud services, subjective scoring, or manual ranking.
- No broad automation beyond deterministic local artifact generation.
