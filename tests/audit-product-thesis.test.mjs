import assert from 'node:assert/strict';
import {
  inferProductThesis,
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
];

const result = inferProductThesis('', {}, null, diagnosticDocs, ['Nearify.xcodeproj'], coreSystems);

assert.equal(
  result.thesis,
  'This repository appears to support a relationship-oriented iOS application that uses event presence, relationship context, follow-up workflows, and notifications to help users act on real-world connections.',
);
assert.equal(result.thesis.includes('SELECT policy'), false);
assert.equal(result.thesis.includes('presence_sessions'), false);
assert.equal(result.evidence.includes('DIAGNOSIS'), false);
