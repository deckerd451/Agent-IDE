import assert from 'node:assert/strict';
import { dedupe, isQualityNoise, normalizeKey, scanComments, scanMarkdownGaps } from '../scripts/backlog.mjs';

const nearifyGeneratedValidation = `# Validation

Last Validation: 2026-06-24T00:00:00.000Z
Confidence: 95%

## Results
- npm run build passed.
- Validation succeeded for Nearify.
- Detected npm scripts: build, test, lint.

## Known Validation Gaps
- No validation gaps detected from package scripts.
- None detected
`;

assert.equal(scanMarkdownGaps('.ai/validation.md', nearifyGeneratedValidation).length, 0);
assert.equal(isQualityNoise('None detected'), true);
assert.equal(isQualityNoise('No validation gaps detected from package scripts.'), true);
assert.equal(isQualityNoise('npm run build -> generated backlog.md'), true);
assert.equal(isQualityNoise('Confidence: 95%'), true);

const nearifyGeneratedArchitecture = `# Architecture

## Core Systems
- Relationship Context Engine
- Generated summary: Nearify links event presence to follow-up reminders.
- Version-controlled \`.ai/*.md\` files that define goals, architecture, backlog, decisions, validation, agents, and code notes.

## Repository Structure
- Major Areas: Sources, Tests, Docs
- Dependencies: SwiftUI, Foundation
`;

assert.deepEqual(scanMarkdownGaps('.ai/architecture.md', nearifyGeneratedArchitecture), []);

const nearifyRoadmap = `# Nearify Implementation Roadmap

## TODO
- Add event-aware follow-up reminders.
- Implement event aware follow up reminders.

## FIXME
- Fix broken reminder scheduling when an event changes time.

## BUILD
- Build a manual backlog import surface.

## ROADMAP
- Surface explicit relationship-context implementation recommendations in the Today view.

## Generated Summary
- Validation passed successfully.
`;

const roadmapItems = dedupe(scanMarkdownGaps('docs/NEARIFY_IMPLEMENTATION_ROADMAP.md', nearifyRoadmap));
assert.equal(roadmapItems.some((item) => item.title.includes('Follow-up Reminders')), true);
assert.equal(roadmapItems.some((item) => item.title.includes('Reminder Scheduling')), true);
assert.equal(roadmapItems.some((item) => item.title.includes('Manual Backlog Import')), true);
assert.equal(roadmapItems.some((item) => item.title.includes('Relationship-context')), true);
assert.equal(roadmapItems.some((item) => /Validation Passed/i.test(item.title)), false);
assert.equal(roadmapItems.filter((item) => normalizeKey(item.title).includes('event aware follow up reminders')).length, 1);

const nearifySource = [
  '// ' + 'TODO: Add event-aware follow-up reminders.',
  '// ' + 'FIXME: Fix broken reminder scheduling when an event changes time.',
  '// ' + 'NOTE: Confidence message is logged for diagnostics.',
].join('\n');

const commentItems = scanComments('Sources/Nearify/ReminderScheduler.swift', nearifySource);
assert.equal(commentItems.length, 3);
assert.equal(commentItems.some((item) => item.title.includes('Add Event-aware Follow-up Reminders')), true);
