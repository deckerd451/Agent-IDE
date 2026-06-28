# Invention Disclosure Template

<!--
  TEMPLATE INSTRUCTIONS — REMOVE THIS BLOCK BEFORE SUBMITTING FOR REVIEW
  -----------------------------------------------------------------------
  1. Copy this file to inventions/INV-{YEAR}-{SEQUENCE}/disclosure.md.
  2. Replace every TBD placeholder with real content.
  3. Delete instruction comments like this one.
  4. Do not leave any section blank. Use "None identified yet." or
     "Not applicable." where a section genuinely has no content.
  5. Run the DRAFT → REVIEW checklist at the bottom before changing
     Filing Status to REVIEW.

  CANONICAL TERMINOLOGY
  All terms used in this document are defined in:
    ../glossary.md    (relative path from this file's parent directory)
  Do not introduce or redefine terms here.

  LEGAL NOTICE
  This document is an engineering record, not a patent application.
  It contains no legal claims. It does not create, waive, or establish
  any patent rights. All legal decisions — including filing, abandonment,
  and trade-secret designation — require review by qualified patent counsel.
  -----------------------------------------------------------------------
-->

---

## Metadata

```
Invention ID       : INV-{YEAR}-{SEQUENCE}
Title              : TBD — one sentence, action-oriented, no jargon
Filing Status      : DRAFT
IP Readiness Level : IRL-2
Inventive Date     : TBD — YYYY-MM-DD (earliest verifiable artifact date)
Priority Date      : TBD — leave blank until a patent application is filed
Filing Date        : TBD — leave blank until a patent application is filed
Patent Family      : TBD — FAM-{YEAR}-{SEQUENCE}, or "None assigned yet"
Assigned To        : TBD — engineer or team responsible for this disclosure
Counsel Contact    : TBD — patent counsel assigned, or "Not yet assigned"
Last Updated       : YYYY-MM-DD
```

<!--
  FILING STATUS VALUES (from glossary.md § Filing Status):
    DRAFT        — being written; not yet submitted for review
    REVIEW       — complete; awaiting Human Review
    APPROVED     — Human Review passed; filing-path decision pending
    FILED        — application submitted or published defensively
    PROSECUTION  — under examination by a patent office
    GRANTED      — claims allowed; patent issued
    PUBLISHED    — defensive publication completed
    ABANDONED    — deliberate decision not to pursue (record rationale below)
    TRADE_SECRET — maintained as trade secret; must not be publicly disclosed
    ARCHIVED     — patent term expired or superseded

  Do not set Filing Status to REVIEW until the DRAFT → REVIEW checklist
  at the bottom of this document is fully complete.

  IP READINESS LEVEL VALUES (from glossary.md § IP Readiness Level):
    IRL-1  Signal — Repository Intelligence Signal raised; no disclosure yet
    IRL-2  Draft Disclosure — in progress; no evidence links yet
    IRL-3  Evidenced Disclosure — complete; at least one evidence artifact linked
    IRL-4  Reviewed Disclosure — Human Review complete; filing decision pending
    IRL-5  Filed — application submitted or defensive publication complete
-->

---

## Dependencies

| Document | Path | Relationship |
|---|---|---|
| Glossary | `../../glossary.md` | Canonical definitions for all terms used here |
| Evidence Bundle | `./evidence.md` | Evidence artifacts establishing inventive date and reduction to practice |
| Novelty File | `./novelty.md` | Prior-art analysis and novelty claims |
| Validation Record | `../../validation/INV-{YEAR}-{SEQUENCE}/validation-report.md` | Validation artifacts serving as implementation evidence |
| Patent Family Overview | `../../patent-families/FAM-{YEAR}-{SEQUENCE}/overview.md` | Family scope and claim strategy context |
| Prior-Art Index | `../../prior-art/index.md` | Master index of reviewed prior-art references |

---

## Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 0.1 | YYYY-MM-DD | TBD | Initial draft |

---

## ⚠ Legal Notice

> This is an engineering record, not a patent application. It does not contain
> legal claims, does not create or waive patent rights, and has not been reviewed
> by patent counsel. All filing, abandonment, trade-secret, and defensive-publication
> decisions require qualified legal review before action is taken.

---

## 1. Title

**TBD**

<!--
  Write one sentence in the form: "A method / system / apparatus for [doing X]
  that [achieves Y] by [mechanism Z]."
  Example: "A method for continuously correlating repository commits to active
  invention disclosures without human initiation, using pattern-matched evidence
  anchors to establish inventive-date provenance in real time."

  The title must describe the technical substance, not the product name or
  marketing language. It must be stable — changing it after APPROVED status
  requires counsel review because it may affect claim scope.
-->

---

## 2. Summary

**TBD**

<!--
  Two to four sentences. State: (1) the problem being solved, (2) the inventive
  method in plain language, and (3) the concrete technical result.

  A reader who understands the summary should be able to explain the invention
  to someone else without reading further. Do not include code or implementation
  detail here — that belongs in Section 5.
-->

---

## 3. Problem Statement

### 3.1 The Problem

**TBD**

<!--
  Describe the engineering problem this invention solves. Be specific:
  - What fails, degrades, or is impossible without this invention?
  - Who or what is affected?
  - What is the cost of the problem (time, correctness, reliability, scale)?

  Do not describe the solution here. Describe only the problem.
-->

### 3.2 Prior Approaches and Their Limitations

**TBD**

<!--
  Describe the approaches that exist today — whether your own prior work,
  industry-standard approaches, or what a skilled engineer would naturally try.
  For each approach, explain why it fails to fully solve the problem described
  in 3.1.

  This section is used in novelty analysis to establish why the invention is
  non-obvious. Be honest about what existing approaches do and do not do.
  Reference prior-art records from ../../prior-art/ where applicable.
-->

---

## 4. Inventive Date

**Earliest verifiable artifact:** TBD — file path or commit hash  
**Date of that artifact:** TBD — YYYY-MM-DD  
**Artifact type:** TBD — commit / design document / dated notebook / internal communication  
**How it establishes inventive date:** TBD

<!--
  The Inventive Date (defined in glossary.md § Inventive Date) is the earliest
  date on which the inventive concept was documented in a verifiable,
  timestamped artifact. It is an engineering record, not a legal determination.

  Requirements:
  - The artifact must be independently verifiable (a commit, a dated file in
    version control, a dated internal document).
  - Unrecorded memories or undated notes do not qualify.
  - If multiple artifacts exist, list the earliest one here and cross-reference
    the others in evidence.md.

  The invariant: Inventive Date ≤ Priority Date ≤ Filing Date.
  Priority Date and Filing Date are set by the patent system, not here.
-->

---

## 5. Technical Solution

### 5.1 Inventive Method

**TBD**

<!--
  Describe the method, system, or apparatus that solves the problem stated in
  Section 3. This is the core technical content of the disclosure.

  Structure this section as a numbered sequence of steps or components:
  1. What the system or method does first
  2. What it does next
  3. ...
  N. What the result is

  Write at a level of detail sufficient for a skilled engineer to implement
  the invention from this description alone (see Enablement, Section 10).
  Include pseudocode, algorithm descriptions, or data-flow descriptions where
  they add precision. Do not include actual production source code here —
  link to commits in the evidence section instead.
-->

### 5.2 Key Mechanisms

**TBD**

<!--
  List and briefly describe the distinct technical mechanisms that make the
  solution work. Each mechanism that is independently novel should be called
  out explicitly here, as it may become the basis for a separate claim.

  Example structure:
  - **Mechanism 1: [Name]** — What it does and why it is non-obvious.
  - **Mechanism 2: [Name]** — What it does and why it is non-obvious.
-->

### 5.3 Concrete Technical Result

**TBD**

<!--
  State the measurable or demonstrable result that the invention achieves.
  This must be specific and verifiable — not "improves performance" but
  "reduces the median time to detect an inventive pattern from N hours to M minutes
  at repository scale X."

  If the result is not yet measured, state the expected result and identify it
  as a hypothesis. A measured result is required before APPROVED status.
-->

---

## 6. Repository Evidence

<!--
  This section links to the Evidence Bundle in evidence.md. All artifacts listed
  here must also appear in evidence.md with full citation.

  Evidence types (from glossary.md § Evidence):
  - Commits (hash, date, repository path, what they show)
  - Benchmark results
  - Validation reports
  - Architecture records
  - Decision records (ADRs)
  - Demonstration recordings
  - Design documents with timestamps
-->

### 6.1 Primary Evidence Artifacts

| Artifact | Type | Date | Location | What It Establishes |
|---|---|---|---|---|
| TBD | Commit / Benchmark / Validation / ADR / Design Doc | YYYY-MM-DD | TBD path or hash | TBD |

### 6.2 Inventive-Date Evidence

**Earliest artifact establishing inventive date:** TBD (cross-reference Section 4)

### 6.3 Reduction-to-Practice Evidence

<!--
  Reduction to Practice (glossary.md § Reduction to Practice) requires at
  least one artifact showing the inventive method executing and producing the
  described result. A design document is not sufficient; a working implementation
  artifact is required.
-->

| Artifact | Date | What It Demonstrates |
|---|---|---|
| TBD | YYYY-MM-DD | TBD |

**Technology Readiness Level at time of disclosure:** TBD (TRL-1 through TRL-5 — see glossary.md § Technology Readiness Level)

---

## 7. Traceability

<!--
  Every invention must be traceable across all dimensions below.
  Gaps in any dimension are engineering deficiencies, not optional fields.
  (See glossary.md § Traceability and README.md Traceability Model.)
-->

| Dimension | Link | Location |
|---|---|---|
| Goal | TBD — which repository goal does this invention advance? | `.ai/goals/GOAL-{ID}.md` |
| Architecture | TBD — which architectural component implements this invention? | `.ai/architecture/{COMPONENT}.md` |
| Decision | TBD — which ADRs document the inventive choices made? | `.ai/decisions/ADR-{ID}.md` |
| Implementation | TBD — which commits or modules contain the implementation? | Git: `{hash}` |
| Validation | TBD — which validation artifacts confirm correct operation? | `../../validation/INV-{YEAR}-{SEQUENCE}/validation-report.md` |
| Evidence | See evidence.md | `./evidence.md` |
| Outcome | TBD — which measured outcomes demonstrate value? | `.ai/outcomes/{OUTCOME-ID}.md` |

---

## 8. Novelty Analysis

<!--
  Full novelty analysis belongs in novelty.md. This section contains a summary
  and a cross-reference. Do not duplicate the full analysis here.

  Novelty (glossary.md § Novelty) is assessed against known prior-art references.
  It is a technical assessment, not a legal conclusion.
-->

### 8.1 Novelty Summary

**TBD**

<!--
  In two to five sentences: what is the specific combination of problem, method,
  and result that has not been previously disclosed? What prior approaches come
  closest, and what do they lack?
-->

### 8.2 Closest Prior Art

| Reference | What It Discloses | Key Difference |
|---|---|---|
| TBD — REF-{YEAR}-{SEQUENCE} | TBD | TBD |

**Full novelty analysis:** `./novelty.md`  
**Prior-art index:** `../../prior-art/index.md`

---

## 9. Prior Art Known So Far

<!--
  List all prior-art references reviewed, even those found not to be material.
  A reference is material if it discloses any element of the inventive method.
  A reference is relevant but not material if it addresses the same problem domain
  without disclosing the inventive approach.

  Each reference must have a record in ../../prior-art/{REF-ID}.md.
-->

| Reference ID | Source | Date | Material? | Notes |
|---|---|---|---|---|
| TBD | TBD | YYYY-MM-DD | Yes / No | TBD — brief summary of relevance |

**Prior-art search status:** TBD — Initial / Ongoing / Complete  
**Search scope:** TBD — databases, keyword sets, date ranges used

---

## 10. Enablement Notes

<!--
  Enablement (glossary.md § Enablement) is the property of this disclosure
  whereby a skilled engineer, reading it without access to the original inventors,
  could implement the invention and reproduce the described result.

  The questions below must be answerable from this document alone. If any
  answer is "no," the disclosure must be revised before advancing to REVIEW.
-->

| Enablement Question | Answer | Notes |
|---|---|---|
| Can a skilled engineer identify the problem from Section 3 without prior knowledge? | TBD Yes / No | TBD |
| Can a skilled engineer reproduce the method from Section 5 without asking the inventors? | TBD Yes / No | TBD |
| Are all key mechanisms in Section 5.2 described with enough detail to implement? | TBD Yes / No | TBD |
| Is the concrete result in Section 5.3 measurable or demonstrable from the evidence? | TBD Yes / No | TBD |
| Are edge cases and failure modes documented or explicitly scoped out? | TBD Yes / No | TBD |

**Known enablement gaps:** TBD — list anything a reviewer would need to ask about

---

## 11. Implementation Evidence

<!--
  This section bridges Section 6 (evidence links) to Section 10 (enablement).
  It confirms that the implementation artifacts are sufficient to support the
  enablement claim and to establish reduction to practice.
-->

**Reference implementation exists:** TBD Yes / No / Partial  
**Reference implementation location:** TBD — commit hash or file path  
**Technology Readiness Level:** TBD (TRL-1 through TRL-5)

If no reference implementation exists, describe the current implementation state
and the gap between current state and a complete demonstration:

**TBD**

---

## 12. Reduction to Practice

<!--
  Reduction to Practice (glossary.md § Reduction to Practice) is established by
  linking this disclosure to artifacts that show the inventive method producing
  the described result.

  If reduction to practice has not yet occurred, state the current status and
  the planned path to establishing it.
-->

**Reduction to practice established:** TBD Yes / No / Partial  
**Date established (if yes):** TBD — YYYY-MM-DD  
**Establishing artifact:** TBD — commit hash, benchmark file, or validation report

If not yet established, describe the current prototype status and what remains:

**TBD**

---

## 13. Human Review

<!--
  Human Review (glossary.md § Human Review) is the required gate before this
  disclosure advances from REVIEW to APPROVED. This section records the outcome
  of each review cycle.

  Do not fill in this section yourself. It is completed by the reviewer.
-->

| Review Cycle | Date | Reviewer | Outcome | Feedback Summary |
|---|---|---|---|---|
| 1 | TBD | TBD | Approve / Revise / Reject | TBD |

**Review instructions for the reviewer:**

1. Confirm the problem in Section 3 is real and specific.
2. Confirm the method in Section 5 is technically complete and non-obvious.
3. Confirm the result in Section 5.3 is measurable and demonstrated by the evidence.
4. Confirm enablement: could you implement this from Section 5 alone?
5. Confirm all traceability links in Section 7 resolve to real artifacts.
6. Confirm the Inventive Date in Section 4 is supported by a verifiable artifact.
7. Note any missing prior-art references that should be added to Section 9.
8. Record your outcome above and update Filing Status accordingly.

---

## 14. Open Questions

<!--
  List any unresolved technical, strategic, or legal questions that affect this
  disclosure. Open questions do not block REVIEW status, but unresolved questions
  that affect claim scope or enablement must be resolved before APPROVED.

  Each question should reference who is responsible for resolving it and a
  target resolution date where known.
-->

1. TBD — [Question]. Responsible: TBD. Target: YYYY-MM-DD.

---

## 15. Future Work

<!--
  Describe known extensions, improvements, or follow-on inventions that are
  not covered by this disclosure. Capturing them here preserves continuation
  opportunities and prevents accidental disclosure of related novel ideas
  before a filing decision is made.
-->

- TBD — potential continuation opportunity: TBD
- TBD — known limitation that a follow-on invention could address: TBD

---

## 16. Non-Goals and Scope Exclusions

<!--
  Explicitly state what this invention does NOT cover. This prevents claim
  scope from being read too broadly and documents deliberate decisions to
  exclude certain applications or mechanisms.
-->

- This disclosure does not cover: TBD
- This disclosure does not address the following related problems: TBD

---

## DRAFT → REVIEW Readiness Checklist

<!--
  Complete every item before changing Filing Status to REVIEW.
  An incomplete checklist means the disclosure is not ready for Human Review.
-->

**Filing Status may be set to `REVIEW` only when all boxes are checked.**

### Completeness

- [ ] Title is one sentence, action-oriented, and technically precise (Section 1)
- [ ] Summary accurately describes the problem, method, and result in ≤ 4 sentences (Section 2)
- [ ] Problem statement is specific and measurable; prior approaches are documented (Section 3)
- [ ] Inventive Date is identified and supported by at least one verifiable artifact (Section 4)
- [ ] Technical method is described in enough detail for a skilled engineer to implement (Section 5.1)
- [ ] Key mechanisms are individually identified (Section 5.2)
- [ ] Concrete technical result is stated; expected or measured (Section 5.3)
- [ ] No section is left blank or contains only "TBD"

### Evidence

- [ ] At least one evidence artifact is linked and resolves to a real file or commit (Section 6.1)
- [ ] Inventive-date artifact is identified and its date is verifiable (Section 6.2)
- [ ] evidence.md exists and is consistent with Section 6 (cross-reference check)
- [ ] Technology Readiness Level is assessed (Section 6.3)

### Traceability

- [ ] All seven traceability dimensions in Section 7 have a link or explicit "Not applicable" entry
- [ ] Goal link resolves to a real goal record in `.ai/goals/`
- [ ] Architecture link resolves to a real architecture record in `.ai/architecture/`

### Novelty and Prior Art

- [ ] Novelty summary clearly states what is new (Section 8.1)
- [ ] At least one prior-art reference has been reviewed and documented (Section 9)
- [ ] A prior-art record exists in `../../prior-art/` for each reference listed
- [ ] novelty.md exists with full analysis (Section 8.2)

### Enablement

- [ ] All enablement questions in Section 10 are answered "Yes" or have a documented plan
- [ ] Known enablement gaps are listed and assigned for resolution

### Reduction to Practice

- [ ] Reduction-to-practice status is assessed (Section 12)
- [ ] If established: establishing artifact is linked and resolves
- [ ] If not established: a clear path to establishment is documented

### Legal and Process

- [ ] Legal notice is present and unmodified (top of document)
- [ ] Filing Status is still `DRAFT` (do not set to `REVIEW` until this checklist is complete)
- [ ] IP Readiness Level is updated to IRL-3 (evidenced) or higher
- [ ] Revision History has at least one entry with date and author
- [ ] Metadata block is complete (all TBD values replaced)
- [ ] All template instruction comments have been removed

---

*Template version: 1.0 — 2026-06-28*  
*Canonical terminology: `../../glossary.md`*  
*Do not modify this TEMPLATE file. Copy it to `inventions/INV-{YEAR}-{SEQUENCE}/disclosure.md` before editing.*
