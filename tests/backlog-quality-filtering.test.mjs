import assert from 'node:assert/strict';
import { classifyComment, dedupe, isQualityNoise, normalizeKey, scanComments, scanMarkdownGaps } from '../scripts/backlog.mjs';

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
assert.equal(isQualityNoise('Package Scripts Were Detected in Package.json'), true);
assert.equal(isQualityNoise('Detected scripts: build, test, lint'), true);

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

## Known Gaps
- Package Scripts Were Detected in Package.json
- ExploreView is a nav push within the home tab
- ActiveJoinedEventKey is intentionally NOT removed
- notifyAuthenticatedUser performs the definitive check
`;

const roadmapItems = dedupe(scanMarkdownGaps('docs/NEARIFY_IMPLEMENTATION_ROADMAP.md', nearifyRoadmap));
assert.equal(roadmapItems.some((item) => item.title.includes('Follow-up Reminders')), true);
assert.equal(roadmapItems.some((item) => item.title.includes('Reminder Scheduling')), true);
assert.equal(roadmapItems.some((item) => item.title.includes('Manual Backlog Import')), true);
assert.equal(roadmapItems.some((item) => item.title.includes('Relationship-context')), true);
assert.equal(roadmapItems.some((item) => /Validation Passed/i.test(item.title)), false);
assert.equal(roadmapItems.some((item) => /Package Scripts/i.test(item.title)), false);
assert.equal(roadmapItems.some((item) => /ExploreView/i.test(item.title)), false);
assert.equal(roadmapItems.some((item) => /ActiveJoinedEventKey/i.test(item.title)), false);
assert.equal(roadmapItems.some((item) => /notifyAuthenticatedUser/i.test(item.title)), false);
assert.equal(roadmapItems.filter((item) => normalizeKey(item.title).includes('event aware follow up reminders')).length, 1);

const nearifySource = [
  '// ' + 'TODO: Add event-aware follow-up reminders.',
  '// ' + 'FIXME: Fix broken reminder scheduling when an event changes time.',
  '// ' + 'NOTE: Confidence message is logged for diagnostics.',
  '// ' + 'ExploreView is a nav push within the home tab.',
  '// ' + 'ActiveJoinedEventKey is intentionally NOT removed.',
  '// ' + 'notifyAuthenticatedUser performs the definitive check.',
].join('\n');

const commentItems = scanComments('Sources/Nearify/ReminderScheduler.swift', nearifySource);
assert.equal(commentItems.length, 2);
assert.equal(commentItems.some((item) => item.title.includes('Add Event-aware Follow-up Reminders')), true);

assert.equal(classifyComment('TODO', 'Add event-aware follow-up reminders.'), 'actionable');
assert.equal(classifyComment('NOTE', 'ExploreView is a nav push within the home tab.'), 'architectural');
assert.equal(classifyComment('NOTE', 'Relationship Context Engine coordinates event state.'), 'architectural');
assert.equal(classifyComment('NOTE', 'Confidence message is logged for diagnostics.'), 'validation');

const nearifyDescriptiveComments = [
  '// a Stable Display Name',
  '// a Signature of the Current Evaluation State',
  '// Signals From a Live EventAttendee + Encounter Tracker',
  '// Visibility Set: Hero + all Queue People',
  '// Share Items: VCard Primary + Text Fallback',
  '// Per-profile Encounter Aggregation From Stored Encounters',
  '// MARK: Relationship Context Engine',
  '// SECTION: Implementation notes',
].join('\n');

assert.deepEqual(scanComments('Sources/Nearify/RelationshipContext.swift', nearifyDescriptiveComments), []);

const explicitNearifyTasks = [
  '// BUG: Fix stale encounter aggregation.',
  '// IMPLEMENT: Add deterministic relationship-context fixtures.',
  '// ACTION: Validate vCard text fallback.',
  '// Future Work: Support richer event attendee signals.',
  '// Known Gap: Missing live encounter tracker sync.',
].join('\n');

const explicitCommentItems = scanComments('Sources/Nearify/RelationshipContext.swift', explicitNearifyTasks);
assert.equal(explicitCommentItems.length, 5);
assert.equal(explicitCommentItems.some((item) => item.title.includes('Stale Encounter Aggregation')), true);
assert.equal(explicitCommentItems.some((item) => item.title.includes('Deterministic Relationship-context Fixtures')), true);
assert.equal(explicitCommentItems.some((item) => item.title.includes('VCard Text Fallback')), true);
assert.equal(explicitCommentItems.some((item) => item.title.includes('Richer Event Attendee Signals')), true);
assert.equal(explicitCommentItems.some((item) => item.title.includes('Live Encounter Tracker Sync')), true);

assert.equal(classifyComment('BUG', 'Fix stale encounter aggregation.'), 'actionable');
assert.equal(classifyComment('IMPLEMENT:', 'Add deterministic relationship-context fixtures.'), 'actionable');
assert.equal(classifyComment('ACTION:', 'Validate vCard text fallback.'), 'actionable');
