# Phase 11: System Design Document

**Date:** 2026-05-09
**Branch:** `claude/document-prompt-strategy-m24JN`
**Agent:** Claude Code
**Goal:** Capture LoanLens's architecture, scaling story, and operational
posture in a single reviewable doc that complements the prompt-strategy
write-up from Phase 10.5.

## Original Prompt

> Create docs/SYSTEM_DESIGN.md.
>
> Include:
> - architecture overview
> - Mermaid component diagram
> - data pipeline
> - ingestion strategy
> - parsing strategy
> - LLM extraction strategy
> - storage design
> - retrieval design
> - handling document variability
> - scaling to 10x volume
> - scaling to 100x volume
> - technical trade-offs
> - error handling
> - validation and data quality
> - observability
> - human review workflow
> - future improvements
>
> Update README with link to the system design doc.
>
> Document prompt in agent-work/prompts/11-system-design.md.

## Approach

The doc is descriptive of the current code (Phases 1–6.5), with explicit
forward-looking sections for 10x and 100x. Source-of-truth files inspected
before writing:

- `apps/api/src/index.ts` – Express bootstrap, route mounting.
- `apps/api/src/routes/ingest.ts` – the entire ingest → parse → extract
  → persist orchestration in one HTTP handler. The most important file
  for understanding "what actually happens."
- `apps/api/src/services/{Parsing,Chunking,Extraction,File}Service.ts` –
  service-layer responsibilities and boundaries.
- `apps/api/src/parsers/*` – the IParser interface and the six concrete
  parsers (Text, Markdown, CSV, JSON, PDF via `unpdf`, DOCX via
  `mammoth`).
- `apps/api/src/database/schema.ts` – nine tables, indexes, and the
  review-workflow migration path.
- `apps/api/src/repositories/*` – data access contracts; especially
  `BorrowerRepository` (EAV writes inside a transaction) and
  `ReviewRepository` (corrections + audit log).
- `apps/api/src/utils/logger.ts` and `apps/api/src/routes/metrics.ts` –
  observability surface area.
- `apps/web/src/{pages,components,store}/*` – frontend shape, especially
  `ReviewQueue`, `BorrowerDetail`, and the Zustand stores.
- `agent-work/prompts/06-openai-extraction.md` and
  `agent-work/prompts/06.5-human-review.md` – existing design notes for
  cross-reference; this doc deliberately does not duplicate them.

## Doc Structure

`docs/SYSTEM_DESIGN.md` is sectioned to match the ask exactly:

1. Architecture overview – three packages, single-node pipeline, OpenAI as
   the only external dep.
2. Component diagram – Mermaid `flowchart LR` showing browser → API
   process → storage / external. Boundary notes call out the routes /
   services / repos split.
3. Data pipeline – Mermaid `sequenceDiagram` walking through a single
   ingest invocation end-to-end, plus the document status state machine.
4. Ingestion strategy – directory-scan model, supported MIME allow-list,
   why upload was deferred, idempotency caveat.
5. Parsing strategy – parser registry table, IParser interface, OCR /
   table / page-number gaps called out.
6. LLM extraction strategy – brief; defers to PROMPT_STRATEGY.md for
   prompt-level detail and only covers the system-design implications
   (batching, rate limits, transactions on persist).
7. Storage design – EAV rationale, table-by-table purpose, indexing
   philosophy, transaction guarantees.
8. Retrieval design – REST endpoint table and read-side conventions
   (pagination, search, provenance always inlined).
9. Handling document variability – the six explicit strategies, plus what
   we deliberately do not do today.
10. Scaling to 10x – bottleneck table mapping each pain point to its
    smallest viable upgrade. Highlights what stays the same (domain
    types, repository interfaces, prompt).
11. Scaling to 100x – stage-per-service architecture, search index, LLM
    cost controls, multi-region / compliance considerations.
12. Technical trade-offs – decision table with chosen / alternative /
    rationale columns. Eleven rows covering the load-bearing decisions.
13. Error handling – numbered policy by layer (parser, validation, rate
    limit, persistence, route). Patterns we avoid called out explicitly.
14. Validation and data quality – three independent layers (syntactic,
    structural/semantic, domain) plus the quality signals we capture and
    the gaps we do not yet close.
15. Observability – logs / metrics / errors / request tracing / frontend
    signals, with concrete file pointers.
16. Human review workflow – Mermaid state diagram, backing tables, API
    surface, UI surface, what's intentionally out of scope.
17. Future improvements – 15 items roughly ordered by impact, starting
    with the quote-grounding verifier (the largest open hallucination
    gap).
18. References – cross-links to the prompt strategy doc, the prior
    agent-work prompts, and the implementation entry points.

## Diagrams

Three Mermaid diagrams:

- A `flowchart LR` component diagram (§2).
- A `sequenceDiagram` for the ingest pipeline (§3).
- A `stateDiagram-v2` for the borrower review state machine (§16).

All three render in GitHub's native Mermaid support, so the doc is
readable without local tooling.

## Other Changes

- README.md gains a `[System Design]` link in the Documentation section,
  placed above the `[Prompt Strategy]` link so the architectural overview
  is the entry point.
- No code changes. No test changes. Pure documentation.

## Why this matters

Before this doc, the architectural intent was implicit – readable only by
opening `routes/ingest.ts` and inferring intent from the code. Capturing
it explicitly:

1. Lets reviewers (architecture, security, product) reason about the
   pipeline without reading TypeScript.
2. Makes the trade-offs section the place to push back on
   decisions, instead of arguing over individual files.
3. Turns the scaling sections into a roadmap: each row in the 10x and
   100x tables is a candidate ticket.
4. Pairs naturally with PROMPT_STRATEGY.md – the latter goes deep on a
   single subsystem; this one keeps the wide-angle view.

## Out of Scope

- No re-derivation of the prompt-strategy material; cross-references only.
- No code changes, schema changes, or test changes.
- No commitments to specific 10x/100x infra (Postgres vs. Aurora, BullMQ
  vs. SQS); the doc presents shape, not vendor selection.

## Files Touched

- `docs/SYSTEM_DESIGN.md` (new)
- `README.md` (added System Design link to Documentation section)
- `agent-work/prompts/11-system-design.md` (this file)
