# Architecture

- Local Vite, React, and TypeScript app.
- Sidebar tabs map directly to plain markdown files in `.ai/`.
- The app renders local markdown content without a database, authentication, LLM calls, agents, or code editing.

## Boundaries

- Repository understanding lives in `.ai/*.md`.
- UI code lives in `src/`.
