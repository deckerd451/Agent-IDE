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
- .ai/decisions.md: Present
- .ai/execution-model.md: Present
- .ai/repository-health.md: Present
- .ai/decision-ranking.json: Present
- docs/repository-improvement-product-redesign.md: Present

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

### 3. Collapse Primary Navigation to Improvement Loop Only

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

### 4. Automate Post-Implementation Validation and Refresh

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

### 5. Improve Markdown Rendering

- **ID**: pj-backlog-17
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

### 6. Reason: Repository documentation identifies actionable follow-up work from: Improve markdown rendering.

- **ID**: pj-backlog-19
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
- **Why It Matters**: Addresses a known repository owner priority: Reason: Repository documentation identifies actionable follow-up work from: Improve markdown rendering.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 7. Suggested Next Step: Define the smallest local, deterministic change needed to improve markdown rendering.

- **ID**: pj-backlog-20
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
- **Why It Matters**: Addresses a known repository owner priority: Suggested Next Step: Define the smallest local, deterministic change needed to improve markdown rendering.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 8. Add Richer Validation Detection

- **ID**: pj-backlog-13
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

### 9. Reason: Repository documentation identifies actionable follow-up work from: Add richer validation detection for additional ecosystems.

- **ID**: pj-backlog-15
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
- **Why It Matters**: Addresses a known repository owner priority: Reason: Repository documentation identifies actionable follow-up work from: Add richer validation detection for additional ecosystems.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 10. Suggested Next Step: Define the smallest local, deterministic change needed to add richer validation detection for additional ecosystems.

- **ID**: pj-backlog-16
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
- **Why It Matters**: Addresses a known repository owner priority: Suggested Next Step: Define the smallest local, deterministic change needed to add richer validation detection for additional ecosystems.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 11. Add Backlog Quality Filtering

- **ID**: pj-backlog-1
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

### 12. Source: README.md:296

- **ID**: pj-backlog-10
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

### 13. Reason: Repository documentation identifies actionable follow-up work from: Expand repository health checks as more intelligence artifacts are added.

- **ID**: pj-backlog-11
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
- **Why It Matters**: Addresses a known repository owner priority: Reason: Repository documentation identifies actionable follow-up work from: Expand repository health checks as more intelligence artifacts are added.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 14. Suggested Next Step: Define the smallest local, deterministic change needed to add expand repository health checks as more intelligence artifacts are added.

- **ID**: pj-backlog-12
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
- **Why It Matters**: Addresses a known repository owner priority: Suggested Next Step: Define the smallest local, deterministic change needed to add expand repository health checks as more intelligence artifacts are added.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 15. Source: README.md:293

- **ID**: pj-backlog-14
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

### 16. Source: README.md:294

- **ID**: pj-backlog-18
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

### 17. Source: README.md:292

- **ID**: pj-backlog-2
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

### 18. Reason: Repository documentation identifies actionable follow-up work from: Add backlog quality filtering.

- **ID**: pj-backlog-3
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

### 19. Suggested Next Step: Define the smallest local, deterministic change needed to add backlog quality filtering.

- **ID**: pj-backlog-4
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

### 20. Add Cross-links Between .ai Documents

- **ID**: pj-backlog-5
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

### 21. Source: README.md:295

- **ID**: pj-backlog-6
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

### 22. Reason: Repository documentation identifies actionable follow-up work from: Add cross-links between `.ai` documents.

- **ID**: pj-backlog-7
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
- **Why It Matters**: Addresses a known repository owner priority: Reason: Repository documentation identifies actionable follow-up work from: Add cross-links between `.ai` documents.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 23. Suggested Next Step: Define the smallest local, deterministic change needed to add cross-links between `.ai` documents.

- **ID**: pj-backlog-8
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
- **Why It Matters**: Addresses a known repository owner priority: Suggested Next Step: Define the smallest local, deterministic change needed to add cross-links between `.ai` documents.. Listed as medium priority in .ai/backlog.md.
- **Why It Outranks Lower Candidates**: Outranks lower-priority backlog items by priority tier. All backlog candidates rank below product experience and information architecture opportunities.

### 24. Add Expand Repository Health Checks

- **ID**: pj-backlog-9
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
