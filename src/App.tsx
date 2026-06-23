import { useMemo, useState } from 'react';
import { sections, type Section } from './sections';

const markdownFiles = import.meta.glob('../.ai/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

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

        if (line.trim() === '') {
          return <div aria-hidden="true" className="lineBreak" key={key} />;
        }

        if (line.startsWith('# ')) {
          return <h2 key={key}>{line.replace('# ', '')}</h2>;
        }

        if (line.startsWith('## ')) {
          return <h3 key={key}>{line.replace('## ', '')}</h3>;
        }

        if (line.startsWith('- ')) {
          return (
            <p className="bullet" key={key}>
              {line}
            </p>
          );
        }

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
  const [selectedId, setSelectedId] = useState<Section['id']>('Goals');
  const selected = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? sections[0],
    [selectedId],
  );
  const markdown = markdownFiles[`../.ai/${selected.markdownFile}`];

  return (
    <div className="shell">
      <Sidebar selected={selected} onSelect={(section) => setSelectedId(section.id)} />

      <main className="mainPanel">
        <header className="topBar">
          <div>
            <p className="kicker">Local .ai contract</p>
            <h1>{selected.id}</h1>
          </div>
          <span className="statusPill">Local markdown · No auth · No agents</span>
        </header>

        <section className="sectionIntro">
          <p>{selected.summary}</p>
          <small>.ai/{selected.markdownFile}</small>
        </section>

        {markdown ? <MarkdownLikeContent markdown={markdown} /> : <EmptyState fileName={selected.markdownFile} />}
      </main>
    </div>
  );
}
