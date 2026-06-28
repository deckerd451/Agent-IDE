# Intellectual Property Glossary

## Purpose

This document is the single source of truth for all technical terminology used by the
Intellectual Property subsystem of Agent IDE. Every document in `.ai/intellectual-property/`
must reference definitions from this glossary. No other document may introduce or redefine
a canonical term. When a new term is needed, this file must be updated in the same commit
that introduces the term.

This is an engineering glossary, not a legal glossary. Definitions are written to support
deterministic use by engineers, inventors, and AI systems operating within Agent IDE. Legal
interpretations of any term are the domain of patent counsel and are outside the scope of
this document.

## Audience

- Engineers building or extending Agent IDE
- Inventors documenting novel technical work
- Patent counsel consuming engineering disclosures
- AI systems operating within Agent IDE that read, write, or validate IP artifacts
- Future contributors who have not been part of earlier design discussions

## Status

`ACTIVE — v1.0 — 2026-06-28`

## Dependencies

| Document | Relationship |
|---|---|
| `.ai/intellectual-property/README.md` | Parent document; establishes subsystem structure this glossary serves |

This glossary has no term-level dependencies. It is the root vocabulary document.

## Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-06-28 | Agent IDE Architect | Initial glossary — all terms introduced in this version |

---

## Terminology Rules

1. Every definition must be self-contained. A reader must be able to understand a term
   without reading any other term first. Cross-references to related terms are permitted
   but must never be required for comprehension.

2. No circular definitions. If term A references term B, term B must not require term A
   to be understood.

3. If two terms are commonly confused, the definition of each must include an explicit
   disambiguation against the other.

4. If a term has a well-known meaning in patent law that differs from its engineering
   meaning in this subsystem, note the difference and clarify which meaning applies here.

5. Definitions must be deterministic. Two readers — or two AI systems — applying the same
   definition to the same artifact must reach the same conclusion about whether the artifact
   satisfies the definition.

6. If a term is expected to evolve as the subsystem matures, document the expected
   direction in the **Future Evolution** field.

---

## Section 1 — Repository IP

---

### Repository IP

**Canonical Definition**
The complete set of novel technical ideas, implementations, methods, processes, and
artifacts that originate from work performed within a software repository and that may
have strategic, commercial, or defensive value. Repository IP is version-controlled,
continuously discovered, and maintained alongside source code as a first-class engineering
artifact.

**Why It Exists**
Software repositories generate novel technical work continuously, but that work is rarely
captured in a form that supports future patent filings, licensing, standards contributions,
or defensive publications. Repository IP is the subsystem that closes that gap by treating
IP management as an engineering discipline rather than a retrospective legal exercise.

**Related Terms**
Intellectual Property, Invention, Engineering Artifact, Innovation Lifecycle

**Example Usage**
"The Agent IDE repository IP includes novel methods for continuous invention discovery,
AI-assisted traceability, and evidence-preserving validation pipelines."

**Non-Examples**
- Third-party libraries consumed by the repository are not Repository IP.
- Ideas discussed but never reduced to an implementation artifact are not Repository IP
  until an Invention Disclosure is created.

**Future Evolution**
As Agent IDE matures, Repository IP may expand to cover cross-repository inventions and
organization-level IP portfolios spanning multiple codebases.

---

### Intellectual Property

**Canonical Definition**
Within this subsystem, Intellectual Property (IP) refers specifically to technical ideas
and implementations that are novel, non-obvious, and have potential strategic value. The
term encompasses patents, defensive publications, trade secrets, and standards
contributions. It does not include copyright (which attaches automatically to all code)
or trademark.

**Why It Exists**
The term is defined here to bound its scope within Agent IDE. Without this bounding,
"IP" becomes ambiguous between legal usage (all proprietary rights) and engineering usage
(strategic technical innovations worth actively managing).

**Related Terms**
Repository IP, Invention, Patent Family, Trade Secret, Defensive Publication

**Example Usage**
"The IP subsystem tracks inventions from initial disclosure through filing, not copyright
or trademark matters."

**Non-Examples**
- Source code as such is not IP in this subsystem's scope — it is a copyright artifact.
  Source code becomes relevant here only as Evidence of an Invention.

**Future Evolution**
If Agent IDE expands to support open-source licensing compliance, that scope would be
handled by a separate subsystem rather than extending this definition.

---

### Engineering Artifact

**Canonical Definition**
Any file, record, diagram, report, or structured output produced during software
engineering work that is version-controlled and can serve as evidence of technical
decisions, inventive activity, or implementation state. Engineering artifacts include
source code, architecture documents, decision records, validation reports, benchmarks,
figures, and invention disclosures.

**Why It Exists**
Repository IP treats IP records as engineering artifacts rather than legal documents.
This framing determines how they are managed: version-controlled, reviewed, validated,
and continuously improved — not filed away after a single review cycle.

**Related Terms**
Evidence, Invention Disclosure, Repository Intelligence

**Example Usage**
"An architecture decision record is an engineering artifact that can serve as evidence
of an inventive choice when linked to an Invention Disclosure."

**Future Evolution**
As AI systems become more active contributors within Agent IDE, AI-generated content
will need to be clearly marked within engineering artifacts to support inventorship
determinations.

---

### Innovation Lifecycle

**Canonical Definition**
The sequence of stages through which a technical idea progresses from initial observation
to mature, managed IP. Within Agent IDE the lifecycle stages are:

1. **Signal** — A Repository Intelligence Signal suggests potential novelty
2. **Disclosed** — An Invention Disclosure is created and linked to evidence
3. **Reviewed** — Engineers and counsel confirm the disclosure is enabling
4. **Filed** — A patent application, defensive publication, or trade-secret record is created
5. **Prosecuted** — For patents: office actions responded to, claims refined
6. **Resolved** — Granted, published, abandoned, or maintained as trade secret
7. **Maintained** — Active management: continuations, licensing, standards contributions
8. **Expired / Archived** — Term ended or strategic decision to abandon

**Why It Exists**
Defining the lifecycle creates deterministic stage transitions that AI systems and
engineers can validate against. A disclosure that has been in `DISCLOSED` state for
more than 90 days without a review is a process failure that can be surfaced automatically.

**Related Terms**
Invention Disclosure, Filing Status, IP Readiness Level, Continuation

**Example Usage**
"INV-2026-0001 is currently at the Reviewed stage of the Innovation Lifecycle; the next
action is a filing decision by end of Q3."

**Future Evolution**
Lifecycle stages may acquire SLA thresholds and automated escalation signals as the
subsystem matures.

---

## Section 2 — Inventions

---

### Invention

**Canonical Definition**
A novel, non-obvious technical solution to a specific engineering problem, implemented or
implementable using the described method, that produces a concrete technical result. An
invention in this subsystem is defined by its technical substance — the problem it solves,
the method it employs, and the result it achieves — not by its legal status.

**Why It Exists**
Distinguishing "invention" from "feature" or "improvement" is critical for deciding what
to track. Not every feature is an invention. An invention must solve a problem in a way
that is not an obvious next step from the current state of the art.

**Related Terms**
Invention Disclosure, Novelty, Prior Art, Reduction to Practice, Enablement

**Example Usage**
"The method by which Agent IDE continuously correlates repository commits to active
invention disclosures without human initiation is an invention — it solves the problem
of evidence loss using a novel automated traceability approach."

**Non-Examples**
- Applying a well-known algorithm to a new dataset is generally not an invention.
- A UI styling decision is not an invention unless the visual organization itself encodes
  a novel interaction paradigm with a concrete technical result.

**Future Evolution**
As AI-assisted development becomes more prevalent, the definition of inventorship will
evolve. This subsystem tracks the technical substance of inventions regardless of whether
the initial idea originated from a human or an AI system; inventorship determinations
remain a human and legal decision.

---

### Invention Disclosure

**Canonical Definition**
A structured engineering document that captures the technical substance of an invention
at a specific point in time, including the problem being solved, the method employed,
the result achieved, and links to implementation evidence. An Invention Disclosure is
the primary input to the patent family system and the legal filing process.

A complete Invention Disclosure includes:
- Problem statement
- Prior approaches and their limitations
- The inventive method (how the problem is solved)
- The concrete technical result
- At least one implementation example
- Links to evidence artifacts
- Inventive date estimate with supporting evidence

**Why It Exists**
Without a structured disclosure, inventions are lost in commit history. The disclosure
creates a durable, reviewable engineering record that can be handed to counsel without
requiring them to reconstruct the invention from source code.

**Related Terms**
Invention, Evidence Bundle, Enablement, Filing Status, Human Review

**Example Usage**
"INV-2026-0001 disclosure.md captures the method by which Agent IDE detects novel
patterns in repository commit sequences and surfaces them as candidate inventions."

**Non-Examples**
- A design document is not an Invention Disclosure unless it contains all required fields
  and is stored in the `inventions/` directory with a formal INV-ID.
- A Jira ticket or GitHub issue is not an Invention Disclosure.

**Future Evolution**
Disclosures may eventually include structured metadata fields consumed directly by
patent management systems, eliminating manual transcription to external tools.

---

### Novelty

**Canonical Definition**
The property of an invention whereby the specific combination of problem, method, and
result has not been previously published, patented, publicly demonstrated, or otherwise
placed into the prior art. Novelty in this subsystem is assessed against known prior art
references and documented in the `novelty.md` file for each invention. It is a
technical assessment, not a legal conclusion.

**Why It Exists**
Novelty assessment performed early — before filing — prevents wasted legal effort on
inventions that will be rejected on prior-art grounds and helps engineers understand
what is actually differentiating about their work.

**Related Terms**
Prior Art, Invention, Obviousness (see Future Evolution), Enablement

**Example Usage**
"The novelty analysis for INV-2026-0001 identifies three prior-art references that
address parts of the problem but none that combine continuous repository monitoring
with automated evidence correlation."

**Disambiguation from Obviousness**
Novelty asks: has this exact combination been done before? Obviousness asks: would a
skilled engineer have arrived at this solution as a routine next step? Both matter for
patent eligibility, but they are evaluated separately. This glossary does not define
"obviousness" as a canonical term because its evaluation is inherently a legal question;
engineering teams should flag potential obviousness concerns in the **Open Questions**
section of each disclosure and escalate to counsel.

**Future Evolution**
Automated prior-art watch services may generate novelty signals continuously, updating
the novelty assessment as new references are published.

---

### Reduction to Practice

**Canonical Definition**
The demonstration that an invention actually works as described, evidenced by a physical
implementation, a working software prototype, or a validated simulation. In this
subsystem, reduction to practice is established by linking an Invention Disclosure to
evidence artifacts (commits, benchmark results, demonstration recordings, or validation
reports) that show the inventive method producing the described result.

**Why It Exists**
Establishing the date of reduction to practice is critical for priority disputes and for
demonstrating enablement. Capturing this evidence in the repository at the time of
implementation — rather than reconstructing it later — is one of the core value
propositions of this subsystem.

**Related Terms**
Evidence, Evidence Bundle, Prototype, Enablement, Implementation Evidence

**Example Usage**
"The reduction-to-practice date for INV-2026-0001 is established by commit `a3f7b9c`
on 2026-04-12, which contains the first working implementation of the continuous
evidence correlation method and the benchmark results confirming its correctness."

**Non-Examples**
- A design document describing how an invention would work is not reduction to practice.
- A passing unit test for a stub implementation is not reduction to practice.

**Future Evolution**
As litigation support becomes a use case, the evidence standards for reduction to
practice may be elevated to require notarized timestamps or blockchain-anchored commits.

---

### Enablement

**Canonical Definition**
The property of an Invention Disclosure whereby a skilled engineer, reading the disclosure
without access to the original inventors, could implement the invention and reproduce the
described result. Enablement is an engineering quality criterion for disclosures, assessed
before filing. A disclosure that fails the enablement test is incomplete and must be
revised before it can proceed in the Innovation Lifecycle.

**Why It Exists**
Patent applications are rejected for lack of enablement if the specification does not
teach how to make and use the invention. Catching enablement failures at the disclosure
stage — rather than during prosecution — saves significant legal cost and avoids the
reputational risk of abandoned applications.

**Related Terms**
Invention Disclosure, Reduction to Practice, Prototype, Reference Implementation

**Example Usage**
"The enablement review for INV-2026-0001 found that the disclosure did not describe
how the system handles ambiguous repository signals; the disclosure was returned to the
inventor with a request to add a decision algorithm and a worked example."

**Future Evolution**
AI-assisted enablement checking — where an AI system attempts to implement the described
method from the disclosure alone and reports gaps — is a planned capability of Agent IDE.

---

### AI-Assisted Invention Discovery

**Canonical Definition**
The capability of Agent IDE to analyze repository activity — commits, architecture changes,
decision records, validation results, and Repository Intelligence Signals — and surface
candidate inventions for human review. AI-Assisted Invention Discovery proposes; it does
not disclose, file, or make inventorship determinations. Every candidate surfaced by the
system requires Human Review before an Invention Disclosure is created.

**Why It Exists**
Engineers rarely have time to monitor their own work for inventive content. AI-Assisted
Invention Discovery shifts the detection burden to the system, ensuring that novel
technical work is not overlooked simply because no one thought to write a disclosure.

**Related Terms**
Repository Intelligence Signal, Human Review, Invention Disclosure, Repository Intelligence

**Example Usage**
"Agent IDE surfaced a candidate invention when it detected that the same novel caching
pattern had been independently implemented in three separate modules over 30 days,
suggesting a general method worth disclosing."

**Non-Examples**
- AI-Assisted Invention Discovery does not search external patent databases. That
  function belongs to the Prior Art review workflow.

**Future Evolution**
Discovery precision will improve as the system accumulates labeled examples of
inventions vs. non-inventions from the repository's own history.

---

### Human Review

**Canonical Definition**
The required step in which a human engineer or inventor reviews an AI-generated candidate
invention, a draft Invention Disclosure, or a filing recommendation before any of these
advances in the Innovation Lifecycle. Human Review is a gate, not a formality. Its output
is one of: Approve, Revise (with specific feedback), or Reject (with rationale).

**Why It Exists**
AI systems operating within Agent IDE may propose but may not decide. Human Review
preserves human authority over all IP decisions and ensures that inventorship, strategic
value, and accuracy are assessed by a person with full context.

**Related Terms**
AI-Assisted Invention Discovery, Invention Disclosure, Filing Status, Innovation Lifecycle

**Future Evolution**
Human Review workflows may become structured forms within Agent IDE rather than
unstructured Markdown comments, enabling audit trails and SLA tracking.

---

## Section 3 — Patent Families

---

### Patent Family

**Canonical Definition**
A group of related Invention Disclosures that share a common technical core and are
managed together for strategic purposes. A patent family may contain a foundational
invention and one or more continuations, continuations-in-part, and divisionals that
extend or refine the original claims. Patent families are maintained in the
`patent-families/` directory.

**Why It Exists**
Individual inventions rarely capture the full scope of a novel technical system.
Managing related inventions as a family enables coordinated claim strategy, systematic
continuation planning, and coherent licensing and commercialization positioning.

**Related Terms**
Invention, Continuation, Continuation-in-Part, Divisional, Claim Strategy

**Example Usage**
"FAM-2026-0001 covers the core methods of Agent IDE's Repository IP subsystem,
including the discovery pipeline, evidence correlation, and traceability model.
Individual inventions within the family extend to specific algorithmic implementations
and UI interaction patterns."

**Disambiguation from Invention Family**
"Patent Family" refers to the legal and strategic grouping used for filing and
prosecution. "Invention Family" (defined below) refers to the engineering grouping of
related technical ideas before any filing decision has been made. An Invention Family
may become a Patent Family or may instead result in a defensive publication.

---

### Invention Family

**Canonical Definition**
An engineering-level grouping of related Invention Disclosures that address the same
technical problem domain from different angles or at different levels of abstraction.
An Invention Family exists before any filing decision and does not imply that a patent
application will be filed.

**Why It Exists**
Engineers naturally produce clusters of related ideas. Grouping them as an Invention
Family enables coordinated disclosure, prior-art review, and strategic decisions about
which inventions to patent, publish defensively, or maintain as trade secrets.

**Related Terms**
Patent Family, Invention Disclosure, Claim Strategy

**Future Evolution**
The distinction between Invention Family and Patent Family may collapse as the system
matures if all Invention Families are evaluated for filing systematically.

---

### Continuation

**Canonical Definition**
A follow-on patent application that claims priority to an earlier application in the
same Patent Family, uses the same specification, and pursues claims that were not
pursued in the original application. In this subsystem, continuation opportunities are
tracked in the `continuations/` directory and identified during claim strategy reviews.

**Why It Exists**
A single application rarely captures all patentable aspects of a complex system.
Continuations allow the portfolio to be extended as the system evolves, as new use cases
are identified, or as competitor products clarify which claims are commercially important.

**Related Terms**
Patent Family, Continuation-in-Part, Divisional, Claim Strategy

**Future Evolution**
Agent IDE may automatically flag continuation opportunities when new implementations
extend a previously filed invention.

---

### Continuation-in-Part

**Canonical Definition**
A follow-on patent application that claims priority to an earlier application but adds
new technical disclosure not present in the original. The new disclosure may be based on
implementations or improvements that post-date the original filing. Continuation-in-Part
applications introduce new matter and therefore establish a new priority date for the
added content.

**Why It Exists**
As Agent IDE evolves, implementations may be refined or extended in ways that represent
genuinely new inventive content. A Continuation-in-Part captures this new content while
preserving the priority date of the original core.

**Related Terms**
Continuation, Patent Family, Reduction to Practice

**Disambiguation from Continuation**
A Continuation reuses the original specification exactly and pursues different claims.
A Continuation-in-Part adds new technical content to the specification. The distinction
matters because the new content in a CIP does not benefit from the original priority date.

---

### Divisional

**Canonical Definition**
A patent application that is split from a parent application when a patent office
determines that the parent contains claims directed to more than one invention. A
Divisional pursues the claims that were not elected in the parent. The Divisional
claims the same priority date as the parent.

**Why It Exists**
Patent offices enforce unity-of-invention requirements. Divisionals are the mechanism
for preserving claims that are split out. Tracking them explicitly in the `continuations/`
directory ensures they are not abandoned by oversight.

**Related Terms**
Patent Family, Continuation, Claim Strategy, Filing Status

---

### Claim Strategy

**Canonical Definition**
The deliberate plan for what a Patent Family will and will not claim, at what breadth,
in which jurisdictions, and in which order across a sequence of applications. Claim
strategy is documented in the `claims-map.md` file for each Patent Family and is
updated as the technology evolves and as competitive and market intelligence informs
scope decisions.

**Why It Exists**
Without a documented claim strategy, related applications make inconsistent or
conflicting scope decisions. A well-designed claim strategy maximizes coverage,
minimizes prosecution risk, and preserves continuation opportunities.

**Related Terms**
Patent Family, Continuation, Divisional, Commercialization

**Example Usage**
"The claim strategy for FAM-2026-0001 is to file broad system claims in the parent
application and defer method claims for a continuation, preserving flexibility to
narrow scope if broad claims face prior-art rejection."

---

### Filing Status

**Canonical Definition**
The current stage of an Invention Disclosure or Patent Family application within the
Innovation Lifecycle. Valid Filing Status values are:

| Status | Meaning |
|---|---|
| `DRAFT` | Disclosure is being written; not yet ready for review |
| `REVIEW` | Disclosure is complete and awaiting Human Review |
| `APPROVED` | Disclosure approved; filing decision pending |
| `FILED` | Application submitted to a patent office or published defensively |
| `PROSECUTION` | Patent application under examination |
| `GRANTED` | Claims allowed and patent issued |
| `PUBLISHED` | Defensive publication completed |
| `ABANDONED` | Filing decision: not to pursue |
| `TRADE_SECRET` | Maintained as trade secret; not to be disclosed publicly |
| `ARCHIVED` | Term expired or superseded |

**Why It Exists**
Filing Status provides a deterministic state that AI systems and engineers can query
to understand the current disposition of every invention.

**Related Terms**
Innovation Lifecycle, Invention Disclosure, Patent Family, Human Review

---

## Section 4 — Prior Art

---

### Prior Art

**Canonical Definition**
Any public disclosure — patent, academic publication, conference presentation, open-source
code, product documentation, blog post, or standard — that was publicly available before
the priority date of an invention and that describes the same or a substantially similar
technical method. Prior Art is used to bound novelty claims and to design inventions that
are clearly differentiated from existing work.

**Why It Exists**
Prior Art review is the primary tool for strengthening inventions. Understanding what
already exists clarifies where genuine novelty lies and prevents filing applications
that will be rejected on prior-art grounds.

**Related Terms**
Novelty, Prior-Art Reference, Defensive Publication

**Example Usage**
"REF-2026-0003 is a prior-art reference: a 2019 academic paper describing automated
dependency analysis in software repositories. It is relevant to INV-2026-0001 but does
not describe continuous evidence correlation or AI-driven discovery, preserving the
novelty of those elements."

**Non-Examples**
- Internal, confidential technical documents that were never publicly disclosed are
  not Prior Art (though they may establish an inventive date for trade secret purposes).

---

### Prior-Art Reference

**Canonical Definition**
A specific, documented prior-art source stored in the `prior-art/` directory and
assigned a REF-ID. Each Prior-Art Reference record includes: source citation,
publication date, summary of relevant technical content, similarity analysis,
difference analysis, impact assessment, confidence rating, and recommendations
for how the relevant invention should be differentiated.

**Why It Exists**
Prior Art is only useful when it is analyzed, not merely listed. A Prior-Art Reference
record forces a structured comparison between each reference and the relevant inventions.

**Related Terms**
Prior Art, Novelty, Invention Disclosure

**Example Usage**
"REF-2026-0003 is filed under `prior-art/REF-2026-0003.md` and linked from the novelty
analysis of INV-2026-0001."

---

### Defensive Publication

**Canonical Definition**
A deliberate, public technical disclosure of an invention for the purpose of establishing
it as Prior Art, preventing competitors from patenting the same idea, without the cost or
disclosure obligations of filing a patent application. Defensive publications are recorded
in the Filing Status as `PUBLISHED` and their publication date and location are
preserved in the filing record.

**Why It Exists**
Not all inventions are worth patenting. Defensive publication is the appropriate strategy
for inventions that are important to keep in the public domain but are not worth the cost
of a patent filing, or where early publication prevents a competitor from obtaining a
blocking patent.

**Related Terms**
Prior Art, Filing Status, Trade Secret, Patent Family

**Disambiguation from Patent Filing**
A Defensive Publication intentionally places an invention into the prior art and
forecloses future patent protection for that invention. A Patent Filing seeks exclusive
rights. These strategies are mutually exclusive for the same invention.

---

## Section 5 — Evidence

---

### Evidence

**Canonical Definition**
Any artifact that documents the existence, date, implementation, or operation of an
invention at a specific point in time. Evidence in this subsystem is version-controlled
and stored or referenced in the `evidence/` directory. Evidence may include commits,
benchmark results, validation reports, screenshots, demonstration recordings,
architecture documents, and decision records.

**Why It Exists**
Evidence is the engineering record that supports every claim made in an Invention
Disclosure. Without evidence, disclosures are assertions. With evidence, they are
documented facts with a verifiable timeline.

**Related Terms**
Evidence Bundle, Implementation Evidence, Reduction to Practice, Engineering Artifact

---

### Evidence Bundle

**Canonical Definition**
The complete, organized collection of Evidence artifacts linked to a specific Invention
Disclosure, sufficient to establish inventive date, reduction to practice, and enablement
without reference to any other source. An Evidence Bundle is documented in the
`evidence.md` file of each invention's directory.

**Why It Exists**
Counsel and AI systems reviewing a disclosure should be able to establish the full
evidentiary picture from a single, organized record rather than by searching commit
history or asking inventors.

**Related Terms**
Evidence, Implementation Evidence, Reduction to Practice, Enablement

**Example Usage**
"The Evidence Bundle for INV-2026-0001 contains: three commits spanning 2026-04-01
to 2026-04-15 showing progressive implementation; benchmark results from 2026-04-16
showing correctness; and a validation report from 2026-04-17 confirming end-to-end
operation."

---

### Implementation Evidence

**Canonical Definition**
Evidence specifically documenting that an invention has been implemented in software —
as distinct from being described or designed. Implementation Evidence typically takes
the form of commits, test results, benchmark outputs, or demonstration recordings that
show the inventive method executing and producing the described result.

**Why It Exists**
Distinguishing implementation evidence from design evidence is important because
implementation evidence establishes Reduction to Practice while design evidence
establishes only conception. Both are valuable, but they play different roles in
establishing the inventive timeline.

**Related Terms**
Evidence, Reduction to Practice, Prototype, Validation

---

## Section 6 — Validation

---

### Validation

**Canonical Definition**
Within the IP subsystem, Validation refers to the process of confirming that an
Invention Disclosure is complete, accurate, enabling, and linked to sufficient evidence.
IP Validation is distinct from software validation (confirming that code behaves
correctly). IP Validation records are stored in the `validation/` directory.

**Why It Exists**
Treating IP Validation as an engineering process — with documented pass/fail criteria
and actionable feedback — catches disclosure deficiencies before they become expensive
problems in prosecution.

**Related Terms**
Enablement, Evidence Bundle, Human Review, Repository Validation

**Disambiguation from Repository Validation**
Repository Validation (defined in the Repository Intelligence subsystem) confirms
that software behaves correctly. IP Validation confirms that an Invention Disclosure
is complete and enabling. These are parallel but distinct processes.

---

### Repository Validation

**Canonical Definition**
The process managed by Agent IDE's Validation subsystem (`.ai/validation/`) that
confirms repository software artifacts meet defined quality, correctness, and
completeness criteria. Repository Validation results may serve as Implementation
Evidence for Invention Disclosures when they demonstrate that an inventive method
operates correctly.

**Why It Exists**
Repository Validation outputs are a natural source of Implementation Evidence.
Connecting the two subsystems allows validation runs to automatically contribute
to Evidence Bundles without additional manual work.

**Related Terms**
Validation, Evidence, Repository Intelligence

---

## Section 7 — Traceability

---

### Traceability

**Canonical Definition**
The documented, navigable linkage between an Invention Disclosure and each of the
following: the Goal it advances, the Architecture it is implemented in, the Decisions
that determined its design, the Implementation that realizes it, the Validation that
confirms it, the Evidence that establishes its timeline, and the Outcomes it produces.
Traceability is complete when every link exists and is navigable. Gaps in any link are
treated as engineering deficiencies.

**Why It Exists**
Traceability is the structural integrity check for the IP subsystem. It ensures that
every invention is grounded in real engineering work, that evidence is not lost, and
that the full technical story of an invention can be reconstructed by anyone — counsel,
investor, or AI system — without relying on the original inventors' memory.

**Related Terms**
Repository IP, Evidence Bundle, Repository Goals, Repository Architecture,
Repository Intelligence

**Example Usage**
"Traceability for INV-2026-0001 is complete: it links to GOAL-0003 (continuous IP
discovery), ARCH-0007 (repository intelligence pipeline), ADR-0012 (evidence
correlation design), commit `a3f7b9c`, VAL-0004 (evidence bundle validation),
and OUTCOME-0005 (first invention discovered without human initiation)."

---

### Dependency

**Canonical Definition**
A documented relationship between two artifacts in which one artifact cannot be
fully understood, evaluated, or used without reference to the other. Dependencies
in this subsystem are declared in the front matter of every document and must be
kept current. Circular dependencies between documents are prohibited.

**Why It Exists**
Explicit dependency declarations make the subsystem navigable and allow AI systems
and engineers to identify what must be read or updated when a document changes.

**Related Terms**
Traceability, Engineering Artifact, Canonical Vocabulary

---

### Canonical Vocabulary

**Canonical Definition**
The set of terms defined in this glossary that have a single, authoritative meaning
within the Intellectual Property subsystem. A term is part of the Canonical Vocabulary
when it appears in this file with a definition. No other document may redefine a
Canonical Vocabulary term. New terms must be added to this glossary before being used
in any other document.

**Why It Exists**
Ambiguous terminology creates inconsistency between documents, between human and AI
readers, and between engineering teams and counsel. A single, authoritative vocabulary
eliminates that ambiguity.

**Related Terms**
Glossary, Dependency, Engineering Artifact

---

### Revision History

**Canonical Definition**
A dated, ordered log of material changes to a document, maintained in the document's
front matter. Every entry includes version, date, author, and a concise summary of
what changed. Revision History enables readers to understand the evolution of a
document's content and to reconstruct the state of the document at any point in time
using the underlying version control system.

**Why It Exists**
Documents in this subsystem are long-lived engineering artifacts. Revision History
makes the document's evolution navigable without requiring readers to inspect git
history directly.

**Related Terms**
Engineering Artifact, Filing Status, Innovation Lifecycle

---

## Section 8 — Prototypes and Implementations

---

### Prototype

**Canonical Definition**
A working but incomplete implementation of an invention, sufficient to demonstrate that
the inventive method produces the described result. In this subsystem, prototypes are
classified by maturity level (see Technology Readiness Level). A prototype at any level
constitutes Implementation Evidence and contributes to the Evidence Bundle.

**Why It Exists**
Prototypes create the evidence of Reduction to Practice. The earlier a prototype is
built and documented, the stronger the evidence of inventive date and the more complete
the Evidence Bundle.

**Related Terms**
Reduction to Practice, Implementation Evidence, Reference Implementation,
Technology Readiness Level

---

### Reference Implementation

**Canonical Definition**
A complete, correct, documented implementation of an invention that serves as the
authoritative example of how the invention works. A Reference Implementation is
sufficient for a skilled engineer to reproduce the invention without assistance.
It is stronger evidence than a Prototype and is the minimum standard for Enablement
in a patent application.

**Why It Exists**
"Reference Implementation" creates a distinct, named quality bar above "prototype"
and below "production." This distinction matters for planning engineering investment
in IP support.

**Related Terms**
Prototype, Enablement, Technology Readiness Level, IP Readiness Level

---

### Technology Readiness Level

**Canonical Definition**
A classification of implementation maturity using a five-level scale adapted for
software invention purposes:

| Level | Label | Description |
|---|---|---|
| TRL-1 | Concept Prototype | Core method demonstrated in isolation, non-production code |
| TRL-2 | Minimum Viable Prototype | End-to-end path works; not robust or performant |
| TRL-3 | Reference Implementation | Complete, correct, documented; enables reproduction |
| TRL-4 | Litigation-Ready Implementation | Fully evidenced, performance-validated, audit-ready |
| TRL-5 | Production Implementation | Deployed, maintained, operationally validated |

**Why It Exists**
TRL provides a shared language for planning the engineering investment required to
strengthen IP evidence. Moving from TRL-1 to TRL-3 is typically sufficient for
filing; TRL-4 and TRL-5 support litigation and commercialization.

**Related Terms**
Prototype, Reference Implementation, IP Readiness Level, Evidence Bundle

---

### IP Readiness Level

**Canonical Definition**
A classification of an Invention Disclosure's completeness and evidentiary strength:

| Level | Label | Criteria |
|---|---|---|
| IRL-1 | Signal | Repository Intelligence Signal raised; no disclosure yet |
| IRL-2 | Draft Disclosure | Disclosure in progress; no evidence links yet |
| IRL-3 | Evidenced Disclosure | Complete disclosure with at least one Evidence artifact |
| IRL-4 | Reviewed Disclosure | Human Review complete; filing decision pending |
| IRL-5 | Filed | Application submitted or Defensive Publication complete |

**Why It Exists**
IP Readiness Level provides a complementary view to Technology Readiness Level.
An invention can be at TRL-3 but only IRL-2 (good prototype, no disclosure written).
Tracking both levels surfaces the gap between engineering work and IP capture.

**Related Terms**
Technology Readiness Level, Invention Disclosure, Filing Status, Human Review

---

### Commercial Readiness

**Canonical Definition**
An assessment of whether an invention or Patent Family is sufficiently developed,
differentiated, and documented to support licensing negotiations, commercialization
discussions, or investment due diligence. Commercial Readiness is documented in the
`commercialization/` directory and considers: claim scope, competitive differentiation,
market applicability, and evidence strength.

**Why It Exists**
Commercial Readiness is distinct from Technical Readiness and IP Readiness. An
invention can be technically complete and fully disclosed but commercially immature
because the market context has not been analyzed or the licensing strategy has not
been defined.

**Related Terms**
Commercialization, Licensing, IP Readiness Level, Technology Readiness Level

---

## Section 9 — Commercialization and Standards

---

### Commercialization

**Canonical Definition**
The process of converting an invention or Patent Family into economic value through
product development, licensing, joint venture, acquisition, or standards adoption.
Within this subsystem, Commercialization analysis is documented in the
`commercialization/` directory and includes market analysis, licensing strategy,
and competitive landscape assessment.

**Why It Exists**
IP that is never commercialized provides only defensive value. Commercialization
analysis ensures that the engineering and legal investment in each invention is
matched to its economic potential.

**Related Terms**
Licensing, Commercial Readiness, Patent Family, Standards

---

### Licensing

**Canonical Definition**
The grant of specific rights to use an invention — under defined conditions, for
defined purposes, in defined jurisdictions, for a defined term — in exchange for
payment or other consideration. Licensing strategy is documented in the
`commercialization/{FAMILY}/licensing-strategy.md` file for each Patent Family.

**Why It Exists**
Licensing transforms a Patent Family from a legal asset into an economic one. Defining
the licensing strategy early — even before filing — informs claim scope decisions.

**Related Terms**
Commercialization, Patent Family, Claim Strategy

---

### Standards

**Canonical Definition**
Formal technical specifications published by a standards body (IEEE, IETF, ISO, W3C,
ECMA, and similar) that define interoperable methods, protocols, or interfaces.
In this subsystem, Standards contributions are tracked as a distinct IP disposition:
inventions that are contributed to a standards process are documented with their
contribution status and any associated patent licensing commitments (FRAND, RF, etc.).

**Why It Exists**
Contributing an invention to a standard is an IP decision with significant consequences
for licensing rights. Tracking it explicitly prevents accidental loss of licensing
rights through standards contribution without appropriate legal review.

**Related Terms**
Defensive Publication, Licensing, Patent Family, Filing Status

---

### Trade Secret

**Canonical Definition**
Technical information that has independent economic value by virtue of not being
generally known, and that is subject to reasonable efforts to maintain its secrecy.
Within this subsystem, Trade Secrets are inventions for which the Filing Status has
been set to `TRADE_SECRET` following a deliberate strategic decision. Trade Secret
records must not contain the actual secret technical content; they contain only
the category, protection measures, and review schedule.

**Why It Exists**
Some inventions are more valuable as trade secrets than as patents — particularly
when the implementation is not detectable in a competitor's product, or when
indefinite protection is preferred over the time-limited exclusivity of a patent.
Tracking trade secret decisions prevents accidental disclosure.

**Related Terms**
Filing Status, Defensive Publication, Licensing, Patent Family

**Important Note**
Trade secret protection is incompatible with patent filing and with Defensive Publication.
Once an invention is publicly disclosed in any form, trade secret protection is lost.
The decision to designate an invention as a Trade Secret must be reviewed by counsel
before any publication or filing occurs.

---

## Section 10 — Repository Intelligence Integration

---

### Repository Intelligence

**Canonical Definition**
The Agent IDE subsystem (`.ai/repository-intelligence/`) that continuously analyzes
the state of a repository — its code, architecture, decisions, history, and activity
patterns — to produce actionable intelligence for engineering and management decisions.
In the IP context, Repository Intelligence is the source of signals that initiate the
Invention Discovery workflow.

**Why It Exists**
Defining Repository Intelligence as a term in the IP glossary establishes the
integration point between the two subsystems. IP discovery is downstream of
Repository Intelligence signal generation.

**Related Terms**
Repository Intelligence Signal, AI-Assisted Invention Discovery, Repository Judgment

---

### Repository Intelligence Signal

**Canonical Definition**
A structured output from the Repository Intelligence subsystem indicating that a
pattern, artifact, or event in the repository may have IP relevance. A Repository
Intelligence Signal is the first stage of the Innovation Lifecycle. Signals are
unvalidated; they require Human Review before an Invention Disclosure is created.

**Why It Exists**
Distinguishing a Signal from a Disclosure is critical. A Signal is an automated
observation; a Disclosure is a human-validated engineering record. Conflating the
two would allow unvalidated AI observations to enter the formal IP record.

**Related Terms**
Repository Intelligence, AI-Assisted Invention Discovery, Innovation Lifecycle,
Human Review

**Example Usage**
"The Repository Intelligence subsystem generated Signal #47 on 2026-04-10, flagging
a novel commit pattern in the evidence correlation module. An engineer reviewed the
signal and created INV-2026-0001."

---

### Repository Judgment

**Canonical Definition**
The capability of Agent IDE to reason about the strategic state of a repository —
not just its current technical state — and to make or recommend decisions that affect
the repository's long-term trajectory. In the IP context, Repository Judgment
encompasses recommendations about which inventions to file, which to publish
defensively, and which to maintain as trade secrets.

**Why It Exists**
Repository Judgment elevates Agent IDE from a passive observer to an active strategic
advisor. Defining it here establishes that IP strategy recommendations are a form
of Repository Judgment, distinct from raw intelligence signals.

**Related Terms**
Repository Intelligence, AI-Assisted Invention Discovery, Human Review

---

### Repository Architecture

**Canonical Definition**
The set of architectural decisions, component designs, and system structures documented
in `.ai/architecture/` that define how the repository's software is organized and how
its components interact. In the IP context, Repository Architecture records serve as
engineering evidence of the inventive system's design and as the primary source of
architectural figures and diagrams for Invention Disclosures.

**Why It Exists**
Architecture documents are frequently the most complete, stable record of how an
invention is designed. Linking them explicitly to Invention Disclosures ensures they
are preserved as IP evidence and not treated as disposable design artifacts.

**Related Terms**
Traceability, Evidence, Engineering Artifact, Figure

---

### Repository Goals

**Canonical Definition**
The set of goal records maintained in `.ai/goals/` that document what the repository
is trying to achieve. In the IP context, every Invention Disclosure must link to at
least one Repository Goal, establishing that the invention is motivated by a real
engineering objective rather than being an abstract contribution with no grounding
in the repository's purpose.

**Why It Exists**
Grounding inventions in Repository Goals prevents the accumulation of speculative
disclosures that are not connected to actual engineering work. It also provides
commercial context: inventions that advance commercially significant goals are
stronger candidates for patent filing.

**Related Terms**
Traceability, Repository Architecture, Repository Outcomes

---

### Repository Outcomes

**Canonical Definition**
The measurable results documented in `.ai/outcomes/` that demonstrate the impact of
engineering work on the repository's goals. In the IP context, Repository Outcomes
serve as commercial evidence: they demonstrate that an invention produces real,
measurable value, strengthening the commercial case for filing and licensing.

**Why It Exists**
Outcomes are the evidence that an invention works in practice. Linking them to
Invention Disclosures closes the traceability chain from goal through architecture
through implementation through validation to measurable result.

**Related Terms**
Traceability, Repository Goals, Commercial Readiness

---

## Section 11 — Documents and Figures

---

### Figure

**Canonical Definition**
A diagram, schematic, or visual representation that illustrates an architectural
concept, inventive method, or system structure. In this subsystem, Figures are stored
in the `figures/` directory, assigned FIG-IDs, and rendered as Mermaid diagrams
whenever the diagram type is supported. Figures are referenced from Invention
Disclosures, Patent Family overviews, and architecture records.

**Why It Exists**
Figures in patent applications are described formally as drawing elements. Maintaining
figures as version-controlled, Mermaid-source documents allows them to be updated,
reviewed, and rendered consistently across engineering and legal contexts.

**Related Terms**
Mermaid Diagram, Invention Disclosure, Engineering Artifact

---

### Mermaid Diagram

**Canonical Definition**
A diagram defined in Mermaid syntax (a text-based diagramming language rendered
natively by GitHub, GitLab, and most Markdown environments) and embedded in or
linked from a document in this subsystem. Mermaid Diagrams are the preferred figure
format because they are version-controlled, diffable, and AI-readable.

**Why It Exists**
Defining Mermaid Diagram as a canonical term establishes it as the required format
for all diagrams in this subsystem — not a preference but a standard. This ensures
that no figure is stored only as a binary image file that cannot be reviewed,
version-controlled, or read by AI systems.

**Related Terms**
Figure, Engineering Artifact

---

### Research Question

**Canonical Definition**
An open technical question whose answer would materially affect an invention's scope,
enablement, claim strategy, or commercial potential. Research Questions are documented
in the **Open Questions** section of Invention Disclosures and in `research/` files
when they require extended investigation. A Research Question is closed when it is
answered with sufficient evidence to make a decision.

**Why It Exists**
Open questions that are never surfaced are the primary cause of missed continuation
opportunities and invalidated claims. Making them explicit as first-class artifacts
ensures they are tracked and resolved.

**Related Terms**
Invention Disclosure, Enablement, Claim Strategy

---

### Subsystem

**Canonical Definition**
A named, directory-scoped module within Agent IDE's `.ai/` structure that manages a
specific domain of repository intelligence or engineering support. Each Subsystem has
a `README.md`, a defined scope, documented dependencies on other subsystems, and
structured artifacts. The IP Subsystem is one of the core subsystems of Agent IDE.

**Why It Exists**
Defining Subsystem as a term enables precise cross-references between modules and
establishes that each subsystem is an independently navigable, self-documenting unit.

**Related Terms**
Repository Intelligence, Traceability, Engineering Artifact

---

## Consistency Audit

The following checks were performed on this glossary at time of initial publication:

| Check | Result |
|---|---|
| Duplicate concepts | None detected |
| Conflicting definitions | None detected |
| Undefined cross-references | None detected |
| Circular definitions | None detected |
| Terms used in README.md without definition | None detected |
| Terms defined here not yet used elsewhere | Several (by design — pre-defining for future documents) |

---

## Future Work

- Add mathematical formalism for Novelty and Enablement assessments in `appendices/`
- Define formal schemas for each glossary term to enable AI-readable structured queries
- Extend Section 10 with Repository Decisions and Backlog integration definitions
- Add a term for "Inventive Step" if counsel recommends distinguishing it from Novelty
- Add jurisdictional notes (US, EP, PCT) as an appendix once filing begins
- Automate consistency audits to run on every glossary commit

## Open Questions

1. Should "Obviousness" be added as a canonical term with an engineering-oriented
   definition, or should it remain out of scope as a purely legal question?
2. Is "FRAND" (Fair, Reasonable, and Non-Discriminatory licensing) worth defining
   now, given that standards contributions may be imminent?
3. Should "Inventorship" be defined here, given its strict legal meaning in US patent
   law (35 USC 116) and the emerging questions about AI inventorship?
4. Should the TRL scale be extended to six levels to separate "deployed" from
   "operationally validated under production load"?
5. As the glossary grows, should it be split into a structured index with per-term
   files, or maintained as a single document?
