# Architecture

Last Audit: 2026-06-23T20:43:15.696Z
Confidence: 95%

## Product Thesis
Agent IDE exists to make repository understanding the primary developer interface by reading local `.ai/` markdown, source structure, package scripts, and project notes into a dashboard-oriented workflow.

## Core Systems
- Dashboard UI: React/Vite interface that makes repository-understanding markdown the primary navigation surface instead of a file tree.
- Repository Intelligence Contract: Version-controlled `.ai/*.md` files that define goals, architecture, backlog, decisions, validation, agent constraints, and code notes.
- Local Audit Engine: `scripts/audit.mjs` deterministically scans local repository signals and regenerates `.ai/architecture.md` without LLM calls.

## Primary Flows
- Repository -> .ai files -> Dashboard
- npm run init:ai -> starter intelligence files
- npm run audit -> generated architecture.md

## Current Focus
The repository is currently evolving toward making repository understanding the primary surface of Agent IDE, with near-term work to improve markdown rendering while keeping the contract plain text and add lightweight cross-links between `.ai/` documents.

## Key Commands
- npm run dev
- npm run build
- npm run init:ai
- npm run audit

## Known Gaps
- No LLM integration
- No agent execution
- No validation generation
- No backlog generation
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
