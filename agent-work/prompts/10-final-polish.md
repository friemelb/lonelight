# Phase 12: Final Polish — README, Demo Flow, UI

**Date:** 2026-05-09
**Branch:** `claude/document-prompt-strategy-m24JN`
**Agent:** Claude Code
**Goal:** Make the project demo-ready: a complete README, a 10-step
demo script, and the UI polish needed to actually run that script
(loading, empty, error states; consistent spacing; clear button labels).

## Original Prompt

> Finalize README and demo flow.
>
> README must include:
> - project overview
> - tech stack
> - architecture summary
> - setup instructions
> - environment variables
> - how to run API and UI
> - how to run tests
> - how to add documents
> - how to run ingestion
> - how to run extraction
> - how to review borrower records
> - known limitations
> - future improvements
> - agent/tooling approach
>
> Add Demo Script:
> 1. Start app
> 2. Open Dashboard
> 3. Run ingestion
> 4. Run extraction
> 5. Open Borrowers
> 6. Open Borrower Detail
> 7. Show source attribution
> 8. Show review workflow
> 9. Show docs
> 10. Show agent-work folder
>
> Add final polish:
> - loading states
> - empty states
> - error states
> - consistent Material UI spacing
> - clear button labels
>
> Document prompt in agent-work/prompts/12-final-polish.md.

## Approach

Two work streams running together: documentation (README) and the small
amount of UI work needed to make the demo script actually executable in
the browser.

### Documentation: README rewrite

The previous README was geared toward early-phase development. It was
re-organized end-to-end so the file tells a single coherent story: what
LoanLens does → how to set it up → how to run each pipeline stage →
how to walk the demo → known limitations and roadmap → tooling
approach.

Section order matches the prompt list exactly so a reviewer can check
each requirement against the table of contents:

1. Project Overview
2. Tech Stack
3. Architecture Summary (links to `SYSTEM_DESIGN.md`)
4. Setup
5. Environment Variables (table per env file)
6. Running the API and UI
7. Running Tests
8. Adding Documents (parser table)
9. Running Ingestion (UI + curl)
10. Running Extraction (UI + curl + status codes)
11. Reviewing Borrower Records (UI + curl)
12. **Demo Script** — the requested 10 steps, each one written so the
    operator can read it aloud and click along.
13. Known Limitations (12 items, lifted from the design docs)
14. Future Improvements (10 items, ordered by impact)
15. Agent / Tooling Approach (subagent roster, phase pattern,
    agent-work folder convention)
16. Documentation (cross-links to the two design docs)
17. License

Each demo step describes both the user action and the UI affordance
that backs it (e.g. "click **Run Ingestion** in the Pipeline Actions
card; the Snackbar reports …"). This makes the demo verifiable
end-to-end without ambiguity.

### UI polish: making the demo executable

Before this phase, several demo steps had no UI affordance at all (no
"Run Extraction" button anywhere; ingestion was a tooltipped icon).
The polish work targets the gaps exposed by the demo script, not
cosmetic changes for their own sake.

**`apps/web/src/store/borrowerStore.ts`**
- Add `extractBorrowers()` action that POSTs `/api/borrowers/extract`
  and returns a typed `ExtractionRunResult` (success, counts, duration,
  errors). Refreshes the borrower list on success so the table
  reflects newly-extracted borrowers without a manual reload.
- Add `isExtracting: boolean` to the store so any UI surface can
  reflect extraction-in-progress state.

**`apps/web/src/store/documentStore.ts`**
- Tighten the `ingestDocuments` return type to a named
  `IngestRunResult` interface that includes `borrowersExtracted`,
  `extractionSuccess`, `extractionError`, etc., so callers can show
  meaningful summaries without `as any` casts.

**`apps/web/src/pages/Dashboard.tsx`**
- New **Pipeline Actions** Paper at the top of the Dashboard with three
  large, clearly-labeled buttons: `Run Ingestion`, `Run Extraction`,
  `Refresh`. Loading states are reflected in button labels
  (`Running ingestion…`, `Running extraction…`).
- Single `Snackbar` with severity-aware (`success` / `warning` /
  `error`) toast messages summarizing each action's outcome, including
  counts and duration.
- Skeleton loading state for metric tiles (`Skeleton variant="text"`
  while `metrics === null`).
- Error banner for metrics fetch failures with a retry-on-close
  affordance.
- Reset Database moved into the API Status card and reworded for
  clarity; still gated by a `confirm()` dialog.
- Consistent grid spacing (`spacing={3}`) and consistent paper padding
  (`p: 3`) across all tiles.

**`apps/web/src/pages/Documents.tsx`**
- Replace the icon-only `CloudUpload` IconButton with a labeled
  `Button` reading `Run Ingestion` (loading state: `Running…`).
- Empty-state row now includes context ("Drop files into
  `apps/api/data/corpus/` and click **Run Ingestion**…") and an
  inline action button so reviewers don't have to bounce back to the
  Dashboard.

**`apps/web/src/pages/Borrowers.tsx`**
- Empty state distinguishes "no search match" from "no borrowers
  extracted yet"; the latter includes an inline **Run Extraction**
  button wired to the store action. Loading-state on the button
  reflects `isExtracting`.

**Pre-existing bug fixed as a blocker**
- `apps/api/src/repositories/ReviewRepository.ts` imported
  `uuid` (not in `package.json`), causing 3 test suites
  (`borrowers.test.ts`, `documents.test.ts`, `ingest.test.ts`) to fail
  at module load. Replaced with `crypto.randomUUID()` to match the
  pattern already used in `BorrowerRepository` and `ExtractionService`.
  After the fix, all 197 API tests pass, all 3 domain test suites pass
  (59 tests), and the web App test suite passes (2 tests).

### What was deliberately NOT changed

Per the project conventions ("Don't add features … beyond what the
task requires"):

- No new pages, components, or routes.
- No theme or color changes.
- No emoji additions; existing emoji in console output untouched.
- No CLAUDE.md edits.
- No test additions for the new store action — the existing
  smoke-level web test still passes; deeper coverage would be its own
  scoped task.

## Verification

```
$ npx tsc --noEmit --skipLibCheck      # web: clean
$ cd apps/api && npx tsc --noEmit --skipLibCheck   # api: clean
$ cd apps/api && npx vitest run        # 197 / 197 pass
$ cd apps/web && npx vitest run        # 2 / 2 pass
$ cd packages/domain && npx vitest run # 59 / 59 pass
```

UI was reviewed by reading each touched component end-to-end and
mentally walking the 10-step demo script. A live browser walkthrough
was not performed in this session.

## Files Touched

**Documentation**
- `README.md` (rewritten)
- `agent-work/prompts/12-final-polish.md` (this file)

**Web**
- `apps/web/src/pages/Dashboard.tsx`
- `apps/web/src/pages/Documents.tsx`
- `apps/web/src/pages/Borrowers.tsx`
- `apps/web/src/store/borrowerStore.ts`
- `apps/web/src/store/documentStore.ts`

**API**
- `apps/api/src/repositories/ReviewRepository.ts` (uuid → crypto.randomUUID)

## Out of Scope

- Idempotent ingest (called out as a known limitation; tracked in
  `SYSTEM_DESIGN.md` future improvements).
- OCR for image-based PDFs.
- Authentication / per-user audit attribution.
- Production deployment instructions / Dockerfiles.
- New automated tests for the demo flow itself.
