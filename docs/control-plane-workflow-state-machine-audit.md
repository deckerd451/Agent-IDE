# Control Plane Workflow State Machine Audit

## Scope and sources

This audit covers the Control Plane workflow state machine implemented in `src/workflow.ts` and rendered/advanced by `src/App.tsx`. It intentionally does not change runtime behavior, UI design, buttons, or deterministic local-first behavior.

Primary repository-local sources:

- State-machine definitions: `workflowDefinitions`, `createWorkflow`, and `advanceWorkflow` in `src/workflow.ts`.
- Visible primary CTA rendering: `WorkflowPrimaryButton`, `CurrentTaskCard`, and `WorkflowProgress` in `src/App.tsx`.
- Workflow click orchestration and side effects: `performWorkflowStepAction` and `handleWorkflowPrimaryAction` in `src/App.tsx`.
- Step workspace copy: `stepToUserTask` and `outcomeWorkflowText` in `src/App.tsx`.
- Regression tests: `tests/workflow-engine.test.mjs`.

## State-transition summary

Control Plane workflows are deterministic finite-state progressions selected by package type or recommendation text:

| Workflow type | Selection rule | Ordered states |
|---|---|---|
| Product Decision | `packageType === product-decision` | Recommendation Ready → Workflow In Progress → Waiting for External Work (Codex / ChatGPT / User) → Validate Result → Refresh Repository → Repository Analysis Running |
| Implementation | `packageType === implementation`, or fallback | Recommendation Ready → Workflow In Progress → Waiting for External Work (Codex / ChatGPT / User) → Validate Result → Refresh Repository → Repository Analysis Running |
| Validation | `packageType === validation-experiment` | Recommendation Ready → Workflow In Progress → Waiting for External Work (Codex / ChatGPT / User) → Workflow In Progress → Validate Result → Refresh Repository → Repository Analysis Running |
| Investigation | Recommendation text matches investigation/risk/unknown/explain | Recommendation Ready → Workflow In Progress → Waiting for External Work (Codex / ChatGPT / User) → Validate Result → Refresh Repository → Repository Analysis Running |
| Documentation | Recommendation text matches documentation/docs | Recommendation Ready → Workflow In Progress → Waiting for External Work (Codex / ChatGPT / User) → Validate Result → Refresh Repository → Repository Analysis Running |

`advanceWorkflow` advances one step per primary CTA click, persists the next `WorkflowState` in localStorage, and marks terminal steps as `Ready To Refresh`. When advancement lands on `Refresh Repository`, `handleWorkflowPrimaryAction` immediately calls `refreshIntelligence({ clearWorkflow: true, previousTitle })`, so the terminal refresh state already auto-runs after the preceding click.

## Complete workflow transition table

Legend:

- **Source** lists the definition and renderer/orchestrator that make the transition visible and effective.
- **Side effects** are side effects from the primary workflow CTA, not secondary copy-only buttons.
- **Auto-advance?** means the transition needs no new user input, external result, confirmation, or decision after the prior state has completed.

| Workflow | Step id | Visible primary CTA label | Source function/component | State before click | State after click | Side effects | Visible feedback | User input required? | New information provided by user | Could auto-advance? | Audit note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Product Decision | `review-canonical-edit` | `Review Canonical Edit`; may render as `Create Canonical Intelligence` or `Review Existing Canonical Intelligence` for canonical bootstrap/existing intelligence | `workflowDefinitions`; `createWorkflow`; `WorkflowPrimaryButton`; `performWorkflowStepAction`; `handleWorkflowPrimaryAction` | Recommendation Ready | Workflow In Progress | Copies recommendation prompt/canonical decision text when available; persists workflow state | Copy toast/status plus `Workflow advanced to Edit or approve the owner-authored decision. Next: Approve Decision Text.` | No click-time input, but review itself may be meaningful before continuing | None on click | No, if the intent is actual owner review; yes for pure copy-and-advance mechanics | CTA implies review while click mostly copies and advances state. |
| Product Decision | `edit-proposal` | `Approve Decision Text` | Same as above | Workflow In Progress | Waiting for External Work (Codex / ChatGPT / User) | No step action; persists workflow state | `Workflow advanced to Apply the canonical edit to repository intelligence. Next: Apply Canonical Edit.` | Yes | Owner approval/decision that text is acceptable | No | Justified gate: approval is a decision. |
| Product Decision | `apply-canonical-edit` | `Apply Canonical Edit` | Same as above; canonical edit UI has separate `CanonicalEditPanel.applyCanonicalEdit` | Waiting for External Work (Codex / ChatGPT / User) | Validate Result | No workflow-step side effect; persists workflow state | `Workflow advanced to Validate the updated repository intelligence. Next: Validate Result.` | Yes if separate canonical edit panel has not been used | Confirmation that external/editor work is complete | No | Label hides that the primary workflow CTA does not itself apply the edit; the actual apply side effect lives in the canonical edit panel. |
| Product Decision | `validate-result` | `Validate Result` | Same as above | Validate Result | Refresh Repository → immediate refresh | Persists workflow state, closes work item, calls `refreshIntelligence({ clearWorkflow: true, previousTitle })` | Refresh progress/errors; after refresh, updated Control Plane | No | None | Yes | Deterministic no-input transition; label hides that it advances to refresh rather than running a distinct validation command. |
| Product Decision | `refresh-repository` | `Refresh Repository Intelligence` | Same as above | Refresh Repository | Repository Analysis Running | If reachable with `Ready To Refresh`, calls `refreshIntelligence` and clears workflow | Refresh progress/errors; updated Control Plane | No | None | Already effectively auto-triggered from preceding step | Terminal refresh path is mostly a fallback if the persisted refresh state is rendered. |
| Implementation | `copy-implementation-prompt` | `Copy Implementation Prompt` | Same as above | Recommendation Ready | Workflow In Progress | Copies implementation prompt; persists workflow state | Copy toast/status plus `Workflow advanced to Open Codex or your coding agent. Next: Copy Prompt and Confirm Coding Agent Is Open.` | No | None | No, because copying prompt is an external side effect useful to the user | Justified click: copies material to clipboard. |
| Implementation | `open-codex` | Visible as `Copy Prompt and Confirm Coding Agent Is Open` (`Open Codex` normalized by `outcomeWorkflowText`) | Same as above | Workflow In Progress | Waiting for External Work (Codex / ChatGPT / User) | Copies the same implementation prompt again; persists workflow state | Copy toast/status plus `Workflow advanced to Complete the implementation outside Agent IDE. Next: Mark External Work Complete.` | Yes, if interpreted as confirmation that agent is open/prompt pasted | Confirmation only; no new content | Partially. If copy is desired, no; if only confirmation, no auto-advance because external tool setup is required | Repeated-click path: same implementation prompt can be copied in consecutive primary steps. |
| Implementation | `run-implementation` | `Mark External Work Complete` | Same as above | Waiting for External Work (Codex / ChatGPT / User) | Validate Result | No step action; persists workflow state | `Workflow advanced to Run or review validation checks. Next: Validate Result. Outcome evidence was not saved...` | Yes | Confirmation that external implementation is complete | No | Justified gate: waits on external result. |
| Implementation | `validate-result` | `Validate Result` | Same as above | Validate Result | Refresh Repository → immediate refresh | Persists workflow state, closes work item, calls refresh | Refresh progress/errors; updated Control Plane | No | None | Yes | Deterministic no-input transition; primary label hides that it is refresh advancement. |
| Implementation | `refresh-repository` | `Refresh Repository Intelligence` | Same as above | Refresh Repository | Repository Analysis Running | Calls refresh and clears workflow if rendered/reclicked | Refresh progress/errors; updated Control Plane | No | None | Already effectively auto-triggered | Fallback/reload recovery state. |
| Validation | `copy-context-package` | Visible as `Prepare AI Context` (`Copy Context Package` normalized) | Same as above | Recommendation Ready | Workflow In Progress | Copies context package; persists workflow state | Copy toast/status plus `Workflow advanced to Copy Understanding Check. Next: Copy Understanding Check.` | No | None | No, because copying context is useful side effect | Justified click: copies required input. |
| Validation | `copy-understanding-check` | `Copy Understanding Check` | Same as above | Workflow In Progress | Waiting for External Work (Codex / ChatGPT / User) | Copies validation prompt; persists workflow state | Copy toast/status plus `Workflow advanced to Open ChatGPT. Next: Confirm ChatGPT Is Open.` | No | None | No, because copying prompt is useful side effect | Justified click: copies required input. |
| Validation | `open-chatgpt` | Visible as `Confirm ChatGPT Is Open` | Same as above | Waiting for External Work (Codex / ChatGPT / User) | Workflow In Progress | No workflow-step side effect; persists workflow state | `Workflow advanced to Paste the AI response back into Agent IDE. Next: Confirm Validation Response Reviewed.` | Yes | Confirmation that external ChatGPT setup/paste happened | No | Justified external-work gate. |
| Validation | `paste-response` | Visible as `Confirm Validation Response Reviewed` | Same as above | Workflow In Progress | Validate Result | No captured response; persists workflow state | `Workflow advanced to Run validation. Next: Confirm Validation Reviewed.` | Yes | Confirmation/mental review only; no persisted response | No if user actually reviews; yes if no response capture is expected | CTA hides that no response is pasted into Agent IDE; it only advances workflow state. |
| Validation | `run-validation` | Visible as `Confirm Validation Reviewed` | Same as above | Validate Result | Refresh Repository → immediate refresh | Persists workflow state, closes work item, calls refresh | Refresh progress/errors; updated Control Plane | No | None | Yes | Deterministic no-input transition; CTA hides that it only advances to refresh. |
| Validation | `refresh-repository` | `Refresh Repository Intelligence` | Same as above | Refresh Repository | Repository Analysis Running | Calls refresh and clears workflow if rendered/reclicked | Refresh progress/errors; updated Control Plane | No | None | Already effectively auto-triggered | Fallback/reload recovery state. |
| Investigation | `review-question` | `Review Question` | Same as above | Recommendation Ready | Workflow In Progress | No step action; persists workflow state | `Workflow advanced to Inspect the cited evidence. Next: Inspect Evidence.` | No click-time input, but review may be meaningful | None on click | No if actual review is required; yes for pure state mechanics | CTA likely hides state advancement. |
| Investigation | `inspect-evidence` | `Inspect Evidence` | Same as above | Workflow In Progress | Waiting for External Work (Codex / ChatGPT / User) | Copies cited evidence; persists workflow state | Copy toast/status plus `Workflow advanced to Record the finding. Next: Record Finding.` | No | None | No, because copying evidence is useful side effect | Justified click: copies evidence. |
| Investigation | `record-finding` | `Record Finding` | Same as above | Waiting for External Work (Codex / ChatGPT / User) | Validate Result | No captured finding; persists workflow state | `Workflow advanced to Validate the finding. Next: Validate Result.` | Yes | Confirmation that external finding was recorded somewhere else | No | Label hides that no finding is recorded in Agent IDE. |
| Investigation | `validate-result` | `Validate Result` | Same as above | Validate Result | Refresh Repository → immediate refresh | Persists workflow state, closes work item, calls refresh | Refresh progress/errors; updated Control Plane | No | None | Yes | Deterministic no-input transition. |
| Investigation | `refresh-repository` | `Refresh Repository Intelligence` | Same as above | Refresh Repository | Repository Analysis Running | Calls refresh and clears workflow if rendered/reclicked | Refresh progress/errors; updated Control Plane | No | None | Already effectively auto-triggered | Fallback/reload recovery state. |
| Documentation | `review-documentation-gap` | `Review Documentation Gap` | Same as above | Recommendation Ready | Workflow In Progress | No step action; persists workflow state | `Workflow advanced to Edit documentation. Next: Edit Documentation.` | No click-time input, but review may be meaningful | None on click | No if actual review is required; yes for pure state mechanics | CTA likely hides state advancement. |
| Documentation | `edit-documentation` | `Edit Documentation` | Same as above | Workflow In Progress | Waiting for External Work (Codex / ChatGPT / User) | No step action; persists workflow state | `Workflow advanced to Review the documentation diff. Next: Review Diff.` | Yes | Confirmation that documentation edit has started/been delegated externally | No | Justified external-work gate if edit occurs outside Agent IDE. |
| Documentation | `review-diff` | `Review Diff` | Same as above | Waiting for External Work (Codex / ChatGPT / User) | Validate Result | No diff read/captured; persists workflow state | `Workflow advanced to Validate documentation output. Next: Validate Result.` | Yes | Confirmation that diff was reviewed externally | No | Label hides that no diff review is performed by the CTA. |
| Documentation | `validate-result` | `Validate Result` | Same as above | Validate Result | Refresh Repository → immediate refresh | Persists workflow state, closes work item, calls refresh | Refresh progress/errors; updated Control Plane | No | None | Yes | Deterministic no-input transition. |
| Documentation | `refresh-repository` | `Refresh Repository Intelligence` | Same as above | Refresh Repository | Repository Analysis Running | Calls refresh and clears workflow if rendered/reclicked | Refresh progress/errors; updated Control Plane | No | None | Already effectively auto-triggered | Fallback/reload recovery state. |

## Paths where the same visible CTA can be clicked more than once

### Same visible label within one workflow instance

| Path | Same visible CTA | Why it can repeat | Justification |
|---|---|---|---|
| Product Decision: `validate-result` → terminal/fallback `refresh-repository` | A refresh-like action appears after validation: `Validate Result` advances to refresh, then `Refresh Repository Intelligence` may render if persisted/reloaded before auto-refresh completes | Both require no new user information; the terminal refresh is already called automatically when `next.repositoryState === 'Refresh Repository'` | Necessary only as fallback/reload recovery; normal path should not ask twice. |
| Implementation: `copy-implementation-prompt` → `open-codex` | The same implementation prompt is copied on both `Copy Implementation Prompt` and the visible `Copy Prompt and Confirm Coding Agent Is Open` | `performWorkflowStepAction` maps both step ids to `implementationPrompt(...)` | Unnecessary repeated copy unless the second click intentionally helps paste into the agent. The label combines copy and confirmation, but no external-open action exists. |
| Implementation: `validate-result` → terminal/fallback `refresh-repository` | Refresh-like completion can be clicked after `Validate Result` if terminal state is rendered | `Validate Result` auto-calls refresh after advancing to `Refresh Repository` | Fallback only; normal path should not ask twice. |
| Validation: `run-validation` → terminal/fallback `refresh-repository` | `Confirm Validation Reviewed` advances into refresh, and `Refresh Repository Intelligence` may be visible/reclickable after reload | Refresh is auto-called by the previous click | Fallback only; normal path should not ask twice. |
| Investigation: `validate-result` → terminal/fallback `refresh-repository` | `Validate Result` advances into refresh, and terminal refresh may also render | Refresh is auto-called by the previous click | Fallback only; normal path should not ask twice. |
| Documentation: `validate-result` → terminal/fallback `refresh-repository` | `Validate Result` advances into refresh, and terminal refresh may also render | Refresh is auto-called by the previous click | Fallback only; normal path should not ask twice. |

### Same visible label across multiple surfaces

`WorkflowPrimaryButton` is rendered both in the dashboard card and the work item workflow progress. The same current primary CTA can therefore be clicked from either surface for the same workflow state. This is a duplicated surface, not a duplicated state-machine step. It is justified because the Work Queue and Work Item both need a visible primary action, but it increases the importance of making state advancement deterministic and idempotent.

## Deterministic no-input transitions that should auto-advance

The following transitions provide no new user input, require no external result, and have either no side effect or only set up an immediate refresh:

| Workflow | Step | Current behavior | Recommended behavior |
|---|---|---|---|
| Product Decision | `validate-result` | User clicks `Validate Result`; workflow advances to `Refresh Repository`; handler immediately refreshes | Auto-advance from validate-result to refresh once validation is only a local refresh. |
| Implementation | `validate-result` | User clicks `Validate Result`; handler immediately refreshes | Auto-advance from validate-result to refresh. |
| Validation | `run-validation` | User clicks visible `Confirm Validation Reviewed`; handler immediately refreshes | Auto-advance from run-validation to refresh after response-review confirmation step is complete. |
| Investigation | `validate-result` | User clicks `Validate Result`; handler immediately refreshes | Auto-advance from validate-result to refresh. |
| Documentation | `validate-result` | User clicks `Validate Result`; handler immediately refreshes | Auto-advance from validate-result to refresh. |
| All workflows | terminal `refresh-repository` if reached after reload | User may click `Refresh Repository Intelligence` | Keep as a recovery fallback, but invoke automatically when rendered with `repositoryState === 'Refresh Repository'` and no refresh is already running. |

Potential no-input but review-labeled steps (`review-question`, `review-documentation-gap`, and the Product Decision first review step) should not be auto-advanced without a product decision, because their names imply the user must read/approve something even though the click itself provides no data.

## CTAs whose labels hide that they only advance workflow state

| CTA | Workflow step(s) | Why label is misleading |
|---|---|---|
| `Apply Canonical Edit` primary workflow CTA | Product Decision `apply-canonical-edit` | The primary workflow CTA does not call the canonical edit API; the actual write is in `CanonicalEditPanel.applyCanonicalEdit`. The workflow CTA only advances state. |
| `Validate Result` | Product Decision, Implementation, Investigation, Documentation `validate-result` | No validation command runs from the CTA; it persists the next state and triggers repository refresh. |
| `Confirm Validation Reviewed` | Validation `run-validation` | No validation work is performed; it advances to refresh. |
| `Confirm Validation Response Reviewed` | Validation `paste-response` | No response is pasted or stored in Agent IDE; it only confirms/requires mental review and advances state. |
| `Record Finding` | Investigation `record-finding` | No finding is captured in Agent IDE; it only advances after presumed external recording. |
| `Review Diff` | Documentation `review-diff` | No diff is opened or inspected by the CTA; it only advances after presumed external review. |
| `Review Question` / `Review Documentation Gap` | Investigation/Documentation first step | The CTA records no review result; it only advances unless the user treats the click as confirmation. |
| `Copy Prompt and Confirm Coding Agent Is Open` | Implementation `open-codex` | It copies the prompt again and advances; it cannot open or verify Codex. |

## Smallest recommended implementation fix

Add a narrow auto-advance path for deterministic refresh-only validation steps: when the current step is one of `validate-result` or `run-validation`, skip persisting/rendering an intermediate user-facing validation CTA and immediately execute the existing refresh path with `clearWorkflow: true`. Preserve terminal `refresh-repository` as a recovery fallback for reloads or interrupted refreshes.

This is smaller than redesigning the workflow model because it reuses the existing `advanceWorkflow`, localStorage persistence, workflow diagnostics, and `refreshIntelligence` behavior while removing the repeated click where no user input or external result is required.
