import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { evaluateCanonicalCompleteness, mdSection } from './canonical-completeness.mjs';

export const synthesisFields = [
  { key: 'productThesis', label: 'Product Thesis', headings: ['Product Thesis', 'Product Purpose'] },
  { key: 'currentFocus', label: 'Current Focus', headings: ['Current Focus', 'Current Product Bet', 'Current Experiment'] },
  { key: 'currentProductBet', label: 'Current Product Bet', headings: ['Current Product Bet', 'Strategic Bet'] },
  { key: 'longTermVision', label: 'Long-term Vision', headings: ['Long-term Vision', 'Long-Term Vision', 'Vision'] },
  { key: 'strategicDifferentiator', label: 'Strategic Differentiator', headings: ['Strategic Differentiator', 'Product Differentiator', 'Differentiator'] },
  { key: 'northStarMetric', label: 'North Star Metric', headings: ['North Star Metric', 'North Star'] },
  { key: 'successCriteria', label: 'Success Criteria', headings: ['Success Criteria', 'Success Definition', 'Strategy Success Definition'] },
  { key: 'whatNotToBuild', label: 'What Not To Build', headings: ['What Not To Build'] },
];

export const evidenceSourceFiles = ['README.md', '.ai/strategy.md', '.ai/decisions.md', '.ai/context-package.md', '.ai/architecture.md', '.ai/validation.md', '.ai/repository-health.md', 'repository-health.md'];

const missingPattern = /^(?:unknown|missing|not detected yet|none detected|generated placeholder|tbd|todo|n\/a|na|-\s*not detected yet\.?)$/i;

function normalize(value) { return value.toLowerCase().replace(/[`*_#>-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function cleanLine(line) { return line.replace(/^[-*]\s+/, '').trim(); }
function sourceLabel(file) { return file === 'README.md' ? 'README.md' : basename(file).replace(/\.md$/i, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function meaningful(value) { return Boolean(value) && !missingPattern.test(value) && !/^evidence\s*:/i.test(value) && !/^confidence\s*:/i.test(value); }

function candidateLines(markdown, heading) {
  const section = mdSection(markdown, heading);
  if (!section) return [];
  const lines = section.split('\n').map(cleanLine).filter(meaningful);
  return lines.length ? [lines[0]] : [];
}

export function synthesizeEvidenceFromDocs(docs = {}, goalsMarkdown = docs['.ai/goals.md'] ?? docs['goals.md'] ?? '') {
  const completeness = evaluateCanonicalCompleteness(goalsMarkdown);
  const fields = {};
  for (const field of synthesisFields) {
    const complete = Boolean(completeness.fields[field.key]?.percent > 0 || field.headings.some((heading) => mdSection(goalsMarkdown, heading)) || (field.key === 'longTermVision' && completeness.fields.manualGoals?.requirements?.find((r) => r.key === 'longTermVision')?.complete));
    const evidence = [];
    if (!complete) {
      for (const file of Object.keys(docs).sort()) {
        if (/\.ai\/goals\.md$|^goals\.md$/.test(file)) continue;
        const markdown = docs[file] ?? '';
        for (const heading of field.headings) {
          for (const wording of candidateLines(markdown, heading)) evidence.push({ source: sourceLabel(file), file, heading, wording });
        }
      }
    }
    const grouped = new Map();
    for (const item of evidence) {
      const key = normalize(item.wording);
      const existing = grouped.get(key) ?? { wording: item.wording, evidence: [] };
      existing.evidence.push(item);
      if (item.wording.length < existing.wording.length || (item.wording.length === existing.wording.length && item.wording < existing.wording)) existing.wording = item.wording;
      grouped.set(key, existing);
    }
    const groups = [...grouped.values()].sort((a, b) => b.evidence.length - a.evidence.length || a.wording.localeCompare(b.wording));
    const selected = groups[0] ?? null;
    const conflict = groups.length > 1;
    const sourceCount = new Set(selected?.evidence.map((item) => item.file) ?? []).size;
    const confidence = !selected ? 'None' : conflict ? (sourceCount >= 2 ? 'Medium' : 'Low') : sourceCount >= 3 ? 'High' : sourceCount === 2 ? 'Medium' : 'Low';
    fields[field.key] = {
      key: field.key,
      label: field.label,
      missing: !complete,
      suggestedWording: selected?.wording ?? null,
      evidence: selected?.evidence ?? [],
      allEvidence: evidence,
      confidence,
      selectionRule: selected ? `Selected the most frequent exact normalized wording across repository-local sources; ties sort by wording. Confidence is ${confidence} from ${sourceCount} supporting source${sourceCount === 1 ? '' : 's'}${conflict ? ' with conflicting repository evidence present' : ''}.` : 'No matching repository-local evidence found.',
      reason: selected ? `${sourceCount} deterministic repository-local source${sourceCount === 1 ? '' : 's'} contain selected wording${conflict ? '; other conflicting wording was detected' : ''}.` : 'No deterministic repository-local source contains this concept.',
    };
  }
  const supported = Object.values(fields).filter((field) => field.missing && field.suggestedWording).length;
  const missing = Object.values(fields).filter((field) => field.missing).length;
  const strength = supported === 0 ? 'None' : supported === missing ? 'Strong' : supported >= Math.ceil(missing / 2) ? 'Partial' : 'Weak';
  return { schemaVersion: 1, supportedFields: supported, missingFields: missing, totalFields: synthesisFields.length, strength, fields };
}

export function renderSynthesisMarkdown(field) {
  if (!field?.suggestedWording) return 'Missing field.';
  return ['Suggested Canonical Wording', '', field.label, '', field.suggestedWording, '', 'Repository-local evidence', '', ...field.evidence.map((item) => `- ${item.source}: ${item.wording}`), '', 'Confidence', '', field.confidence, '', 'Repository owner action', '', '- Review', '- Accept', '- Edit', '- Reject'].join('\n');
}

export async function readEvidenceDocs(repositoryPath = process.cwd()) {
  const docs = {};
  for (const file of ['.ai/goals.md', ...evidenceSourceFiles]) docs[file] = await readFile(join(repositoryPath, file), 'utf8').catch(() => '');
  return docs;
}

export async function persistEvidenceSynthesis(repositoryPath = process.cwd()) {
  const docs = await readEvidenceDocs(repositoryPath);
  const synthesis = synthesizeEvidenceFromDocs(docs, docs['.ai/goals.md']);
  await mkdir(join(repositoryPath, '.ai'), { recursive: true });
  await writeFile(join(repositoryPath, '.ai/evidence-synthesis.json'), `${JSON.stringify(synthesis, null, 2)}\n`);
  return synthesis;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await persistEvidenceSynthesis(process.cwd());
  console.log('Wrote .ai/evidence-synthesis.json');
}
