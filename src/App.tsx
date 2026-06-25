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

type IntelligenceState = 'Present' | 'Missing' | 'Needs Attention';

type ControlPlaneRecommendation = {
  title: string;
  explanation: string;
  whyItMatters: string;
  evidenceSource: string;
  prompt: string;
};

type QualitySnapshot = {
  overallScore: number;
  trend: 'Improving' | 'Stable' | 'Needs Attention';
  canonicalIntelligenceQuality?: { score: number };
  generatedExportQuality?: { score: number };
  coverage: Record<string, boolean | number>;
  consistency: { score: number; contradictions: string[]; duplicatedSections: string[] };
  freshness: { score: number; staleDocuments: string[]; filesChanged: number; manualNotesPreserved: boolean };
  confidence: { score: number; overallRepositoryConfidence: string };
  drift: { newRisks: string[]; removedRisks: string[] };
  recentRegressions: string[];
  recentImprovements: string[];
  recommendedAction: string;
};

type ControlPlane = {
  status: Record<string, string>;
  understanding: Array<{ label: string; state: IntelligenceState; source: string }>;
  unknowns: Array<{ label: string; source: string }>;
  recommendation: ControlPlaneRecommendation;
  diff: Record<string, string | string[]>;
  quality: QualitySnapshot | null;
  qualityHistory: Array<Record<string, unknown>>;
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
  return state.toLowerCase().replace(/\s+/g, '-');
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

function ControlPlaneDashboard({ data }: { data: ControlPlane | null }) {
  if (!data) return <WelcomeDashboard />;

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
  ];
  const diffEntries = meaningfulDiffEntries(data.diff);

  return (
    <div className="controlPlane compactDashboard">
      <section className="dashboardGrid statusGrid" aria-label="Repository status">
        {statusCards.map(([label, value]) => <article className="metricCard" key={String(label)}><small>{label}</small><strong>{value || 'Unknown'}</strong></article>)}
      </section>

      <section className="controlCard answerGrid" aria-label="Repository intelligence answers">
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
      </section>

      {data.quality && (
        <section className="controlCard qualityCard" aria-label="Intelligence quality">
          <div className="qualityHeader"><div><small>Overall Quality</small><strong>{data.quality.overallScore}/100</strong></div><span className={stateClass(data.quality.trend === 'Needs Attention' ? 'Needs Attention' : 'Present')}>Trend: {data.quality.trend}</span></div>
          <div className="qualityGrid">
            <div><small>Canonical Intelligence</small><strong>{data.quality.canonicalIntelligenceQuality?.score ?? data.quality.overallScore}%</strong></div>
            <div><small>Export Quality</small><strong>{data.quality.generatedExportQuality?.score ?? data.quality.coverage.score}%</strong></div>
            <div><small>Consistency</small><strong>{data.quality.consistency.score}%</strong></div>
            <div><small>Freshness</small><strong>{data.quality.freshness.score}%</strong></div>
            <div><small>Confidence</small><strong>{data.quality.confidence.score}%</strong></div>
          </div>
          <div className="answerGrid">
            <div><h2>Recent regressions</h2>{data.quality.recentRegressions.length ? <ul>{data.quality.recentRegressions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No recent regressions detected.</p>}</div>
            <div><h2>Recent improvements</h2>{data.quality.recentImprovements.length ? <ul>{data.quality.recentImprovements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No recent improvements detected.</p>}</div>
          </div>
          <p><b>Recommended action:</b> {data.quality.recommendedAction}</p>
        </section>
      )}

      <section className="controlCard recommended" aria-label="Single recommended next action">
        <small>Recommended Next Step</small>
        <strong>{data.quality?.recommendedAction || data.recommendation.title}</strong>
        <p>{data.recommendation.explanation}</p>
        <p><b>Why it matters:</b> {data.recommendation.whyItMatters}</p>
        <p><b>Evidence source:</b> {data.recommendation.evidenceSource}</p>
        <button onClick={() => void copyText(data.recommendation.prompt)} type="button">Generate Builder Prompt</button>
      </section>

      <section className="controlCard"><h2>Trend</h2><p>{data.quality ? data.quality.trend : 'No intelligence quality trend available yet.'}</p></section>
      <section className="controlCard"><h2>Recent Changes</h2>{diffEntries.length > 0 ? diffEntries.map(([label, items]) => <details key={label}><summary>{label} <span>{items.length}</span></summary><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></details>) : <p>No material intelligence changes detected.</p>}</section>

      <section className="controlCard handoffCard"><h2>AI Handoff</h2><div className="handoffGrid">{packageLabels.map(([key, label]) => <button disabled={!data.packages[key]} key={key} onClick={() => void copyText(data.packages[key] ?? '')} type="button">{label}</button>)}</div></section>

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
        await loadControlPlane(refreshedRepositoryPath);
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

        {selected.id === 'Control Plane' && <ControlPlaneDashboard data={controlPlane} />}
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
