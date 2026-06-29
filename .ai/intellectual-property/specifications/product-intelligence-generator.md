# Product Intelligence Generator Specification

## Purpose

This document is the engineering implementation blueprint for the deterministic
generator that produces `.ai/product-intelligence.json` and
`.ai/product-intelligence.md`. It implements the Product Intelligence Specification
(product-intelligence-specification.md) exactly as written. It does not modify that
specification; it translates it into precise implementation instructions.

---

## Status

`ACTIVE — v1.0 — 2026-06-29`

---

## Canonical Reference

All field derivation, validation, and output schema rules are defined in
`product-intelligence-specification.md`. This document specifies **how** to
implement those rules, not what they should be.

---

## Section 1 — Files Modified

### 1.1 New Files Created

| File | Purpose |
|---|---|
| `scripts/product-intelligence.mjs` | The generator script |
| `tests/product-intelligence.test.mjs` | Unit and integration tests |
| `.ai/product-intelligence.json` | Generated output (JSON) |
| `.ai/product-intelligence.md` | Generated output (Markdown) |

### 1.2 Existing Files Modified

| File | Change |
|---|---|
| `scripts/next-improvement.mjs` | Call `generateProductIntelligence` after `decision-ranking.json` is written; pass result to `renderImplementationPackage` |
| `scripts/context-package.mjs` | Read `product-intelligence.json` and inject `## Strategic Context` section |
| `package.json` | Add `"product:intelligence": "node scripts/product-intelligence.mjs"` to scripts |

### 1.3 Files NOT Modified

- `scripts/health.mjs` — Product Intelligence reads health; does not write it
- `scripts/strategy.mjs` — Product Intelligence reads strategy; does not write it
- `scripts/audit.mjs` — No change
- `scripts/backlog.mjs` — No change
- `src/App.tsx` — No change in this implementation

---

## Section 2 — New Script: `scripts/product-intelligence.mjs`

### 2.1 Module Structure

```
scripts/product-intelligence.mjs
│
├── imports
│   ├── node:fs/promises (readFile, writeFile, mkdir, stat)
│   └── node:path (join, resolve)
│
├── constants
│   ├── SCHEMA_VERSION = 1
│   ├── IMPLEMENTATION_VERB_PATTERN (regex)
│   ├── STOP_WORDS (Set)
│   ├── SUPPORTS_INDICATORS (array of strings)
│   └── WEAKENS_INDICATORS (array of strings)
│
├── helper functions (pure, exported for testing)
│   ├── mdSection(markdown, heading)
│   ├── firstNonBlankLine(text)
│   ├── normalizeSentence(text)
│   ├── stemWords(text)
│   ├── wordOverlap(textA, textB)
│   ├── bullets(text)
│   ├── classifyEvidenceDirection(text)
│   ├── stripBoilerplatePrefix(text)
│   ├── isImplementationVerb(text)
│   └── fileMtime(filePath)
│
├── derivation functions (pure, exported for testing)
│   ├── deriveProductThesis(goals)
│   ├── deriveCurrentProductBet(strategy, goals)
│   ├── deriveHighestRiskAssumption(health, architecture, goals, bet)
│   ├── deriveCurrentEvidence(health, quality, outcomes, decisions, backlog, bet)
│   ├── deriveHighestLeverageMilestone(strategy, goals, outcomes)
│   ├── deriveRepositoryAlignment(decisionRanking, bet)
│   ├── deriveStrategicRecommendation(alignment, backlog, bet, architecture)
│   └── runValidation(fields)
│
├── render functions (pure, exported for testing)
│   ├── renderProductIntelligenceJson(fields, inputTimestamps)
│   └── renderProductIntelligenceMd(fields)
│
└── export async function generateProductIntelligence(repositoryPath, options)
    └── if (main module) → generateProductIntelligence(process.cwd())
```

### 2.2 Import Declarations

```
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
```

No other imports. No imports from other scripts in this module. All helper logic
is self-contained in this file.

---

## Section 3 — Constants

### 3.1 `SCHEMA_VERSION`

```
const SCHEMA_VERSION = 1;
```

### 3.2 `IMPLEMENTATION_VERB_PATTERN`

Used by `isImplementationVerb()` to detect milestone-is-task warnings.

```
const IMPLEMENTATION_VERB_PATTERN =
  /^(add|fix|build|implement|update|create|wire|refactor|remove|resolve|address)\b/i;
```

### 3.3 `STOP_WORDS`

Used by `stemWords()` to remove common words before overlap computation.

```
const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'to','of','and','or','in','on','at','by','for','with','from',
  'that','this','which','it','its','not','no','do','does','did',
  'have','has','had','will','would','should','could','may','might',
  'as','if','so','but','than','then','when','where','how','what',
  'all','any','each','every','into','through','during','before',
  'after','between','while','about','against','through','during',
  'repository','agent','ide','intelligence','current','next',
]);
```

### 3.4 `SUPPORTS_INDICATORS`

```
const SUPPORTS_INDICATORS = [
  'passed','complete','ready','verified','high confidence',
  'implemented','worked','success','achieved','present',
  'consistent','no gaps','no risks','strong',
];
```

### 3.5 `WEAKENS_INDICATORS`

```
const WEAKENS_INDICATORS = [
  'failed','missing','incomplete','gap','risk','weak',
  'not implemented','broken','partial','contradiction','duplicate',
  'low confidence','fixme','bug','blocker','critical',
];
```

---

## Section 4 — Helper Functions

All helper functions are pure (no side effects, no file I/O). All are exported for
unit testing.

### 4.1 `mdSection(markdown, heading)`

Extract the body of a `##`-level section from a markdown string.

```
function mdSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(
    new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im')
  );
  return match?.[1]?.trim() ?? '';
}
```

Identical pattern to existing `mdSection` in `next-improvement.mjs`. Not imported
from that module; duplicated in this file to keep `product-intelligence.mjs`
dependency-free.

### 4.2 `firstNonBlankLine(text)`

Return the first line of `text` that is non-empty and does not start with `#`,
`-`, or `*`.

```
function firstNonBlankLine(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 3 && !/^[#\-*>]/.test(l))
    ?? '';
}
```

### 4.3 `normalizeSentence(text)`

Trim whitespace; remove trailing punctuation except `?` and `!`; collapse
internal whitespace to single spaces; truncate to 280 characters.

```
function normalizeSentence(text) {
  return text.replace(/\s+/g, ' ').trim().replace(/[.;,]$/, '').slice(0, 280);
}
```

### 4.4 `stemWords(text)`

Convert text to a set of lowercase stems after stop-word removal. Stems are
produced by stripping common suffixes: `ing`, `tion`, `ed`, `ly`, `er`, `s`
(in that order, applied once each if the result is at least 4 characters).

```
function stemWords(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/);
  const stems = new Set();
  for (const word of words) {
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    let stem = word;
    for (const suffix of ['ing', 'tion', 'ed', 'ly', 'er', 's']) {
      if (stem.endsWith(suffix) && stem.length - suffix.length >= 4) {
        stem = stem.slice(0, stem.length - suffix.length);
        break;
      }
    }
    stems.add(stem);
  }
  return stems;
}
```

### 4.5 `wordOverlap(textA, textB)`

Return the count of stems that appear in both `stemWords(textA)` and
`stemWords(textB)`.

```
function wordOverlap(textA, textB) {
  const stemsA = stemWords(textA);
  const stemsB = stemWords(textB);
  let count = 0;
  for (const stem of stemsA) if (stemsB.has(stem)) count++;
  return count;
}
```

### 4.6 `bullets(text)`

Return an array of bullet text values from a markdown string (lines starting with
`- ` or `* `, trimmed).

```
function bullets(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, '').trim());
}
```

### 4.7 `classifyEvidenceDirection(text)`

Classify a string as `"supports"`, `"weakens"`, or `"unknown"` using
`SUPPORTS_INDICATORS` and `WEAKENS_INDICATORS`.

```
function classifyEvidenceDirection(text) {
  const lower = text.toLowerCase();
  const weakens = WEAKENS_INDICATORS.some((indicator) => lower.includes(indicator));
  const supports = SUPPORTS_INDICATORS.some((indicator) => lower.includes(indicator));
  if (weakens && !supports) return 'weakens';
  if (supports && !weakens) return 'supports';
  if (weakens && supports) return 'weakens'; // weakening signal takes precedence
  return 'unknown';
}
```

### 4.8 `stripBoilerplatePrefix(text)`

Remove known generated preamble patterns from strategy/goals text before using
as a sentence value.

Patterns to strip (applied in order, stop after first match):
1. `/^The repository is currently focused on\s*/i`
2. `/^The current bet is\s*/i`
3. `/^We are betting that\s*/i`
4. `/^Currently,?\s*/i`

```
function stripBoilerplatePrefix(text) {
  const patterns = [
    /^The repository is currently focused on\s*/i,
    /^The current bet is\s*/i,
    /^We are betting that\s*/i,
    /^Currently,?\s*/i,
  ];
  for (const pattern of patterns) {
    const stripped = text.replace(pattern, '');
    if (stripped.length < text.length) return stripped.trim();
  }
  return text;
}
```

### 4.9 `isImplementationVerb(text)`

Return `true` if the first word of `text` matches `IMPLEMENTATION_VERB_PATTERN`.

```
function isImplementationVerb(text) {
  return IMPLEMENTATION_VERB_PATTERN.test(text.trim());
}
```

### 4.10 `fileMtime(filePath)`

Return the file modification time as an ISO 8601 string, or `null` if the file
does not exist.

```
async function fileMtime(filePath) {
  try {
    const s = await stat(filePath);
    return s.mtime.toISOString();
  } catch {
    return null;
  }
}
```

---

## Section 5 — Derivation Functions

All derivation functions are pure and synchronous. They receive already-read
string/object inputs and return plain values. They are exported for unit testing.

### 5.1 `deriveProductThesis(goals)`

**Input:** `goals` — string content of `.ai/goals.md`

**Algorithm:**
1. Call `mdSection(goals, 'Product Thesis')`.
2. Call `firstNonBlankLine()` on the result.
3. Call `normalizeSentence()` on the result.
4. If empty, return `{ text: null, source: '.ai/goals.md §Product Thesis', characterCount: 0 }`.
5. Return `{ text, source: '.ai/goals.md §Product Thesis', characterCount: text.length }`.

### 5.2 `deriveCurrentProductBet(strategy, goals)`

**Inputs:** `strategy` — string content of `.ai/strategy.md`; `goals` — string
content of `.ai/goals.md`

**Algorithm:**
1. Try `mdSection(strategy, 'Current Product Bet')`. Call `firstNonBlankLine()`.
   Call `stripBoilerplatePrefix()`. Call `normalizeSentence()`. If non-empty, use
   it with `source: '.ai/strategy.md §Current Product Bet'`.
2. If step 1 is empty, try `mdSection(goals, 'Current Focus')`.
   Call `firstNonBlankLine()`. Call `stripBoilerplatePrefix()`. Call
   `normalizeSentence()`. If non-empty, use it with
   `source: '.ai/goals.md §Current Focus'`.
3. If both are empty, return `{ text: null, source: null, normalized: true }`.
4. Return `{ text, source, normalized: true }`.

### 5.3 `deriveHighestRiskAssumption(health, architecture, goals, bet)`

**Inputs:** `health`, `architecture`, `goals` — strings; `bet` — string (the
`currentProductBet.text` or empty string if null)

**Algorithm:**
1. Extract risk candidates from three sources:
   - `bullets(mdSection(health, 'Risks'))` → tag each with
     `source: '.ai/repository-health.md §Risks'`
   - `bullets(mdSection(architecture, 'Known Gaps'))` → tag each with
     `source: '.ai/architecture.md §Known Gaps'`
   - `[firstNonBlankLine(mdSection(goals, 'What Not To Build'))]` → tag with
     `source: '.ai/goals.md §What Not To Build'` (only if non-empty)
2. Filter candidates:
   - Remove candidates where text matches `/^no .*risk/i` or `/^none/i`.
3. Score each candidate:
   - `highMarker`: text contains any of `/\b(fixme|broken|critical|blocker|missing)\b/i` → +10
   - `betOverlap`: `wordOverlap(candidate.text, bet)` → add overlap count
   - `finalScore = highMarker + betOverlap`
4. Sort by `finalScore` descending. Select the first.
5. If no candidates remain after filtering, return
   `{ text: null, source: null, evidenceBacked: false }`.
6. Return
   `{ text: selected.text, source: selected.source, evidenceBacked: true }`.

### 5.4 `deriveCurrentEvidence(health, quality, outcomes, decisions, backlog, bet)`

**Inputs:** `health`, `decisions`, `backlog` — strings; `quality` — parsed JSON
object or null; `outcomes` — array of outcome entries; `bet` — string

**Algorithm:**

Collect evidence items from each source:

**From `health`:**
- `mdSection(health, 'Intelligence Completeness')`: split by newlines; keep lines
  that start with `-`; each becomes an evidence item with
  `source: '.ai/repository-health.md §Intelligence Completeness'`
- `mdSection(health, 'Risks')`: bullets → evidence items with
  `source: '.ai/repository-health.md §Risks'`

**From `quality` (JSON):**
- `quality.overallScore`: if ≥ 80, emit
  `{ text: 'Intelligence quality score is ${quality.overallScore}/100', direction: 'supports', source: '.ai/intelligence-quality.json' }`
  else emit with `direction: 'weakens'`
- `quality.canonicalIntelligenceQuality.completenessState`: if `'Complete'` or
  `'Strong'`, emit supports; if `'Partial'` or `'Missing'`, emit weakens

**From `outcomes`:**
- Filter to entries where `outcome === 'implemented'` and
  `promptQuality === 'worked'`; take up to 3 most recent; emit each as supports
  with `source: '.ai/outcomes.json'`

**From `decisions`:**
- Check for presence of `/no LLM|local.first|deterministic/i` in decisions text;
  if present, emit one supports item: `'Architectural constraints (local-first, deterministic, no LLM) are in place'`
  with `source: '.ai/decisions.md'`

**From `backlog`:**
- `bullets(mdSection(backlog, 'Prioritized Backlog'))`: take up to 5; each is
  `unknown` direction (open work, direction not determinable); `source: '.ai/backlog.md §Prioritized Backlog'`

**Classification:** For each item not already classified, call
`classifyEvidenceDirection(text)` to assign direction.

**Override:** If a health risk item contains `/no .*risk/i`, it is `supports`.

**Return:**
```
{
  supports: [...items with direction 'supports'],
  weakens:  [...items with direction 'weakens'],
  unknown:  [...items with direction 'unknown'],
}
```

### 5.5 `deriveHighestLeverageMilestone(strategy, goals, outcomes)`

**Inputs:** `strategy`, `goals` — strings; `outcomes` — array of outcome entries

**Algorithm:**
1. Try `mdSection(strategy, 'Current Experiment')`. Call `firstNonBlankLine()`.
   Call `normalizeSentence()`. If non-empty and not starting with an implementation
   verb, use it with `source: '.ai/strategy.md §Current Experiment'`,
   `milestoneIsTaskWarning: false`.
2. If step 1 produces text that starts with an implementation verb, still use it
   but set `milestoneIsTaskWarning: true`.
3. If step 1 is empty, extract success criteria from
   `bullets(mdSection(goals, 'Success Criteria'))`. Filter to criteria not matched
   by any recent `implemented` + `worked` outcome (match = `wordOverlap(criterion,
   outcome.recommendationTitle) >= 2`). Take the first unmatched criterion.
   Use `source: '.ai/goals.md §Success Criteria'`, check
   `isImplementationVerb()` for warning.
4. If step 3 is empty, derive from `mdSection(goals, 'Current Focus')`.
   Append ` is reliably demonstrated` to the focus text. Use
   `source: '.ai/goals.md §Current Focus'`, `milestoneIsTaskWarning: false`.
5. Return
   `{ text, source, milestoneIsTaskWarning }`.

### 5.6 `deriveRepositoryAlignment(decisionRanking, bet)`

**Inputs:** `decisionRanking` — parsed JSON object or null; `bet` — string

**Algorithm:**
1. If `decisionRanking` is null or has no `selectedIssue`, return
   `{ verdict: 'Unknown', explanation: 'No selected candidate in decision-ranking.json.', selectedCandidateId: null, selectedCandidateTitle: null, betOverlapStems: 0 }`.
2. If `bet` is null or empty, return
   `{ verdict: 'Unknown', explanation: 'Current Product Bet is not defined.', selectedCandidateId, selectedCandidateTitle, betOverlapStems: 0 }`.
3. Extract `selectedCandidateId = decisionRanking.selectedIssue.id`,
   `selectedCandidateTitle = decisionRanking.selectedIssue.title`,
   `candidateEvidence = decisionRanking.selectedIssue.evidence ?? ''`.
4. Compute `betOverlapStems = wordOverlap(selectedCandidateTitle + ' ' + candidateEvidence, bet)`.
5. Read the `actionability` field from `decisionRanking.selectedIssue`
   (`'code-fixable'` | `'manual'` | `'validation-experiment'`).
6. **Verdict assignment:**
   - `betOverlapStems >= 3` AND `actionability === 'code-fixable'`
     → `"Strong Alignment"`
   - `betOverlapStems >= 1` OR `actionability === 'code-fixable'`
     → `"Moderate Alignment"`
   - Neither above
     → `"Weak Alignment"`
   - `selectedCandidateTitle` or `candidateEvidence` text is explicitly excluded
     by What Not To Build patterns read during `deriveCurrentEvidence`
     → `"No Alignment"`

   **Note:** The `"No Alignment"` check requires passing the `whatNotToBuild` text
   (extracted from `.ai/goals.md §What Not To Build` and
   `.ai/strategy.md §What Not To Build`) into this function as an additional
   parameter. If `wordOverlap(candidate text, whatNotToBuild) >= 3`, override
   verdict to `"No Alignment"`.

7. **Explanation construction:**
   - Strong: `'Selected candidate "${selectedCandidateTitle}" directly advances the Current Product Bet (${betOverlapStems} stem overlap).'`
   - Moderate: `'Selected candidate "${selectedCandidateTitle}" has indirect relation to the Current Product Bet (${betOverlapStems} stem overlap).'`
   - Weak: `'Selected candidate "${selectedCandidateTitle}" does not overlap with the Current Product Bet text.'`
   - No Alignment: `'Selected candidate "${selectedCandidateTitle}" is in scope of What Not To Build.'`
   - Unknown: as above.

8. Return `{ verdict, explanation, selectedCandidateId, selectedCandidateTitle, betOverlapStems }`.

### 5.7 `deriveStrategicRecommendation(alignment, backlog, bet, architecture)`

**Inputs:** `alignment` — result of `deriveRepositoryAlignment`; `backlog`,
`architecture` — strings; `bet` — string

**Algorithm:**
1. If `alignment.verdict` is `"Strong Alignment"` or `"Moderate Alignment"` or
   `"Unknown"`, return `null`.
2. For `"Weak Alignment"`:
   - `gap`: `'The selected candidate does not directly advance the Current Product Bet.'`
   - Find the first backlog bullet where `wordOverlap(bullet, bet) >= 2`.
     If found: `alternativeDirection: 'Consider "${bullet}" from .ai/backlog.md which more directly targets the Current Product Bet.'`,
     `evidenceSource: '.ai/backlog.md §Prioritized Backlog'`
   - If not found in backlog, try `bullets(mdSection(architecture, 'Known Gaps'))`.
     Same overlap check. If found, cite `.ai/architecture.md §Known Gaps`.
   - If nothing found, `alternativeDirection: 'No backlog or architecture gap with direct bet overlap found; review .ai/goals.md §Current Focus for strategic candidates.'`, `evidenceSource: '.ai/goals.md §Current Focus'`
3. For `"No Alignment"`:
   - `gap`: `'The selected candidate is excluded by What Not To Build.'`
   - Same alternative direction logic as step 2.
4. Return `{ gap, alternativeDirection, evidenceSource }`.

### 5.8 `runValidation(fields)`

**Input:** `fields` — the complete derived product intelligence object (all fields
populated or null before writing)

**Algorithm:** Check each validation rule from the specification §8 in order.
Return an array of finding objects. Empty array if no findings.

```
{ code: 'PI-V01', severity: 'BLOCKING', message: '...', field: 'productThesis' }
```

Rules to check (in order):

| Code | Condition | Severity | Field |
|---|---|---|---|
| PI-V01 | `fields.productThesis.text === null` | BLOCKING | productThesis |
| PI-V02 | `fields.currentProductBet.text === null` | BLOCKING | currentProductBet |
| PI-V03 | `fields.highestRiskAssumption.text === null` | WARNING | highestRiskAssumption |
| PI-V04 | `fields.currentEvidence.supports.length === 0` | WARNING | currentEvidence |
| PI-V05 | `fields.currentEvidence.weakens.length === 0` | WARNING | currentEvidence |
| PI-V06 | `fields.highestLeverageMilestone.milestoneIsTaskWarning === true` | WARNING | highestLeverageMilestone |
| PI-V07 | `fields.repositoryAlignment.verdict === 'Weak Alignment'` | INFO | repositoryAlignment |
| PI-V08 | `fields.repositoryAlignment.verdict === 'No Alignment'` | WARNING | repositoryAlignment |
| PI-V09 | any `inputTimestamps` value is >24 hours before `generatedAt` | WARNING | inputTimestamps |
| PI-V10 | any evidence item has `source` null or empty | BLOCKING | currentEvidence |
| PI-V11 | `fields.strategicRecommendation !== null` AND alignment is Strong/Moderate | INFO | strategicRecommendation |
| PI-V12 | `fields.productThesis.characterCount > 200` | WARNING | productThesis |

---

## Section 6 — `generateProductIntelligence(repositoryPath, options)`

### 6.1 Signature

```
export async function generateProductIntelligence(repositoryPath = process.cwd(), options = {})
```

`options` is reserved for future use (e.g., injecting pre-read file contents in
tests). Default: `{}`.

### 6.2 Algorithm

```
1. resolved = resolve(repositoryPath)
2. aiDir = join(resolved, '.ai')

3. Read all inputs in parallel (Promise.all):
   - goals      = readFile(join(aiDir, 'goals.md'), 'utf8')         catch ENOENT → ''
   - strategy   = readFile(join(aiDir, 'strategy.md'), 'utf8')      catch ENOENT → ''
   - health     = readFile(join(aiDir, 'repository-health.md'), 'utf8') catch ENOENT → ''
   - architecture = readFile(join(aiDir, 'architecture.md'), 'utf8') catch ENOENT → ''
   - decisions  = readFile(join(aiDir, 'decisions.md'), 'utf8')     catch ENOENT → ''
   - backlog    = readFile(join(aiDir, 'backlog.md'), 'utf8')       catch ENOENT → ''
   - qualityRaw = readFile(join(aiDir, 'intelligence-quality.json'), 'utf8') catch ENOENT → ''
   - rankingRaw = readFile(join(aiDir, 'decision-ranking.json'), 'utf8') catch ENOENT → ''
   - outcomesRaw = readFile(join(aiDir, 'outcomes.json'), 'utf8')   catch ENOENT → '[]'

4. Parse JSON inputs (catch parse errors → null):
   - quality = JSON.parse(qualityRaw) or null
   - decisionRanking = JSON.parse(rankingRaw) or null
   - outcomes = JSON.parse(outcomesRaw) or []

5. Collect inputTimestamps in parallel (Promise.all of fileMtime):
   - '.ai/goals.md', '.ai/strategy.md', '.ai/repository-health.md',
     '.ai/decision-ranking.json', '.ai/architecture.md',
     '.ai/decisions.md', '.ai/backlog.md', '.ai/outcomes.json'
   - Each keyed by its relative path

6. generatedAt = options.generatedAt ?? new Date().toISOString()
   (options.generatedAt is used by tests to inject a fixed timestamp)

7. Derive all fields (in order per Section 5):
   - productThesis           = deriveProductThesis(goals)
   - currentProductBet       = deriveCurrentProductBet(strategy, goals)
   - highestRiskAssumption   = deriveHighestRiskAssumption(health, architecture, goals, currentProductBet.text ?? '')
   - currentEvidence         = deriveCurrentEvidence(health, quality, outcomes, decisions, backlog, currentProductBet.text ?? '')
   - highestLeverageMilestone = deriveHighestLeverageMilestone(strategy, goals, outcomes)
   - whatNotToBuild          = mdSection(goals, 'What Not To Build') + ' ' + mdSection(strategy, 'What Not To Build')
   - repositoryAlignment     = deriveRepositoryAlignment(decisionRanking, currentProductBet.text ?? '', whatNotToBuild)
   - strategicRecommendation = deriveStrategicRecommendation(repositoryAlignment, backlog, currentProductBet.text ?? '', architecture)

8. Assemble fields object:
   fields = {
     productThesis, currentProductBet, highestRiskAssumption,
     currentEvidence, highestLeverageMilestone, repositoryAlignment,
     strategicRecommendation,
   }

9. validationFindings = runValidation(fields)

10. Determine productIntelligenceState:
    - 'blocked' if any finding has severity 'BLOCKING'
    - 'warning' if no BLOCKING but any WARNING
    - 'ready' otherwise

11. Build JSON output object:
    output = {
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      productIntelligenceState,
      ...fields,
      validationFindings,
      inputTimestamps,
    }

12. await mkdir(aiDir, { recursive: true })
13. await writeFile(join(aiDir, 'product-intelligence.json'), JSON.stringify(output, null, 2) + '\n')
14. await writeFile(join(aiDir, 'product-intelligence.md'), renderProductIntelligenceMd(output))

15. return output
```

### 6.3 Error Handling

- File read errors other than `ENOENT` are re-thrown.
- JSON parse errors set the parsed value to `null`; derivation functions handle
  null inputs gracefully (returning null fields and emitting appropriate validation
  findings).
- Write errors are re-thrown without catching.
- If `productIntelligenceState` is `'blocked'`, the JSON and Markdown files are
  still written. The blocked state is visible in the output; consumers detect it
  by reading `productIntelligenceState`.

---

## Section 7 — Render Functions

### 7.1 `renderProductIntelligenceJson(output)`

Implemented by `JSON.stringify(output, null, 2) + '\n'` in the generator. No
separate function required; the JSON structure is the output itself.

### 7.2 `renderProductIntelligenceMd(output)`

**Input:** the complete `output` object produced in step 11 above.

**Returns:** a string following exactly the markdown structure in
product-intelligence-specification.md §7.

Implementation (template literal pseudocode):

```
function renderProductIntelligenceMd(output) {
  const { productThesis, currentProductBet, highestRiskAssumption,
          currentEvidence, highestLeverageMilestone, repositoryAlignment,
          strategicRecommendation, validationFindings,
          productIntelligenceState, generatedAt } = output;

  const evidenceBullets = (items) =>
    items.length
      ? items.map((item) => `- ${item.text} *(${item.source})*`).join('\n')
      : '- None detected.';

  const findingsTable = validationFindings.length
    ? ['| Code | Severity | Field | Message |', '|---|---|---|---|',
       ...validationFindings.map((f) =>
         `| ${f.code} | ${f.severity} | ${f.field} | ${f.message} |`)
      ].join('\n')
    : 'No findings.';

  return [
    '# Product Intelligence',
    '',
    `Generated: ${generatedAt}`,
    `State: ${productIntelligenceState}`,
    '',
    '## Product Thesis',
    '',
    productThesis.text ?? '*(Not detected — see Validation Findings)*',
    '',
    `Source: ${productThesis.source ?? 'unavailable'}`,
    '',
    '---',
    '',
    '## Current Product Bet',
    '',
    currentProductBet.text ?? '*(Not detected — see Validation Findings)*',
    '',
    `Source: ${currentProductBet.source ?? 'unavailable'}`,
    '',
    '---',
    '',
    '## Highest-Risk Assumption',
    '',
    highestRiskAssumption.text ?? '*(No evidence-backed assumption found)*',
    '',
    `Source: ${highestRiskAssumption.source ?? 'unavailable'}`,
    '',
    '---',
    '',
    '## Current Evidence',
    '',
    '### Supports the Assumption',
    evidenceBullets(currentEvidence.supports),
    '',
    '### Weakens the Assumption',
    evidenceBullets(currentEvidence.weakens),
    '',
    '### Unknown',
    evidenceBullets(currentEvidence.unknown),
    '',
    '---',
    '',
    '## Highest-Leverage Milestone',
    '',
    highestLeverageMilestone.text ?? '*(Not derived)*',
    '',
    `Source: ${highestLeverageMilestone.source ?? 'unavailable'}`,
    highestLeverageMilestone.milestoneIsTaskWarning
      ? '\n> **Warning (PI-V06):** Milestone text begins with an implementation verb.'
      : '',
    '',
    '---',
    '',
    '## Repository Alignment',
    '',
    `**Verdict:** ${repositoryAlignment.verdict}`,
    '',
    `**Selected candidate:** ${repositoryAlignment.selectedCandidateTitle ?? 'None'}`,
    '',
    `**Explanation:** ${repositoryAlignment.explanation}`,
    '',
    '---',
    '',
    '## Strategic Recommendation',
    '',
    strategicRecommendation
      ? [strategicRecommendation.gap, '', strategicRecommendation.alternativeDirection].join('\n')
      : 'No strategic gap identified.',
    '',
    '---',
    '',
    '## Validation Findings',
    '',
    findingsTable,
    '',
  ].join('\n');
}
```

---

## Section 8 — Execution Order Inside Refresh Pipeline

### 8.1 Current `generateNextImprovement` call sequence

```
scripts/next-improvement.mjs :: generateNextImprovement(repositoryPath)
│
├── read all .ai/ inputs
├── chooseNextImprovementWithCandidates(...)
├── renderPrompt(...)
├── writeFile('.ai/next-improvement-prompt.md')
├── writeFile('.ai/decision-ranking.json')       ← PI reads this
└── writeFile('.ai/recommendation-trace.md')
```

### 8.2 Required insertion point

Product Intelligence must run **after** `decision-ranking.json` is written and
**before** the Implementation Package is read by `context-package.mjs` or the
Control Plane.

The insertion point is inside `generateNextImprovement`, after the
`writeFile('.ai/decision-ranking.json')` call and before the function returns.

### 8.3 Modification to `scripts/next-improvement.mjs`

**Import to add** (at top of file, after existing imports):
```
import { generateProductIntelligence } from './product-intelligence.mjs';
```

**Code to add** (in `generateNextImprovement`, after the `decision-ranking.json`
write and before `return`):

```javascript
// Generate Product Intelligence annotation.
// Failure is non-blocking: if product-intelligence.mjs throws,
// log the error and continue.
let productIntelligence = null;
try {
  productIntelligence = await generateProductIntelligence(resolved);
} catch (error) {
  console.error('[product-intelligence] Generation failed (non-blocking):', error.message);
}
```

**Return value change:** Add `productIntelligence` to the returned object:
```javascript
return { choice: selectedIssue, selectedIssue, candidates, decisionRanking,
         explanation: selectedIssue.explanation, prompt,
         filesRead: requiredFiles, productIntelligence };
```

### 8.4 Modification to `renderImplementationPackage`

The `renderImplementationPackage` function in `next-improvement.mjs` currently
has the signature:
```
function renderImplementationPackage(selected, details, ranking)
```

**New signature:**
```
function renderImplementationPackage(selected, details, ranking, productIntelligence = null)
```

**New `## Strategic Context` block** to inject immediately before
`## Selected Issue`:

```javascript
function renderStrategicContext(pi) {
  if (!pi || pi.productIntelligenceState === 'blocked') return '';
  const lines = [
    '## Strategic Context',
    '',
    `**Product Thesis:** ${pi.productThesis?.text ?? 'Not defined'}`,
    `**Current Product Bet:** ${pi.currentProductBet?.text ?? 'Not defined'}`,
    `**Repository Alignment:** ${pi.repositoryAlignment?.verdict} — ${pi.repositoryAlignment?.explanation}`,
    `**Highest-Leverage Milestone:** ${pi.highestLeverageMilestone?.text ?? 'Not derived'}`,
  ];
  if (pi.strategicRecommendation) {
    lines.push('');
    lines.push('## Strategic Gap');
    lines.push('');
    lines.push(pi.strategicRecommendation.gap);
    lines.push('');
    lines.push(`Alternative direction: ${pi.strategicRecommendation.alternativeDirection}`);
  }
  lines.push('');
  return lines.join('\n');
}
```

**Injection point in `renderImplementationPackage` template:** Insert
`${renderStrategicContext(productIntelligence)}` immediately before
`## Selected Issue\n${renderSelectedIssue(selected)}`.

The same `renderStrategicContext` function is used by `renderProductDecisionPackage`
and `renderValidationPackage` using the same injection point. The
`productIntelligence` parameter defaults to `null`, so existing callers without the
parameter continue to work without change.

**Propagation:** `renderPrompt(choice)` must accept and forward a
`productIntelligence` field:
```javascript
export function renderPrompt(choice, productIntelligence = null) {
  const selected = choice.selectedIssue ?? choice;
  // ...existing logic...
  if (selected.packageType === 'task-clarification') return renderTaskClarificationPackage(selected, ranking);
  if (selected.packageType === 'product-decision') return renderProductDecisionPackage(selected, details, ranking, productIntelligence);
  if (selected.packageType === 'validation-experiment') return renderValidationPackage(selected, details, ranking, productIntelligence);
  return renderImplementationPackage(selected, details, ranking, productIntelligence);
}
```

Call site in `generateNextImprovement`:
```javascript
const prompt = renderPrompt({ selectedIssue, decisionRanking }, productIntelligence);
```

---

## Section 9 — Context Package Integration

### 9.1 Modification to `scripts/context-package.mjs`

**Read `product-intelligence.json`** in `generateContextPackage`:

Add to the `readAiJson` calls:
```javascript
const pi = await readAiJson(aiDir, 'product-intelligence.json');
```

**Add `## Product Intelligence` section** after `## Decision Ranking` and before
`## Highest-Priority Issue`:

```javascript
'## Product Intelligence',
renderProductIntelligenceSection(pi),
'',
```

**Helper function:**
```javascript
function renderProductIntelligenceSection(pi) {
  if (!pi || pi.productIntelligenceState === 'blocked') {
    return 'Product Intelligence not available. Run `node scripts/product-intelligence.mjs`.';
  }
  return [
    `**Product Thesis:** ${pi.productThesis?.text ?? 'Not defined'}`,
    `**Current Product Bet:** ${pi.currentProductBet?.text ?? 'Not defined'}`,
    `**Repository Alignment:** ${pi.repositoryAlignment?.verdict}`,
    `**Highest-Leverage Milestone:** ${pi.highestLeverageMilestone?.text ?? 'Not derived'}`,
    pi.strategicRecommendation ? `**Strategic Gap:** ${pi.strategicRecommendation.gap}` : '',
  ].filter(Boolean).join('\n');
}
```

If `product-intelligence.json` does not exist, `readAiJson` returns `null`; the
section displays the "not available" message. No error is thrown.

---

## Section 10 — AI Handoff Integration

No code changes are required to `scripts/ai-handoff-validation.mjs`. Product
Intelligence flows into AI Handoff through `context-package.md` (which
`ai-handoff-validation.mjs` reads). The `## Product Intelligence` section injected
into `context-package.md` in Section 9 is therefore automatically included in
the AI Handoff evaluation input.

No additional changes.

---

## Section 11 — `package.json` Change

Add to the `scripts` block:
```json
"product:intelligence": "node scripts/product-intelligence.mjs"
```

Position: after `"next:improvement"`.

---

## Section 12 — Tests

### 12.1 New Test File: `tests/product-intelligence.test.mjs`

#### Group 1: Helper functions

| Test | Assertion |
|---|---|
| `mdSection` extracts section body | `mdSection('# Doc\n\n## Foo\nbar\nbaz\n\n## Other\nX', 'Foo') === 'bar\nbaz'` |
| `mdSection` returns empty string when heading absent | `mdSection('# Doc\n\n## Other\nX', 'Missing') === ''` |
| `firstNonBlankLine` skips headings and bullets | Returns first plain text line |
| `normalizeSentence` truncates to 280, strips trailing period | Pass 300-char string; result ≤ 280 chars and does not end with `.` |
| `stemWords` removes stop words | `stemWords('the repository is healthy').has('health') === true`, `stemWords('the repository is healthy').has('the') === false` |
| `wordOverlap` counts shared stems | `wordOverlap('add backlog filtering', 'filter the backlog items') >= 2` |
| `wordOverlap` returns 0 for unrelated strings | `wordOverlap('product thesis', 'fix test runner') === 0` |
| `bullets` extracts bullet items | |
| `classifyEvidenceDirection` classifies supports | Text with "passed" → `'supports'` |
| `classifyEvidenceDirection` classifies weakens | Text with "missing" → `'weakens'` |
| `classifyEvidenceDirection` classifies unknown | Text with no indicators → `'unknown'` |
| `classifyEvidenceDirection` weakens wins when both present | Text with "passed" and "failed" → `'weakens'` |
| `stripBoilerplatePrefix` strips known preamble | `stripBoilerplatePrefix('The repository is currently focused on making X') === 'making X'` |
| `isImplementationVerb` detects verb | `isImplementationVerb('Add backlog quality filtering') === true` |
| `isImplementationVerb` passes milestone | `isImplementationVerb('Repository handoff readiness reaches Ready') === false` |

#### Group 2: Derivation functions

| Test | Assertion |
|---|---|
| `deriveProductThesis` extracts thesis from goals | Valid goals.md → `{ text: 'Agent IDE...', characterCount: >0 }` |
| `deriveProductThesis` returns null when section absent | Empty goals → `{ text: null }` |
| `deriveCurrentProductBet` uses strategy primary | Strategy with §Current Product Bet → source is strategy |
| `deriveCurrentProductBet` falls back to goals §Current Focus | Strategy without bet → source is goals |
| `deriveCurrentProductBet` returns null when both absent | |
| `deriveCurrentProductBet` strips boilerplate prefix | `'The repository is currently focused on making X'` → text does not start with "The repository" |
| `deriveHighestRiskAssumption` selects risk by bet overlap | Health with two risks; one overlaps bet more → that one selected |
| `deriveHighestRiskAssumption` prefers FIXME/critical markers | Marker beats higher overlap |
| `deriveHighestRiskAssumption` returns null when no risks | Empty health → `{ text: null, evidenceBacked: false }` |
| `deriveCurrentEvidence` populates supports from quality score ≥ 80 | `quality.overallScore = 91` → supports contains quality entry |
| `deriveCurrentEvidence` populates weakens from quality score < 80 | `quality.overallScore = 55` → weakens contains quality entry |
| `deriveCurrentEvidence` includes implemented+worked outcomes in supports | `outcomes = [{ outcome: 'implemented', promptQuality: 'worked' }]` → supports entry present |
| `deriveCurrentEvidence` ignores non-worked outcomes | `outcome = 'failed'` → not in supports |
| `deriveCurrentEvidence` all evidence items have non-null source | Every returned item has `source` string |
| `deriveHighestLeverageMilestone` uses strategy §Current Experiment | |
| `deriveHighestLeverageMilestone` warns when experiment starts with verb | Text starts with "Add" → `milestoneIsTaskWarning: true` |
| `deriveHighestLeverageMilestone` falls back to goals §Success Criteria | |
| `deriveHighestLeverageMilestone` falls back to focus + appended text | Both experiment and criteria absent → text ends with "is reliably demonstrated" |
| `deriveRepositoryAlignment` returns Strong for ≥3 stem overlap + code-fixable | |
| `deriveRepositoryAlignment` returns Moderate for 1-2 overlap | |
| `deriveRepositoryAlignment` returns Weak for 0 overlap | |
| `deriveRepositoryAlignment` returns No Alignment when candidate matches What Not To Build | |
| `deriveRepositoryAlignment` returns Unknown when no decisionRanking | |
| `deriveStrategicRecommendation` returns null for Strong alignment | |
| `deriveStrategicRecommendation` returns null for Moderate alignment | |
| `deriveStrategicRecommendation` returns gap+alternative for Weak alignment | |
| `deriveStrategicRecommendation` finds alternative from backlog with overlap | |

#### Group 3: Validation

| Test | Assertion |
|---|---|
| `runValidation` emits PI-V01 when productThesis.text is null | |
| `runValidation` emits PI-V02 when currentProductBet.text is null | |
| `runValidation` emits PI-V03 when highestRiskAssumption.text is null | |
| `runValidation` emits PI-V06 when milestoneIsTaskWarning true | |
| `runValidation` emits PI-V07 for Weak Alignment (INFO) | |
| `runValidation` emits PI-V08 for No Alignment (WARNING) | |
| `runValidation` emits PI-V10 when any evidence item has empty source | |
| `runValidation` emits no findings for a well-formed output | |
| `runValidation` sets state to blocked when BLOCKING finding present | |

#### Group 4: Render

| Test | Assertion |
|---|---|
| `renderProductIntelligenceMd` produces `# Product Intelligence` heading | |
| `renderProductIntelligenceMd` includes productThesis.text | |
| `renderProductIntelligenceMd` includes "Not detected" when thesis null | |
| `renderProductIntelligenceMd` includes strategic gap block when recommendation non-null | |
| `renderProductIntelligenceMd` omits strategic gap when recommendation null | |
| `renderProductIntelligenceMd` includes findings table when findings present | |
| `renderProductIntelligenceMd` says "No findings." when array empty | |

#### Group 5: Integration (file I/O)

| Test | Assertion |
|---|---|
| `generateProductIntelligence` writes `product-intelligence.json` to temp dir | File exists and parses to valid JSON with `schemaVersion: 1` |
| `generateProductIntelligence` writes `product-intelligence.md` to temp dir | File starts with `# Product Intelligence` |
| `generateProductIntelligence` returns blocked state when goals.md is missing | `productIntelligenceState === 'blocked'` |
| `generateProductIntelligence` is non-blocking when decision-ranking.json is absent | No throw; `repositoryAlignment.verdict === 'Unknown'` |
| `generateProductIntelligence` is deterministic: same inputs produce same JSON | Run twice on same fixture; outputs are byte-identical (excluding generatedAt via options.generatedAt) |

### 12.2 Existing Tests Requiring Updates

| Test file | Change required |
|---|---|
| `tests/current-task-runtime-data-path.test.mjs` | No change required — tests assert on `renderPrompt` output structure; the `## Strategic Context` block is additive and appears before `## Selected Issue`, which is still present |
| `tests/recommendation-candidate-expansion.test.mjs` | No change required |
| `tests/shadow-recommendation-control-plane.test.mjs` | No change required — tests do not assert on absence of `## Strategic Context` |
| `tests/prompt-body.test.mjs` | Verify this test does not assert exact prompt content that would break if `## Strategic Context` is prepended. If it does, update the assertion to use `assert.match` instead of `assert.equal` on the full prompt string |

**Check before committing:** Run `npm test` after the changes to `renderImplementationPackage`. If any existing test does an exact equality check on the full prompt string and the new `## Strategic Context` block is present (because `productIntelligence` was passed in), that test will fail. Fix by either passing `null` for `productIntelligence` in the test fixture, or changing the assertion to `assert.match`.

---

## Section 13 — Graceful Degradation

| Failure scenario | Behavior |
|---|---|
| `goals.md` missing | `productThesis: null`; `productIntelligenceState: 'blocked'`; files written with blocked state |
| `strategy.md` missing | `currentProductBet` falls back to `goals.md §Current Focus`; if also absent, null |
| `decision-ranking.json` missing | `repositoryAlignment.verdict: 'Unknown'`; no error thrown |
| `intelligence-quality.json` missing or invalid JSON | `quality = null`; evidence items from quality are omitted; no error |
| `outcomes.json` missing | `outcomes = []`; no error |
| Any derivation function throws unexpectedly | Caught in `generateProductIntelligence`; field set to null; PI-V01 or PI-V02 BLOCKING emitted; state set to `'blocked'`; file still written |
| `generateProductIntelligence` itself throws | Caught in `next-improvement.mjs` call site; error logged; `productIntelligence = null`; rest of pipeline continues unchanged |
| `product-intelligence.json` missing when Context Package runs | `readAiJson` returns null; "not available" message displayed; no error |

---

## Section 14 — Migration Steps

These steps are performed once when the implementation lands. They are
non-destructive and fully reversible.

1. **Create `scripts/product-intelligence.mjs`** with the structure defined in
   Section 2.
2. **Create `tests/product-intelligence.test.mjs`** with the tests defined in
   Section 12.
3. **Modify `scripts/next-improvement.mjs`**:
   - Add import for `generateProductIntelligence`
   - Add call after `decision-ranking.json` write (wrapped in try/catch)
   - Update `renderPrompt` signature to accept `productIntelligence`
   - Update `renderImplementationPackage`, `renderProductDecisionPackage`,
     `renderValidationPackage` to accept and use `productIntelligence`
   - Add `renderStrategicContext` helper
4. **Modify `scripts/context-package.mjs`**:
   - Add `readAiJson(aiDir, 'product-intelligence.json')` call
   - Add `renderProductIntelligenceSection` helper
   - Inject `## Product Intelligence` section into output content array
5. **Add `"product:intelligence"` to `package.json`**
6. **Run `npm test`** — all existing tests must pass before the PR is merged.
7. **Run `node scripts/product-intelligence.mjs`** from the repository root to
   generate the initial `.ai/product-intelligence.json` and
   `.ai/product-intelligence.md`.
8. **Run `node scripts/next-improvement.mjs`** to regenerate
   `.ai/next-improvement-prompt.md` with the new `## Strategic Context` block.
9. **Commit all new and modified files** in a single commit.

---

## Section 15 — Acceptance Criteria

The implementation is complete when all of the following are true:

1. `npm test` passes with zero failures on all existing and new tests.
2. `npm run build` produces no new TypeScript errors attributable to this change.
3. `node scripts/product-intelligence.mjs` runs to completion and writes:
   - `.ai/product-intelligence.json` with `schemaVersion: 1` and a non-null
     `productThesis.text` field
   - `.ai/product-intelligence.md` starting with `# Product Intelligence`
4. Running `node scripts/product-intelligence.mjs` twice in sequence on the same
   repository produces identical JSON output (excluding `generatedAt`).
5. `node scripts/next-improvement.mjs` runs to completion and the generated
   `.ai/next-improvement-prompt.md` contains `## Strategic Context` with a
   non-empty `**Product Thesis:**` line.
6. `node scripts/context-package.mjs` runs to completion and the generated
   `.ai/context-package.md` contains `## Product Intelligence` with a non-empty
   `**Repository Alignment:**` line.
7. When `.ai/goals.md` §Product Thesis is absent, `productIntelligenceState` in
   the JSON output is `'blocked'` and `validationFindings` contains a finding with
   `code: 'PI-V01'` and `severity: 'BLOCKING'`.
8. When `generateProductIntelligence` throws (simulated by passing a non-existent
   `repositoryPath`), `node scripts/next-improvement.mjs` still completes and still
   writes `.ai/decision-ranking.json` and `.ai/next-improvement-prompt.md`.
9. The `## Strategic Context` block in the Implementation Package is ≤ 12 lines
   when `strategicRecommendation` is null.
10. Every evidence item in `product-intelligence.json` has a non-empty `source`
    field — verified by the PI-V10 validation rule and confirmed in the test suite.
