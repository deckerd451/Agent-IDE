# Architecture

Last Audit: 2026-06-24T00:16:59.907Z
Confidence: 95%

## Product Thesis
Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.

Product Thesis Evidence:
README.md, .ai/goals.md, scripts/audit.mjs

## Core Systems
- Dashboard UI: Inferred from target repository structure and naming.
  Evidence: src/App.tsx, src/sections.ts, package.json
- Repository Intelligence Contract: Inferred from target repository structure and naming.
  Evidence: .ai/*.md, scripts/init-ai.mjs, README.md
- Local Audit Engine: Inferred from target repository structure and naming.
  Evidence: scripts/audit.mjs, package.json

## Primary Flows
- Repository -> .ai files -> Dashboard
- npm run init:ai -> starter intelligence files
- npm run audit -> generated architecture.md
- npm run backlog -> generated backlog.md

## Current Focus
The repository is currently focused on making repository understanding the primary surface of Agent IDE.

Current Focus Evidence:
.ai/goals.md

## Key Commands
- npm run dev
- npm run build
- npm run init:ai
- npm run audit
- npm run backlog

## Known Gaps
- No LLM integration
- No agent execution
- No validation generation
- No packaged CLI

## Repository Structure

### Languages
- CSS
- HTML
- JavaScript
- JSON
- Markdown
- React
- TypeScript

### Major Areas
- scripts/
- src/
- tests/

### Major Files
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
