# Architecture

Last Audit: 2026-06-23T20:32:07.506Z
Confidence: 95%

## Product Thesis
- Agent IDE is a prototype developer environment where the primary interface is repository understanding instead of the file tree. Traditional IDEs start with files, folders, search, Git, and terminals. Agent IDE starts with the context engineers and agents need before touching code:
- V1 is intentionally small: a local Vite + React + TypeScript app with a sidebar for these repository-understanding sections. Each tab renders the matching markdown file from the repository-local `.ai/` folder.
- Make repository understanding the primary surface of Agent IDE.

## Core Systems
- Application shell: source files under `src/` provide the runnable user interface or main application code.
- React UI: React and React DOM render the local interface.
- Vite toolchain: Vite provides local development, preview, and production bundling workflows.
- Repository automation: scripts under `scripts/` initialize and audit local repository-understanding files.
- `.ai/` knowledge contract: markdown documents hold local goals, architecture, backlog, decisions, validation, agent planning, and code notes.
- Package workflows: npm scripts expose the main local commands for development, validation, initialization, and audit.

## Primary Flows
- Section metadata selects a `.ai/*.md` file, and the React application renders that markdown as the active repository-understanding tab.
- `npm run audit` scans local repository signals and rewrites `.ai/architecture.md` while preserving the manual notes section.
- `npm run init:ai` creates missing starter `.ai/` markdown files without overwriting existing notes.
- `npm run build` runs the configured production validation/build pipeline.

## Current Focus
- Local `.ai/` starter folder and markdown files.
- Sidebar tabs that load and render the matching `.ai/*.md` file.
- Helpful empty states for missing markdown files.
- `npm run init:ai` for creating starter files without overwriting existing content.
- Make repository understanding the primary surface of Agent IDE.
- Improve markdown rendering while keeping the contract plain text.
- Add lightweight cross-links between `.ai/` documents.

## Key Commands
- `npm run dev` — vite
- `npm run build` — tsc -b && vite build
- `npm run preview` — vite preview
- `npm run init:ai` — node scripts/init-ai.mjs
- `npm run audit` — node scripts/audit.mjs

## Known Gaps
- No automated UI interaction tests yet.
- Add automation only after the local `.ai/` contract is useful on its own.
- CLI packaging
- Agents
- LLM calls
- Database
- Authentication
- Code editing

## Repository Structure

### Languages
- CSS
- HTML
- JavaScript
- JSON
- Markdown
- React
- TypeScript

### Folders
- scripts/
- src/

### Files
- index.html
- package.json
- README.md
- tsconfig.app.json
- tsconfig.json
- vite.config.ts

### Dependencies
- @types/react
- @types/react-dom
- @vitejs/plugin-react
- react
- react-dom
- typescript
- vite

## Manual Notes
