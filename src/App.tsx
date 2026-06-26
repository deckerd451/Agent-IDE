import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sections, type Section } from './sections';

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

type DocumentState = {
  content: string;
  exists: boolean;
  isLoading: boolean;
  sourcePath: string;
};

const handoffWrapper = 'Using only this repository intelligence package, explain the product, current focus, strategic bet, risks, and safest next development step. Do not assume source-code access.';

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

function Sidebar({ selected, onSelect }: { selected: Section; onSelect: (section: Section) => void }) {
  return (
    <aside className="sidebar" aria-label="Repository understanding sections">
      <div className="brand">
        <span className="brandMark">AI</span>
        <div>
          <strong>Agent IDE</strong>
          <small>Repository understanding</small>
        </div>
      </div>

      <nav className="sectionNav">
        {sections.map((section) => (
          <button
            className={section.id === selected.id ? 'navItem active' : 'navItem'}
            key={section.id}
            onClick={() => onSelect(section)}
            type="button"
          >
            <span>{section.id}</span>
            <small>{section.eyebrow}</small>
          </button>
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
  const workflow = ['Connect Repository', 'Refresh Intelligence', 'Review Repository Status', 'Generate AI Handoff Package'];
  return (
    <div className="controlPlane welcomeDashboard">
      <section className="heroCard" aria-label="Agent IDE workflow welcome">
        <div>
          <p className="kicker">Welcome to Agent IDE</p>
          <h2>Repository understanding before code editing</h2>
          <p>Connect any local repository and Agent IDE will build deterministic, version-controlled intelligence before anyone starts changing code.</p>
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
  if (candidate.id === 'strategy-quality') return 'Define Current Product Bet';
  if (candidate.id === 'ai-handoff-validation') return 'Run AI Handoff Validation';
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
  if (filePath && candidate?.id === 'strategy-quality') return `Add product strategy notes to \`${filePath}\`.`;
  return candidate?.ownerAction ?? quality?.recommendedAction ?? recommendation.explanation;
}

function hasUsefulValue(value?: string | null) {
  return Boolean(value && !/^(not specified|none detected|none|n\/?a)$/i.test(value.trim()));
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

function ControlPlaneDashboard({ data, progressSummary }: { data: ControlPlane | null; progressSummary?: ProgressSummary | null }) {
  if (!data) return <WelcomeDashboard />;
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
  const packageLabels = [
    ['context', 'Copy Context Package'],
    ['architect', 'Copy Architect Prompt'],
    ['builder', 'Copy Builder Prompt'],
    ['reviewer', 'Copy Reviewer Prompt'],
    ['debugger', 'Copy Debugger Prompt'],
    ['product-decision', 'Copy Product Decision Package'],
  ];
  const topWork = firstCandidate(data, 1);
  const afterThis = firstCandidate(data, 2);
  const diffEntries = meaningfulDiffEntries(data.diff);
  const taskTitle = humanTaskTitle(topWork, data.recommendation.title);
  const taskAction = actionForTask(topWork, data.recommendation, data.quality);
  const taskFile = filePathForTask(topWork, data.recommendation);
  const workMetaRows = [
    ['What you need to do', taskAction],
    ['File to edit', taskFile ? `\`${taskFile}\`` : null],
    ['Expected impact', topWork ? `+${topWork.expectedImprovement.total}` : 'See package'],
    ['Suggested next step', hasUsefulValue(topWork?.expectedCompletionTarget) ? topWork?.expectedCompletionTarget : null],
    ['Actionability', topWork?.actionability ?? data.recommendation.actionability ?? null],
  ].filter(([, value]) => hasUsefulValue(value));
  const afterThisRows = [
    ['Expected impact', `+${afterThis?.expectedImprovement.total ?? 0}`],
    ['Why this matters', afterThis?.reason],
    ['Dependency', afterThis?.dependency],
  ].filter(([, value]) => hasUsefulValue(value));

  return (
    <div className="controlPlane compactDashboard">
      <section className="todayWorkCard" aria-label="Today's Work">
        <div>
          <p className="kicker">Today's Work</p>
          <h2>{taskTitle}</h2>
          <p><b>Why this matters:</b> {topWork?.reason ?? data.recommendation.whyItMatters}</p>
          <div className="workMetaGrid">
            {workMetaRows.map(([label, value]) => <div key={label ?? String(value)}><small>{label}</small><strong>{renderInlineMarkdown(String(value))}</strong></div>)}
          </div>
        </div>
        <button className="primaryCta" onClick={() => void copyText(data.recommendation.prompt)} type="button">Open Product Decision Package</button>
      </section>

      {afterThis && (
        <section className="controlCard afterThisCard" aria-label="After This">
          <p className="kicker">After This</p>
          <h2>{humanTaskTitle(afterThis, afterThis.title)}</h2>
          <div className="workMetaGrid compact">
            {afterThisRows.map(([label, value]) => <div key={label ?? String(value)}><small>{label}</small><strong>{value}</strong></div>)}
          </div>
        </section>
      )}

      <section className="controlCard handoffCard quickAiActions" aria-label="Quick AI Actions"><h2>Quick AI Actions</h2><p>Start from Today's Work, then hand the deterministic package to the right AI role.</p><div className="handoffGrid">{packageLabels.map(([key, label]) => <button disabled={!data.packages[key] && key !== 'product-decision'} key={key} onClick={() => void copyText(key === 'product-decision' ? data.recommendation.prompt : (data.packages[key] ?? ''))} type="button">{label}</button>)}</div></section>

      {progressSummary && (
        <section className="controlCard progressSummaryCard" aria-label="Refresh progress summary">
          <h2>Refresh Progress</h2>
          {!progressSummary.hasBaseline ? <p>This is your first refresh. Progress will be tracked after your next completed task.</p> : <>
            <div className="qualityGrid">
              <div><small>Completed task</small><strong>{progressSummary.completedTask}</strong></div>
              <div><small>Repository quality delta</small><strong>{progressSummary.repositoryQualityDelta}</strong></div>
              <div><small>Confidence delta</small><strong>{progressSummary.confidenceDelta}</strong></div>
              <div><small>Verification delta</small><strong>{progressSummary.verificationDelta}</strong></div>
              <div><small>Current top priority</small><strong>{humanTaskTitle(topWork, progressSummary.currentTopPriority)}</strong></div>
            </div>
            <div className="answerGrid"><div><h2>Newly resolved tasks</h2>{progressSummary.newlyResolvedIssues.length ? <ul>{progressSummary.newlyResolvedIssues.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None detected.</p>}</div><div><h2>New tasks</h2>{progressSummary.newlyIntroducedIssues.length ? <ul>{progressSummary.newlyIntroducedIssues.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None detected.</p>}</div></div>
          </>}
        </section>
      )}

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
          <h2>Repository Intelligence Verification</h2>
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
        {data.recommendation.packageType && <p><b>Package Type:</b> {data.recommendation.packageType}</p>}
        <p><b>Source risk/recommendation:</b> {data.recommendation.explanation}</p>
        <p><b>Reason:</b> {data.recommendation.whyItMatters}</p>
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
                  <div><small>Expected Improvement</small><strong>+{candidate.expectedImprovement.total}</strong><span>+{candidate.expectedImprovement.repositoryHealth} Health · +{candidate.expectedImprovement.canonicalCompleteness} Completeness · +{candidate.expectedImprovement.quality} Quality</span></div>
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
              <p><b>Reason:</b> {data.explanations.recommendation.reason}</p>
              <ul>{data.explanations.recommendation.candidateIssues.map((issue) => <li key={issue.title}>{issue.title}: priority {issue.priority}<small>{issue.evidence}</small></li>)}</ul>
            </details>
          )}
          {data.explanations.decisionRanking && (
            <details>
              <summary>{data.explanations.decisionRanking.title}</summary>
              <p><b>Rule:</b> {data.explanations.decisionRanking.rule}</p>
              <p><b>Selected:</b> {data.explanations.decisionRanking.selected?.title}</p>
              <p><b>Reason:</b> {data.explanations.decisionRanking.reason}</p>
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
                  <p><b>Reason:</b> {field.reason.join(' ')}</p>
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
      <details className="controlCard disclosureCard"><summary>Raw intelligence / full markdown</summary><p>Use the sidebar to open the full version-controlled markdown documents when you need implementation detail.</p></details>
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
  }, [selectedId]);

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
      const response = await fetch(new URL('/api/repository/refresh', serverBaseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositoryPath }),
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
        await Promise.all(['goals.md', 'strategy.md', 'repository-health.md', 'context-package.md', ...promptFiles].map((file) => loadIntelligenceFile(refreshedRepositoryPath, file)));
        const url = new URL('/api/repository/control-plane', serverBaseUrl);
        url.searchParams.set('repositoryPath', refreshedRepositoryPath);
        const response = await fetch(url);
        const refreshedControlPlane = await response.json() as ControlPlane & { error?: string };
        if (!response.ok) throw new Error(refreshedControlPlane.error ?? 'Unable to load control plane.');
        setControlPlane(refreshedControlPlane);
        setProgressSummary(buildProgressSummary(previousControlPlane, refreshedControlPlane));
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="shell">
      <Sidebar selected={selected} onSelect={(section) => setSelectedId(section.id)} />

      <main className="mainPanel">
        <header className="topBar">
          <div>
            <p className="kicker">Local repository intelligence</p>
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
              {isRefreshing ? 'Refreshing…' : 'Refresh Intelligence'}
            </button>
          </div>
          <p>
            Agent IDE validates the local path, runs deterministic generators from this app, and writes outputs into
            the target repository&apos;s <code>.ai/</code> folder. The target repository does not need Agent IDE installed.
          </p>
          {connectedPath && <small>Connected: {connectedPath}</small>}
          {error && <div className="summary failure">{error}</div>}
          {summary && <div className="summary success">{summary}</div>}
          {connectedPath && summary && (
            <div className="nextActions">
              <strong>Next actions</strong>
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

        <section className="sectionIntro">
          <p>{selected.summary}</p>
          <small>{document?.sourcePath ?? (connectedPath ? `${connectedPath}/.ai/${selected.markdownFile}` : `.ai/${selected.markdownFile}`)}</small>
        </section>

        {selected.id === 'Control Plane' && <ControlPlaneDashboard data={controlPlane} progressSummary={progressSummary} />}
        {selected.id === 'Prompt Center' && (
          <PromptCenter connectedPath={connectedPath} documents={documents} loadFile={loadIntelligenceFile} />
        )}
        {selected.id === 'Context Package' && connectedPath && document && !document.isLoading && document.exists && (
          <DocumentActions content={document.content} copyLabel="Copy Context Package" downloadLabel="Download Context Package" downloadName="context-package.md" extraActions={<button onClick={() => void copyText(`${handoffWrapper}\n\n${document.content}`)} type="button">Copy for Claude/GPT</button>} />
        )}
        {selected.id !== 'Prompt Center' && selected.id !== 'Control Plane' && !connectedPath && <MissingDocument />}
        {selected.id !== 'Prompt Center' && selected.id !== 'Control Plane' && connectedPath && document?.isLoading && <div className="markdownPanel emptyState"><h2>Loading…</h2></div>}
        {selected.id !== 'Prompt Center' && selected.id !== 'Control Plane' && connectedPath && document && !document.isLoading && document.exists && <MarkdownLikeContent markdown={document.content} />}
        {selected.id !== 'Prompt Center' && selected.id !== 'Control Plane' && connectedPath && document && !document.isLoading && !document.exists && <MissingDocument />}
      </main>
    </div>
  );
}
