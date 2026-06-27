# RFC: Repository Judgment Engine v2

## Status

Proposed.

## Product thesis

Agent IDE should not merely identify what is wrong with a repository. It should determine, from repository-local evidence, the single highest-value thing to build next.

The Repository Judgment Engine v2 is a deterministic decision system that converts repository intelligence, product intent, execution constraints, backlog evidence, and generated analysis into exactly one ranked recommendation. It assumes the repository may already be healthy. In that case, the engine must still identify the next best value-creating improvement rather than defaulting to validation, audit, or risk cleanup.

## Non-goals

- This RFC does not implement code.
- This RFC does not redesign the UI.
- This RFC does not change the current recommendation engine directly.
- This RFC does not introduce LLM inference into ranking.
- This RFC does not assume architectural risk is always present.

---

## 1. Problem

The current improvement model is strongest when it can detect repository deficiencies: missing intelligence, validation gaps, architectural risks, determinism issues, and technical debt. Those signals are necessary because an unsafe or under-specified repository cannot reliably receive high-quality implementation work.

However, architectural-risk detection is only one phase of repository improvement.

A repository improvement loop has at least four phases:

1. **Stabilize**: identify missing intelligence, broken validation, architectural hazards, determinism gaps, and other blockers.
2. **Clarify**: align product goals, execution model, backlog, ownership, and success criteria.
3. **Advance**: choose the next capability, workflow, platform, automation, documentation, or developer-experience investment that increases repository value.
4. **Compound**: repeatedly select work that unlocks future work, reduces future effort, and increases the quality of subsequent recommendations.

If the engine treats risk detection as the whole product, then a healthy repository becomes a dead end. A healthy repository with no validation failures and no architectural risks still has product opportunities, workflow bottlenecks, under-documented features, platform gaps, onboarding friction, performance opportunities, duplicated capabilities, and automation candidates.

The product goal therefore requires a broader engine:

> Given everything known about this repository, determine the single highest-value thing to build next.

That requires repository judgment, not only repository auditing.

---

## 2. Repository Judgment

### Definition

**Repository judgment** is the deterministic act of selecting exactly one next improvement that maximizes repository value under current goals, constraints, dependencies, effort, and evidence confidence.

Repository judgment answers:

- What should be built next?
- Why is it more valuable than every other candidate?
- What evidence supports that conclusion?
- What dependencies does it unlock?
- What implementation package should be generated?
- What validation proves the improvement landed?

Repository judgment is not a free-form opinion. It is a reproducible decision produced from structured repository evidence and explicit scoring rules.

### Distinctions

#### Repository intelligence

Repository intelligence is the generated and manually curated understanding of the repository: goals, architecture, backlog, execution model, tests, health, decisions, context packages, evidence lineage, and quality reports.

Repository intelligence answers: **what do we know?**

Repository judgment answers: **given what we know, what should happen next?**

#### Repository validation

Repository validation checks whether known commands, tests, generated artifacts, implementation packages, and handoff assumptions are correct or complete.

Repository validation answers: **does this pass?**

Repository judgment answers: **what is the highest-value next change if everything already passes?**

#### Repository health

Repository health describes safety, completeness, consistency, confidence, and readiness of the repository and its intelligence.

Repository health answers: **is the repository safe to improve?**

Repository judgment answers: **what improvement creates the most value now?**

#### Repository architecture

Repository architecture describes the structure of systems, boundaries, modules, data flow, dependencies, and architectural decisions.

Repository architecture answers: **how is the repository built?**

Repository judgment answers: **which buildable change best advances the repository?**

#### Repository auditing

Repository auditing identifies defects, risks, missing artifacts, contradictions, policy violations, or stale knowledge.

Repository auditing answers: **what is wrong or uncertain?**

Repository judgment answers: **what is next, even when nothing is wrong?**

---

## 3. Categories of Improvements

The engine should eventually recognize the following improvement categories. Categories are not mutually exclusive; one candidate may receive multiple category labels, but ranking should use one primary category for deterministic tie-breaking.

1. **Architectural improvement**: improves boundaries, modularity, ownership, dependency direction, or system shape.
2. **Product capability**: adds or completes user-visible behavior aligned with goals or backlog.
3. **UX improvement**: improves clarity, accessibility, flow, error states, empty states, or user confidence without changing core capability.
4. **Workflow simplification**: reduces steps, decisions, manual work, or operational overhead in user or developer workflows.
5. **Duplicated functionality**: consolidates repeated logic, overlapping flows, redundant artifacts, or competing implementations.
6. **Technical debt**: resolves known debt markers, deprecated patterns, brittle implementation, or complexity not captured as architecture.
7. **Performance**: improves runtime, build time, test time, bundle size, memory, query count, caching, or perceived responsiveness.
8. **Onboarding**: makes the repository easier for new contributors or agents to understand, run, test, and modify.
9. **Missing documentation**: adds or refreshes docs required for usage, contribution, operations, architecture, or product understanding.
10. **Automation opportunity**: turns manual, repeated, or error-prone work into deterministic scripts, checks, generation, or CI tasks.
11. **Developer experience**: improves local setup, commands, errors, diagnostics, code organization, typing, linting, fixtures, or debugging.
12. **Testing**: adds missing coverage for important paths, removes brittle tests, improves fixtures, or connects validation to product intent.
13. **Maintainability**: improves readability, naming, decomposition, configuration, shared utilities, or change isolation.
14. **Platform expansion**: enables a new runtime, integration surface, operating system, package target, browser, API consumer, or deployment path.
15. **Reliability**: improves failure handling, retries, idempotency, recovery, persistence, or consistency.
16. **Security and privacy**: improves secrets handling, dependency exposure, input validation, permissions, data minimization, or local-first guarantees.
17. **Accessibility**: improves keyboard navigation, semantics, contrast, screen-reader support, focus management, or reduced-motion behavior.
18. **Observability and diagnostics**: improves logs, traces, debug artifacts, health reports, explainability, or failure localization.
19. **Data/model quality**: improves schemas, migrations, generated intelligence quality, data validation, fixtures, or deterministic derivations.
20. **Internationalization/localization readiness**: prepares text, formatting, locale-sensitive logic, and layout for broader audiences.
21. **Configuration and extensibility**: improves plugin points, settings, policy files, adapters, or extension boundaries.
22. **Dependency modernization**: updates dependency usage, replaces abandoned packages, removes unused dependencies, or simplifies dependency footprint.
23. **Build and release**: improves packaging, versioning, release notes, reproducible builds, artifact generation, or deployment checks.
24. **Compliance and governance**: improves licenses, notices, policy docs, review requirements, audit trails, or regulated workflow support.
25. **Content quality**: improves product copy, examples, templates, generated prompts, explanatory text, or domain-specific guidance.
26. **Backlog refinement**: clarifies, merges, splits, or reprioritizes repository-local backlog items when backlog quality blocks implementation choice.
27. **Strategic alignment**: updates or reconciles goals, roadmap, success metrics, and product thesis when candidates cannot be compared safely.
28. **Recommendation-system quality**: improves the repository's own ability to produce better next recommendations, when Agent IDE itself is the repository.

---

## 4. Deterministic Signals

The engine must not use LLM inference during scoring or selection. It may consume generated intelligence artifacts, but only as structured evidence with provenance and confidence. If generated intelligence is unstructured prose, a prior deterministic extractor must convert it into auditable fields before ranking.

### Shared signal sources

All categories can draw from these repository-local sources:

- Source code: file paths, imports, exports, symbols, comments, TODOs, type definitions, route maps, command definitions, package metadata.
- Architecture: module graph, dependency graph, ownership boundaries, public APIs, entry points, generated architecture artifacts.
- Strategy: `.ai/goals.md`, strategy artifacts, product thesis, success criteria, non-goals, constraints.
- Execution model: workflow states, commands, scripts, CI configuration, package tasks, generated execution-model artifacts.
- Backlog: manual backlog, issue exports, TODO indexes, roadmap files, unchecked tasks, generated backlog quality reports.
- Tests: test files, coverage metadata if available, snapshot counts, command results, validation artifacts.
- Repository history: commit frequency by area, churn, age of files, recent edits, repeatedly reverted paths, stale modules.
- Generated intelligence: health, quality, evidence lineage, context package, audits, decision logs, recommendation traces.

### Category-specific deterministic evidence

| Category | Deterministic evidence |
| --- | --- |
| Architectural improvement | Cyclic dependencies; boundary violations; modules importing across forbidden layers; high fan-in/fan-out; architecture artifact risks; decision records identifying unresolved structural work; public APIs with multiple competing owners. |
| Product capability | Backlog items tagged feature/capability; TODOs in user-facing modules; route or command stubs; tests marked skipped for missing behavior; goals naming unmet capabilities; README examples not backed by code. |
| UX improvement | User-facing strings with error/fallback/empty-state markers; forms without validation messages; routes/screens without loading or empty states; accessibility lint outputs; TODOs in UI files; product-map flows with excessive steps. |
| Workflow simplification | Workflow graph nodes with many manual transitions; scripts requiring chained commands; README setup steps count; duplicated command documentation; generated execution-model bottlenecks; repeated user decision points. |
| Duplicated functionality | Similar exported function names; repeated file patterns; duplicate route handlers; copy-pasted constants; multiple scripts doing overlapping tasks; dependency graph showing parallel implementations. |
| Technical debt | TODO/FIXME/HACK/XXX markers; deprecated APIs; ignored lint/type errors; large files; complex functions by static metrics; stale compatibility shims; manual debt backlog items. |
| Performance | Bundle-size reports; expensive dependency imports; repeated synchronous file reads in hot paths; test/build duration history; large generated artifacts; unbounded loops over repository files; benchmark artifacts. |
| Onboarding | Missing or stale setup instructions; absent example env files; package scripts not documented; first-run commands failing; lack of contributor guide; context package missing run/test/edit instructions. |
| Missing documentation | Public exports without docs; CLI commands without help text; configuration files without examples; architecture decisions without rationale; README links to missing files; generated doc coverage reports. |
| Automation opportunity | Repeated manual checklist items; commands documented but not scripted; generated artifacts requiring manual refresh; validation steps not wired into package scripts; recurring maintenance commits. |
| Developer experience | Missing `dev`, `test`, `lint`, or `typecheck` scripts; unclear errors; no fixtures; slow feedback loops; fragmented config; duplicated test helpers; generated execution-model friction. |
| Testing | Source modules without adjacent or mapped tests; skipped tests; low coverage metadata; high-risk files with no tests; validation artifacts naming gaps; bug-fix commits without corresponding tests. |
| Maintainability | High churn plus high complexity; large modules; many responsibilities in one file; inconsistent naming; repeated literals; unstable internal APIs; generated maintainability score fields. |
| Platform expansion | Strategy or backlog names a target platform; adapters exist for some platforms but not others; conditional code paths; package exports lacking target entries; tests covering only one runtime. |
| Reliability | Error paths without tests; catch blocks that swallow errors; non-idempotent scripts; persistence writes without recovery; flaky-test records; validation commands with intermittent failures. |
| Security and privacy | Dependency advisories; secrets-like strings; missing `.env.example`; broad permissions; unsafe shell interpolation; telemetry/network calls conflicting with local-first goals; absent input validation. |
| Accessibility | Interactive elements without labels; missing alt text; heading order issues; keyboard traps from static analysis; contrast token gaps; UI tests lacking accessibility assertions. |
| Observability and diagnostics | Errors without actionable messages; missing debug flags; validation failures without artifact paths; no logs around long-running workflows; recommendation traces lacking evidence IDs. |
| Data/model quality | Schema fields unused or unvalidated; migrations without tests; generated JSON lacking schema; inconsistent enum values; stale fixtures; intelligence artifacts missing provenance fields. |
| Internationalization/localization readiness | Hard-coded date/number formats; concatenated UI strings; text embedded in logic; lack of locale utilities; layout assumptions tied to English string length. |
| Configuration and extensibility | Hard-coded paths; repeated config constants; missing plugin/adapter boundaries; feature flags absent for optional behavior; generated architecture noting extension seams. |
| Dependency modernization | Unused dependencies; multiple libraries for same purpose; outdated lockfile metadata; deprecated packages; large transitive dependency additions; package scripts invoking removed tools. |
| Build and release | Missing build command; unreproducible generated files; package metadata gaps; missing release notes; CI not covering packaged artifact; version files inconsistent. |
| Compliance and governance | Missing license; third-party notices absent; contribution policy missing; code owners absent; generated audit trail incomplete; regulated-data terms found without policy. |
| Content quality | Duplicate product copy; placeholder text; examples failing tests; generated prompts missing acceptance criteria; docs contradict strategy; templates lacking repository-specific fields. |
| Backlog refinement | Backlog items with no evidence IDs; duplicate backlog entries; stale completed items; mixed manual/generated sections; overly broad items lacking acceptance criteria. |
| Strategic alignment | Goals missing success criteria; backlog conflicts with non-goals; product thesis absent; multiple competing priorities with equal evidence; stale strategy fields. |
| Recommendation-system quality | Recommendation traces without candidates; scoring fields missing; implementation package lacks validation; generated artifacts inconsistent; ranking selects only risk work despite healthy repository evidence. |

---

## 5. Scoring Model

### Candidate model

Every candidate should be represented as structured data before scoring:

```json
{
  "id": "stable-id",
  "title": "Buildable recommendation title",
  "primaryCategory": "product-capability",
  "secondaryCategories": ["testing", "developer-experience"],
  "evidenceIds": ["evidence:backlog:12", "evidence:test-gap:4"],
  "blockedBy": [],
  "unlocks": ["candidate:platform-adapter"],
  "affectedAreas": ["src/workflow.ts", "scripts/next-improvement.mjs"],
  "estimatedEffort": "M",
  "confidence": 0.82
}
```

### Score dimensions

All dimensions must be deterministic numbers from 0 to 100.

1. **Importance**: how strongly the candidate aligns with repository goals, strategy, backlog priority, user-facing capability, or stated success criteria.
2. **Urgency**: how time-sensitive the candidate is based on stale dependencies, near-term roadmap markers, high-churn areas, repeated failures, or age of unresolved backlog items.
3. **Leverage**: how much future work becomes easier because this candidate improves shared infrastructure, reusable patterns, automation, docs, tests, or execution flow.
4. **Dependency unlocks**: how many and how valuable downstream candidates become unblocked by this work.
5. **Product impact**: how directly the candidate improves user-visible outcomes, core product promise, adoption, retention, reliability, or trust.
6. **Implementation effort**: estimated cost and risk of implementation. Lower effort increases score when value is similar.
7. **Confidence**: how complete, consistent, recent, and provenance-backed the evidence is.

### Normalized effort score

Implementation effort should be converted into a positive score where smaller is better:

| Effort | Meaning | Effort score |
| --- | --- | --- |
| XS | Single narrow edit or artifact update | 100 |
| S | Small scoped change with clear validation | 85 |
| M | Moderate multi-file change | 65 |
| L | Broad change requiring careful sequencing | 40 |
| XL | Large initiative, should be split | 15 |

Candidates estimated as XL should usually be transformed into smaller buildable candidates before final ranking.

### Default weighted score

```text
valueScore =
  importance * 0.22 +
  urgency * 0.10 +
  leverage * 0.18 +
  dependencyUnlocks * 0.14 +
  productImpact * 0.20 +
  effortScore * 0.08 +
  confidence * 0.08
```

Rationale:

- Importance and product impact are weighted highest because the product promise is value creation, not cleanup.
- Leverage and dependency unlocks are heavily weighted because Agent IDE should choose compounding improvements.
- Urgency matters but should not dominate unless the repository has time-sensitive evidence.
- Effort matters as a tie-sensitive constraint, not as the primary reason to choose trivial work.
- Confidence matters enough to penalize speculative candidates but not enough to suppress high-value, well-bounded work.

### Health gate before value scoring

The engine should still respect repository readiness:

1. If critical validation, safety, or intelligence blockers exist, produce a blocker-removal recommendation.
2. If no critical blockers exist, generate value candidates across all categories.
3. If both blocker and value candidates exist, compare only after applying a **readiness multiplier**:
   - Critical blocker: force rank above value work.
   - High blocker: multiply value work by 0.85 unless value work also removes the blocker.
   - Medium/low blocker: allow value work to win.

This keeps the product safe without trapping healthy repositories in audit mode.

### Tie breaking

The engine must always choose exactly one recommendation. Sort by:

1. Higher `valueScore` rounded to two decimals.
2. Higher `confidence`.
3. Higher `dependencyUnlocks`.
4. Higher `productImpact`.
5. Lower implementation effort bucket: XS, S, M, L, XL.
6. Higher evidence count with unique source types.
7. More recent supporting evidence.
8. Primary category order, with product-facing categories before internal categories when all else is equal:
   1. product capability
   2. UX improvement
   3. workflow simplification
   4. automation opportunity
   5. developer experience
   6. testing
   7. documentation/onboarding
   8. maintainability/technical debt
   9. architecture/platform/build/security/compliance
9. Lexicographic `title`.
10. Lexicographic `id`.

The last two rules guarantee determinism even for otherwise identical candidates.

---

## 6. New Intelligence Artifacts

The engine should introduce a small set of generated artifacts. These artifacts are internal infrastructure, not primary UI surfaces.

### `.ai/repository-map.json`

A deterministic inventory of repository structure:

- packages
- entry points
- routes/screens/commands
- public exports
- test files
- scripts
- generated artifacts
- config files
- documentation files

### `.ai/product-map.md` and `.ai/product-map.json`

A product-facing map of capabilities, user workflows, promises, and visible surfaces. The JSON form is used for scoring; the Markdown form is for inspection.

Fields:

- capability ID
- evidence paths
- user-facing surfaces
- current status: implemented, partial, stubbed, documented-only, test-only
- linked goals and backlog items

### `.ai/opportunities.json` and `.ai/opportunities.md`

A deterministic opportunity index grouped by category. It contains raw unranked opportunities, not final recommendations.

Fields:

- opportunity ID
- category
- evidence IDs
- affected areas
- candidate generation rule
- confidence

### `.ai/dependency-graph.json`

A graph of code, artifact, workflow, and candidate dependencies.

Nodes:

- files
- modules
- commands
- tests
- generated artifacts
- backlog items
- candidates

Edges:

- imports
- generates
- validates
- blocks
- unlocks
- documents
- supersedes

### `.ai/improvement-candidates.json`

The normalized candidate list before ranking.

Fields:

- candidate metadata
- categories
- evidence IDs
- score dimensions before weighting
- effort estimate
- blockers
- unlocks
- validation plan

### `.ai/repository-judgment.json`

The final machine-readable judgment.

Fields:

- selected candidate
- full ranking
- score formula
- tie-break trace
- excluded candidates and exclusion reasons
- readiness gate result
- confidence
- generated timestamp policy

### `.ai/repository-judgment.md`

A human-readable explanation of the selected recommendation:

- selected recommendation
- why it is next
- why alternatives lost
- evidence summary
- implementation package summary
- validation plan
- confidence and limitations

### `.ai/implementation-package.json`

A deterministic package for prompt generation:

- selected candidate
- files likely involved
- constraints
- acceptance criteria
- validation commands
- relevant context excerpts by evidence ID
- non-goals

### `.ai/value-model.json`

The configured scoring model:

- dimensions
- weights
- category priors
- effort mapping
- readiness gates
- tie-break rules
- schema version

### `.ai/evidence-index.json`

A normalized index of evidence used by all artifacts:

- evidence ID
- source type
- path
- line or structural locator when available
- extractor rule
- freshness
- confidence

---

## 7. Recommendation Pipeline v2

```text
Repository
  ↓
Repository inventory
  - files
  - packages
  - scripts
  - tests
  - docs
  - history
  ↓
Intelligence
  - goals
  - health
  - architecture
  - strategy
  - backlog
  - decisions
  - evidence lineage
  - quality reports
  ↓
Execution Model
  - runnable commands
  - workflow states
  - validation paths
  - implementation constraints
  - ownership boundaries
  ↓
Repository Judgment
  - readiness gate
  - value model
  - product map
  - dependency graph
  - opportunity extraction
  ↓
Candidate Generation
  - category-specific rules
  - evidence-linked candidates
  - effort estimates
  - unlock relationships
  - validation plans
  ↓
Ranking
  - importance
  - urgency
  - leverage
  - dependency unlocks
  - product impact
  - effort score
  - confidence
  - tie-break trace
  ↓
Implementation Package
  - one selected improvement
  - one build prompt input package
  - constraints
  - non-goals
  - acceptance criteria
  - validation commands
  ↓
Validation
  - command execution
  - artifact checks
  - acceptance evidence
  - regression detection
  ↓
Refresh
  - regenerate inventory
  - regenerate intelligence
  - regenerate opportunities
  - regenerate judgment
  ↓
Next Recommendation
  - exactly one selected candidate
```

### Pipeline rules

1. Every generated candidate must cite deterministic evidence.
2. Every score must be reproducible from artifact fields.
3. Every selected recommendation must have a validation plan.
4. The pipeline must preserve a working recommendation even when optional artifacts are absent.
5. Missing optional artifacts should reduce confidence, not stop selection.
6. Critical safety blockers may override value ranking, but healthy repositories must enter value ranking.
7. The final output is one recommendation, not a dashboard of choices.

---

## 8. Migration Strategy

The migration should replace the current engine only when the new engine can preserve the existing product loop.

### Phase 1: Add artifact schemas without changing selection

- Add schema definitions for evidence index, product map, opportunities, candidates, value model, and repository judgment.
- Generate empty or minimal artifacts from existing intelligence.
- Keep the current recommendation engine as the source of truth.
- Success criterion: current recommendation output is unchanged.

### Phase 2: Build deterministic evidence index

- Normalize evidence IDs across existing intelligence artifacts.
- Add freshness, source type, path, and extractor metadata.
- Preserve manual sections and existing generated artifacts.
- Success criterion: every existing recommendation can point to evidence IDs.

### Phase 3: Generate opportunities in shadow mode

- Add deterministic extractors for a small initial category set:
  - product capability
  - testing
  - documentation/onboarding
  - automation opportunity
  - developer experience
  - technical debt
- Do not use these opportunities for selection yet.
- Success criterion: opportunities are generated and auditable without affecting the product.

### Phase 4: Generate improvement candidates in shadow mode

- Convert opportunities into normalized candidates.
- Add effort estimates, validation plans, and unlock relationships.
- Compare shadow candidates to current recommendations in trace artifacts.
- Success criterion: candidate generation is deterministic and stable across repeated runs.

### Phase 5: Add repository judgment shadow ranking

- Implement value scoring and tie-break traces in generated artifacts.
- Keep current recommendation selected by default.
- Surface differences only in Advanced diagnostics.
- Success criterion: repository judgment can explain why it would select a candidate.

### Phase 6: Hybrid selection with readiness gate

- Use current risk/blocker recommendations for critical readiness issues.
- Use repository judgment for healthy repositories or repositories with only medium/low issues.
- Success criterion: healthy repositories receive value-creating recommendations.

### Phase 7: Repository Judgment Engine becomes source of truth

- Replace current selection with v2 ranking.
- Preserve existing implementation package and validation interfaces.
- Keep compatibility shims for old artifact names.
- Success criterion: product still shows exactly one recommendation and one implementation prompt.

### Phase 8: Expand category coverage

- Add remaining category extractors incrementally.
- Require tests for every extractor and scoring rule.
- Success criterion: new categories improve recommendation quality without destabilizing selection.

---

## 9. Self-Critique

### Assumption: deterministic evidence is enough to identify value

Challenge: Some product value is not visible in the repository. Market pressure, customer feedback, revenue goals, and user pain may live outside source control.

Mitigation: The engine should support manual strategy and backlog artifacts as first-class evidence. If external context is not present in repository-local artifacts, the engine should lower confidence and may recommend strategic alignment rather than inventing product intent.

Confidence: Medium.

### Assumption: exactly one recommendation is always desirable

Challenge: Some repositories may have multiple equally valid next steps, and forcing one can hide tradeoffs.

Mitigation: The product experience should show one recommendation, but `.ai/repository-judgment.json` should retain the full ranking and tie-break trace for auditability.

Confidence: High.

### Assumption: value categories can be extracted without LLM inference

Challenge: Product capability and UX opportunities are harder to detect deterministically than tests, scripts, dependencies, or TODO markers.

Mitigation: Start with evidence-rich categories and require explicit repository-local signals. Generated intelligence can propose structured fields, but scoring only consumes deterministic extracted fields.

Confidence: Medium.

### Assumption: scoring weights can be universal

Challenge: A library, CLI, web app, internal tool, and research repo may value categories differently.

Mitigation: Store weights in `.ai/value-model.json` and allow deterministic repository-type presets derived from package metadata, entry points, and strategy fields.

Confidence: Medium.

### Assumption: effort can be estimated deterministically

Challenge: Effort estimates from file counts, dependency breadth, and test coverage are approximations.

Mitigation: Use coarse buckets only. Penalize XL candidates and split them into smaller implementation packages.

Confidence: Medium.

### Assumption: dependency unlocks can be modeled reliably

Challenge: Candidate dependency graphs may miss conceptual or product dependencies not encoded in code or backlog.

Mitigation: Use only explicit dependencies: imports, generated graph edges, backlog blockers, strategy prerequisites, and tests that name missing behavior.

Confidence: Medium.

### Assumption: repository health should only gate critical blockers

Challenge: Some non-critical health issues may compound into bad implementation work.

Mitigation: Apply readiness multipliers for high and medium blockers instead of hard gates. Let value work win only when evidence is strong.

Confidence: High.

### Assumption: generated intelligence artifacts are trustworthy inputs

Challenge: Generated artifacts may be stale, contradictory, or incomplete.

Mitigation: Every generated artifact used in scoring must carry freshness, schema version, provenance, and quality status. Stale or low-quality artifacts reduce confidence.

Confidence: High.

### Assumption: category breadth will not overwhelm the system

Challenge: Too many categories can create noisy candidates and unstable rankings.

Mitigation: Categories should be implemented incrementally, with extractor-specific tests, minimum evidence thresholds, and exclusion reasons.

Confidence: High.

### What still requires human judgment

The engine can rank repository-local evidence, but humans may still need to decide:

- Whether repository-local goals reflect the real business strategy.
- Whether external users care about a capability not represented in backlog or docs.
- Whether a high-value initiative should be intentionally deferred for staffing, timing, contractual, or market reasons.
- Whether a large recommendation should be split differently than the deterministic dependency graph suggests.
- Whether scoring weights should be adjusted for a specific repository type or organization.
- Whether compliance, security, or legal constraints outside the repository should override the selected recommendation.

### Section confidence summary

| Section | Confidence | Reason |
| --- | --- | --- |
| Problem | High | The limitation of risk-only recommendation is direct and product-critical. |
| Repository Judgment | High | The distinctions are stable and align with the product thesis. |
| Categories of Improvements | Medium | Broad coverage is useful, but category taxonomy will evolve with implementation evidence. |
| Deterministic Signals | Medium | Many signals are reliable; product and UX signals require careful extractor design. |
| Scoring Model | Medium | The dimensions are sound, but weights require calibration against real repositories. |
| New Intelligence Artifacts | High | The artifact architecture cleanly separates evidence, candidates, ranking, and package generation. |
| Recommendation Pipeline v2 | High | The pipeline preserves the existing loop while adding value judgment. |
| Migration Strategy | High | Shadow-mode phases reduce risk and preserve a working product. |
| Self-Critique | High | The main weaknesses are known and can be mitigated through provenance and manual strategy inputs. |

---

## Final recommendation

Build Repository Judgment Engine v2 as a deterministic value-selection layer on top of existing repository intelligence, not as another audit pass. Preserve the current safety checks, but make them gates into value ranking rather than the entire recommendation system. The long-term source of truth should be `.ai/repository-judgment.json`, with `.ai/repository-judgment.md` explaining the single selected next improvement in human terms.
