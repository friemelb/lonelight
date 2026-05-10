# Search and Filtering for LoanLens

## Overview

This document describes the search and filtering implementation that lets reviewers triage borrower records by free-text query and slice the list by extraction quality, review state, and source document.

## Original Prompt

> Add search and filtering.
>
> Backend:
> - GET /api/search?q=
> - search borrower name
> - addresses
> - account numbers
> - loan numbers
> - source quotes
>
> Frontend:
> - search bar on Borrowers page
> - filter by confidence
> - filter by review status
> - filter by source document
>
> Add tests for search behavior.
>
> Document prompt in agent-work/prompts/09-search-filtering.md.

## Design Decisions

### One unified search endpoint
- New `GET /api/search` is added rather than overloading `/api/borrowers`. The Borrowers page uses it for both browsing and querying. `/api/borrowers` stays as-is for direct API consumers and the existing `BorrowerDetail` flow.

### Caller-controlled search scopes
- The free-text `q` is matched against scopes the caller picks: `'values'` (against `borrower_fields.field_value`) and/or `'quotes'` (against `borrower_fields.evidence_quote`). Default is `['values']` — the safer behavior, since matching evidence quotes can surface surprising results (e.g. searching "John" finding Mary because the quote that supports Mary's record mentions both names).
- All requested search targets — borrower name, address components, account numbers, loan numbers — live in `field_value` (or will, once the persistence TODO at `BorrowerRepository.ts:69` is finished). The `'values'` scope covers them all. Evidence quotes are exposed as a separate opt-in scope so reviewers can switch to "find borrowers whose source quotes mention X" when they need it.
- Out of scope here: persisting nested address/account/loan rows. The SQL is written so they become searchable the moment that TODO lands.

### Confidence semantic
- The confidence filter applies to `fullName.confidence` (the primary display field). A borrower passes if `fullName.confidence >= threshold`. This matches what the user sees in the table and gives a single, predictable knob. Threshold of `0` (default) means "no filter" and skips the SQL clause entirely.
- Alternatives considered (min across all fields, min across any field) were rejected as either too strict or too loose to be useful as a default.

### Filter state in the store, auto-fetch on change
- Filter state lives in `borrowerStore` next to existing borrowers state, mirroring the `documentStore.setFilters` pattern. Each filter change immediately triggers a refetch — no separate "Apply" button.
- The free-text input is debounced 300ms in the page component before calling `setFilters`.

## API

### GET /api/search

**Query parameters:**
- `q` (optional) — free-text search; matched as `%q%` against the columns picked by `in`.
- `in` (optional, default `values`) — comma-separated subset of `values,quotes`. `values` matches `borrower_fields.field_value`; `quotes` matches `borrower_fields.evidence_quote`. Returns 400 if any token is unknown.
- `confidence` (optional, 0–1) — minimum `fullName.confidence`. Returns 400 if out of range or non-numeric.
- `reviewStatus` (optional) — one of `pending_review`, `approved`, `rejected`, `corrected`. Returns 400 if invalid.
- `sourceDocument` (optional) — filters borrowers to those whose fields were extracted from the given `documents.id`.
- `limit` (default 50), `offset` (default 0).

**Response (same envelope as `/api/borrowers`):**
```json
{
  "data": [/* BorrowerRecord[] */],
  "pagination": { "total": 12, "limit": 50, "offset": 0, "hasMore": false }
}
```

## Repository

### `BorrowerRepository.searchAndFilter(opts)`

Lives next to the older `search()` method. Builds a dynamic `WHERE` clause from the provided options against `borrowers b LEFT JOIN borrower_fields bf`. Two queries: a `COUNT(DISTINCT b.id)` for `total`, and a `SELECT DISTINCT b.id ... ORDER BY b.updated_at DESC LIMIT ? OFFSET ?` for the page. Full records are hydrated by reusing `findById()`.

The `minConfidence` clause uses a subquery: `b.id IN (SELECT borrower_id FROM borrower_fields WHERE field_name = 'fullName' AND confidence >= ?)`.

## Frontend

### `borrowerStore` additions
- `SearchScope = 'values' | 'quotes'` exported alongside `BorrowerFilters`.
- `BorrowerFilters` interface: `{ q, searchIn: SearchScope[], minConfidence, reviewStatus: ReviewStatus | 'ALL', sourceDocumentId: string | 'ALL' }`.
- `DEFAULT_FILTERS` constant exported for the page's reset logic. Default `searchIn` is `['values']`.
- `setFilters(partial)` — merges + auto-fetches.
- `fetchFiltered(limit, offset)` — hits `/api/search`, skipping params equal to defaults. Sends `in` only when `searchIn` differs from the default *and* `q` is non-empty.
- `resetFilters()` — restores defaults and refetches.
- A small `hydrateBorrower` helper consolidates the previously-duplicated date/`extractedAt` conversion logic that `fetchBorrowers` and `fetchBorrowerById` both did inline.

### Borrowers page
- Free-text input is now bound to local `searchInput` state, debounced 300ms before calling `setFilters({ q })`.
- A `ToggleButtonGroup` next to the search input lets the reviewer pick `Values` and/or `Quotes` (default: `Values` only). The handler refuses an empty selection — a zero-scope search would silently match nothing.
- New filter row (a `Paper` above the table) with:
  - **Min confidence** — MUI `Slider` (0–1, step 0.05).
  - **Review status** — MUI `Select` with `All / Pending / Approved / Rejected / Corrected`.
  - **Source document** — MUI `Autocomplete` populated from `useDocumentStore().documents` (loaded on mount if empty); first option is `All documents`.
  - **Reset** button — disabled when filters match defaults.
- Pagination, refresh, and row navigation work as before.

## Files Touched

**New:**
- `apps/api/src/routes/search.ts`
- `apps/api/src/routes/search.test.ts`
- `apps/web/src/store/borrowerStore.test.ts`
- `agent-work/prompts/09-search-filtering.md`

**Modified:**
- `apps/api/src/repositories/BorrowerRepository.ts` — added `searchAndFilter`
- `apps/api/src/index.ts` — registered `/api/search` router
- `apps/web/src/store/borrowerStore.ts` — filter state + `fetchFiltered` + `hydrateBorrower` helper
- `apps/web/src/pages/Borrowers.tsx` — filter UI + wiring to `setFilters`

## Tests

### Backend (`apps/api/src/routes/search.test.ts`)
- Search by `fullName`, email, account number, loan number, and address city (all via the default `values` scope).
- Quote-only matches are returned only when `in=quotes` (or `in=values,quotes`) is set; the default scope deliberately ignores quotes.
- Filter by `confidence >= 0.9`, `reviewStatus`, and `sourceDocument`.
- Combined `q` + filter narrows correctly.
- Empty query returns all rows.
- Pagination metadata (`total`, `hasMore`).
- 400 on invalid `reviewStatus`, out-of-range confidence, non-numeric confidence, or unknown `in` token.

Account number, loan number, and address rows are seeded with a small `insertExtraField` helper that writes directly to `borrower_fields` (working around the persistence TODO).

### Frontend (`apps/web/src/store/borrowerStore.test.ts`)
- `fetchFiltered` builds the right URL (defaults omitted), populates state, and surfaces errors.
- `setFilters` merges partial updates and triggers a fetch with the merged params.
- `resetFilters` restores defaults and refetches.
- Scope toggling: `in` is omitted on the default `['values']`, sent as `quotes` or `values,quotes` otherwise, and never sent when `q` is empty.
- Mocks `fetch` via `vi.stubGlobal`; this also establishes the first store-level test pattern in `apps/web/src/store/`.

## Verification

```sh
npm run test:api          # 217 tests pass (197 prior + 20 new search tests)
npm run test:web          # 12 tests pass (2 prior + 10 new store tests)
npm run type-check        # all workspaces clean
```

Manual:
```sh
# Default: values-only — won't match a name that only appears in an evidence quote
curl 'http://localhost:3001/api/search?q=John'

# Opt in to quote search
curl 'http://localhost:3001/api/search?q=John&in=quotes'

# Both scopes plus filters
curl 'http://localhost:3001/api/search?q=John&in=values,quotes&confidence=0.5&reviewStatus=pending_review'
```

In the UI at `/borrowers`:
- Type in the search box → debounced fetch to `/api/search?q=...`.
- Move the confidence slider → low-confidence rows drop out.
- Pick a status / source document → list narrows.
- "Reset" returns the table to the full list.

---

**Document Version**: 1.0
**Last Updated**: 2026-05-09
**Author**: Claude Code Agent
