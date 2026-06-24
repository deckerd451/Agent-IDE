import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const aiDir = join(root, '.ai');
const outputPath = join(aiDir, 'context-package.md');

const sourceFiles = {
  goals: 'goals.md',
  architecture: 'architecture.md',
  decisions: 'decisions.md',
  strategy: 'strategy.md',
  validation: 'validation.md',
  backlog: 'backlog.md',
  health: 'repository-health.md',
};

async function readAiFile(fileName) {
  return readFile(join(aiDir, fileName), 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') return `# ${fileName}\n\n- Missing. Run Refresh Intelligence to generate this file.`;
    throw error;
  });
}

function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'));
  return match?.[1]?.trim() || '- No generated content available yet.';
}

function firstMatchingSection(markdown, headings) {
  for (const heading of headings) {
    const content = extractSection(markdown, heading);
    if (!content.startsWith('- No generated content')) return content;
  }
  return '- No generated content available yet.';
}

const docs = Object.fromEntries(
  await Promise.all(Object.entries(sourceFiles).map(async ([key, fileName]) => [key, await readAiFile(fileName)])),
);

const content = [
  '# Context Package',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Product Thesis',
  firstMatchingSection(docs.architecture, ['Product Thesis', 'Product Purpose']) || firstMatchingSection(docs.goals, ['Product Purpose', 'Product Thesis']),
  '',
  '## Current Focus',
  firstMatchingSection(docs.architecture, ['Current Focus']) || firstMatchingSection(docs.goals, ['Current Focus']),
  '',
  '## Strategy',
  [
    firstMatchingSection(docs.strategy, ['North Star Metric']),
    firstMatchingSection(docs.strategy, ['Strategic Differentiator']),
    firstMatchingSection(docs.strategy, ['Current Product Bet']),
    firstMatchingSection(docs.strategy, ['What Not To Build']),
    firstMatchingSection(docs.strategy, ['Success Definition']),
  ].join('\n\n'),
  '',
  '## Core Systems',
  firstMatchingSection(docs.architecture, ['Core Systems', 'Primary Flows', 'Implementation Entry Points']),
  '',
  '## Key Decisions',
  firstMatchingSection(docs.decisions, ['Active Decisions', 'Key Decisions', 'Manual Decisions']),
  '',
  '## Validation Summary',
  [
    firstMatchingSection(docs.validation, ['Overall Status', 'Confidence']),
    firstMatchingSection(docs.validation, ['Commands Run', 'Known Validation Gaps']),
  ].join('\n\n'),
  '',
  '## Current Backlog',
  firstMatchingSection(docs.backlog, ['Prioritized Backlog', 'Current Backlog', 'Manual Backlog']),
  '',
  '## Repository Health Summary',
  [
    firstMatchingSection(docs.health, ['Intelligence Completeness']),
    firstMatchingSection(docs.health, ['Quality Signals']),
    firstMatchingSection(docs.health, ['Risks']),
    firstMatchingSection(docs.health, ['Recommended Next Step']),
  ].join('\n\n'),
  '',
].join('\n');

await mkdir(aiDir, { recursive: true });
await writeFile(outputPath, content);
console.log(`Wrote ${outputPath}`);
