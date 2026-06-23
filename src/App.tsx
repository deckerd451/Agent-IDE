import { useMemo, useState } from 'react';
import { sections, type Section } from './sections';

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

function MarkdownLikeContent({ lines }: { lines: string[] }) {
  return (
    <div className="markdownPanel">
      {lines.map((line) => {
        if (line.startsWith('# ')) {
          return <h2 key={line}>{line.replace('# ', '')}</h2>;
        }

        if (line.startsWith('## ')) {
          return <h3 key={line}>{line.replace('## ', '')}</h3>;
        }

        if (line.startsWith('- ')) {
          return <p className="bullet" key={line}>{line}</p>;
        }

        return <p key={line}>{line}</p>;
      })}
    </div>
  );
}

export function App() {
  const [selectedId, setSelectedId] = useState<Section['id']>('Goals');
  const selected = useMemo(
    () => sections.find((section) => section.id === selectedId) ?? sections[0],
    [selectedId],
  );

  return (
    <div className="shell">
      <Sidebar selected={selected} onSelect={(section) => setSelectedId(section.id)} />

      <main className="mainPanel">
        <header className="topBar">
          <div>
            <p className="kicker">V1 prototype</p>
            <h1>{selected.id}</h1>
          </div>
          <span className="statusPill">Local only · No auth · No agents</span>
        </header>

        <section className="sectionIntro">
          <p>{selected.summary}</p>
        </section>

        <MarkdownLikeContent lines={selected.content} />
      </main>
    </div>
  );
}
