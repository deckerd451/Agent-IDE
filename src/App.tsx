import { useMemo, useState } from 'react';
import { sections, type Section } from './sections';

const markdownFiles = import.meta.glob('../.ai/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

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

const generatedFiles = new Set(['architecture.md', 'backlog.md', 'validation.md', 'decisions.md']);
const serverBaseUrl = import.meta.env.VITE_AGENT_IDE_SERVER_URL ?? 'http://localhost:5174';

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

function MarkdownLikeContent({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n');

  return (
    <div className="markdownPanel">
      {lines.map((line, index) => {
        const key = `${index}-${line}`;

        if (line.trim() === '') return <div aria-hidden="true" className="lineBreak" key={key} />;
        if (line.startsWith('# ')) return <h2 key={key}>{line.replace('# ', '')}</h2>;
        if (line.startsWith('## ')) return <h3 key={key}>{line.replace('## ', '')}</h3>;
        if (line.startsWith('- ')) return <p className="bullet" key={key}>{line}</p>;
        return <p key={key}>{line}</p>;
      })}
    </div>
  );
}

function EmptyState({ fileName }: { fileName: string }) {
  return (
    <div className="markdownPanel emptyState">
      <h2>No local markdown yet</h2>
      <p>
        Create <code>.ai/{fileName}</code> to populate this tab, or run <code>npm run init:ai</code> to
        create the full starter folder.
      </p>
    </div>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState<Section['id']>('Architecture');
  const [repositoryPath, setRepositoryPath] = useState('');
  const [connectedPath, setConnectedPath] = useState('');
  const [remoteMarkdown, setRemoteMarkdown] = useState<Record<string, string>>({});
  const [steps, setSteps] = useState<StepState[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selected = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? sections[0],
    [selectedId],
  );
  const markdown = remoteMarkdown[selected.markdownFile] ?? markdownFiles[`../.ai/${selected.markdownFile}`];

  async function loadGeneratedFiles(path: string) {
    const entries = await Promise.all(
      [...generatedFiles].map(async (file) => {
        const url = new URL('/api/repository/file', serverBaseUrl);
        url.searchParams.set('repositoryPath', path);
        url.searchParams.set('file', file);
        const response = await fetch(url);
        if (!response.ok) return [file, ''];
        const data = await response.json() as { content: string };
        return [file, data.content];
      }),
    );
    setRemoteMarkdown(Object.fromEntries(entries));
  }

  async function refreshIntelligence() {
    setError('');
    setSummary('');
    setSteps([]);
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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RefreshEvent;
          if (event.type === 'started' && event.repositoryPath) setConnectedPath(event.repositoryPath);
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
            setSummary(`${event.summary} Outputs were written to ${event.aiPath}.`);
            if (event.repositoryPath) await loadGeneratedFiles(event.repositoryPath);
          }
        }
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
          <small>{connectedPath ? `${connectedPath}/.ai/${selected.markdownFile}` : `.ai/${selected.markdownFile}`}</small>
        </section>

        {markdown ? <MarkdownLikeContent markdown={markdown} /> : <EmptyState fileName={selected.markdownFile} />}
      </main>
    </div>
  );
}
