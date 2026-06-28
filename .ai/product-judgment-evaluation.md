# Product Judgment Evaluation — Shadow Mode

> **Shadow Mode**: Does not affect active Work Queue recommendation.

Generated: 1970-01-01T00:00:00.000Z

## Scoring Methodology

Each candidate is scored on five dimensions (0–100 each):

| Dimension | Weight | Description |
|---|---|---|
| Product Value | 30% | Direct user-visible improvement |
| Strategic Alignment | 25% | Alignment with .ai/goals.md product thesis |
| User Impact | 20% | Number and depth of users affected |
| Leverage | 15% | Unlocks future improvements |
| Implementation Cost | 10% | Inverse of implementation effort |

Composite = 0.30×PV + 0.25×SA + 0.20×UI + 0.15×LV + 0.10×IC

## Inputs

- .ai/goals.md: Present
- .ai/strategy.md: Present
- .ai/backlog.md: Present
- .ai/architecture.md: Present
- .ai/context-package.md: Present
- .ai/decisions.md: Present
- .ai/execution-model.md: Present
- .ai/repository-health.md: Present
- .ai/decision-ranking.json: Present
- docs/repository-improvement-product-redesign.md: Present

## Product Signals Detected

- currentFocus: Detected
- productBet: Detected
- currentExperiment: Detected
- productThesis: Detected
- northStarMetric: Detected
- successDefinition: Detected
- backlogItems: Detected
- architecture: Detected

## Candidate Evaluations

### 1. Implement Focused Improvement Loop UX

- **ID**: pj-improvement-loop
- **Category**: product-experience
- **Composite Score**: 88/100
- **Product Value**: 95/100
- **Strategic Alignment**: 92/100
- **User Impact**: 90/100
- **Leverage**: 88/100
- **Implementation Cost**: 55/100
- **Confidence**: High
- **Evidence**: docs/repository-improvement-product-redesign.md — explicit product vision: "Open Agent IDE → see the next best improvement → generate one prompt → implement → validate → refresh → repeat"
- **Source Files**: src/App.tsx, src/workflow.ts, scripts/next-improvement.mjs
- **Why It Matters**: Transforms Agent IDE from a repository-intelligence browser into a focused improvement operating system. Every user visit answers one question: what is the single highest-impact improvement and what happens next?
- **Why It Outranks Lower Candidates**: Addresses the primary user journey end-to-end. All other product opportunities are components or downstream effects of this loop.

### 2. Auto-compose Single Implementation Prompt from All Intelligence

- **ID**: pj-auto-compose-prompt
- **Category**: product-experience
- **Composite Score**: 83/100
- **Product Value**: 85/100
- **Strategic Alignment**: 88/100
- **User Impact**: 82/100
- **Leverage**: 85/100
- **Implementation Cost**: 65/100
- **Confidence**: High
- **Evidence**: docs/repository-improvement-product-redesign.md — "Agent IDE composes one complete implementation prompt from all internal intelligence."
- **Source Files**: scripts/next-improvement.mjs, scripts/context-package.mjs, src/App.tsx
- **Why It Matters**: Users never need to know what a context package, builder prompt, or architect prompt is. One complete prompt encapsulates all intelligence needed to execute the improvement.
- **Why It Outranks Lower Candidates**: Directly reduces the cognitive burden of the improvement loop. Lower-ranked candidates improve subsystems rather than the central user interaction.

### 3. Validate Product Bet: The repository is currently focused on making repositor

- **ID**: pj-bet-the-repository-is-currently-focused-on-makin
- **Category**: product-validation
- **Composite Score**: 81/100
- **Product Value**: 82/100
- **Strategic Alignment**: 92/100
- **User Impact**: 68/100
- **Leverage**: 85/100
- **Implementation Cost**: 72/100
- **Confidence**: High
- **Evidence**: .ai/strategy.md — Current Product Bet: "The repository is currently focused on making repository understanding the pr..."
- **Source Files**: .ai/strategy.md, .ai/goals.md
- **Why It Matters**: The active product bet "The repository is currently focused on making repository understanding the pr..." needs validation evidence. A focused experiment or instrumentation pass confirms or refutes the bet before further investment.
- **Why It Outranks Lower Candidates**: Validating the active product bet has higher leverage than any individual feature — it gates the entire product direction.

### 4. Instrument and Validate Current Focus: The repository is currently focused on making repository understanding the pr...

- **ID**: pj-focus-the-repository-is-currently-focused-on-makin
- **Category**: product-focus
- **Composite Score**: 80/100
- **Product Value**: 78/100
- **Strategic Alignment**: 90/100
- **User Impact**: 72/100
- **Leverage**: 80/100
- **Implementation Cost**: 78/100
- **Confidence**: High
- **Evidence**: .ai/goals.md — Current Focus: "The repository is currently focused on making repository understanding the pr..."
- **Source Files**: .ai/goals.md, .ai/strategy.md
- **Why It Matters**: The declared Current Focus is "The repository is currently focused on making repository understanding the pr...". Ensuring this focus is instrumented and measurable against the North Star Metric maximizes product signal per development cycle.
- **Why It Outranks Lower Candidates**: Current Focus alignment has higher strategic score than backlog items because it directly addresses the declared product priority.

### 5. Collapse Primary Navigation to Improvement Loop Only

- **ID**: pj-simplify-navigation
- **Category**: information-architecture
- **Composite Score**: 79/100
- **Product Value**: 80/100
- **Strategic Alignment**: 85/100
- **User Impact**: 78/100
- **Leverage**: 75/100
- **Implementation Cost**: 68/100
- **Confidence**: High
- **Evidence**: docs/repository-improvement-product-redesign.md — "Screens that should be removed from normal usage" and "UI elements that should become Advanced"
- **Source Files**: src/App.tsx
- **Why It Matters**: Eliminates decision fatigue. The owner sees one recommendation, one rationale, one button. Repository Health, Context Package, Validation, Verification, and Prompt Center move to Advanced.
- **Why It Outranks Lower Candidates**: Reducing navigation complexity has higher product leverage than adding features to existing surfaces.

### 6. Instrument North Star Metric: Repository handoff readiness is Ready with high canonic

- **ID**: pj-northstar-repository-handoff-readiness-is-ready-with-h
- **Category**: product-measurement
- **Composite Score**: 79/100
- **Product Value**: 76/100
- **Strategic Alignment**: 86/100
- **User Impact**: 70/100
- **Leverage**: 84/100
- **Implementation Cost**: 82/100
- **Confidence**: High
- **Evidence**: .ai/goals.md — North Star Metric: "Repository handoff readiness is Ready with high canonical intelligence consis..."
- **Source Files**: .ai/goals.md
- **Why It Matters**: The declared North Star is "Repository handoff readiness is Ready with high canonical intelligence consis...". Verifying this metric is instrumented and tracked in production ensures the product direction is data-driven.
- **Why It Outranks Lower Candidates**: An uninstrumented North Star Metric means all product judgment is qualitative — instrumenting it enables quantitative prioritization.

### 7. Complete and Evaluate Current Experiment: Can the system reliably deliver the current focus:

- **ID**: pj-experiment-can-the-system-reliably-deliver-the-current-
- **Category**: product-validation
- **Composite Score**: 78/100
- **Product Value**: 75/100
- **Strategic Alignment**: 88/100
- **User Impact**: 65/100
- **Leverage**: 82/100
- **Implementation Cost**: 80/100
- **Confidence**: High
- **Evidence**: .ai/strategy.md — Current Experiment: "Can the system reliably deliver the current focus: The repository is currentl..."
- **Source Files**: .ai/strategy.md
- **Why It Matters**: An active experiment "Can the system reliably deliver the current focus: The repository is currentl..." is underway. Reaching a clear go/no-go decision on this experiment unlocks the next product bet and prevents investment in the wrong direction.
- **Why It Outranks Lower Candidates**: Active experiments have time-value — delayed evaluation reduces signal quality and wastes development cycles.

### 8. Automate Post-Implementation Validation and Refresh

- **ID**: pj-automate-post-implementation
- **Category**: product-experience
- **Composite Score**: 76/100
- **Product Value**: 78/100
- **Strategic Alignment**: 80/100
- **User Impact**: 75/100
- **Leverage**: 80/100
- **Implementation Cost**: 60/100
- **Confidence**: Medium
- **Evidence**: docs/repository-improvement-product-redesign.md — "Validation & Refresh — automatically handle the post-implementation loop"
- **Source Files**: scripts/server.mjs, src/App.tsx, src/workflow.ts
- **Why It Matters**: After implementation, the owner clicks one button. Validation, refresh, and next-improvement selection happen automatically. The loop closes without manual steps.
- **Why It Outranks Lower Candidates**: Automates the most repetitive part of the improvement loop. Backlog-only items below this threshold do not change the core loop.

### 9. Verify Success Criteria Are Measurable and Tracked

- **ID**: pj-success-control-plane-reports-repository-handoff-rea
- **Category**: product-measurement
- **Composite Score**: 76/100
- **Product Value**: 72/100
- **Strategic Alignment**: 84/100
- **User Impact**: 65/100
- **Leverage**: 76/100
- **Implementation Cost**: 86/100
- **Confidence**: Medium
- **Evidence**: .ai/goals.md — Success Criteria: "Control Plane reports repository handoff readiness as Ready."
- **Source Files**: .ai/goals.md
- **Why It Matters**: 2 success criteria are defined. A verification pass confirms each is tracked, measurable, and tied to observable product behavior — not just intentions.
- **Why It Outranks Lower Candidates**: Defined but untracked success criteria produce false confidence. Verification is low-cost with high strategic impact.

### 10. Improve Markdown Rendering

- **ID**: pj-backlog-improve-markdown-rendering
- **Category**: backlog
- **Composite Score**: 61/100
- **Product Value**: 58/100
- **Strategic Alignment**: 60/100
- **User Impact**: 56/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Improve Markdown Rendering. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 11. Add Richer Validation Detection

- **ID**: pj-backlog-add-richer-validation-detection
- **Category**: backlog
- **Composite Score**: 59/100
- **Product Value**: 56/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Add Richer Validation Detection. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 12. Add Backlog Quality Filtering

- **ID**: pj-backlog-add-backlog-quality-filtering
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Add Backlog Quality Filtering. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 13. Add Cross-links Between .ai Documents

- **ID**: pj-backlog-add-cross-links-between-ai-documents
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Add Cross-links Between .ai Documents. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 14. Add Expand Repository Health Checks

- **ID**: pj-backlog-add-expand-repository-health-checks
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Add Expand Repository Health Checks. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 15. Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.

- **ID**: pj-backlog-reason-repository-documentation-identifies-a
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 16. Source: README.md:292

- **ID**: pj-backlog-source-readme-md-292
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Source: README.md:292. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 17. Source: README.md:293

- **ID**: pj-backlog-source-readme-md-293
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Source: README.md:293. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 18. Source: README.md:294

- **ID**: pj-backlog-source-readme-md-294
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Source: README.md:294. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 19. Source: README.md:295

- **ID**: pj-backlog-source-readme-md-295
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Source: README.md:295. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 20. Source: README.md:296

- **ID**: pj-backlog-source-readme-md-296
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Source: README.md:296. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 21. Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.

- **ID**: pj-backlog-suggested-next-step-define-the-smallest-loca
- **Category**: backlog
- **Composite Score**: 58/100
- **Product Value**: 52/100
- **Strategic Alignment**: 60/100
- **User Impact**: 48/100
- **Leverage**: 62/100
- **Implementation Cost**: 82/100
- **Confidence**: Medium
- **Evidence**: .ai/backlog.md — medium priority backlog item
- **Source Files**: None specified
- **Why It Matters**: Addresses a known repository owner priority: Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.
