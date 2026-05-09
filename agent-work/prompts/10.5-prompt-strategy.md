# Phase 10.5: Document the Prompt Strategy

**Date:** 2026-05-09
**Branch:** `claude/document-prompt-strategy-m24JN`
**Agent:** Claude Code
**Goal:** Capture how LoanLens uses LLMs for borrower extraction in a reviewable design doc.

## Original Prompt

> Create docs/PROMPT_STRATEGY.md.
>
> Document:
> - extraction prompt design
> - why chunking is used
> - JSON enforcement strategy
> - Zod validation strategy
> - retry behavior
> - hallucination mitigation
> - source attribution requirements
> - confidence scoring
> - OpenAI model selection rationale
> - trade-offs vs traditional NLP
> - known limitations
>
> Include:
> - sample extraction prompt
> - sample valid response
> - sample invalid response
> - how invalid responses are handled
>
> Update README to link this doc.
>
> Document prompt in agent-work/prompts/10.5-prompt-strategy.md.

## Approach

The doc is descriptive (reflecting what the code already does), not
prescriptive. Source-of-truth files inspected before writing:

- `apps/api/src/services/ExtractionService.ts` – prompt assembly, retry
  flow, batching, merge logic, OpenAI call parameters.
- `apps/api/src/schemas/borrowerExtraction.schema.ts` – Zod contract for
  every extracted field, including the `ExtractedField` envelope.
- `apps/api/src/services/ChunkingService.ts` – chunk size (1500 chars),
  overlap (100 chars), sentence-boundary splitting.
- `agent-work/prompts/06-openai-extraction.md` – existing Phase 6 design
  notes used as a cross-reference for confidence rubric and metrics.

## Doc Structure

`docs/PROMPT_STRATEGY.md` is organized so each numbered section maps
directly to a bullet from the original ask:

1. Goals and constraints (framing).
2. Extraction prompt design (matches "extraction prompt design").
3. Why chunking is used (matches "why chunking is used").
4. JSON enforcement strategy.
5. Zod validation strategy.
6. Retry behavior – split into validation retry (single attempt) and
   rate-limit retry (exponential backoff), reflecting both
   `extractBorrowersFromAllDocuments` and `callOpenAIWithRetry`.
7. Hallucination mitigation – seven concrete defenses, cross-referenced to
   the limitations section so the gaps are not hidden.
8. Confidence scoring – the 4-band rubric the prompt actually emits, plus
   the honest caveat that scores are uncalibrated.
9. Source attribution requirements – the `ExtractedField` envelope and how
   it lands in `borrower_fields` (EAV).
10. OpenAI model selection rationale – why `gpt-4o-2024-11-20`, with the
    snapshot pin called out.
11. Trade-offs vs. traditional NLP – side-by-side table.
12. Sample extraction prompt – condensed but faithful to the current
    output of `buildExtractionPrompt()`.
13. Sample valid response – passes both `JSON.parse` and the Zod schema.
14. Sample invalid response – seven distinct violations (out-of-range
    confidence, non-UUID source ID, zero page, empty quote, enum
    violation, negative income, etc.).
15. How invalid responses are handled – pseudo-flow plus the concrete
    error messages the schema would emit for the §14 example, plus the
    HTTP 422 / dropped-batch behavior.
16. Known limitations – 12 entries, including the important ones the code
    currently does NOT do (no quote verification, no UUID-in-batch check,
    no caching).
17. References – relative links back to the implementation files and to
    this prompt file.

## Other Changes

- README.md gains a **Documentation** section with a single link to the
  new doc, placed above the License section so it sits with other
  navigational content.
- No code changes. No test changes. Pure documentation.

## Why this matters

Before this doc, the prompt strategy was implicit – readable only by
opening the service file. Capturing it explicitly:

1. Lets reviewers (security, compliance, product) reason about
   hallucination risk without reading TypeScript.
2. Documents the *intentional* trade-offs (e.g. why we don't use OpenAI's
   structured-output mode yet) so they aren't accidentally "fixed."
3. Makes the limitations section a living checklist for future phases –
   each item is a candidate Phase-7+ ticket.

## Out of Scope

- No prompt or schema changes. The doc reflects current behavior.
- No new tests. Documentation is not exercised by the test suite.
- No calibration data. Confidence calibration is called out as a known
  limitation but not addressed here.

## Files Touched

- `docs/PROMPT_STRATEGY.md` (new)
- `README.md` (added Documentation section)
- `agent-work/prompts/10.5-prompt-strategy.md` (this file)
