# Repository Improvement Product Redesign

## New product philosophy

Agent IDE should behave like an autonomous senior engineering lead, not a repository intelligence browser. The product exists to answer one question on every visit: **what is the single highest-impact repository improvement, and what should happen next?**

Repository intelligence, deterministic scoring, validation packages, prompts, evidence lineage, and generated artifacts remain essential systems, but they become invisible infrastructure. The repository owner should experience Agent IDE as a focused improvement loop that recommends one valuable action, prepares one implementation prompt, validates the result, refreshes its understanding, and then recommends the next action.

The core product promise is:

```text
Open Agent IDE → see the next best improvement → generate one prompt → implement → validate → refresh → repeat
```

Anything that does not support that loop belongs outside the primary experience.

## New interaction model

The primary interaction model is a single recommendation card plus a single primary action.

1. Agent IDE identifies the repository and its improvement readiness.
2. Agent IDE recommends exactly one highest-value improvement.
3. Agent IDE explains, in plain product language, why that improvement is next.
4. The user clicks **Generate Implementation Prompt**.
5. Agent IDE produces one copyable prompt that already composes any internal architect, builder, reviewer, debugger, context, and validation information needed.
6. The user implements the change in any coding environment.
7. The user returns and clicks **Implementation Complete**.
8. Agent IDE validates, refreshes repository intelligence, and presents the next improvement.

The product should never ask the user to choose prompt types, artifact categories, workflow phases, package files, generated markdown, or diagnostic views during normal usage.

## Complete screen hierarchy

```text
Agent IDE
├─ Home: Next Improvement
├─ Implementation Prompt
├─ Validation & Refresh
├─ Next Improvement Ready
└─ Advanced
   ├─ Repository Intelligence
   ├─ Generated Artifacts
   ├─ Validation Details
   ├─ Evidence Lineage
   ├─ Scoring & Ranking
   ├─ Prompt Internals
   └─ System Settings
```

The hierarchy intentionally has only one primary route for normal users: **Home: Next Improvement**. Every other normal screen exists only to complete the active improvement loop. Diagnostic and generated-artifact surfaces move under **Advanced**.

## Repository improvement state machine

```text
Unknown Repository
  └─ connect repository → Understanding Repository

Understanding Repository
  └─ deterministic refresh complete → Improvement Recommended
  └─ refresh failed → Advanced: Validation Details

Improvement Recommended
  └─ Generate Implementation Prompt → Prompt Generated

Prompt Generated
  └─ copy prompt → Awaiting Implementation
  └─ regenerate prompt → Prompt Generated

Awaiting Implementation
  └─ Implementation Complete → Validating Implementation

Validating Implementation
  └─ validation passed → Refreshing Repository
  └─ validation failed → Fix Needed

Fix Needed
  └─ Generate Fix Prompt → Prompt Generated
  └─ Advanced details requested → Advanced: Validation Details

Refreshing Repository
  └─ refresh complete → Improvement Recommended
  └─ no valuable improvement found → Repository Stable

Repository Stable
  └─ refresh repository → Understanding Repository
```

State names are user-facing only when helpful. The normal user should mostly see simple status language: **Repository improving**, **Prompt ready**, **Validating**, **Refreshing**, and **Next improvement ready**.

## Information architecture

### Primary information

The homepage answers only five questions:

1. **What is my repository?**
   - Repository name: `Nearify`
   - Status: `Repository improving`
   - Confidence: `96%`

2. **What is the single biggest improvement?**
   - Recommendation title: `Between Events recommendation quality`
   - Expected impact: `+24`
   - Estimate: `22 minutes`

3. **Why is this the next improvement?**
   - One paragraph that explains repository value in product terms.
   - No filenames, generated artifact names, package names, prompt types, ranking internals, or implementation metadata.

4. **What should happen now?**
   - Exactly one button: **Generate Implementation Prompt**.

5. **What happens after implementation?**
   - The loop: **Implementation Complete → Validate → Refresh Repository → Next Improvement**.

### Secondary information

Secondary information is available only when it helps the loop:

- Prompt copy confirmation.
- Implementation status.
- Validation pass/fail status.
- Refresh completion status.
- Next improvement availability.

### Advanced information

Advanced information is hidden behind an explicit **Advanced** entry and is not part of the normal repository-owner journey.

## Screens that should exist

### 1. Home: Next Improvement

Purpose: answer the five homepage questions in under five seconds.

Primary content:

- Repository identity.
- Improvement status.
- Confidence.
- One recommendation.
- Impact and estimate.
- One-paragraph rationale.
- One primary button: **Generate Implementation Prompt**.

Rules:

- No tabs.
- No dashboard grids.
- No generated artifact references.
- No prompt type choices.
- No tables.
- No workflow checklist.

### 2. Implementation Prompt

Purpose: give the user exactly one prompt to copy.

Primary content:

- Prompt title matching the recommended improvement.
- One copyable prompt.
- Copy action.
- Short instruction: implement this in your preferred coding environment, then return.
- One post-copy action: **Implementation Complete**.

Rules:

- Do not expose architect, builder, reviewer, or debugger prompt labels.
- If multiple internal prompts are needed, compose them automatically into one implementation prompt.
- Do not expose context packages or source artifacts.

### 3. Validation & Refresh

Purpose: automatically handle the post-implementation loop.

Primary content:

- Current status: validating, refreshing, complete, or needs fix.
- If validation passes: show **Next Improvement Ready**.
- If validation fails: show one plain-language issue summary and one button, **Generate Fix Prompt**.

Rules:

- Do not show raw validation logs by default.
- Do not show progress percentages.
- Do not make the user manually run workflow steps.
- Detailed validation remains available in Advanced.

### 4. Next Improvement Ready

Purpose: transition back to the home loop.

Primary content:

- Confirmation that the repository was refreshed.
- The next single highest-impact improvement.
- One primary button: **Generate Implementation Prompt**.

This may be the same route as Home with refreshed content.

### 5. Repository Stable

Purpose: handle the rare state where no meaningful improvement is currently recommended.

Primary content:

- Repository name.
- Stability status.
- Confidence.
- Plain-language explanation.
- One button: **Refresh Repository**.

Rules:

- Do not fill the empty state with dashboards or artifact lists.
- Offer Advanced only as a secondary escape hatch.

### 6. Advanced

Purpose: support expert inspection without polluting the primary product.

Primary content:

- Repository Intelligence.
- Generated Artifacts.
- Validation Details.
- Evidence Lineage.
- Scoring & Ranking.
- Prompt Internals.
- System Settings.

Rules:

- Advanced is intentionally not the product's default mental model.
- Advanced can expose current deterministic systems without changing the underlying generators.

## Screens that should be removed from normal usage

These should no longer be primary navigation destinations:

- Repository Health.
- Context Package.
- Validation.
- Verification.
- Prompt Center.
- Architecture.
- Backlog.
- Strategy.
- Decisions or Decision Ranking.
- Generated artifact viewers.
- Workflow engine screens.
- Package category screens.
- Delta dashboards.
- Progress dashboards.

They can remain available only through Advanced when useful for debugging, audits, or expert inspection.

## UI elements that should become Advanced

Move the following out of the primary experience:

- Repository Health labels and cards.
- Context Package actions.
- Validation package links.
- Verification status blocks.
- Prompt Center navigation.
- Architect, Builder, Reviewer, and Debugger prompt choices.
- Backlog views.
- Strategy views.
- Architecture views.
- Decision ranking views.
- Generated markdown previews.
- Repository paths.
- Artifact timestamps.
- Evidence-source lists.
- Confidence methodology.
- Scoring formula details.
- Expected-impact calculation internals.
- Delta cards.
- Progress percentages.
- Workflow step checklists.
- Copy Context Package.
- Copy Builder Prompt.
- Open Workspace.
- Refresh Intelligence as a primary call to action.
- Package categories.
- Implementation metadata.

The only primary action before implementation should be **Generate Implementation Prompt**.

## Ideal user journey

1. The owner opens Agent IDE.
2. The home screen says:
   - `Nearify`
   - `Repository improving`
   - `Confidence 96%`
3. The screen shows one recommendation:
   - `Between Events recommendation quality`
   - `Expected impact +24`
   - `Estimated 22 minutes`
4. The owner reads one paragraph explaining why this improvement creates the greatest repository value.
5. The owner clicks **Generate Implementation Prompt**.
6. Agent IDE composes one complete implementation prompt from all internal intelligence.
7. The owner copies the prompt into their preferred coding environment.
8. The owner implements the change.
9. The owner returns and clicks **Implementation Complete**.
10. Agent IDE validates automatically.
11. Agent IDE refreshes repository intelligence automatically.
12. Agent IDE shows the next highest-impact improvement.
13. The loop repeats.

At no point does the owner need to know what a context package, repository health report, validation package, prompt role, workflow engine, or generated artifact is.

## Why this better fulfills the long-term goal

This design turns Agent IDE from a repository-intelligence inspection tool into a repository-improvement operating system. It preserves the deterministic intelligence layer while changing the user's relationship to it: intelligence becomes the engine, not the interface.

The simplified model is better for long-term autonomy because it establishes the exact loop an autonomous system must eventually perform without human orchestration:

```text
Understand → choose highest-value improvement → prepare implementation → validate → refresh → repeat
```

By removing artifact browsing, prompt-type selection, workflow checklists, and diagnostic dashboards from the primary experience, the product trains users to trust Agent IDE as an engineering lead that decides what matters next. That makes the eventual transition from human-in-the-loop implementation to AI-led implementation natural: the product already owns prioritization, prompt composition, validation, and refresh. The human is only temporarily responsible for execution.

The resulting product is mobile-first by structure, not just by layout. A phone-sized screen can show repository identity, one recommendation, one rationale, and one button. That constraint forces the product to make decisions instead of exposing systems. A deterministic repository improvement engine should feel decisive, calm, and action-oriented; this redesign makes that the center of the experience.
