# Control Plane Button Flow Audit

This audit documents the current button-click behavior and invisible workflow state transitions in Agent IDE's Control Plane. It is intentionally descriptive only: no workflow behavior has been changed.

## Scope and source map

Primary workflow state is defined in `src/workflow.ts` and rendered/driven from `src/App.tsx`.

- `workflowDefinitions` defines workflow step ids, labels, primary CTA text, current repository state, and next repository state.
- `createWorkflow(...)` derives the visible current step, progress, estimated remaining steps, and current primary action from persisted workflow state.
- `advanceWorkflow(...)` marks the current step complete and moves to the next workflow step.
- `WorkflowPrimaryButton` renders the repeated primary CTA from `workflow.currentPrimaryAction`, after copy-normalizing labels with `outcomeWorkflowText(...)`.
- `handleWorkflowPrimaryAction(...)` is the shared primary CTA click handler.
- `performWorkflowStepAction(...)` performs the only automatic per-step side effects before state advances: copy text to clipboard for a subset of step ids.
- `CompletionPanel` separately implements “Mark External Work Complete” outcome recording through the `Save Outcome` button.
- `refreshIntelligence(...)` performs the repository refresh stream, reloads generated intelligence files, reloads control-plane data, and optionally clears persisted workflow state.

## Textual state-machine summary

### Shared primary CTA behavior

1. A workflow is selected from recommendation metadata.
2. The Control Plane shows one primary CTA for the current workflow step.
3. Clicking the CTA calls `handleWorkflowPrimaryAction(...)`.
4. If the current state is terminal refresh (`completionState === "Ready To Refresh"` or `repositoryState === "Refresh Repository"`), the click runs `refreshIntelligence(...)` instead of `performWorkflowStepAction(...)`.
5. Otherwise, `performWorkflowStepAction(...)` may copy a text artifact for recognized step ids.
6. The click then calls `advanceWorkflow(...)`, writes the new workflow state to `localStorage`, and updates React state.
7. If the advanced state is `Refresh Repository` or `Ready To Refresh`, the handler immediately calls `refreshIntelligence({ clearWorkflow: true })`.

### Implementation workflow

`Recommendation Ready` → **Copy Implementation Prompt** → `Workflow In Progress` → **Open Codex** → `Waiting for External Work (Codex / ChatGPT / User)` → **Mark External Work Complete** → `Validate Result` → **Validate Result** → `Refresh Repository` → automatic refresh → workflow cleared.

Current implementation detail: `Open Codex` copies the implementation prompt again; it does not open a URL. `Mark External Work Complete` in the primary CTA advances the workflow state only; the separate `Save Outcome` button records outcome evidence.

### Validation workflow

`Recommendation Ready` → **Prepare AI Context** → `Workflow In Progress` → **Copy Understanding Check** → `Waiting for External Work (Codex / ChatGPT / User)` → **Open ChatGPT** → `Workflow In Progress` → **Paste Validation Response** → `Validate Result` → **Run Validation** → `Refresh Repository` → automatic refresh → workflow cleared.

Current implementation detail: `Open ChatGPT`, `Paste Validation Response`, and `Run Validation` do not open a URL, read pasted content, or run validation logic directly. They are state-advancing markers. `Run Validation` auto-advances into refresh, so the visible result is refresh progress rather than a separate validation result.

### Product decision workflow

`Recommendation Ready` → **Review / Create Canonical Intelligence** → `Workflow In Progress` → **Approve Decision Text** → `Waiting for External Work (Codex / ChatGPT / User)` → **Apply Canonical Edit** → `Validate Result` → **Validate Result** → `Refresh Repository` → automatic refresh → workflow cleared.

Current implementation detail: the primary `Apply Canonical Edit` step copies the recommendation prompt or advances state; actual file writing is handled by the separate `Apply Canonical Edit` button inside `CanonicalEditPanel`.

### Investigation workflow

`Recommendation Ready` → **Review Question** → `Workflow In Progress` → **Inspect Evidence** → `Waiting for External Work (Codex / ChatGPT / User)` → **Record Finding** → `Validate Result` → **Validate Result** → `Refresh Repository` → automatic refresh → workflow cleared.

Current implementation detail: only `Inspect Evidence` copies text. The review/record/validate steps advance workflow state without visible work unless refresh begins.

### Documentation workflow

`Recommendation Ready` → **Review Documentation Gap** → `Workflow In Progress` → **Edit Documentation** → `Waiting for External Work (Codex / ChatGPT / User)` → **Review Diff** → `Validate Result` → **Validate Result** → `Refresh Repository` → automatic refresh → workflow cleared.

Current implementation detail: these primary CTA steps only advance workflow state until refresh.

## Primary buttons and state-changing actions

| User-visible label | Source component / function | State before click | State after click | Work performed | Visible feedback | Repeatable? | Repeated click required? | Repeated click accidental / idempotent? | Should auto-advance when no input required? |
|---|---|---|---|---|---|---|---|---|---|
| Refresh Repository Intelligence (repository connection) | `App` repository card → `refreshIntelligence()` | Any state with repository path entered | Connected path set; intelligence files and control plane reloaded; workflow state preserved unless called with clear option | Streams local refresh API; reads/writes generated `.ai` outputs through server | Yes: button changes to “Repository analysis running…”, step list, summary/error | Yes | No | Mostly idempotent; repeats regenerate intelligence | No; explicit refresh is appropriate |
| Refresh Repository Intelligence (secondary Control Plane CTA) | `CurrentTaskCard` secondary button → `onRefresh` | Any loaded workflow | Same as manual refresh; does not explicitly clear workflow | Streams local refresh API and reloads data | Yes: refresh progress/summary/error | Yes | No | Mostly idempotent, but may leave workflow state if recommendation key still matches | No |
| Refresh Repository Intelligence (workflow primary refresh state) | `WorkflowPrimaryButton` → `handleWorkflowPrimaryAction()` → `refreshIntelligence({ clearWorkflow: true })` | `repositoryState === "Refresh Repository"` or `completionState === "Ready To Refresh"` | Refresh runs; workflow state cleared after successful terminal refresh | Streams local refresh API; reloads data; clears workflow state | Yes during refresh; after refresh the active recommendation may change | Yes if refresh fails or state persists | Sometimes appears required if previous click only advanced into refresh state; current handler now auto-refreshes when advanced into refresh | Repeating after success starts a new explicit refresh | No; terminal refresh already auto-runs when reached by primary CTA |
| Prepare AI Context (normalized from Copy Context Package) | `WorkflowPrimaryButton`; step id `copy-context-package`; `performWorkflowStepAction()` | Validation workflow: `Recommendation Ready` | `Workflow In Progress`; next CTA is Copy Understanding Check | Copies context package to clipboard; persists workflow state | Ambiguous: no inline copied confirmation; only CTA text changes | Yes through browser/back/persisted state edge cases or if clipboard failed before advance | Yes in current validation workflow: user must click this before Copy Understanding Check | Repeating copy would be idempotent but not normally reachable after advance | No; it requires user clipboard/paste action |
| Copy Understanding Check | `WorkflowPrimaryButton`; step id `copy-understanding-check`; `performWorkflowStepAction()` | Validation workflow: `Workflow In Progress` | `Waiting for External Work (Codex / ChatGPT / User)`; next CTA is Open ChatGPT | Copies validation prompt to clipboard; persists workflow state | Ambiguous: no copied confirmation; only CTA text changes | Yes through state reset or manual repeat | Yes: separate copy after context package is required | Repeating copy is idempotent | No; it requires user clipboard/paste action |
| Open ChatGPT | `WorkflowPrimaryButton`; step id `open-chatgpt`; `performWorkflowStepAction()` has no mapping | Validation workflow: `Waiting for External Work (Codex / ChatGPT / User)` | `Workflow In Progress`; next CTA is Paste Validation Response | No URL opened; no copy; only workflow state advances | Ambiguous/misleading: label implies opening URL, but visible result is only CTA/current-step change | Yes through repeated state restoration | Required by current state machine to reach Paste Validation Response | Accidental state-only marker; idempotent only in the sense that it moves forward once | Yes, or relabel as “I opened ChatGPT”; no local input is required by app |
| Paste Validation Response | `WorkflowPrimaryButton`; step id `paste-response`; `performWorkflowStepAction()` has no mapping | Validation workflow: `Workflow In Progress` after Open ChatGPT | `Validate Result`; next CTA is Run Validation | No paste field is read; only workflow state advances | Ambiguous: no response captured or confirmation beyond CTA change | Yes through state restoration | Required by current state machine | Accidental state-only marker unless it represents manual acknowledgement | Yes if no response input is collected; otherwise add a visible input/confirmation |
| Run Validation | `WorkflowPrimaryButton`; step id `run-validation`; no mapping, then auto-refresh | Validation workflow: `Validate Result` | `Refresh Repository`, then refresh starts and workflow clears on success | No standalone validation; triggers workflow advance and immediate repository refresh | Partially visible: refresh progress appears, but no “validation ran” result | Yes if refresh fails | Required as final validation CTA in current workflow | The click is not idempotent; it reruns refresh | Yes if validation has no independent local work before refresh |
| Copy Implementation Prompt | `WorkflowPrimaryButton`; step id `copy-implementation-prompt`; `performWorkflowStepAction()` | Implementation workflow: `Recommendation Ready` | `Workflow In Progress`; next CTA is Open Codex | Copies implementation prompt to clipboard | Ambiguous: no copied confirmation; only CTA changes | Yes through reset/state edge cases | Yes in current workflow before Open Codex | Repeating copy is idempotent | No; user must paste prompt externally |
| Open Codex | `WorkflowPrimaryButton`; step id `open-codex`; `performWorkflowStepAction()` | Implementation workflow: `Workflow In Progress` | `Waiting for External Work (Codex / ChatGPT / User)`; next CTA is Mark External Work Complete | Copies implementation prompt again; does not open Codex URL | Ambiguous/misleading: no opened URL and no copied confirmation | Yes through state restoration | Required by current implementation workflow | Repeated copy is idempotent; the “open” label is misleading | Consider auto-advance after copy or relabel; no app input is required |
| Mark External Work Complete (primary CTA) | `WorkflowPrimaryButton`; step id `run-implementation`; `performWorkflowStepAction()` has no mapping | Implementation workflow: `Waiting for External Work (Codex / ChatGPT / User)` | `Validate Result`; next CTA is Validate Result | No file write; only workflow state advances | Ambiguous: no outcome saved; separate completion panel remains | Yes through state restoration | Required to reach validation state | Accidental if user expects outcome persistence | No, because it is a manual acknowledgement that external work is done |
| Save Outcome | `CompletionPanel.saveOutcome()` | Any Control Plane page with repository path; independent of workflow state | Outcome saved; outcome note cleared; control plane/outcome files reloaded; optional refresh starts | POSTs local outcome API; writes `.ai/outcomes.json` and `.ai/outcomes.md`; optional refresh | Yes: Saving… state and success/error message | Yes | Not required by primary workflow state machine, but required to persist outcome evidence | Repeating writes duplicate/additional outcome evidence; not idempotent | No; requires user-selected outcome/prompt quality |
| Refresh Repository Intelligence after saving | `CompletionPanel` checkbox + `saveOutcome()` | Save Outcome clicked with checkbox checked | Refresh starts after successful save | Same as Save Outcome, then refresh | Yes: save status and refresh progress | Yes | No | Repeating save+refresh is not idempotent | No |
| Refresh Repository Intelligence (CompletionPanel secondary) | `CompletionPanel` secondary button → `onRefresh` | Any completion panel state | Manual refresh starts | Streams local refresh API | Yes | Yes | No | Mostly idempotent refresh | No |
| Preview implementation guidance / Preview validation guidance | `RepositoryDecisionAnswers` `<details>` summary + `TaskArtifact` | Details collapsed | Details expanded; no workflow state change | Reveals already-rendered implementation/validation artifact | Yes: content appears inline | Yes | No | Idempotent disclosure toggle | No; user chooses whether to inspect |
| Copy-only: Builder / Reviewer / Debugger / Context Package | `WorkItemPage` prompt buttons | Work item page open | Same state | Copies selected prompt/package | Ambiguous: no copied confirmation | Yes | No | Idempotent clipboard copy | No |
| Copy validation prompt | `ValidationWorkspace` secondary button | Validation actions details open | Same state | Copies validation prompt | Ambiguous: no copied confirmation | Yes | No | Idempotent clipboard copy | No |
| Copy-only validation prompt/package buttons | `ValidationWorkspace` prompt action buttons | Validation actions details open | Same state | Copies selected text | Ambiguous: no copied confirmation | Yes | No | Idempotent clipboard copy | No |
| Apply Canonical Edit (panel button) | `CanonicalEditPanel.applyCanonicalEdit()` | Product-decision canonical panel, reviewed text present | Same workflow state; status message updated | POSTs local canonical edit API; writes owner-approved canonical intelligence through server | Yes: Applying… and success/error status | Yes | Not required by primary CTA state machine, but required for actual canonical file write | Not idempotent in all cases; repeated writes may duplicate/update depending server behavior | No; requires owner review/input |
| Refresh Creates Canonical Intelligence (disabled panel button) | `CanonicalEditPanel` button label for create-missing mode | `proposal.mode === "create-missing"` | No click; disabled | None | Visible disabled state | No | No | N/A | N/A |
| Back to Work Queue | `WorkItemPage` secondary button → `setIsWorkItemOpen(false)` | Work item page open | Dashboard visible | UI navigation only | Yes: page changes | Yes | No | Idempotent | No |
| View Strategy | Repository card optional shortcut / dashboard prop | Connected path with summary or dashboard action | Strategy tab selected | UI navigation only | Yes: selected section changes | Yes | No | Idempotent | No |
| Copy Context Package optional shortcut | Repository card optional shortcut | Connected path with summary and loaded context package | Same state | Copies context package | Ambiguous: no copied confirmation | Yes | No | Idempotent clipboard copy | No |
| Copy Architect Prompt optional shortcut | Repository card optional shortcut | Connected path with summary and loaded architect prompt | Same state | Copies architect prompt | Ambiguous: no copied confirmation | Yes | No | Idempotent clipboard copy | No |

## Invisible output and ambiguous feedback

The following actions currently perform invisible or ambiguous work:

1. Clipboard actions have no inline copied state: Prepare AI Context, Copy Understanding Check, Copy Implementation Prompt, Open Codex's copy behavior, copy-only prompt buttons, validation prompt copy buttons, and optional shortcut copy buttons.
2. `Open ChatGPT` does not open ChatGPT and does not copy text; it only advances workflow state.
3. `Open Codex` does not open Codex; it copies the implementation prompt again and advances workflow state.
4. `Paste Validation Response` does not provide or read a paste target; it only advances workflow state.
5. `Mark External Work Complete` primary CTA does not save an outcome; the actual persistence action is `Save Outcome` in the completion panel.
6. `Run Validation` does not run a standalone validation action; it advances into refresh and relies on repository intelligence refresh for visible feedback.
7. Product-decision primary CTA labels can overlap with the separate canonical edit panel button. The panel button writes files; the workflow primary CTA mostly copies/advances.
8. Workflow advancement is persisted to `localStorage`, but the user-facing feedback is often only the CTA label/current step changing.

## Repeated-click paths

### Required by the current state machine

- Validation requires separate clicks for Prepare AI Context, Copy Understanding Check, Open ChatGPT, Paste Validation Response, and Run Validation.
- Implementation requires separate clicks for Copy Implementation Prompt, Open Codex, Mark External Work Complete, and Validate Result.
- Product Decision, Investigation, and Documentation workflows similarly require every primary CTA click even when a step performs no local work.

### Accidental or unnecessary repeated-click paths

- `Open ChatGPT` is a no-op state marker and could be skipped or transformed into a visible acknowledgement.
- `Paste Validation Response` is a no-op state marker unless a response input is added.
- `Run Validation` is only a bridge to refresh and can auto-advance if no validation input is required.
- `Open Codex` repeats the implementation prompt copy but does not open anything; this can feel like the same copy button twice.
- `Mark External Work Complete` and `Save Outcome` are semantically close but independent. Users may click one expecting the other to have happened.
- Copy-only buttons are safe to repeat, but lack copied feedback, so users may click repeatedly to confirm.

## Smallest recommended follow-up implementation step

Add deterministic, local-only action feedback and auto-advance no-input marker steps:

1. Add a small visible workflow action result line near the primary CTA, using existing `workflowDiagnostics.lastStepActionResult` or a new user-facing state, e.g. “Copied implementation prompt”, “Advanced to Open ChatGPT”, or “Refreshing repository intelligence…”.
2. Relabel or instrument URL-labeled no-op actions so the result matches the label. The smallest behavior-preserving option is copy/feedback only: “Marked ChatGPT opened” instead of “Open ChatGPT”, or show “No URL is opened by Agent IDE.”
3. Auto-advance deterministic no-input bridge steps (`Open ChatGPT`, `Paste Validation Response`, possibly `Run Validation`) when no user-provided value is collected, or convert them into explicit acknowledgement labels.
4. Clarify the difference between workflow `Mark External Work Complete` and persistent `Save Outcome` by showing a visible warning/result when the primary CTA advances without saving outcome evidence.

The smallest single fix is: **show visible feedback after every primary CTA click and clipboard action, without changing workflow order**. That would make repeated-click confusion observable while preserving current deterministic behavior.
