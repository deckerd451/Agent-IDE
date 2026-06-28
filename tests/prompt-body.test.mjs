import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderPrompt } from '../scripts/next-improvement.mjs';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const implementationPromptFunction = appSource.match(/function implementationPrompt\([\s\S]*?\n}\n\nfunction recommendationDisplayTitle/)?.[0] ?? '';

assert.match(implementationPromptFunction, /Runtime prompt-body path investigation/);
assert.match(implementationPromptFunction, /data\.recommendation\.implementationPrompt/);
assert.doesNotMatch(implementationPromptFunction, /data\.packages\.builder|documents\['prompts\/builder\.md'\]|data\.recommendation\.prompt/);
assert.match(appSource, /'copy-implementation-prompt': implementationPrompt\(data, documents\)/);
assert.match(appSource, /'open-codex': implementationPrompt\(data, documents\)/);

const decoratedTitle = 'Fix Preview Prompt Body Source';
const rawJudgmentTitle = 'Advance strategy: Control Plane reports repository handoff readiness as Ready.';
const rendered = renderPrompt({
  selectedIssue: {
    id: 'preview-prompt-body-source',
    category: 'code-fixable',
    severity: 'high',
    actionability: 'code-fixable',
    packageType: 'implementation',
    source: '.ai/recommendation-trace.md',
    title: decoratedTitle,
    evidence: 'Preview Prompt rendered stale package builder content.',
    reason: 'The UI must use recommendation.implementationPrompt as the single source.',
    recommendedAction: decoratedTitle,
    engineeringTask: {
      status: 'compiled',
      title: decoratedTitle,
      rootCause: 'Preview Prompt can otherwise use stale prompt-body fallbacks.',
      implementationTarget: decoratedTitle,
      likelyFiles: ['src/App.tsx'],
      deterministicEvidence: ['TaskArtifact calls implementationPrompt for Preview Prompt.'],
      acceptanceCriteria: ['Preview Prompt, Copy Implementation Prompt, and Open Codex use one source.'],
      nonGoals: ['Do not use packages.builder as the live prompt body.'],
      originalRecommendation: { title: rawJudgmentTitle },
    },
  },
  decisionRanking: { candidates: [], selectedIssue: { title: decoratedTitle }, selectionExplanation: 'Selected for regression coverage.' },
});

for (const heading of ['Selected Issue', 'Current Evidence', 'Goal', 'Why This Helps', 'Acceptance Criteria']) {
  assert.match(rendered, new RegExp(`## ${heading}`));
}
assert.match(rendered, new RegExp(`# ${decoratedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
assert.match(rendered, new RegExp(`## Goal\\n${decoratedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
assert.doesNotMatch(rendered, new RegExp(`## Goal\\n${rawJudgmentTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
assert.match(rendered, /## Original Repository Judgment Recommendation\n- Title: Advance strategy: Control Plane reports repository handoff readiness as Ready\./);
