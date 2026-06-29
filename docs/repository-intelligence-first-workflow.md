# Repository Intelligence First Workflow

## Purpose

Agent IDE's primary workflow is a continuous repository-intelligence control loop, not a task queue or documentation browser. At every refresh the product should answer one question:

> Given everything the repository currently knows, what single decision most increases confidence in the current Product Bet?

All other generated artifacts are supporting evidence and belong in the Library unless they are needed to answer that question.

## Repository-first workflow

```text
Repository State
↓
Current Product Thesis
↓
Current Product Bet
↓
Current Experiment
↓
Current Repository Decision
↓
Implementation Guidance
↓
Outcome
↓
Refresh Repository Intelligence
↓
Repeat
```

The Control Plane is the primary surface for this loop. It answers four questions only:

1. **Where are we?** Repository state, current experiment, health, confidence, and evidence readiness.
2. **Why are we here?** Product Thesis, Current Product Bet, strategic context, and alignment evidence.
3. **What decision should we make next?** Exactly one repository decision with evidence, tradeoffs, expected outcome, and confidence.
4. **How do we execute it?** Implementation guidance, primary files, supporting artifacts, validation, expected artifacts, and scope.

Prompt browsing, raw generated markdown, ranking diagnostics, shadow judgments, timelines, and health details remain available in the Library/Advanced areas, but they are not the primary workflow.

## Smallest architectural changes

1. **Rename the primary mental model from task to repository decision.** Keep the existing recommendation selection semantics and package generation, but render the selected recommendation as a decision that advances or invalidates the Product Bet.
2. **Keep current generators unchanged.** Strategy, health, context package, decision ranking, repository judgment, product judgment, recommendation trace, and implementation prompt generation remain deterministic local inputs.
3. **Add a deterministic primary-surface projection.** The UI derives the four Control Plane answers from the existing Control Plane JSON and generated Context Package instead of introducing new services or LLM calls.
4. **Move non-primary surfaces into Library/Advanced.** Existing artifacts stay accessible for inspection and backward compatibility.
5. **Expose missing-intelligence failures before implementation.** If the selected recommendation cannot identify a primary implementation file or concrete guidance, the UI names that missing repository intelligence before asking the developer to browse the tree.

## Migration plan preserving compatibility

- **Phase 1 — Presentation-only migration:** Render the current recommendation as a repository decision while retaining existing `packageType`, workflow state, implementation prompt, outcome saving, and refresh behavior.
- **Phase 2 — Intelligence completeness checks:** Add deterministic checks that classify whether implementation can begin from repository intelligence alone. Start with primary-file and validation-command availability.
- **Phase 3 — Artifact normalization:** Extend generated intelligence with explicit `Primary Files`, `Supporting Files`, `Invalidation Evidence`, and `Expected Artifacts` fields when the current prompt lacks them. Existing prompts continue to work.
- **Phase 4 — Authoritative product judgment only after proof:** Preserve current recommendation selection semantics until Product Judgment demonstrates a stronger deterministic alternative through shadow evaluation.

## Concrete implementation steps

1. Update Control Plane copy and layout so the first screen answers the four repository-intelligence questions.
2. Derive Product Thesis, Product Bet, and Current Experiment from `.ai/strategy.md`/Context Package when present, falling back to Control Plane status only when the generated package is unavailable.
3. Render the selected recommendation as one repository decision, including why it exists, why it is highest leverage, product-bet advancement, supporting evidence, and invalidation evidence.
4. Render implementation readiness before implementation actions: primary files, supporting artifacts, validation path, expected artifacts, and estimated scope.
5. When implementation readiness is incomplete, display the first missing repository intelligence and the smallest deterministic addition needed to avoid file-tree exploration on the next refresh.
6. Keep outcome capture and refresh as the final step so each cycle adds evidence back into repository intelligence.

## Deterministic validation strategy

A refresh proves repository intelligence is replacing the file tree only if these checks can be answered from generated intelligence:

1. **Repository explanation check:** A developer can explain product thesis, architecture, current experiment, and current repository decision from the Control Plane and Context Package only.
2. **Decision identification check:** The selected decision is singular and traceable to repository-local evidence and deterministic ranking.
3. **Implementation-start check:** The decision includes enough primary-file, supporting-file, validation, and expected-artifact guidance to begin without browsing the repository.
4. **Exploration failure check:** If browsing is still required, the UI identifies the missing intelligence field that forced exploration.
5. **Refresh improvement check:** Outcome capture plus refresh updates generated intelligence, verification, quality, or handoff readiness so the next loop starts with more complete repository understanding.

Success is not measured by document count, prompt count, or health score alone. Success is measured by whether repository intelligence lets an unfamiliar developer understand the product, understand the current bet, choose the correct implementation, start safely, and return outcome evidence to the loop without beginning from the file tree.
