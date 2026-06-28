# Product Judgment Model Migration Plan

## Status

Proposed. This plan intentionally changes no production behavior.

## Migration principles

- Keep production recommendation logic unchanged until the Product Judgment Model has deterministic fixtures, trace artifacts, and repeated shadow evidence.
- Keep Repository Judgment scoring unchanged during this milestone.
- Keep the Work Queue unchanged.
- Make every new artifact repository-local, reproducible, explainable, and auditable.
- Do not add LLM calls, embeddings, vector search, cloud services, subjective scoring, manual ranking, or hidden heuristics.

---

## Phase 0: Documentation-only RFC

**Goal:** Capture the model, scoring dimensions, candidate classes, migration strategy, and repository-specific evaluation without changing behavior.

**Deliverables:**

- `docs/product-judgment-model-rfc.md`
- `docs/product-judgment-migration-plan.md`

**Exit criteria:**

- `npm test` passes.
- `npm run build` passes.
- Git diff contains documentation only.
- Production recommendation still selects the same issue as before the RFC.

---

## Phase 1: Shadow artifact design

**Goal:** Define a future `.ai/product-judgment.json` and `.ai/product-judgment.md` without wiring them into production.

**Tasks:**

1. Define a stable candidate schema with ids, title, class, evidence ids, deterministic assumptions, inferred assumptions, scores, tie breakers, and loser explanations.
2. Define evidence normalization from Product Thesis, Current Product Bet, Success Definition, North Star Metric, Current Experiment, Strategy, Architecture, Decisions, Backlog, Execution Model, Validation, Repository Health, Repository Judgment history, Repository Judgment evaluation, Decision Ranking, and Context Package.
3. Define deterministic candidate generation buckets for backlog, strategy, decisions, execution/validation, and judgment history.
4. Define stable snapshots so repeated generation is byte-for-byte deterministic.

**Non-goals:**

- Do not modify `next:improvement` output.
- Do not modify `.ai/decision-ranking.json` generation.
- Do not modify Work Queue behavior.

**Exit criteria:**

- Schema is documented.
- Tests can assert deterministic serialization once implementation begins.
- No production artifact reads the new shadow artifact.

---

## Phase 2: Shadow generator implementation in a later milestone

**Goal:** Generate Product Judgment artifacts in shadow mode only.

**Tasks:**

1. Implement deterministic extractors for candidate sources.
2. Implement the transparent scoring model exactly as documented.
3. Emit full score tables, evidence sources, deterministic assumptions, inferred assumptions, and loser explanations.
4. Add tests for deterministic output, tie breaking, score bounds, missing evidence handling, and no production behavior changes.

**Required checks:**

- `npm test`
- `npm run build`
- Byte-for-byte determinism test for repeated generation.
- Fixture test proving production recommendation output is unchanged.

**Exit criteria:**

- Shadow artifacts are generated but never selected by the Work Queue.
- Existing production recommendation fixtures remain unchanged.

---

## Phase 3: Comparative evaluation

**Goal:** Compare production recommendation, current Repository Judgment shadow output, and Product Judgment shadow output over repeated refreshes.

**Evaluation metrics:**

| Metric | Deterministic source |
| --- | --- |
| Strategic alignment delta | Product Judgment scores vs. production selected candidate. |
| User-impact delta | Candidate class and user-impact scoring. |
| Product leverage delta | Unlock counts, evidence diversity, recommendation-loop impact. |
| Maintenance displacement rate | Count of times a maintenance fallback loses to a product-value candidate. |
| Evidence support rate | Percent of claims with repository-local evidence ids. |
| Determinism rate | Repeated generation equality. |
| Behavior preservation | Production artifacts unchanged while shadow mode is enabled. |

**Promotion gates:**

- At least three consecutive shadow wins over production when production selects maintenance fallback.
- No unsupported evidence in Product Judgment artifacts.
- Deterministic output across repeated refreshes.
- Existing production recommendation tests continue to pass.
- Product Judgment explains why every lower-ranked candidate lost.
- Product Judgment top candidate can be converted into one implementation package without manual interpretation.

---

## Phase 4: Read-only UI/advanced surfacing

**Goal:** Show Product Judgment as advanced diagnostic evidence without changing the primary recommendation.

**Tasks:**

1. Add an Advanced-only view or generated markdown link for Product Judgment.
2. Label it as shadow-only.
3. Show comparison against production recommendation.
4. Preserve current primary recommendation and implementation prompt behavior.

**Exit criteria:**

- Users cannot accidentally act on Product Judgment as the production recommendation.
- Screenshots or UI tests verify the shadow label if UI is changed.
- Production recommendation remains unchanged.

---

## Phase 5: Controlled promotion proposal

**Goal:** Prepare, but not automatically execute, a later change that makes Product Judgment authoritative.

**Required proposal contents:**

- Evidence that promotion gates passed.
- Diff of production recommendation before and after promotion.
- Rollback plan.
- Updated tests proving Work Queue semantics are intentionally changed.
- Updated implementation package generation rules.
- Documentation that the selected recommendation now maximizes expected product value.

**Rollback plan:**

1. Keep the previous production decision-ranking generator available behind an explicit compatibility path until after promotion validation.
2. Preserve production fixtures for the old recommendation engine.
3. If Product Judgment emits unsupported evidence, non-deterministic output, or malformed packages, revert selection to the previous production ranking and keep Product Judgment shadow-only.

---

## Initial repository-specific migration assessment

The current production recommendation is `Run AI Handoff Validation`, a maintenance recommendation selected because no serious repository intelligence issue is detected. The proposed Product Judgment Model would instead rank `Add Backlog Quality Filtering` first because it improves the quality of future product recommendations and is supported by backlog evidence, Repository Judgment shadow output, and Repository Judgment Evaluation.

Top 10 proposed shadow opportunities:

1. Add Backlog Quality Filtering.
2. Promote Product Judgment shadow evaluation into an auditable shadow-to-production gate.
3. Add Richer Validation Detection.
4. Add Cross-links Between `.ai` Documents.
5. Expand Repository Health Checks.
6. Improve Markdown Rendering.
7. Make Control Plane readiness the primary product surface.
8. Add deterministic decision-ranking loser explanations.
9. Add generated-artifact freshness and provenance cross-checks.
10. Run AI Handoff Validation.

## Final verification checklist for this documentation milestone

- Documentation only.
- No production recommendation logic changed.
- No Repository Judgment scoring changed.
- No Work Queue behavior changed.
- Tests pass.
- Build passes.
- Changes are committed on the current branch.
- Pull request metadata is recorded after commit.
