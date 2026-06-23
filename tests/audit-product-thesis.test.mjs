import assert from 'node:assert/strict';
import {
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
