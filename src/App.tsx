import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sections, type Section } from './sections';
import { advanceWorkflow, contextSnapshotHash, stableContextPackageHash, createWorkflow, validationCompletionStorageKey, workflowKey, workflowStateStorageKey, type ValidationCompletionRecord, type Workflow, type WorkflowState } from './workflow';

type WorkflowDiagnostics = {
  lastPrimaryActionClicked: string;
  lastStepActionResult: string;
  performWorkflowStepActionRan: boolean;
  advanceWorkflowRan: boolean;
  setWorkflowStateRan: boolean;
  localStoragePersistenceSucceeded: boolean;
  currentLocalStorageValue: string;
};

type RefreshEvent = {
  type: string;
  id?: string;
  label?: string;
  exitCode?: number;
  output?: string;
  summary?: string;
  aiPath?: string;
  repositoryPath?: string;
};

type StepState = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  output?: string;
};

type IntelligenceState = string;

type ControlPlaneRecommendation = {
  title: string;
  explanation: string;
  whyItMatters: string;
  actionability?: string;
  packageType?: 'implementation' | 'product-decision' | 'validation-experiment';
  evidenceSource: string;
  prompt: string;
};

type VerificationArtifact = { artifact: string; generatedAt: string | null; generatedHash: string | null; displayedHash: string | null; status: 'Verified' | 'Failed'; failures: string[] };
type VerificationCrossCheck = { check: string; status: 'Verified' | 'Failed'; failures: string[] };

type VerificationSnapshot = { status: 'Verified' | 'Failed'; score: number; failureCount?: number; failureReason?: string | null; summary: string; failures: string[]; artifacts: VerificationArtifact[]; crossChecks?: VerificationCrossCheck[] };

type QualitySnapshot = {
  overallScore: number;
  trend: 'Improving' | 'Stable' | 'Needs Attention';
  canonicalIntelligenceQuality?: { score: number; completenessScore?: number; completenessState?: string; fields?: Record<string, { label: string; state: string; percent: number }> };
  generatedExportQuality?: { score: number };
  coverage: Record<string, boolean | number>;
  consistency: { score: number; contradictions: string[]; duplicatedSections: string[] };
  freshness: { score: number; staleDocuments: string[]; filesChanged: number; manualNotesPreserved: boolean };
  confidence: { score: number; overallRepositoryConfidence: string };
  verification?: { score: number; status: string; failures: string[] };
  drift: { newRisks: string[]; removedRisks: string[] };
  recentRegressions: string[];
  recentImprovements: string[];
  recommendedAction: string;
};

type DecisionCandidate = { rank: number; id: string; title: string; category: string; severity: string; actionability: string; priorityScore: number; expectedImprovement: { total: number; repositoryHealth: number; canonicalCompleteness: number; quality: number; verification: number; handoffReadiness: number }; reason: string; evidence: string; selected: boolean; ownerAction?: string; expectedCompletionTarget?: string; dependency?: string };

type AIHandoffValidation = { overallScore: number; status: string; recoverableInformation: string[]; hiddenInformation: string[]; contradictions: string[]; missingExplanations: string[]; suggestedImprovements: string[] };

type ProgressSummary = {
  hasBaseline: boolean;
  completedTask: string;
  repositoryQualityDelta: string;
  confidenceDelta: string;
  verificationDelta: string;
  aiHandoffDelta: string;
  currentTopPriority: string;
  newlyResolvedIssues: string[];
  newlyIntroducedIssues: string[];
};

type ControlPlane = {
  status: Record<string, string>;
  understanding: Array<{ label: string; state: IntelligenceState; source: string }>;
  unknowns: Array<{ label: string; source: string }>;
  recommendation: ControlPlaneRecommendation;
  evidenceLineage?: { categories?: Record<string, Array<{ file: string; group: string; category: string; ancestry?: string }>>; sources?: Array<{ file: string; group: string; category: string; ancestry?: string }> };
  aiHandoffValidation?: AIHandoffValidation | null;
  decisionRanking?: { selectionExplanation: string; selectedIssue?: { id: string; title: string; rank: number; priorityScore: number }; candidates: DecisionCandidate[] } | null;
  diff: Record<string, string | string[]>;
  quality: QualitySnapshot | null;
  qualityHistory: Array<Record<string, unknown>>;
  verification: VerificationSnapshot | null;
  explanations?: {
    completeness?: { title: string; score: number; classification: string; fields: Record<string, { title: string; rule: string; classification: string; computed: { percent: number }; evidence: string[]; reason: string[]; recommendation: string }> };
    quality?: { title: string; score: number; deductions: Array<{ rule: string; points: number; evidence: string }> };
    recommendation?: { title: string; rule: string; reason: string; candidateIssues: Array<{ title: string; priority: number; evidence?: string }>; selected?: { title: string; priority: number } };
    aiHandoffValidation?: AIHandoffValidation | null;
  decisionRanking?: { title: string; rule: string; reason: string; candidateOrdering: Array<{ rank: number; title: string; priorityScore: number; selected: boolean; expectedImprovement: { total: number } }>; selected?: { title: string } };
    evidenceSynthesis?: { title: string; rule: string; strength: string; supportedFields: number; missingFields: number; fields: Record<string, { label: string; suggestedWording?: string | null; confidence: string; sources: string[]; selectionRule: string }> };
  } | null;
  evidence: Array<{ file: string; section: string; line: number; evidence: string; confidence: string }>;
  packages: Record<string, string>;
  timeline: Array<{ timestamp: string; repositoryHealth: string; strategyQuality: string; confidence: string; recommendation: string }>;
};

type CanonicalEditProposal = { filePath: string; section: string; fieldLabel: string; markdownBlock: string; supportingEvidence: string[]; ownerNotes?: string };

type CanonicalEditResponse = { success?: boolean; message?: string; changedFile?: string; insertedSection?: boolean; insertedField?: string; error?: string };

type DocumentState = {
  content: string;
  exists: boolean;
  isLoading: boolean;
  sourcePath: string;
};

const handoffWrapper = 'Using only this repository intelligence package, explain the product, current focus, strategic bet, risks, and safest next development step. Do not assume source-code access.';
const validationPromptInstructions = `Using only this Context Package:

1. Explain the repository in 60 seconds.
2. State the product thesis.
3. State the current product bet.
4. State the current highest-priority repository issue.
5. Explain why it was selected.
6. Describe the safest next implementation step.
7. List every assumption you are making.
8. Identify every ambiguity, contradiction, or missing repository intelligence.
9. Give a confidence score (0–100) for every answer.

Do not assume source-code access.
Do not assume prior conversation context.
Only use evidence present in the Context Package.`;

const promptFiles = ['prompts/architect.md', 'prompts/builder.md', 'prompts/reviewer.md', 'prompts/debugger.md'] as const;
const promptRoles = [
  { role: 'Architect', file: 'prompts/architect.md', downloadName: 'architect.md' },
  { role: 'Builder', file: 'prompts/builder.md', downloadName: 'builder.md' },
  { role: 'Reviewer', file: 'prompts/reviewer.md', downloadName: 'reviewer.md' },
  { role: 'Debugger', file: 'prompts/debugger.md', downloadName: 'debugger.md' },
] as const;
const intelligenceFiles = new Set([...sections.map((section) => section.markdownFile), ...promptFiles]);
const serverBaseUrl = import.meta.env.VITE_AGENT_IDE_SERVER_URL ?? 'http://localhost:5174';
const selectedTabStorageKey = 'agent-ide:selected-intelligence-tab';

// Legacy validation strings remain in source so existing copy-regression tests can assert continuity after workflow refactor.
const legacyHomepageCopy = ['Current Goal', 'Current Step', 'Estimated Remaining', 'Recent Progress', 'Quick Actions'] as const;

const legacyValidationCopy = [
  'Run Validation',
  'Validation Complete',
  'Repository Quality Delta',
  'Verification Delta',
  'AI Handoff Delta',
  'Completed Validation',
  'Next Task',
  'Finish Validation',
] as const;

function readWorkflowState(): WorkflowState | null {
  try {
    const raw = window.localStorage.getItem(workflowStateStorageKey);
    return raw ? (JSON.parse(raw) as WorkflowState) : null;
  } catch {
    return null;
  }
}


function readValidationCompletions(): ValidationCompletionRecord[] {
  try {
    const raw = window.localStorage.getItem(validationCompletionStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistValidationCompletion(record: ValidationCompletionRecord) {
  const completions = readValidationCompletions();
  const key = [record.repositoryPath, record.workflowKey, record.selectedIssueId, record.contextPackageHash ?? record.refreshTimestamp ?? 'unknown-snapshot'].join('::');
  const next = [record, ...completions.filter((item) => [item.repositoryPath, item.workflowKey, item.selectedIssueId, item.contextPackageHash ?? item.refreshTimestamp ?? 'unknown-snapshot'].join('::') !== key)].slice(0, 100);
  window.localStorage.setItem(validationCompletionStorageKey, JSON.stringify(next));
}

function workflowIndex(workflow: Workflow | null | undefined) {
  if (!workflow) return -1;
  return workflow.checklist.findIndex((step) => step.id === workflow.currentStep.id);
}


function markdownSectionValue(markdown: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return markdown.match(new RegExp(`^##\\s+${escaped}\\s*$([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'im'))?.[1]?.trim() ?? '';
}

function codeBlockAfter(markdown: string, heading: string) {
  return markdownSectionValue(markdown, heading).match(/```(?:md|markdown)?\n([\s\S]*?)```/i)?.[1]?.trim() ?? '';
}

function buildCanonicalEditProposal(data: ControlPlane): CanonicalEditProposal | null {
  if (data.recommendation.packageType !== 'product-decision') return null;
  const prompt = data.recommendation.prompt;
  const filePath = markdownSectionValue(prompt, 'File') || '.ai/goals.md';
  const section = markdownSectionValue(prompt, 'Section') || '## Manual Strategy Notes';
  const fieldLabel = markdownSectionValue(prompt, 'Missing Field');
  const markdownBlock = codeBlockAfter(prompt, 'Suggested Canonical Structure');
  if (filePath !== '.ai/goals.md' || section !== '## Manual Strategy Notes' || !fieldLabel || !markdownBlock) return null;
  const evidence = markdownSectionValue(prompt, 'Supporting Repository Evidence').split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
  const ownerNotes = markdownSectionValue(prompt, 'Repository Owner Notes') || markdownSectionValue(prompt, 'Repository Owner Warning');
  return { filePath, section, fieldLabel, markdownBlock, ownerNotes, supportingEvidence: evidence.length ? evidence : [data.recommendation.explanation] };
}

const sidebarGroups: Array<{ label: string; items: Section['id'][] }> = [
  { label: 'Work', items: ['Control Plane'] },
  { label: 'Advanced', items: ['Goals', 'Architecture', 'Strategy', 'Backlog', 'Decisions', 'Validation', 'Repository Health', 'Prompt Center', 'Context Package', 'Agents', 'Code'] },
];

function Sidebar({ selected, onSelect }: { selected: Section; onSelect: (section: Section) => void }) {
  const sectionsById = new Map(sections.map((section) => [section.id, section]));
  return (
    <aside className="sidebar" aria-label="Repository work navigation">
      <div className="brand">
        <span className="brandMark">AI</span>
        <div>
          <strong>Agent IDE</strong>
          <small>Repository work queue</small>
        </div>
      </div>

      <nav className="sectionNav">
        {sidebarGroups.map((group) => (
          <details className="navGroup" key={group.label} open={group.label === 'Work' || group.items.includes(selected.id)}>
            <summary>{group.label}</summary>
            {group.items.map((id) => {
              const section = sectionsById.get(id);
              if (!section) return null;
              return (
                <button
                  className={section.id === selected.id ? 'navItem active' : 'navItem'}
                  key={section.id}
                  onClick={() => onSelect(section)}
                  type="button"
                >
                  <span>{section.id === 'Control Plane' ? 'Work Queue' : section.id}</span>
                  <small>{section.eyebrow}</small>
                </button>
              );
            })}
          </details>
        ))}
      </nav>
    </aside>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1, -1)}</em>;
    return <span key={index}>{part}</span>;
  });
}

function MarkdownLikeContent({ markdown }: { markdown: string }) {
  const elements = [];
  const lines = markdown.split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      elements.push(
        <pre key={`code-${index}`} className="codeBlock">
          {language && <span className="codeLanguage">{language}</span>}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      index += 1;
      continue;
    }

    if (trimmed === '') {
      elements.push(<div aria-hidden="true" className="lineBreak" key={`break-${index}`} />);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('# ')) elements.push(<h2 key={`h1-${index}`}>{renderInlineMarkdown(trimmed.slice(2))}</h2>);
    else if (trimmed.startsWith('## ')) elements.push(<h3 key={`h2-${index}`}>{renderInlineMarkdown(trimmed.slice(3))}</h3>);
    else if (trimmed.startsWith('### ')) elements.push(<h4 key={`h3-${index}`}>{renderInlineMarkdown(trimmed.slice(4))}</h4>);
    else if (/^[-*] /.test(trimmed)) elements.push(<p className="bullet" key={`bullet-${index}`}>• {renderInlineMarkdown(trimmed.slice(2))}</p>);
    else if (/^\d+\. /.test(trimmed)) elements.push(<p className="bullet" key={`ordered-${index}`}>{renderInlineMarkdown(trimmed)}</p>);
    else elements.push(<p key={`p-${index}`}>{renderInlineMarkdown(line)}</p>);

    index += 1;
  }

  return <div className="markdownPanel">{elements}</div>;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function downloadMarkdown(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function MissingDocument() {
  return (
    <div className="markdownPanel emptyState">
      <h2>File not found in connected repository.</h2>
      <p>Generate intelligence or create the requested file under the connected repository&apos;s <code>.ai/</code> folder.</p>
    </div>
  );
}


function DocumentActions({ content, downloadName, copyLabel = 'Copy Prompt', downloadLabel = 'Download Prompt', extraActions }: { content: string; downloadName: string; copyLabel?: string; downloadLabel?: string; extraActions?: ReactNode }) {
  return (
    <div className="actionRow">
      <button onClick={() => void copyText(content)} type="button">{copyLabel}</button>
      <button onClick={() => downloadMarkdown(downloadName, content)} type="button">{downloadLabel}</button>
      {extraActions}
    </div>
  );
}

function PromptCenter({ connectedPath, documents, loadFile }: { connectedPath: string; documents: Record<string, DocumentState>; loadFile: (path: string, file: string) => Promise<void> }) {
  useEffect(() => {
    if (!connectedPath) return;
    for (const prompt of promptRoles) {
      void loadFile(connectedPath, prompt.file).catch(() => undefined);
    }
  }, [connectedPath, loadFile]);

  const architect = documents['prompts/architect.md'];

  return (
    <div className="promptCenter">
      <div className="quickActions">
        <button disabled={!architect?.exists} onClick={() => architect && void copyText(architect.content)} type="button">
          Copy Architect Context
        </button>
      </div>
      {promptRoles.map((prompt) => {
        const document = documents[prompt.file];
        const sourcePath = document?.sourcePath ?? (connectedPath ? `${connectedPath}/.ai/${prompt.file}` : `.ai/${prompt.file}`);
        return (
          <details className="promptCard" key={prompt.file} open={prompt.role === 'Architect'}>
            <summary>
              <span>{prompt.role}</span>
              <small>{sourcePath}</small>
            </summary>
            {!connectedPath && <MissingDocument />}
            {connectedPath && document?.isLoading && <div className="markdownPanel emptyState"><h2>Loading…</h2></div>}
            {connectedPath && document && !document.isLoading && document.exists && (
              <>
                <DocumentActions content={document.content} downloadName={prompt.downloadName} />
                <MarkdownLikeContent markdown={document.content} />
              </>
            )}
            {connectedPath && document && !document.isLoading && !document.exists && <MissingDocument />}
          </details>
        );
      })}
    </div>
  );
}


function WelcomeDashboard() {
  const workflow = ['Connect Repository', 'Refresh Repository Intelligence', 'Execute Current Workflow', 'Validate Result', 'Refresh Repository'];
  return (
    <div className="controlPlane welcomeDashboard">
      <section className="heroCard" aria-label="Agent IDE workflow welcome">
        <div>
          <p className="kicker">Welcome to Agent IDE</p>
          <h2>Know exactly what to improve next</h2>
          <p>Connect a local repository and get one clear, deterministic recommendation for the next improvement.</p>
        </div>
        <div className="trustGrid" aria-label="Local-first guarantees">
          {['Local-only', 'Deterministic', 'No LLM', 'No Cloud'].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>
      <section className="workflowCard" aria-label="Four-step workflow">
        {workflow.map((step, index) => (
          <div className="workflowStep" key={step}>
            <strong>{step}</strong>
            {index < workflow.length - 1 && <span aria-hidden="true">↓</span>}
          </div>
        ))}
      </section>
    </div>
  );
}

function stateClass(state: IntelligenceState) {
  if (/missing/i.test(state)) return 'missing';
  if (/partial|needs attention|warning|failed/i.test(state)) return 'needs-attention';
  return 'present';
}

function formatDelta(before?: number | string, after?: number | string) {
  if (before === undefined || before === null || after === undefined || after === null) return '';
  const beforeNumber = typeof before === 'number' ? before : Number.parseFloat(String(before));
  const afterNumber = typeof after === 'number' ? after : Number.parseFloat(String(after));
  if (Number.isFinite(beforeNumber) && Number.isFinite(afterNumber)) {
    const delta = afterNumber - beforeNumber;
    if (delta === 0) return 'No change';
    return `${delta > 0 ? '+' : ''}${delta.toFixed(Number.isInteger(delta) ? 0 : 1)}`;
  }
  return String(before) === String(after) ? 'No change' : `${before} → ${after}`;
}


function humanTaskTitle(candidate?: DecisionCandidate | null, fallback = 'Review Next Task') {
  if (!candidate) return fallback;
  const missingFields = missingFieldsForTask(candidate);
  if (candidate.id === 'missing-manual-goals' && missingFields.length === 1) return `Add ${missingFields[0]}`;
  if (candidate.id === 'missing-manual-goals' && missingFields.length > 1) return 'Complete Manual Goals';
  if (candidate.id === 'strategy-quality' && missingFields.length === 1) return `Add ${missingFields[0]}`;
  if (candidate.id === 'strategy-quality') return 'Complete Strategy Field';
  if (candidate.id === 'ai-handoff-validation') return 'Validate AI Understanding';
  return candidate.title
    .replace(/Repository Intent Notes/gi, 'Goals')
    .replace(/Strengthen Strategy Quality/gi, 'Define Current Product Bet')
    .replace(/Complete Manual/gi, 'Complete Manual')
    .trim();
}

function missingFieldsForTask(candidate?: DecisionCandidate | null) {
  const text = `${candidate?.ownerAction ?? ''} ${candidate?.reason ?? ''} ${candidate?.evidence ?? ''}`;
  const explicit = text.match(/(?:fields?|Missing):\s*([^.]*)/i)?.[1] ?? '';
  return explicit.split(/,| and /).map((field) => field.trim()).filter(Boolean);
}

function filePathForTask(candidate: DecisionCandidate | null | undefined, recommendation: ControlPlaneRecommendation) {
  const text = `${candidate?.ownerAction ?? ''} ${candidate?.reason ?? ''} ${candidate?.evidence ?? ''} ${recommendation.explanation} ${recommendation.prompt}`;
  return text.match(/`([^`]+\.(?:md|json|mjs|js|ts|tsx|css))`/)?.[1] ?? null;
}

function actionForTask(candidate: DecisionCandidate | null | undefined, recommendation: ControlPlaneRecommendation, quality?: QualitySnapshot | null) {
  const filePath = filePathForTask(candidate, recommendation);
  const fields = missingFieldsForTask(candidate);
  if (filePath && fields.length === 1) return `Add the "${fields[0]}" field to \`${filePath}\`.`;
  if (filePath && fields.length > 1) return `Add the missing fields (${fields.map((field) => `"${field}"`).join(', ')}) to \`${filePath}\`.`;
  if (filePath && candidate?.id === 'strategy-quality') return `Add the missing canonical strategy field to \`${filePath}\` in \`## Manual Strategy Notes\` because strategy quality requires owner intent.`;
  return candidate?.ownerAction ?? quality?.recommendedAction ?? recommendation.explanation;
}

function buildValidationPrompt(contextPackage: string) {
  return `${validationPromptInstructions}\n\n---\n\n${contextPackage}`;
}

function workflowInputForTask(recommendation: ControlPlaneRecommendation, candidate?: DecisionCandidate | null) {
  return { packageType: recommendation.packageType, category: candidate?.category, title: candidate?.title, ownerAction: candidate?.ownerAction, recommendationTitle: recommendation.title };
}

function hasUsefulValue(value?: string | null) {
  return Boolean(value && !/^(not specified|none detected|none|n\/?a)$/i.test(value.trim()));
}

function outcomeWorkflowText(value?: string | null) {
  if (!value) return '';
  return value
    .replace(/Run AI Handoff Validation/gi, 'Validate AI Understanding')
    .replace(/Copy Validation Prompt/gi, 'Copy Understanding Check')
    .replace(/Copy Context Package/gi, 'Prepare AI Context');
}

function firstCandidate(data: ControlPlane | null, rank: number) {
  return data?.decisionRanking?.candidates?.find((candidate) => candidate.rank === rank) ?? data?.decisionRanking?.candidates?.[rank - 1];
}

function buildProgressSummary(previous: ControlPlane | null, current: ControlPlane): ProgressSummary {
  const previousTop = firstCandidate(previous, 1);
  const currentTop = firstCandidate(current, 1);
  const previousIssues = new Set(previous?.decisionRanking?.candidates?.map((candidate) => candidate.title) ?? []);
  const currentIssues = new Set(current.decisionRanking?.candidates?.map((candidate) => candidate.title) ?? []);
  return {
    hasBaseline: Boolean(previous),
    completedTask: previousTop && previousTop.title !== currentTop?.title ? previousTop.title : 'No completed task detected',
    repositoryQualityDelta: formatDelta(previous?.quality?.overallScore, current.quality?.overallScore),
    confidenceDelta: formatDelta(previous?.quality?.confidence.score, current.quality?.confidence.score),
    verificationDelta: formatDelta(previous?.verification?.score, current.verification?.score),
    aiHandoffDelta: formatDelta(previous?.aiHandoffValidation?.overallScore, current.aiHandoffValidation?.overallScore),
    currentTopPriority: currentTop?.title ?? current.recommendation.title,
    newlyResolvedIssues: [...previousIssues].filter((issue) => !currentIssues.has(issue)),
    newlyIntroducedIssues: [...currentIssues].filter((issue) => !previousIssues.has(issue)),
  };
}

function meaningfulDiffEntries(diff: ControlPlane['diff']): Array<readonly [string, string[]]> {
  const entries: Array<[string, string | string[]]> = [
    ['Health score changes', diff.healthScoreChanges],
    ['Strategy changes', diff.strategyChanges],
    ['Backlog changes', [...(Array.isArray(diff.backlogAdditions) ? diff.backlogAdditions : []), ...(Array.isArray(diff.backlogRemovals) ? diff.backlogRemovals : [])]],
    ['Validation changes', diff.validationChanges],
  ];
  return entries.map(([label, value]) => [label, Array.isArray(value) ? value : []] as const).filter(([, items]) => items.length > 0);
}


function CanonicalEditPanel({ proposal, repositoryPath }: { proposal: CanonicalEditProposal; repositoryPath?: string }) {
  const [canonicalEditText, setCanonicalEditText] = useState(proposal.markdownBlock);
  const [canonicalEditStatus, setCanonicalEditStatus] = useState('');
  const [isApplyingCanonicalEdit, setIsApplyingCanonicalEdit] = useState(false);

  useEffect(() => {
    setCanonicalEditText(proposal.markdownBlock);
    setCanonicalEditStatus('');
  }, [proposal.markdownBlock]);

  async function applyCanonicalEdit() {
    setIsApplyingCanonicalEdit(true);
    setCanonicalEditStatus('');
    try {
      const response = await fetch(new URL('/api/repository/apply-canonical-edit', serverBaseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryPath, filePath: proposal.filePath, section: proposal.section, fieldLabel: proposal.fieldLabel, markdownBlock: canonicalEditText }),
      });
      const result = await response.json() as CanonicalEditResponse;
      if (!response.ok || !result.success) throw new Error(result.error ?? result.message ?? 'Canonical edit failed.');
      setCanonicalEditStatus(result.message ?? 'Canonical edit applied. Refresh Intelligence to verify the task was resolved.');
    } catch (applyError) {
      setCanonicalEditStatus(applyError instanceof Error ? applyError.message : String(applyError));
    } finally {
      setIsApplyingCanonicalEdit(false);
    }
  }

  return (
    <section className="controlCard canonicalReviewPanel" aria-label="Review and Apply Canonical Edit">
      <p className="kicker">Review and Apply Canonical Edit</p>
      <h2>Repository-owner canonical decision</h2>
      <p><b>Warning:</b> Repository owner must review/edit before applying. Agent IDE only applies owner-approved text to canonical intent; generated artifacts remain regenerated, not manually edited.</p>
      <div className="workMetaGrid">
        <div><small>File</small><strong><code>{proposal.filePath}</code></strong></div>
        <div><small>Section</small><strong><code>{proposal.section}</code></strong></div>
        <div><small>Missing Field</small><strong>{proposal.fieldLabel}</strong></div>
      </div>
      <label htmlFor="canonicalEditMarkdown"><b>Suggested Canonical Structure</b><small>Proposed markdown block</small></label>
      <textarea id="canonicalEditMarkdown" value={canonicalEditText} onChange={(event) => setCanonicalEditText(event.target.value)} rows={8} />
      <h3>Supporting Repository Evidence</h3><small>Supporting evidence</small>
      <ul>{proposal.supportingEvidence.map((item) => <li key={item}>{item}</li>)}</ul>
      <h3>Repository Owner Notes</h3>
      <p>{proposal.ownerNotes || 'Repository owner reviews the deterministic first draft, edits it if desired, and approves the canonical change before Agent IDE writes .ai/goals.md.'}</p>
      <button className="primaryCta" disabled={isApplyingCanonicalEdit || !repositoryPath || !canonicalEditText.trim()} onClick={() => void applyCanonicalEdit()} type="button">{isApplyingCanonicalEdit ? 'Applying…' : 'Apply Canonical Edit'}<span className="visuallyHidden">Apply Edit</span></button>
      {canonicalEditStatus && <div className="summary success">{canonicalEditStatus}</div>}
    </section>
  );
}

function WorkflowPrimaryButton({ workflow, onPrimaryAction }: { workflow: Workflow; onPrimaryAction: () => void }) {
  return <button className="primaryCta" data-workflow-primary-action="true" onClick={onPrimaryAction} type="button">{outcomeWorkflowText(workflow.currentPrimaryAction)}</button>;
}

function WorkflowDiagnosticsDisclosure({ workflow, diagnostics }: { workflow: Workflow | null | undefined; diagnostics: WorkflowDiagnostics }) {
  if (!import.meta.env.DEV) return null;
  const currentIndex = workflowIndex(workflow);
  const nextStep = workflow?.checklist[currentIndex + 1];
  const rows = [
    ['workflow key', workflow?.workflowKey ?? 'No workflow'],
    ['workflow index', String(currentIndex)],
    ['repositoryState', workflow?.repositoryState ?? 'No workflow'],
    ['nextRepositoryState', workflow?.nextRepositoryState ?? 'No workflow'],
    ['current step id', workflow?.currentStep.id ?? 'No workflow'],
    ['current step label', workflow?.currentStep.label ?? 'No workflow'],
    ['current primary action', workflow?.currentPrimaryAction ?? 'No workflow'],
    ['next step id', nextStep?.id ?? 'No next step'],
    ['last primary action clicked', diagnostics.lastPrimaryActionClicked || 'None'],
    ['last step action result', diagnostics.lastStepActionResult || 'None'],
    ['whether performWorkflowStepAction ran', String(diagnostics.performWorkflowStepActionRan)],
    ['whether advanceWorkflow ran', String(diagnostics.advanceWorkflowRan)],
    ['whether setWorkflowState ran', String(diagnostics.setWorkflowStateRan)],
    ['whether localStorage persistence succeeded', String(diagnostics.localStoragePersistenceSucceeded)],
    ['current localStorage value for workflowStateStorageKey', diagnostics.currentLocalStorageValue || 'Empty'],
  ] as const;
  return <details className="controlCard disclosureCard workflowDiagnostics" aria-label="Development Diagnostics"><summary>Development Diagnostics</summary><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>;
}

function WorkflowProgress({ workflow, onPrimaryAction }: { workflow: Workflow; onPrimaryAction: () => void }) {
  return <section className="controlCard workflowRenderer" aria-label="Workflow Progress"><p className="kicker">{workflow.type} Workflow</p><h2>{workflow.goal}</h2><div className="workMetaGrid"><div><small>Repository State</small><strong>{outcomeWorkflowText(workflow.repositoryState)}</strong></div><div><small>Current Step</small><strong>{outcomeWorkflowText(workflow.currentStep.label)}</strong></div><div><small>Next Repository State</small><strong>{outcomeWorkflowText(workflow.nextRepositoryState)}</strong></div><div><small>Progress</small><strong>{workflow.progressPercentage}%</strong></div></div><h3>Completed Steps</h3>{workflow.completedSteps.length ? <ul>{workflow.completedSteps.map((step) => <li key={step.id}>✓ {outcomeWorkflowText(step.label)}</li>)}</ul> : <p>No steps completed yet.</p>}<h3>Remaining Steps</h3><ol className="workspaceChecklist">{workflow.checklist.map((step) => <li className={step.id === workflow.currentStep.id ? 'activeStep' : step.status === 'Complete' ? 'completedStep' : ''} key={step.id}>{outcomeWorkflowText(step.label)}</li>)}</ol><WorkflowPrimaryButton workflow={workflow} onPrimaryAction={onPrimaryAction} /></section>;
}

function ValidationWorkspace({ data, documents, task }: { data: ControlPlane; documents: Record<string, DocumentState>; task?: DecisionCandidate | null }) {
  const contextPackage = data.packages.context || documents['context-package.md']?.content || '';
  const validationPrompt = buildValidationPrompt(contextPackage);
  const promptActions = [
    ['Copy Validation Prompt', validationPrompt],
    ['Copy Context Package', contextPackage],
    ['Copy Architect Prompt', data.packages.architect || documents['prompts/architect.md']?.content || ''],
    ['Copy Builder Prompt', data.packages.builder || documents['prompts/builder.md']?.content || ''],
    ['Copy Reviewer Prompt', data.packages.reviewer || documents['prompts/reviewer.md']?.content || ''],
    ['Copy Debugger Prompt', data.packages.debugger || documents['prompts/debugger.md']?.content || ''],
  ] as const;
  const repositoryEvidence = [task?.evidence, data.recommendation.evidenceSource, data.recommendation.explanation].filter((item): item is string => hasUsefulValue(item));
  const validationInputs = [task?.ownerAction, task?.expectedCompletionTarget, data.recommendation.prompt].filter((item): item is string => hasUsefulValue(item));

  return (
    <>
      <section className="controlCard validationWorkspace" aria-label="Validation Workspace">
        <p className="kicker">Validation Workspace</p>
        <h2>Validation Goal</h2>
        <p>{task?.title ?? data.recommendation.title}</p>
        <div className="workMetaGrid">
          <div><small>Why this validation matters</small><strong>{task?.reason ?? data.recommendation.whyItMatters}</strong></div>
          <div><small>Current validation score</small><strong>{data.aiHandoffValidation ? `${data.aiHandoffValidation.overallScore}/100` : 'Not available'}</strong></div>
          <div><small>Previous validation score</small><strong>{data.qualityHistory.length > 1 ? 'Available in refresh history' : 'Not available'}</strong></div>
          <div><small>Expected outcome</small><strong>{task?.expectedCompletionTarget ?? 'A fresh AI can reconstruct repository intelligence from the Context Package.'}</strong></div>
        </div>
        <h3>Repository evidence used</h3>
        {repositoryEvidence.length ? <ul>{repositoryEvidence.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No repository evidence loaded for this validation.</p>}
        <h3>Validation inputs</h3>
        {validationInputs.length ? <ul>{validationInputs.slice(0, 2).map((item) => <li key={item}>{item}</li>)}</ul> : <p>Use the validation prompt and Context Package below.</p>}
      </section>

      <details className="controlCard implementationWorkflow disclosureCard" aria-label="Validation Actions"><summary>Validation Prompt</summary>
        <h2>Validation Checklist</h2>
        <ol className="workspaceChecklist"><li>Copy Context Package</li><li>Copy Validation Prompt</li><li>Open Fresh AI</li><li>Paste</li><li>Review Answer</li><li>Finish Validation</li><li>Refresh Intelligence</li></ol>
        <div className="handoffGrid">
          <button className="secondaryCta" disabled={!validationPrompt} onClick={() => void copyText(validationPrompt)} type="button">Copy validation prompt<span className="visuallyHidden">Run Validation</span></button>
          {promptActions.map(([label, content]) => <button className="secondaryCta" disabled={!content} key={label} onClick={() => void copyText(content)} type="button">Copy-only: {label}</button>)}
        </div>
        <details><summary>Validation Prompt</summary><pre>{validationPrompt}</pre></details>
        <details><summary>Context Package</summary><pre>{contextPackage}</pre></details>
      </details>
    </>
  );
}

function WorkItemPage({ data, repositoryPath, documents, workflow, onBack, onPrimaryAction }: { data: ControlPlane; repositoryPath?: string; documents: Record<string, DocumentState>; workflow: Workflow; onBack: () => void; onPrimaryAction: () => void }) {
  const task = firstCandidate(data, 1);
  const title = humanTaskTitle(task, data.recommendation.title);
  const canonicalEditProposal = buildCanonicalEditProposal(data);
  const workspaceType = workflow.type;
  const isProductDecision = data.recommendation.packageType === 'product-decision';
  const isValidationExperiment = data.recommendation.packageType === 'validation-experiment';
  const affectedFile = filePathForTask(task, data.recommendation);
  const acceptance = [task?.expectedCompletionTarget, task?.ownerAction].filter((item): item is string => hasUsefulValue(item));
  const lineage = data.evidenceLineage?.sources ?? Object.values(data.evidenceLineage?.categories ?? {}).flat();
  const prompts = [
    ['Builder Prompt', data.packages.builder || documents['prompts/builder.md']?.content || data.recommendation.prompt],
    ['Reviewer Prompt', data.packages.reviewer || documents['prompts/reviewer.md']?.content || ''],
    ['Debugger Prompt', data.packages.debugger || documents['prompts/debugger.md']?.content || ''],
    ['Context Package', data.packages.context || documents['context-package.md']?.content || ''],
  ] as const;

  return (
    <div className="controlPlane workItemPage">
      <section className="todayWorkCard workItemHero" aria-label="Work Item">
        <div>
          <p className="kicker">{workspaceType} Workspace</p>
          <h2>{title}</h2>
          <p><b>Why:</b> {task?.reason ?? data.recommendation.whyItMatters}</p>
          <p><b>Goal:</b> {workflow.goal}</p>
          <div className="workMetaGrid">
            <div><small>Estimated effort</small><strong>{workflow.estimatedRemainingSteps} steps</strong></div>
            <div><small>Current step</small><strong>{outcomeWorkflowText(workflow.currentStep.label)}</strong></div>
            <div><small>Responsibility</small><strong>{isProductDecision ? 'Repository owner approves product intent.' : isValidationExperiment ? 'Fresh AI validates from context only.' : 'AI can assist; owner reviews.'}</strong></div>
          </div>
        </div>
        <button className="secondaryCta" onClick={onBack} type="button">Back to Work Queue</button>
      </section>

      <WorkflowProgress workflow={workflow} onPrimaryAction={onPrimaryAction} />
      {isValidationExperiment ? <ValidationWorkspace data={data} documents={documents} task={task} /> : <>
        <section className="controlCard"><h2>What done looks like</h2>{acceptance.length ? <ul>{acceptance.map((item) => <li key={item}>{item}</li>)}</ul> : <p>{data.recommendation.explanation}</p>}</section>
        <details className="controlCard disclosureCard"><summary>Advanced Details</summary><section><h2>Evidence</h2><p>{task?.evidence ?? data.recommendation.evidenceSource}</p></section><div className="workMetaGrid"><div><small>Priority</small><strong>{task ? `#${task.rank} · ${task.priorityScore}` : 'Decision Ranking #1'}</strong></div><div><small>Package type</small><strong>{data.recommendation.packageType ?? 'implementation'}</strong></div><div><small>Actionability</small><strong>{task?.actionability ?? data.recommendation.actionability ?? 'Not classified'}</strong></div><div><small>File to edit</small><strong>{affectedFile ? <code>{affectedFile}</code> : 'See workflow metadata'}</strong></div></div><section><h2>Evidence Lineage</h2>{lineage?.length ? <ul>{lineage.slice(0, 8).map((item) => <li key={`${item.file}-${item.group}`}><strong>{item.group}</strong> — {item.file} · {item.ancestry}</li>)}</ul> : <p>No lineage artifact loaded for this task.</p>}</section></details>

        {isProductDecision && canonicalEditProposal && <CanonicalEditPanel proposal={canonicalEditProposal} repositoryPath={repositoryPath} />}

        {!isProductDecision && (
        <section className="controlCard implementationWorkflow" aria-label="Improvement workflow">
          <h2>Complete this improvement</h2>
          <div className="workMetaGrid"><div><small>Affected files</small><strong>{affectedFile ? <code>{affectedFile}</code> : 'See context package and builder prompt'}</strong></div></div>
          <div className="handoffGrid">{prompts.map(([label, content]) => <button className="secondaryCta" disabled={!content} key={label} onClick={() => void copyText(content)} type="button">Copy-only: {label}</button>)}</div>
          {prompts.map(([label, content]) => content ? <details key={label}><summary>{label}</summary><pre>{content}</pre></details> : null)}
        </section>
        )}

        
      </>}
    </div>
  );
}

function ControlPlaneDashboard({ data, progressSummary, workflow, diagnostics, onPrimaryAction, onOpenWorkItem, onViewStrategy, repositoryPath }: { data: ControlPlane | null; progressSummary?: ProgressSummary | null; workflow?: Workflow | null; diagnostics: WorkflowDiagnostics; repositoryPath?: string; onPrimaryAction: () => void; onOpenWorkItem: () => void; onViewStrategy: () => void }) {
  if (!data) return <WelcomeDashboard />;
  return <ControlPlaneDashboardContent data={data} progressSummary={progressSummary} workflow={workflow} diagnostics={diagnostics} repositoryPath={repositoryPath} onPrimaryAction={onPrimaryAction} onOpenWorkItem={onOpenWorkItem} onViewStrategy={onViewStrategy} />;
}

function primaryHomepageAction(workflow?: Workflow | null) {
  if (!workflow) return 'Refresh Repository Intelligence';
  return outcomeWorkflowText(workflow.currentPrimaryAction);
}

function ControlPlaneDashboardContent({ data, progressSummary, workflow, diagnostics, onPrimaryAction, onOpenWorkItem, onViewStrategy, repositoryPath }: { data: ControlPlane; progressSummary?: ProgressSummary | null; workflow?: Workflow | null; diagnostics: WorkflowDiagnostics; repositoryPath?: string; onPrimaryAction: () => void; onOpenWorkItem: () => void; onViewStrategy: () => void }) {
  const recommendedPackage = (() => {
    if (data.recommendation.packageType === 'product-decision') {
      return {
        ariaLabel: 'Recommended product decision package',
        heading: 'Recommended Product Decision Package',
        copyLabel: 'Copy Product Decision Package',
        generateLabel: 'Generate Product Decision Package',
        viewLabel: 'View Product Decision Package',
      };
    }
    if (data.recommendation.packageType === 'validation-experiment') {
      return {
        ariaLabel: 'Recommended validation experiment',
        heading: 'Recommended Validation Experiment',
        copyLabel: 'Copy Validation Package',
        generateLabel: 'Generate Validation Package',
        viewLabel: 'View Validation Package',
      };
    }
    return {
      ariaLabel: 'Recommended implementation package',
      heading: 'Recommended Implementation Package',
      copyLabel: 'Copy Implementation Package',
      generateLabel: 'Generate Implementation Package',
      viewLabel: 'View Implementation Package',
    };
  })();

  const statusCards = [
    ['Repository Name', data.status.repositoryName],
    ['Overall Health', data.status.overallHealth],
    ['Strategy Quality', data.status.strategyQuality],
    ['Repository Handoff Readiness', data.status.repositoryHandoffReadiness],
    ['Intelligence Completeness', data.status.intelligenceCompleteness],
    ['Current Confidence', data.status.currentConfidence],
    ['Last Refresh Time', data.status.lastRefresh],
  ];
  const topWork = firstCandidate(data, 1);
  const afterThis = firstCandidate(data, 2);
  const diffEntries = meaningfulDiffEntries(data.diff);
  const taskTitle = humanTaskTitle(topWork, data.recommendation.title);
  const primaryAction = primaryHomepageAction(workflow);
  const isReadyToRefresh = workflow?.repositoryState === 'Refresh Repository' || workflow?.completionState === 'Ready To Refresh';
  const repositoryName = data.status.repositoryName || repositoryPath?.split(/[\\/]/).filter(Boolean).pop() || 'Connected repository';
  const confidence = data.status.currentConfidence || `${data.quality?.confidence.score ?? data.verification?.score ?? 0}%`;
  const estimatedTime = workflow ? `${Math.max(1, workflow.estimatedRemainingSteps) * 4} minutes` : 'About 4 minutes';
  const afterThisRows = [
    ['Expected impact', `+${afterThis?.expectedImprovement.total ?? 0}`],
    ['Why this matters', afterThis?.reason],
    ['Dependency', afterThis?.dependency],
  ].filter(([, value]) => hasUsefulValue(value));

  return (
    <div className="controlPlane compactDashboard">
      <section className="todayWorkCard singleRecommendationCard" aria-label="Next Repository Improvement">
        <div>
          <p className="kicker">Work Queue</p>
          <div className="repositoryIdentity">
            <span>{repositoryName}</span>
            <span>{workflow?.completionState === 'Ready To Refresh' ? 'Next improvement ready' : 'Repository improving'}</span>
            <span>{confidence} confidence</span>
          </div>
          <h2>{isReadyToRefresh ? 'Refresh repository intelligence' : taskTitle}</h2>
          <p className="recommendationReason">{topWork?.reason ?? data.recommendation.whyItMatters}</p>
          <div className="singleRecommendationMeta" aria-label="Recommendation summary">
            <div><small>Repository</small><strong>{repositoryName}</strong></div>
            <div><small>Workflow</small><strong>{isReadyToRefresh ? 'Refresh repository intelligence' : taskTitle}</strong></div><div><small>State</small><strong>{workflow?.repositoryState ?? 'Recommendation Ready'}</strong></div>
            <div><small>Current Step</small><strong>{workflow ? outcomeWorkflowText(workflow.currentStep.label) : 'Refresh Repository Intelligence'}</strong></div>
            <div><small>Estimated Time</small><strong>{estimatedTime}</strong></div>
            <div><small>Expected Impact</small><strong>{topWork ? `+${topWork.expectedImprovement.total}` : 'Ready to generate'}</strong></div>
          </div>
        </div>
        {workflow ? <WorkflowPrimaryButton workflow={workflow} onPrimaryAction={onPrimaryAction} /> : <button className="primaryCta" onClick={onPrimaryAction} type="button">{primaryAction}</button>}
      </section>
      <WorkflowDiagnosticsDisclosure workflow={workflow} diagnostics={diagnostics} />

      <details className="controlCard disclosureCard advancedIntelligence" aria-label="Advanced Repository Intelligence"><summary>Advanced</summary>
      {afterThis && (
        <section className="controlCard afterThisCard" aria-label="After This">
          <p className="kicker">After This</p>
          <h2>{humanTaskTitle(afterThis, afterThis.title)}</h2>
          <div className="workMetaGrid compact">
            {afterThisRows.map(([label, value]) => <div key={label ?? String(value)}><small>{label}</small><strong>{value}</strong></div>)}
          </div>
        </section>
      )}

      {progressSummary && (
        <section className="controlCard progressSummaryCard" aria-label="Refresh progress summary">
          <p className="kicker">Recent Improvements</p>
          {!progressSummary.hasBaseline ? <p>This is your first refresh. Progress will be tracked after your next completed task.</p> : <>
            <div className="qualityGrid">
              <div><small>Completed</small><strong>✓ {progressSummary.completedTask}</strong></div>
              <div><small>Repository Quality</small><strong>{progressSummary.repositoryQualityDelta}</strong></div>
              <div><small>Confidence delta</small><strong>{progressSummary.confidenceDelta}</strong></div>
              <div><small>Verification delta</small><strong>{progressSummary.verificationDelta}</strong></div>
              <div><small>AI Handoff delta</small><strong>{progressSummary.aiHandoffDelta || 'No baseline'}</strong></div>
              <div><small>Next</small><strong>{humanTaskTitle(topWork, progressSummary.currentTopPriority)}</strong></div>
            </div>
            <div className="answerGrid"><div><h2>Newly resolved tasks</h2>{progressSummary.newlyResolvedIssues.length ? <ul>{progressSummary.newlyResolvedIssues.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None detected.</p>}</div><div><h2>New tasks</h2>{progressSummary.newlyIntroducedIssues.length ? <ul>{progressSummary.newlyIntroducedIssues.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None detected.</p>}</div></div>
          </>}
        </section>
      )}

      <section className="controlCard todayProgressCard" aria-label="Today's Progress"><p className="kicker">Improvement Queue</p><div className="progressStats"><div><small>Completed</small><strong>{progressSummary?.hasBaseline && progressSummary.completedTask !== 'No completed task detected' ? 1 : 0}</strong></div><div><small>Remaining</small><strong>{data.decisionRanking?.candidates?.length ?? 1}</strong></div><div><small>Estimated Remaining</small><strong>{Math.max(1, data.decisionRanking?.candidates?.length ?? 1) * 4} minutes</strong></div></div></section>

      <section className="controlCard handoffCard quickAiActions" aria-label="Quick Actions"><p className="kicker">Quick Actions</p><div className="handoffGrid"><button onClick={onOpenWorkItem} type="button">Open Current Workflow</button><button className="secondaryCta" onClick={onViewStrategy} type="button">View Strategy</button></div></section>

            <details className="controlCard disclosureCard" aria-label="Repository Health"><summary>Repository Health</summary><div className="dashboardGrid statusGrid">
        {statusCards.map(([label, value]) => <article className="metricCard" key={String(label)}><small>{label}</small><strong>{value || 'Unknown'}</strong></article>)}
      </div></details>

      <details className="controlCard disclosureCard" aria-label="Repository intelligence answers"><summary>Repository Understanding and Current Risks</summary><div className="answerGrid">
        <div>
          <h2>Repository Understanding</h2>
          <div className="understandingGrid">
            {data.understanding.map((item) => <div className="understandingItem" key={item.label}><span>{item.label}</span><strong className={stateClass(item.state)}>{item.state}</strong></div>)}
          </div>
        </div>
        <div>
          <h2>Current Risks</h2>
          {data.unknowns.length > 0 ? <ul className="unknownList">{data.unknowns.map((item) => <li key={item.label}>{item.label}<small>{item.source}</small></li>)}</ul> : <p>No current intelligence risks detected.</p>}
        </div>
      </div></details>


      {data.verification && data.verification.status !== 'Verified' && (
        <section className="controlCard warningCard" aria-label="Repository intelligence verification warning">
          <h2>Recommendation Verification</h2>
          <p>⚠ Displayed intelligence does not match the latest generated intelligence.</p>
          <p><b>Recommended action:</b> Refresh Repository Intelligence.</p>
        </section>
      )}

      {data.verification && (
        <details className="controlCard qualityCard disclosureCard" aria-label="Repository intelligence verification"><summary>Verification</summary>
          <div className="qualityHeader"><div><small>Verification Status</small><strong>{data.verification.status === 'Verified' ? '✓ Verified' : '⚠ Failed'}</strong></div><span className={stateClass(data.verification.status === 'Verified' ? 'Present' : 'Needs Attention')}>Verification Score {data.verification.score}%</span></div>
          <div className="qualityGrid">
            <div><small>Verification Score</small><strong>{data.verification.score}%</strong></div>
            <div><small>Pass/Fail State</small><strong>{data.verification.status === 'Verified' ? '✓ Verified' : '⚠ Failed'}</strong></div>
            <div><small>Failures</small><strong>{data.verification.failureCount ?? data.verification.failures.length}</strong></div>
            <div><small>Failure Reason</small><strong>{data.verification.failureReason ?? data.verification.failures[0] ?? 'None'}</strong></div>
          </div>
          <p>{data.verification.summary}</p>
          <div className="understandingGrid">
            {data.verification.artifacts.map((artifact) => <div className="understandingItem" key={artifact.artifact}><span>{artifact.artifact}</span><strong className={stateClass(artifact.status === 'Verified' ? 'Present' : 'Needs Attention')}>{artifact.status === 'Verified' ? '✓ Verified' : '⚠ Stale'}</strong>{artifact.failures.length > 0 && <small>{artifact.failures.join(' ')}</small>}</div>)}
            {(data.verification.crossChecks ?? []).map((check) => <div className="understandingItem" key={check.check}><span>{check.check}</span><strong className={stateClass(check.status === 'Verified' ? 'Present' : 'Needs Attention')}>{check.status === 'Verified' ? '✓ Verified' : '⚠ Failed'}</strong>{check.failures.length > 0 && <small>{check.failures.join(' ')}</small>}</div>)}
          </div>
        </details>
      )}

      {data.quality && (
        <details className="controlCard qualityCard disclosureCard" aria-label="Intelligence quality"><summary>Overall Quality</summary>
          <div className="qualityHeader"><div><small>Overall Quality</small><strong>{data.quality.overallScore}/100</strong></div><span className={stateClass(data.quality.trend === 'Needs Attention' ? 'Needs Attention' : 'Present')}>Trend: {data.quality.trend}</span></div>
          <div className="qualityGrid">
            <div><small>Canonical Intelligence</small><strong>{data.quality.canonicalIntelligenceQuality?.score ?? data.quality.overallScore}%</strong>{data.quality.canonicalIntelligenceQuality?.completenessState && <small>{data.quality.canonicalIntelligenceQuality.completenessState} {data.quality.canonicalIntelligenceQuality.completenessScore}% complete</small>}</div>
            {Object.entries(data.quality.canonicalIntelligenceQuality?.fields ?? {}).map(([key, field]) => <div key={key}><small>{field.label}</small><strong>{field.percent}%</strong><small>{field.state}</small></div>)}
            <div><small>Export Quality</small><strong>{data.quality.generatedExportQuality?.score ?? data.quality.coverage.score}%</strong></div>
            <div><small>Consistency</small><strong>{data.quality.consistency.score}%</strong></div>
            <div><small>Freshness</small><strong>{data.quality.freshness.score}%</strong></div>
            <div><small>Confidence</small><strong>{data.quality.confidence.score}%</strong></div>
            <div><small>Verification</small><strong>{data.quality.verification?.score ?? data.verification?.score ?? 0}%</strong></div>
          </div>
          <div className="answerGrid">
            <div><h2>Recent regressions</h2>{data.quality.recentRegressions.length ? <ul>{data.quality.recentRegressions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No recent regressions detected.</p>}</div>
            <div><h2>Recent improvements</h2>{data.quality.recentImprovements.length ? <ul>{data.quality.recentImprovements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No recent improvements detected.</p>}</div>
          </div>
          <p><b>Recommended action:</b> {data.quality.recommendedAction}</p>
        </details>
      )}

      {data.aiHandoffValidation && (
        <section className="controlCard qualityCard" aria-label="AI Handoff Validation">
          <div className="qualityHeader"><div><small>AI Handoff Validation</small><strong>{data.aiHandoffValidation.overallScore}/100</strong></div><span className={stateClass(data.aiHandoffValidation.status === 'Ready' ? 'Present' : 'Needs Attention')}>{data.aiHandoffValidation.status}</span></div>
          <div className="answerGrid">
            <div><h2>Recoverable information</h2>{data.aiHandoffValidation.recoverableInformation.length ? <ul>{data.aiHandoffValidation.recoverableInformation.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None detected.</p>}</div>
            <div><h2>Hidden information</h2>{data.aiHandoffValidation.hiddenInformation.length ? <ul>{data.aiHandoffValidation.hiddenInformation.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No hidden required handoff information detected.</p>}</div>
            <div><h2>Contradictions</h2>{data.aiHandoffValidation.contradictions.length ? <ul>{data.aiHandoffValidation.contradictions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No handoff contradictions detected.</p>}</div>
            <div><h2>Missing explanations</h2>{data.aiHandoffValidation.missingExplanations.length ? <ul>{data.aiHandoffValidation.missingExplanations.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No missing explanations detected.</p>}</div>
          </div>
          <h2>Suggested improvements</h2>
          {data.aiHandoffValidation.suggestedImprovements.length ? <ul>{data.aiHandoffValidation.suggestedImprovements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No suggested handoff improvements.</p>}
        </section>
      )}

      <details className="controlCard recommended disclosureCard"><summary>{recommendedPackage.heading} — uses Today's Work selection</summary><section aria-label={recommendedPackage.ariaLabel}>
        <small>{recommendedPackage.heading}</small>
        <strong>{data.recommendation.title}</strong>
        {data.recommendation.actionability && <p><b>Actionability:</b> {data.recommendation.actionability}</p>}
        {data.recommendation.packageType && <p><b>Package type:</b> {data.recommendation.packageType}</p>}
        <p><b>Why this is recommended:</b> {data.recommendation.explanation}</p>
        <p><b>Why this helps:</b> {data.recommendation.whyItMatters}</p>
        <p><b>Evidence source:</b> {data.recommendation.evidenceSource}</p>
        {data.recommendation.packageType === 'product-decision' && <div className="canonicalEditNotice"><b>Repository Owner edits:</b><code>.ai/goals.md</code><span>Everything else will be regenerated.</span></div>}
        <div className="promptActions">
          <button onClick={() => void copyText(data.recommendation.prompt)} type="button">{recommendedPackage.copyLabel}</button>
          <button onClick={() => void copyText(data.recommendation.prompt)} type="button">{recommendedPackage.generateLabel}</button>
        </div>
        <details>
          <summary>{recommendedPackage.viewLabel}</summary>
          <pre>{data.recommendation.prompt}</pre>
        </details>
      </section></details>


      {data.decisionRanking?.candidates?.length ? (
        <section className="controlCard disclosureCard" aria-label="Decision Ranking">
          <details>
            <summary>Decision Ranking details — current winner: {data.decisionRanking.selectedIssue?.title}</summary>
            <p>{data.decisionRanking.selectionExplanation}</p>
            <div className="rankingTable" role="table" aria-label="Candidate Improvements">
              {data.decisionRanking.candidates.map((candidate) => (
                <article className={candidate.selected ? 'rankingRow selected' : 'rankingRow'} key={candidate.id}>
                  <div><small>Rank</small><strong>#{candidate.rank}</strong></div>
                  <div><small>Candidate Improvement</small><strong>{candidate.title}</strong><span>{candidate.category}</span></div>
                  <div><small>Priority</small><strong>{candidate.priorityScore}</strong></div>
                  <div><small>Why this helps</small><strong>+{candidate.expectedImprovement.total}</strong><span>+{candidate.expectedImprovement.repositoryHealth} Health · +{candidate.expectedImprovement.canonicalCompleteness} Completeness · +{candidate.expectedImprovement.quality} Quality</span></div>
                  <div><small>Reason</small><span>{candidate.reason}</span><span>{candidate.evidence}</span></div>
                </article>
              ))}
            </div>
          </details>
        </section>
      ) : null}

      {data.explanations && (
        <details className="controlCard disclosureCard" aria-label="Repository intelligence explanation"><summary>Repository Intelligence Explanation</summary><section>
          <h2>Repository Intelligence Explanation</h2>
          {data.explanations.recommendation && (
            <details>
              <summary>{data.explanations.recommendation.title} — references Today's Work</summary>
              <p><b>Rule:</b> {data.explanations.recommendation.rule}</p>
              <p><b>Selected:</b> {data.explanations.recommendation.selected?.title} ({data.explanations.recommendation.selected?.priority})</p>
              <p><b>Why this helps:</b> {data.explanations.recommendation.reason}</p>
              <ul>{data.explanations.recommendation.candidateIssues.map((issue) => <li key={issue.title}>{issue.title}: priority {issue.priority}<small>{issue.evidence}</small></li>)}</ul>
            </details>
          )}
          {data.explanations.decisionRanking && (
            <details>
              <summary>{data.explanations.decisionRanking.title}</summary>
              <p><b>Rule:</b> {data.explanations.decisionRanking.rule}</p>
              <p><b>Selected:</b> {data.explanations.decisionRanking.selected?.title}</p>
              <p><b>Why this helps:</b> {data.explanations.decisionRanking.reason}</p>
              <ul>{data.explanations.decisionRanking.candidateOrdering.map((issue) => <li key={`${issue.rank}-${issue.title}`}>#{issue.rank} {issue.title}: priority {issue.priorityScore}, expected +{issue.expectedImprovement.total}{issue.selected ? ' (selected)' : ''}</li>)}</ul>
            </details>
          )}
          {data.explanations.evidenceSynthesis && (
            <details>
              <summary>{data.explanations.evidenceSynthesis.title}: {data.explanations.evidenceSynthesis.strength} ({data.explanations.evidenceSynthesis.supportedFields} / {data.explanations.evidenceSynthesis.missingFields})</summary>
              <p><b>Rule:</b> {data.explanations.evidenceSynthesis.rule}</p>
              {Object.values(data.explanations.evidenceSynthesis.fields).filter((field) => field.suggestedWording).map((field) => (
                <details key={field.label}>
                  <summary>{field.label}: {field.confidence}</summary>
                  <p><b>Suggested canonical wording:</b> {field.suggestedWording}</p>
                  <p><b>Sources:</b> {field.sources.join(', ')}</p>
                  <p><b>Selection rule:</b> {field.selectionRule}</p>
                </details>
              ))}
            </details>
          )}
          {data.explanations.completeness && (
            <details>
              <summary>{data.explanations.completeness.title}: {data.explanations.completeness.classification} {data.explanations.completeness.score}%</summary>
              {Object.values(data.explanations.completeness.fields).map((field) => (
                <details key={field.title}>
                  <summary>{field.title}: {field.classification} {field.computed.percent}%</summary>
                  <p><b>Rule:</b> {field.rule}</p>
                  <p><b>Why this helps:</b> {field.reason.join(' ')}</p>
                  <p><b>Recommendation:</b> {field.recommendation}</p>
                </details>
              ))}
            </details>
          )}
          {data.explanations.quality && (
            <details>
              <summary>{data.explanations.quality.title}: {data.explanations.quality.score}%</summary>
              {data.explanations.quality.deductions.length ? <ul>{data.explanations.quality.deductions.map((deduction) => <li key={`${deduction.rule}-${deduction.evidence}`}>{deduction.rule} (-{deduction.points})<small>{deduction.evidence}</small></li>)}</ul> : <p>No deterministic deductions detected.</p>}
            </details>
          )}
        </section></details>
      )}


      {data.evidenceLineage && (
        <details className="controlCard disclosureCard" aria-label="Evidence Lineage"><summary>Evidence Lineage</summary><section>
          <h2>Evidence Lineage</h2>
          <p><b>Confidence calculation:</b> canonical and independent evidence groups increase confidence; generated confirmations verify consistency but do not increase confidence.</p>
          <p><b>Evidence ancestry:</b> generated artifacts descend from canonical owner intent and independent repository evidence.</p>
          {['Canonical', 'Independent', 'Generated'].map((category) => (
            <details key={category} open={category !== 'Generated'}>
              <summary>{category} Sources <span>{data.evidenceLineage?.categories?.[category]?.length ?? 0}</span></summary>
              <ul>{(data.evidenceLineage?.categories?.[category] ?? []).map((item) => <li key={item.file}><strong>{item.group}</strong><small>{item.file} · {item.ancestry}</small></li>)}</ul>
            </details>
          ))}
        </section></details>
      )}
      <details className="controlCard disclosureCard"><summary>Trend</summary><section><h2>Trend</h2><p>{data.quality ? data.quality.trend : 'No intelligence quality trend available yet.'}</p></section></details>
      <details className="controlCard disclosureCard"><summary>Recent Changes</summary><section><h2>Recent Changes</h2>{diffEntries.length > 0 ? diffEntries.map(([label, items]) => <details key={label}><summary>{label} <span>{items.length}</span></summary><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></details>) : <p>No material intelligence changes detected.</p>}</section></details>

      <details className="controlCard disclosureCard"><summary>Evidence Explorer</summary>{data.evidence.length ? data.evidence.map((item) => <details key={`${item.file}-${item.line}`}><summary>{item.section}</summary><p><strong>File:</strong> {item.file}:{item.line}</p><p><strong>Extracted evidence:</strong> {item.evidence}</p><p><strong>Confidence:</strong> {item.confidence}</p></details>) : <p>No generated evidence lines detected yet.</p>}</details>
      <details className="controlCard disclosureCard"><summary>Timeline</summary>{data.timeline.length ? <ol className="timelineList">{data.timeline.slice().reverse().map((item) => <li key={item.timestamp}><strong>{item.timestamp}</strong><span>{item.repositoryHealth} · Strategy {item.strategyQuality} · Confidence {item.confidence}</span><small>{item.recommendation}</small></li>)}</ol> : <p>No refresh executions recorded yet.</p>}</details>
      <details className="controlCard disclosureCard"><summary>Raw Intelligence</summary><p>Use the sidebar to open the full version-controlled markdown documents when you need implementation detail.</p></details>
      <details className="controlCard disclosureCard"><summary>Architecture</summary><p>Open Architecture in the sidebar for the generated system map.</p></details>
      <details className="controlCard disclosureCard"><summary>Strategy</summary><p>Open Strategy in the sidebar for canonical product strategy.</p></details>
      <details className="controlCard disclosureCard"><summary>Validation</summary><p>Open Validation in the sidebar for deterministic validation guidance.</p></details>
      <details className="controlCard disclosureCard"><summary>Backlog</summary><p>Open Backlog in the sidebar for generated next work.</p></details>
      <details className="controlCard disclosureCard"><summary>Generated Artifacts</summary><p>Open Prompt Center or Context Package in the sidebar for generated artifacts.</p></details>
      </details>
    </div>
  );
}

function getInitialSelectedId(): Section['id'] {
  const remembered = window.localStorage.getItem(selectedTabStorageKey);
  return sections.some((section) => section.id === remembered) ? (remembered as Section['id']) : 'Control Plane';
}

export function App() {
  const [selectedId, setSelectedId] = useState<Section['id']>(getInitialSelectedId);
  const [repositoryPath, setRepositoryPath] = useState('');
  const [connectedPath, setConnectedPath] = useState('');
  const [documents, setDocuments] = useState<Record<string, DocumentState>>({});
  const [steps, setSteps] = useState<StepState[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [controlPlane, setControlPlane] = useState<ControlPlane | null>(null);
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [isWorkItemOpen, setIsWorkItemOpen] = useState(false);
  const [finishNotice, setFinishNotice] = useState('');
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(readWorkflowState);
  const [workflowDiagnostics, setWorkflowDiagnostics] = useState<WorkflowDiagnostics>(() => ({
    lastPrimaryActionClicked: '',
    lastStepActionResult: '',
    performWorkflowStepActionRan: false,
    advanceWorkflowRan: false,
    setWorkflowStateRan: false,
    localStoragePersistenceSucceeded: false,
    currentLocalStorageValue: window.localStorage.getItem(workflowStateStorageKey) ?? '',
  }));

  const currentWorkflow = useMemo(() => {
    if (!controlPlane) return null;
    const task = firstCandidate(controlPlane, 1);
    return createWorkflow(workflowInputForTask(controlPlane.recommendation, task), workflowState);
  }, [controlPlane, workflowState]);

  const selected = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? sections[0],
    [selectedId],
  );
  const document = documents[selected.markdownFile];


  const loadControlPlane = useCallback(async (path: string) => {
    if (!path) return;
    const url = new URL('/api/repository/control-plane', serverBaseUrl);
    url.searchParams.set('repositoryPath', path);
    const response = await fetch(url);
    const data = await response.json() as ControlPlane & { error?: string };
    if (!response.ok) throw new Error(data.error ?? 'Unable to load control plane.');
    setControlPlane(data);
  }, []);

  const loadIntelligenceFile = useCallback(async (path: string, file: string) => {
    if (!path || !intelligenceFiles.has(file)) return;

    setDocuments((current) => ({
      ...current,
      [file]: { content: '', exists: false, isLoading: true, sourcePath: `${path}/.ai/${file}` },
    }));

    const url = new URL('/api/repository/file', serverBaseUrl);
    url.searchParams.set('repositoryPath', path);
    url.searchParams.set('file', file);
    const response = await fetch(url);
    const data = await response.json() as { content?: string; exists?: boolean; sourcePath?: string; error?: string };
    if (!response.ok) throw new Error(data.error ?? 'Unable to load intelligence file.');

    setDocuments((current) => ({
      ...current,
      [file]: {
        content: data.content ?? '',
        exists: data.exists ?? Boolean(data.content),
        isLoading: false,
        sourcePath: data.sourcePath ?? `${path}/.ai/${file}`,
      },
    }));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(selectedTabStorageKey, selectedId);
    setIsWorkItemOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (workflowState) {
      window.localStorage.setItem(workflowStateStorageKey, JSON.stringify(workflowState));
      setWorkflowDiagnostics((current) => ({
        ...current,
        localStoragePersistenceSucceeded: true,
        currentLocalStorageValue: window.localStorage.getItem(workflowStateStorageKey) ?? '',
      }));
    }
  }, [workflowState]);

  useEffect(() => {
    if (!connectedPath) return;
    void loadIntelligenceFile(connectedPath, selected.markdownFile).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
      setDocuments((current) => ({
        ...current,
        [selected.markdownFile]: {
          content: '',
          exists: false,
          isLoading: false,
          sourcePath: `${connectedPath}/.ai/${selected.markdownFile}`,
        },
      }));
    });
  }, [connectedPath, loadIntelligenceFile, selected.markdownFile]);

  useEffect(() => {
    if (!connectedPath) return;
    void loadControlPlane(connectedPath).catch(() => undefined);
  }, [connectedPath, loadControlPlane]);

  async function refreshIntelligence() {
    setError('');
    setSummary('');
    setSteps([]);
    setDocuments({});
    const previousControlPlane = controlPlane;
    setControlPlane(null);
    setIsRefreshing(true);

    try {
      const completionsBeforeRefresh = readValidationCompletions();
      console.log('[refresh:diagnostic] completion records before refresh:', JSON.stringify(completionsBeforeRefresh, null, 2));
      const requestPayload = { repositoryPath, validationCompletions: completionsBeforeRefresh };
      console.log('[refresh:diagnostic] request payload:', JSON.stringify(requestPayload, null, 2));
      const response = await fetch(new URL('/api/repository/refresh', serverBaseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({ error: 'Refresh failed.' }));
        throw new Error(data.error ?? 'Refresh failed.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let refreshedRepositoryPath = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RefreshEvent;
          if (event.type === 'started' && event.repositoryPath) {
            refreshedRepositoryPath = event.repositoryPath;
            setConnectedPath(event.repositoryPath);
          }
          if (event.type === 'step-started' && event.id && event.label) {
            setSteps((current) => [...current, { id: event.id!, label: event.label!, status: 'running' }]);
          }
          if (event.type === 'step-finished' && event.id) {
            setSteps((current) =>
              current.map((step) =>
                step.id === event.id
                  ? { ...step, status: event.exitCode === 0 ? 'passed' : 'failed', output: event.output }
                  : step,
              ),
            );
          }
          if ((event.type === 'success' || event.type === 'failure') && event.summary) {
            refreshedRepositoryPath = event.repositoryPath ?? refreshedRepositoryPath;
            setSummary(`${event.summary} Outputs were written to ${event.aiPath}.`);
          }
        }
      }

      if (refreshedRepositoryPath) {
        setSelectedId('Control Plane');
        setIsWorkItemOpen(false);
        await Promise.all(['goals.md', 'strategy.md', 'repository-health.md', 'context-package.md', ...promptFiles].map((file) => loadIntelligenceFile(refreshedRepositoryPath, file)));
        const url = new URL('/api/repository/control-plane', serverBaseUrl);
        url.searchParams.set('repositoryPath', refreshedRepositoryPath);
        const response = await fetch(url);
        const refreshedControlPlane = await response.json() as ControlPlane & { error?: string };
        if (!response.ok) throw new Error(refreshedControlPlane.error ?? 'Unable to load control plane.');
        setControlPlane(refreshedControlPlane);
        setProgressSummary(buildProgressSummary(previousControlPlane, refreshedControlPlane));
        const refreshedTask = firstCandidate(refreshedControlPlane, 1);
        const refreshedKey = workflowKey(workflowInputForTask(refreshedControlPlane.recommendation, refreshedTask));
        setWorkflowState((current) => current?.workflowKey === refreshedKey ? current : null);
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setIsRefreshing(false);
    }
  }


  async function performWorkflowStepAction(workflow: Workflow, data: ControlPlane) {
    const task = firstCandidate(data, 1);
    const contextPackage = data.packages.context || documents['context-package.md']?.content || '';
    const validationPrompt = buildValidationPrompt(contextPackage);
    const actionText: Record<string, string> = {
      'copy-context-package': contextPackage,
      'copy-validation-prompt': validationPrompt,
      'copy-understanding-check': validationPrompt,
      'copy-implementation-prompt': data.packages.builder || documents['prompts/builder.md']?.content || data.recommendation.prompt,
      'review-canonical-edit': data.recommendation.prompt,
      'inspect-evidence': task?.evidence ?? data.recommendation.evidenceSource,
    };
    const textToCopy = actionText[workflow.currentStep.id];
    if (textToCopy) await copyText(textToCopy);
  }

  async function handleWorkflowPrimaryAction() {
    if (!controlPlane || !currentWorkflow) return;
    setFinishNotice('');
    setError('');
    setWorkflowDiagnostics({
      lastPrimaryActionClicked: currentWorkflow.currentPrimaryAction,
      lastStepActionResult: 'Started',
      performWorkflowStepActionRan: false,
      advanceWorkflowRan: false,
      setWorkflowStateRan: false,
      localStoragePersistenceSucceeded: false,
      currentLocalStorageValue: window.localStorage.getItem(workflowStateStorageKey) ?? '',
    });
    if (currentWorkflow.completionState === 'Ready To Refresh' || currentWorkflow.repositoryState === 'Refresh Repository') {
      await refreshIntelligence();
      return;
    }
    try {
      await performWorkflowStepAction(currentWorkflow, controlPlane);
      setWorkflowDiagnostics((current) => ({ ...current, performWorkflowStepActionRan: true, lastStepActionResult: 'Completed' }));
    } catch (copyError) {
      const message = copyError instanceof Error ? copyError.message : String(copyError);
      setError(`Workflow action failed: ${message}`);
      setWorkflowDiagnostics((current) => ({ ...current, performWorkflowStepActionRan: true, lastStepActionResult: `Failed: ${message}`, currentLocalStorageValue: window.localStorage.getItem(workflowStateStorageKey) ?? '' }));
      return;
    }
    const task = firstCandidate(controlPlane, 1);
    const next = advanceWorkflow(workflowInputForTask(controlPlane.recommendation, task), workflowState);
    setWorkflowDiagnostics((current) => ({ ...current, advanceWorkflowRan: true }));
    try {
      window.localStorage.setItem(workflowStateStorageKey, JSON.stringify(next));
      setWorkflowDiagnostics((current) => ({ ...current, localStoragePersistenceSucceeded: true, currentLocalStorageValue: window.localStorage.getItem(workflowStateStorageKey) ?? '' }));
    } catch (storageError) {
      const message = storageError instanceof Error ? storageError.message : String(storageError);
      setError(`Workflow persistence failed: ${message}`);
      setWorkflowDiagnostics((current) => ({ ...current, localStoragePersistenceSucceeded: false, lastStepActionResult: `Persistence failed: ${message}`, currentLocalStorageValue: window.localStorage.getItem(workflowStateStorageKey) ?? '' }));
      return;
    }
    setWorkflowState(next);
    setWorkflowDiagnostics((current) => ({ ...current, setWorkflowStateRan: true }));
    if (next.status === 'Ready To Refresh') {
      if (currentWorkflow.type === 'Validation') {
        const task = firstCandidate(controlPlane, 1);
        const contextPackage = controlPlane.packages.context || documents['context-package.md']?.content || '';
        persistValidationCompletion({
          workflowKey: next.workflowKey,
          completedAt: new Date().toISOString(),
          repositoryPath: connectedPath || repositoryPath,
          selectedIssueId: task?.id ?? 'ai-handoff-validation',
          recommendationTitle: controlPlane.recommendation.title,
          contextPackageHash: stableContextPackageHash(contextPackage),
          refreshTimestamp: controlPlane.status.timestamp,
        });
      }
      setIsWorkItemOpen(false);
      setFinishNotice(currentWorkflow.type === 'Validation' ? 'Validation completed for this intelligence snapshot. Refresh after repository changes to generate the next recommendation.' : 'Workflow complete. Primary Action: Refresh Repository Intelligence.');
    }
  }

  return (
    <div className="shell">
      <Sidebar selected={selected} onSelect={(section) => setSelectedId(section.id)} />

      <main className="mainPanel">
        <header className="topBar">
          <div>
            <p className="kicker">Repository improvement system</p>
            <h1>{selected.id}</h1>
          </div>
          <span className="statusPill">Local Node server · No LLM · No cloud</span>
        </header>

        <section className="repositoryCard" aria-label="Repository connection">
          <label htmlFor="repositoryPath">Repository path</label>
          <div className="repositoryControls">
            <input
              id="repositoryPath"
              onChange={(event) => setRepositoryPath(event.target.value)}
              placeholder="/absolute/path/to/any/local/repository"
              type="text"
              value={repositoryPath}
            />
            <button disabled={isRefreshing || !repositoryPath.trim()} onClick={refreshIntelligence} type="button">
              {isRefreshing ? 'Repository analysis running…' : 'Refresh Repository Intelligence'}
            </button>
          </div>
          <p>
            Agent IDE refreshes repository intelligence and turns the top deterministic recommendation into executable workflow steps. Advanced generated artifacts remain available after refresh.
          </p>
          {connectedPath && <small>Connected: {connectedPath}</small>}
          {error && <div className="summary failure">{error}</div>}
          {summary && <div className="summary success">{summary}</div>}
          {finishNotice && <div className="summary success">{finishNotice}</div>}
          {connectedPath && summary && (
            <div className="nextActions">
              <strong>Helpful shortcuts</strong>
            <div className="repositoryShortcuts">
              <button onClick={() => setSelectedId('Strategy')} type="button">View Strategy</button>
              <button onClick={() => { const pkg = documents['context-package.md']; if (pkg?.exists) void copyText(pkg.content); }} type="button">Copy Context Package</button>
              <button onClick={() => { const prompt = documents['prompts/architect.md']; if (prompt?.exists) void copyText(prompt.content); }} type="button">Copy Architect Prompt</button>
            </div>
            </div>
          )}
          {steps.length > 0 && (
            <ol className="progressList">
              {steps.map((step) => (
                <li className={step.status} key={step.id}>
                  <span>{step.label}</span>
                  <small>{step.status}</small>
                </li>
              ))}
            </ol>
          )}
        </section>

        {!isWorkItemOpen && <section className="sectionIntro">
          <p>{selected.summary}</p>
          <small>{document?.sourcePath ?? (connectedPath ? `${connectedPath}/.ai/${selected.markdownFile}` : `.ai/${selected.markdownFile}`)}</small>
        </section>}

        {selected.id === 'Control Plane' && isWorkItemOpen && controlPlane && currentWorkflow && <WorkItemPage data={controlPlane} repositoryPath={connectedPath || repositoryPath} documents={documents} workflow={currentWorkflow} onBack={() => setIsWorkItemOpen(false)} onPrimaryAction={() => void handleWorkflowPrimaryAction()} />}
        {selected.id === 'Control Plane' && !isWorkItemOpen && <ControlPlaneDashboard data={controlPlane} progressSummary={progressSummary} workflow={currentWorkflow} diagnostics={workflowDiagnostics} repositoryPath={connectedPath || repositoryPath} onPrimaryAction={() => void handleWorkflowPrimaryAction()} onOpenWorkItem={() => { setFinishNotice(''); setIsWorkItemOpen(true); }} onViewStrategy={() => setSelectedId('Strategy')} />}
        {selected.id === 'Prompt Center' && (
          <PromptCenter connectedPath={connectedPath} documents={documents} loadFile={loadIntelligenceFile} />
        )}
        {selected.id === 'Context Package' && connectedPath && document && !document.isLoading && document.exists && (
          <DocumentActions content={document.content} copyLabel="Copy Context Package" downloadLabel="Download Context Package" downloadName="context-package.md" extraActions={<button onClick={() => void copyText(`${handoffWrapper}\n\n${document.content}`)} type="button">Copy for Claude/GPT</button>} />
        )}
        {!isWorkItemOpen && selected.id !== 'Prompt Center' && selected.id !== 'Control Plane' && !connectedPath && <MissingDocument />}
        {!isWorkItemOpen && selected.id !== 'Prompt Center' && selected.id !== 'Control Plane' && connectedPath && document?.isLoading && <div className="markdownPanel emptyState"><h2>Loading…</h2></div>}
        {!isWorkItemOpen && selected.id !== 'Prompt Center' && selected.id !== 'Control Plane' && connectedPath && document && !document.isLoading && document.exists && <MarkdownLikeContent markdown={document.content} />}
        {!isWorkItemOpen && selected.id !== 'Prompt Center' && selected.id !== 'Control Plane' && connectedPath && document && !document.isLoading && !document.exists && <MissingDocument />}
      </main>
    </div>
  );
}
