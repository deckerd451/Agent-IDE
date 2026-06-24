import assert from 'node:assert/strict';
import {
  inferCurrentFocus,
  inferProductThesis,
  isProductThesisBroadEnough,
  isProductThesisExcludedSource,
  isProductThesisNoise,
  productThesisCandidates,
} from '../scripts/audit.mjs';

const forbiddenTerms = [
  'SELECT policy',
  'table',
  'rows',
  'SQL',
  'RLS',
  'Supabase',
  'audit',
  'ambiguity',
  'optimize',
  'quality',
  'best opportunity',
  'policy',
  'diagnosis',
  'bug',
  'issue',
  'root cause',
  'regression',
  'fix',
  'error',
  'failure',
  'implementation',
  'architecture only',
  'no code',
  'no UI',
];

for (const term of forbiddenTerms) {
  assert.equal(isProductThesisNoise(`This sentence mentions ${term} in context.`), true, term);
}

assert.equal(isProductThesisExcludedSource('docs/PRESENCE_DIAGNOSIS.md'), true);
assert.deepEqual(
  productThesisCandidates(
    'The SELECT policy on `presence_sessions` table only allows users to view their own rows.',
    'docs/PRESENCE_DIAGNOSIS.md',
    1,
  ),
  [],
);

assert.deepEqual(
  productThesisCandidates(
    'The Best Opportunity Quality Audit identified a strategic ambiguity: should Best Opportunity optimize for relationship continuity, opportunity discovery, or a hybrid of both?',
    'README.md',
    1,
  ),
  [],
);
assert.equal(isProductThesisBroadEnough('The follow-up engine prioritizes relationship reminders.'), false);
assert.equal(
  isProductThesisBroadEnough('This application helps users maintain relationships through follow-up workflows.'),
  true,
);

const diagnosticDocs = {
  'docs/PRESENCE_DIAGNOSIS.md':
    'The SELECT policy on `presence_sessions` table only allows users to view their own rows.',
};

const coreSystems = [
  { name: 'Follow-Up Engine', sources: ['FollowUpEngine.swift'] },
  { name: 'Event Presence', sources: ['EventPresenceStore.swift'] },
  { name: 'Notification Pipeline', sources: ['NotificationPipeline.swift'] },
  { name: 'Decision Surface', sources: ['DecisionSurface.swift'] },
  { name: 'Domain Models', sources: ['DomainModels.swift'] },
  { name: 'People/Profile Surfaces', sources: ['PeopleProfileView.swift'] },
];

const expectedRelationshipThesis =
  'This repository appears to support a relationship-oriented iOS application that uses event presence, relationship context, follow-up workflows, decision surfaces, and notifications to help users act on real-world connections.';

const result = inferProductThesis('', {}, null, diagnosticDocs, ['Nearify.xcodeproj'], coreSystems);

assert.equal(result.thesis, expectedRelationshipThesis);
assert.equal(result.thesis.includes('SELECT policy'), false);
assert.equal(result.thesis.includes('presence_sessions'), false);
assert.equal(result.evidence.includes('DIAGNOSIS'), false);

const narrowReadmeResult = inferProductThesis(
  'The Best Opportunity Quality Audit identified a strategic ambiguity: should Best Opportunity optimize for relationship continuity, opportunity discovery, or a hybrid of both?',
  {},
  null,
  {},
  ['Nearify.xcodeproj'],
  coreSystems,
);

assert.equal(narrowReadmeResult.thesis, expectedRelationshipThesis);
assert.equal(narrowReadmeResult.evidence.includes('README.md'), false);
assert.equal(narrowReadmeResult.evidence.includes('FollowUpEngine.swift'), true);
assert.equal(narrowReadmeResult.evidence.includes('EventPresenceStore.swift'), true);

const roadmapTable = `# Nearify Implementation Roadmap

| Recommendation | ROI | Engineering effort | Complexity reduction |
| --- | --- | --- | --- |
| Quick Win | High | Low | Medium |
| Medium Project | Medium | Medium | High |
| Short Project | High | Low | Low |
`;

assert.deepEqual(productThesisCandidates(roadmapTable, 'docs/NEARIFY_IMPLEMENTATION_ROADMAP.md', 2), []);

const roadmapResult = inferProductThesis(
  '',
  {},
  null,
  { 'docs/NEARIFY_IMPLEMENTATION_ROADMAP.md': roadmapTable },
  ['Nearify.xcodeproj'],
  coreSystems,
);

assert.equal(roadmapResult.thesis, expectedRelationshipThesis);
assert.equal(roadmapResult.thesis.split(/\s+/).length <= 40, true);
assert.equal(roadmapResult.thesis.includes('|'), false);
assert.equal(roadmapResult.thesis.includes('Recommendation'), false);
assert.equal(roadmapResult.evidence.includes('NEARIFY_IMPLEMENTATION_ROADMAP'), false);
assert.equal(roadmapResult.evidence.includes('FollowUpEngine.swift'), true);
assert.equal(roadmapResult.evidence.includes('NotificationPipeline.swift'), true);

const roadmapTableThenProse = `${roadmapTable}

Nearify helps people maintain real-world relationships through event context and timely follow-up workflows.
`;

assert.deepEqual(productThesisCandidates(roadmapTableThenProse, 'docs/NEARIFY_IMPLEMENTATION_ROADMAP.md', 2), [
  {
    text: 'Nearify helps people maintain real-world relationships through event context and timely follow-up workflows.',
    source: 'docs/NEARIFY_IMPLEMENTATION_ROADMAP.md',
    preferred: true,
  },
]);


const goalsWithCurrentFocus = `# Goals

## Active
- Improve unrelated active goal.

## Current Focus
Between Events experience: helping users know who to reach out to today when they are not currently at an event.

## Future
- Later work.
`;

const explicitFocusResult = inferCurrentFocus('', { 'goals.md': goalsWithCurrentFocus, 'backlog.md': '## Next\n- Infer this instead.' }, null, []);

assert.deepEqual(explicitFocusResult, {
  focus: 'Between Events experience: helping users know who to reach out to today when they are not currently at an event.',
  evidence: '.ai/goals.md',
});

const multilineGoalsFocus = `# Goals

## Current Focus
Line one of the focus.

- Keep this bullet verbatim too.
`;

assert.deepEqual(inferCurrentFocus('', { 'goals.md': multilineGoalsFocus }, null, []), {
  focus: 'Line one of the focus.\n\n- Keep this bullet verbatim too.',
  evidence: '.ai/goals.md',
});

const inferredFocusResult = inferCurrentFocus('', { 'backlog.md': '## Next\n- Build fallback focus' }, null, []);

assert.equal(inferredFocusResult.focus, 'The repository is currently focused on build fallback focus.');
assert.equal(inferredFocusResult.evidence, '.ai/backlog.md');

const roadmapFocusResult = inferCurrentFocus('', {}, null, [], {
  'docs/PRODUCT_ROADMAP.md': '## Next\n- Enable relationship reminders from roadmap',
});

assert.equal(roadmapFocusResult.focus, 'The repository is currently focused on enable relationship reminders from roadmap.');
assert.equal(roadmapFocusResult.evidence, 'docs/PRODUCT_ROADMAP.md');
