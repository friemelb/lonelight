# LoanLens

**AI-powered mortgage document processing.** LoanLens ingests heterogeneous
loan documents (PDF, DOCX, TXT, MD, CSV, JSON), parses and chunks them, and
uses GPT-4o to extract structured borrower information — names, SSNs,
addresses, income, accounts — with mandatory source attribution and a
human-in-the-loop review workflow.

> Architecture-level write-ups live in [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md)
> and [`docs/PROMPT_STRATEGY.md`](docs/PROMPT_STRATEGY.md). This README is the
> entry point for running the app and walking the demo.

---

## Table of Contents

1.  [Project Overview](#1-project-overview)
2.  [Tech Stack](#2-tech-stack)
3.  [Architecture Summary](#3-architecture-summary)
4.  [Setup](#4-setup)
5.  [Environment Variables](#5-environment-variables)
6.  [Running the API and UI](#6-running-the-api-and-ui)
7.  [Running Tests](#7-running-tests)
8.  [Adding Documents](#8-adding-documents)
9.  [Running Ingestion](#9-running-ingestion)
10. [Running Extraction](#10-running-extraction)
11. [Reviewing Borrower Records](#11-reviewing-borrower-records)
12. [Demo Script](#12-demo-script)
13. [Known Limitations](#13-known-limitations)
14. [Future Improvements](#14-future-improvements)
15. [Agent / Tooling Approach](#15-agent--tooling-approach)
16. [Documentation](#16-documentation)
17. [License](#17-license)

---

## 1. Project Overview

Mortgage corpora are heterogeneous: every lender ships a different template,
documents come in mixed formats, and key data points (borrower identity,
income, accounts) are scattered across many pages. LoanLens turns that pile
into a structured, auditable borrower record.

What it does:

- **Ingests** a directory of loan documents and parses each one to text.
- **Chunks** the text with sentence-aware overlap so the LLM has clean
  context windows.
- **Extracts** borrower fields with `gpt-4o-2024-11-20`, requiring a
  confidence score, source document ID, source page, and verbatim
  evidence quote on every field.
- **Validates** every model response against a Zod schema and retries once
  with the error embedded in the prompt on failure.
- **Persists** borrowers and per-field provenance into SQLite via an EAV
  table.
- **Surfaces** every borrower in a review queue with the evidence quote
  next to each value, so a human can approve, reject, or correct before
  the record is treated as final.

Volume target for v0.1: up to ~100K documents on a single node. The
architecture's 10x and 100x evolution paths are documented in
[`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md).

---

## 2. Tech Stack

**Backend** — `apps/api`
- Node.js 18+, TypeScript (strict)
- Express 4
- SQLite (`better-sqlite3`) — synchronous, transactional
- OpenAI SDK (`openai`) — `gpt-4o-2024-11-20`
- Zod — runtime validation of LLM output
- `unpdf` (PDF), `mammoth` (DOCX) — text extraction
- Vitest + Supertest — tests

**Frontend** — `apps/web`
- React 18, TypeScript (strict)
- Vite 5
- Material UI 5
- Zustand — state management
- React Router 6
- Vitest + Testing Library — tests

**Shared** — `packages/domain`
- TypeScript types and Zod-derived schemas used by API and web.

**Tooling**
- npm workspaces (monorepo)
- Husky pre-commit (typecheck + tests on staged code)
- JSON-line structured logging to stdout

---

## 3. Architecture Summary

Single-node, synchronous pipeline:

```
corpus/  ──► FileService ──► ParsingService ──► ChunkingService ──┐
                                                                  │
                                                                  ▼
                                                        ExtractionService
                                                          (OpenAI + Zod
                                                          + retry + merge)
                                                                  │
                                                                  ▼
                                                  BorrowerRepository (txn)
                                                                  │
                                                                  ▼
                                                            SQLite (9 tables)
                                                                  │
                                                                  ▼
                                                          REST API ──► React UI
                                                                       (review)
```

All processing happens in the API process inside the request-scoped handler
for `POST /api/ingest` (which also triggers extraction), or via the standalone
`POST /api/borrowers/extract` endpoint. The UI never talks to OpenAI directly.

A diagrammed walkthrough — including the data flow, document state machine,
and review state machine — lives in
[`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md).

---

## 4. Setup

### Prerequisites

- Node.js 18+
- npm 9+
- An OpenAI API key (only required for extraction; ingestion + parsing
  work without one)

### Install

```bash
git clone <repo-url>
cd lonelight
npm install
```

The first install bootstraps all three workspaces (`apps/api`, `apps/web`,
`packages/domain`).

### Build the shared domain package

The API and web apps depend on `@loanlens/domain`. Build it once after
install and any time you change shared types:

```bash
npm run build --workspace @loanlens/domain
```

(`npm run build` from the repo root builds everything.)

---

## 5. Environment Variables

Copy the example files and edit:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### `apps/api/.env`

| Variable          | Required           | Default                     | Notes                                                  |
| ----------------- | ------------------ | --------------------------- | ------------------------------------------------------ |
| `OPENAI_API_KEY`  | for extraction only| —                           | Without it, ingestion still runs, extraction is skipped.|
| `OPENAI_MODEL`    | no                 | `gpt-4o-2024-11-20`         | Pin to a model snapshot.                               |
| `PORT`            | no                 | `3001`                      | API listen port.                                       |
| `HOST`            | no                 | `localhost`                 |                                                        |
| `NODE_ENV`        | no                 | `development`               |                                                        |
| `CORS_ORIGIN`     | no                 | `http://localhost:5173`     | Web origin allowed by Express CORS.                    |
| `DATABASE_PATH`   | no                 | `./data/loanlens.db`        | SQLite file path.                                      |

### `apps/web/.env`

| Variable        | Default                      | Notes                              |
| --------------- | ---------------------------- | ---------------------------------- |
| `VITE_API_URL`  | `http://localhost:3001`      | Used by the dev proxy.             |

The web app talks to the API through Vite's dev proxy, so most setups need
no overrides.

---

## 6. Running the API and UI

Start both dev servers from the repo root:

```bash
npm run dev
```

This launches:

- API at <http://localhost:3001>
- Web at <http://localhost:5173>

Or run them individually:

```bash
npm run dev:api
npm run dev:web
```

Production-style build:

```bash
npm run build
npm run start --workspace @loanlens/api   # serves the built API
```

---

## 7. Running Tests

From the repo root:

```bash
npm test            # all workspaces
npm run test:api    # API only (Vitest + Supertest)
npm run test:web    # Web only (Vitest + Testing Library)
npm run type-check  # tsc --noEmit across all workspaces
```

The pre-commit hook (`.husky/pre-commit`) runs typecheck and tests on
staged files; do not bypass with `--no-verify`.

---

## 8. Adding Documents

LoanLens ingests from a local corpus directory rather than a multipart
upload (rationale: deterministic demo loop, schema is upload-ready when we
need it).

Drop files into:

```
apps/api/data/corpus/
```

Supported extensions:

| Extension | Parser          | Notes                                           |
| --------- | --------------- | ----------------------------------------------- |
| `.pdf`    | `unpdf`         | Text-based PDFs only. No OCR for scans yet.     |
| `.docx`   | `mammoth`       | Text content; formatting is dropped.            |
| `.txt`    | TextParser      | Pass-through.                                   |
| `.md`     | MarkdownParser  | Pass-through.                                   |
| `.csv`    | CsvParser       | Tabular content; preserves headers.             |
| `.json`   | JsonParser      | Pretty-printed for chunk readability.           |

Files with other extensions are recorded in `documents` with
`status = FAILED` and an "Unsupported file type" error so they show up in
the UI rather than disappearing silently.

The repo also ships sample loan documents under `Loan Documents/`. Copy
the ones you want to use into `apps/api/data/corpus/`.

---

## 9. Running Ingestion

Ingestion = **scan corpus → parse files → chunk text → persist
documents and chunks**. If `OPENAI_API_KEY` is set, ingestion also runs
extraction inline as a final step.

### From the UI (recommended)

1. Open the **Dashboard** (<http://localhost:5173>).
2. Click **Run Ingestion**. The Snackbar reports
   `Ingested N of M files` and refreshes the metrics tiles.

### From the CLI

```bash
curl -X POST http://localhost:3001/api/ingest
```

The response (`IngestResponse`) returns counts per stage:

```json
{
  "total": 17,
  "successful": 17,
  "failed": 0,
  "parsed": 17,
  "parseFailed": 0,
  "totalChunks": 65,
  "borrowersExtracted": 1,
  "extractionSuccess": true,
  "documents": [...],
  "errors": []
}
```

Re-running ingestion is **not idempotent** in v0.1: it re-creates document
rows. Reset the database first if you want a clean state (Dashboard → Reset
Database, or `POST /api/debug/reset-database`).

---

## 10. Running Extraction

Extraction = **send chunked documents to GPT-4o → validate JSON with
Zod → retry once on failure → upsert borrowers with full provenance**.
You can run it standalone (without re-ingesting) any time documents are
already in the database.

### From the UI

1. Open the **Dashboard**.
2. Click **Run Extraction**. The Snackbar reports
   `Extracted N borrowers from M documents in T.Ts`.

The empty state on the Borrowers page also has its own **Run Extraction**
button.

### From the CLI

```bash
curl -X POST http://localhost:3001/api/borrowers/extract
```

Response shape:

```json
{
  "success": true,
  "data": {
    "borrowers": [{ "borrower": { /* ... */ }, "documentIds": [], "extractedAt": "..." }],
    "stats": {
      "totalDocuments": 17,
      "totalChunks": 65,
      "borrowersExtracted": 1,
      "durationMs": 15420
    }
  },
  "errors": []
}
```

**HTTP status codes**:
- `200` — success (may include partial errors in `errors[]`).
- `422` — extraction failed Zod validation after retry.
- `500` — `OPENAI_API_KEY` not configured, or OpenAI API error.

How the prompt is built, why retries work the way they do, and the
hallucination-mitigation strategy live in
[`docs/PROMPT_STRATEGY.md`](docs/PROMPT_STRATEGY.md).

---

## 11. Reviewing Borrower Records

Every extracted borrower lands as `pending_review`. Reviewers walk a
small state machine: `pending_review → approved | rejected | corrected`,
with `corrected → approved | rejected` from there.

### From the UI

1. Open **Review Queue** in the left nav (or **Borrowers** for the full
   list). The queue shows pending borrowers sorted by confidence ascending
   so the riskiest extractions are first.
2. Click a row to open **Borrower Detail**.
3. Each field shows its **value, confidence chip, source document link,
   and the verbatim evidence quote**. Click the source link to jump to
   the exact page in the document with the quote highlighted.
4. Use the **Edit** icon on a field to record a correction — the original
   value, original confidence, and original evidence quote are preserved
   in `field_corrections` (immutable audit row).
5. Use **Approve** / **Reject** at the bottom to finalize the record. A
   timestamped row is written to `borrower_review_audit`.

### From the API

```bash
# Pending queue
curl 'http://localhost:3001/api/borrowers?reviewStatus=pending_review'

# Single borrower (full extracted fields)
curl http://localhost:3001/api/borrowers/<id>

# Approve / reject / correct
curl -X POST http://localhost:3001/api/borrowers/<id>/review/approve \
  -H 'Content-Type: application/json' \
  -d '{"notes":"Verified against W-2"}'
```

---

## 12. Demo Script

A scripted walkthrough that hits every major surface in under 5 minutes.
Assumes `apps/api/.env` has a valid `OPENAI_API_KEY`.

### 1. Start the app

```bash
npm run dev
```

Wait until you see `🚀 API server running` and the Vite ready banner.

### 2. Open the Dashboard

Navigate to <http://localhost:5173>. The Dashboard loads with API status,
processing metrics, and the **Pipeline Actions** card at the top.

### 3. Run Ingestion

Click **Run Ingestion** in the Pipeline Actions card. The button shows
`Running ingestion…`; after a few seconds a Snackbar reports the file
counts and the metrics tiles update (Total Documents, Extracted Documents,
Total Chunks, Success Rate).

### 4. Run Extraction

Click **Run Extraction**. The button shows `Running extraction…` while
batches are sent to OpenAI; the Snackbar reports
`Extracted N borrowers from M documents in T.Ts`. The Pending Reviews
metric tile increments.

### 5. Open Borrowers

Click **Borrowers** in the left nav. The table lists every extracted
borrower with name, contact, review status chip, and document count. Use
the search field to filter by any field (name, email, phone).

### 6. Open Borrower Detail

Click any row. The detail page renders the borrower's personal info,
contact info, document summary, and (for `pending_review` records) the
review actions panel.

### 7. Show source attribution

For any extracted field on the detail page, point at the **confidence
chip**, the **Source: <document>** link, and the **evidence quote**
underneath. Click the source link to open the source document with the
exact page and quote highlighted — the round-trip from extracted value
back to source text is the core auditability story.

### 8. Show the review workflow

On the borrower detail page:

1. Click the **Edit** icon next to any field, change the value, save.
   The borrower's status flips to `Corrected`; the original value, its
   confidence, and the evidence quote are preserved in the audit log.
2. Click **Approve** (with optional reviewer notes) to finalize the
   record. The status chip updates to `Approved` and the **Reviewed At**
   timestamp appears in the Review Information section.
3. Visit **Review Queue** in the left nav to confirm the borrower has
   left the pending list.

### 9. Show the docs

Open [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) and
[`docs/PROMPT_STRATEGY.md`](docs/PROMPT_STRATEGY.md) in the editor (or on
GitHub for rendered Mermaid diagrams). Highlight:

- The component diagram and ingest sequence diagram in `SYSTEM_DESIGN.md`.
- The sample valid / invalid LLM responses in `PROMPT_STRATEGY.md`.
- The trade-offs and known-limitations sections in both — they document
  what the system *doesn't* do as honestly as what it does.

### 10. Show the agent-work folder

Open `agent-work/prompts/`. Each file is the original prompt that drove a
phase of development, plus the design notes captured while working. The
folder is the source-of-truth for *how* the system was built (alongside
the code which is *what* was built):

- `01-scaffold.md` through `06.5-human-review.md` — phase-by-phase build.
- `10.5-prompt-strategy.md`, `11-system-design.md`, `12-final-polish.md`
  — design-doc and final-polish work.

---

## 13. Known Limitations

The system is honest about what it does not yet do. Lifted from
[`docs/SYSTEM_DESIGN.md` §13–14](docs/SYSTEM_DESIGN.md) and
[`docs/PROMPT_STRATEGY.md` §16](docs/PROMPT_STRATEGY.md):

1. **No idempotent ingest.** Re-running `POST /api/ingest` on the same
   corpus duplicates rows. Reset the database first.
2. **Self-reported confidence is uncalibrated.** Use it for ranking, not
   as an absolute probability.
3. **Evidence quotes are not verified against the source.** A
   hallucinated quote can pass validation today.
4. **`sourceDocumentId` is checked for UUID shape, not membership in the
   batch.** A motivated hallucination could attribute to an arbitrary
   UUID.
5. **No OCR.** Image-only PDFs end up as documents with empty chunks.
6. **Single retry on validation failure.** Persistently bad batches are
   dropped.
7. **No authentication.** Review actions are timestamped but
   unattributed.
8. **All chunks loaded into memory per batch.** Very large corpora can
   exhaust the API process.
9. **Multi-borrower disambiguation is heuristic.** SSN with full-name
   fallback; identical names without SSN merge incorrectly.
10. **English-only prompt and schema.**
11. **No PII redaction in logs.** Validation errors and prompts can
    contain PII.
12. **Page numbers default to 1 for non-PDF parsers.**

---

## 14. Future Improvements

Roughly ordered by impact (full list in
[`docs/SYSTEM_DESIGN.md` §17](docs/SYSTEM_DESIGN.md#17-future-improvements)):

1. **Quote-grounding verifier** that asserts every `evidenceQuote` is a
   substring of its chunk — closes the largest open hallucination gap.
2. **Async pipeline** behind a job queue with progress polling.
3. **Idempotent ingest** via content-hash dedup.
4. **OCR for image-only PDFs.**
5. **OpenAI structured outputs / function calling** with Zod-to-JSON-Schema
   to remove the hand-rolled JSON skeleton in the prompt.
6. **Token-aware chunking** instead of char-based splitting.
7. **Postgres migration** when SQLite's serialized writer binds.
8. **FTS5 / `tsvector` borrower search** to replace `LIKE '%...%'`.
9. **Authentication** (OIDC) with per-user audit attribution.
10. **Confidence calibration** against approved borrowers as labels.

---

## 15. Agent / Tooling Approach

This project was built with [Claude Code](https://www.anthropic.com/claude-code)
using a structured multi-agent workflow. The full record lives in
`agent-work/prompts/`; the high-level pattern was:

- **Phased development**, one focused PR per phase. Each phase has a
  numbered prompt file (`01-scaffold.md`, `02-domain-models.md`, …)
  capturing the original instruction and any design decisions made
  during the phase.
- **Specialized subagents** invoked from the `.claude/CLAUDE.md` config
  for tasks that benefit from role conditioning:
  - `senior-dev` — backend, frontend, LLM integration.
  - `architect` — system design, scaling, technology choices.
  - `qa-eng` — test planning and validation strategy.
  - `designer` — UI/UX, Material UI components.
- **Code-as-record.** Documentation work (`PROMPT_STRATEGY.md`,
  `SYSTEM_DESIGN.md`) is descriptive of the implementation, not
  prescriptive. The code is the source of truth; the docs make it
  reviewable without reading every file.
- **Honest limitations.** Every design doc includes a "Known
  Limitations" section that calls out gaps explicitly so they are not
  silently assumed to work.
- **Pre-commit safety net.** Husky runs typecheck + tests on staged code
  to catch regressions before they land.
- **Structured logs and metrics.** Every pipeline stage emits a JSON
  log line plus a row in `processing_metrics`, so an agent or operator
  can reconstruct what happened from observability alone.

---

## 16. Documentation

- [System Design](docs/SYSTEM_DESIGN.md) — Architecture overview,
  component diagram, data pipeline, ingestion / parsing / extraction /
  storage / retrieval strategies, document variability handling, scaling
  to 10x and 100x volume, technical trade-offs, error handling,
  validation and data quality, observability, human review workflow,
  and future improvements.
- [Prompt Strategy](docs/PROMPT_STRATEGY.md) — LLM extraction prompt
  design, chunking rationale, JSON / Zod validation strategy, retry
  behavior, hallucination mitigation, source attribution, confidence
  scoring, OpenAI model selection, trade-offs vs. traditional NLP, known
  limitations, and sample valid / invalid responses.
- `agent-work/prompts/` — phase-by-phase build prompts and design notes.
- `.claude/CLAUDE.md` — project context for Claude Code agents.

---

## 17. License

UNLICENSED — Private repository.

For questions or clarifications, please reach out to the project maintainer.
