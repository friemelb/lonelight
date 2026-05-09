# LoanLens Prompt Strategy

**Last Updated:** 2026-05-09
**Owner:** Extraction pipeline (`apps/api/src/services/ExtractionService.ts`)
**Schema:** `apps/api/src/schemas/borrowerExtraction.schema.ts`

This document explains how LoanLens uses Large Language Models (LLMs) to turn
unstructured mortgage documents into structured, auditable borrower records.
It covers the prompt design, the validation layer that wraps it, and the
trade-offs we accept by relying on an LLM rather than traditional NLP.

---

## 1. Goals and Constraints

The extraction layer must:

1. Produce **structured, schema-conformant output** that can be stored in
   SQLite via the `BorrowerRepository` without further normalization.
2. Provide **source attribution** (document, page, exact quote) for every
   extracted field so downstream reviewers can verify any value.
3. Emit a **calibrated confidence score** for every field, enabling automated
   triage and human-in-the-loop review.
4. **Never hallucinate** values that are not supported by the source corpus.
5. Fail **loudly and recoverably** when the model returns malformed output,
   not silently corrupt the database.

These goals shape every design decision below.

---

## 2. Extraction Prompt Design

The prompt is assembled at runtime by
`ExtractionService.buildExtractionPrompt()` and is composed of five sections:

1. **Role framing** – establishes domain expertise:
   > "You are an expert at extracting structured borrower information from
   > mortgage loan documents."
2. **Context block** – every chunk that the batch will analyze, prefixed with
   `=== DOCUMENT: <filename> (ID: <uuid>) ===` and
   `[CHUNK <id> - Page <n>]` headers. The UUIDs and page numbers are surfaced
   in-band so the model can copy them verbatim into `sourceDocumentId` /
   `sourcePage`.
3. **Schema specification** – an inline JSON skeleton showing the exact shape
   of each field, including the nested `{ value, confidence,
   sourceDocumentId, sourcePage, evidenceQuote }` envelope.
4. **Critical requirements** – numbered, imperative rules (e.g. "EVERY field
   must include …", "Return ONLY the JSON object").
5. **Confidence scoring rubric** – a band-by-band guide (see
   [§8](#8-confidence-scoring)).

A condensed sample is included in [§12](#12-sample-extraction-prompt). The
full prompt body lives in `ExtractionService.buildExtractionPrompt()` in
`apps/api/src/services/ExtractionService.ts`.

### 2.1 System message

The OpenAI chat call uses a separate system message:

> "You are a mortgage document analysis expert. You extract structured data
> from loan documents with high accuracy. Always respond with valid JSON."

The system message is intentionally short – role conditioning is repeated in
the user message because some smaller models down-weight the system role.

### 2.2 Sampling parameters

| Parameter     | Value | Rationale                                         |
| ------------- | ----- | ------------------------------------------------- |
| `temperature` | 0.1   | Factual extraction; minimize stochastic variance. |
| `max_tokens`  | 16000 | Allows full borrower JSON for large corpora.      |

---

## 3. Why Chunking Is Used

Documents are pre-split into ~1500-character overlapping chunks by
`ChunkingService`, and chunks – not raw documents – are what the prompt sees.
This is intentional:

1. **Context window budget.** GPT-4o has a 128K-token window, but mortgage
   corpora can exceed that across dozens of PDFs. Chunking lets us batch
   selectively (`DEFAULT_BATCH_CONFIG`: 5 docs / 30 chunks / 40K chars per
   call) instead of paying for one giant request.
2. **Page-level provenance.** Each chunk carries a `pageNumber`, and the
   prompt surfaces it in the `[CHUNK ... - Page n]` header. The model can
   then attribute extractions to a specific page rather than guessing.
3. **Sentence-aware boundaries with overlap.** `ChunkingService` splits on
   sentence delimiters and carries a 100-character overlap into the next
   chunk so values that straddle a boundary (e.g. "John\nDoe") are not lost.
4. **Cost containment.** Smaller, focused requests are cheaper to retry on
   validation failure (see [§6](#6-retry-behavior)).
5. **Failure isolation.** When one batch fails validation after retry, the
   other batches still produce results – we degrade gracefully rather than
   losing the whole corpus.

Because the same borrower can appear across batches, the service runs
`mergeDuplicateBorrowers()` after all batches return, keying on SSN with
fall-back to normalized full name and preferring higher-confidence values
on collision.

---

## 4. JSON Enforcement Strategy

The model is instructed three different ways to return JSON:

1. The system message ends with "Always respond with valid JSON."
2. The user prompt ends with "Return ONLY the JSON object, no additional
   text."
3. The JSON skeleton in the prompt is a literal example the model can mimic.

We deliberately **do not rely on instructions alone**. The
`parseAndValidateResponse()` method:

- Strips ```` ```json ```` and bare ```` ``` ```` fences if the model wraps
  its output in markdown.
- Calls `JSON.parse()` and reports any syntactic failure as a `JSON parsing
  failed` error.
- Hands the parsed object to the Zod schema for structural validation.

We considered OpenAI's `response_format: { type: 'json_object' }` and
structured-output (function-calling) modes. They are on the roadmap but were
deferred because:

- Structured output requires a JSON Schema we would have to keep in sync
  with the Zod schema (single source of truth concern).
- Hand-rolled prompt + Zod gives identical end-to-end guarantees with full
  control over error messages used in the retry prompt.

---

## 5. Zod Validation Strategy

`OpenAIExtractionResponseSchema` (in
`apps/api/src/schemas/borrowerExtraction.schema.ts`) is the contract between
the LLM and the rest of the system. Nothing reaches the database unless it
parses cleanly.

Key invariants enforced by Zod:

- `confidence` is a number in `[0, 1]`.
- `sourceDocumentId` is a UUID (and at the route layer must match a document
  the model was actually given).
- `sourcePage` is a positive integer.
- `evidenceQuote` has length ≥ 1.
- `incomeType` is restricted to a 7-value enum; `frequency` to a 7-value
  enum; out-of-vocabulary values are rejected.
- Numeric income amounts are positive.
- Email fields must be valid email strings.

Validation failures are converted to human-readable strings of the form
`<path>: <message>` and surfaced both in the retry prompt and in the
service's `validationErrors` field for logging.

The schema is deliberately permissive about **which fields are present** –
nearly all top-level fields are `.optional()`. We would rather the model
omit a field than fabricate one. The "extract only what you can support"
instruction in the prompt is paired with this schema permissiveness to give
the model an honest exit.

---

## 6. Retry Behavior

There are two distinct retry mechanisms:

### 6.1 Validation retry (single attempt)

If `parseAndValidateResponse()` fails, `extractBorrowersFromAllDocuments()`
calls `buildRetryPrompt()`, which appends the prior error message and a
focused reminder:

```
IMPORTANT: The previous extraction attempt failed with this error:
<error>

Please carefully review the requirements and provide a valid JSON response …
- All confidence values must be between 0 and 1
- All sourceDocumentId fields must be valid UUIDs from the documents provided
- All evidenceQuote fields must contain actual text quotes
- The response must be valid, parseable JSON
```

Only **one** retry is attempted. Empirically, a second attempt on the same
prompt rarely succeeds and doubles the worst-case latency / cost. If the
retry also fails, the service returns `success: false` with the validation
errors and the route returns HTTP 422.

### 6.2 Rate-limit retry (exponential backoff)

`callOpenAIWithRetry()` wraps `callOpenAI()` and retries up to 3 times when
the OpenAI SDK throws a `429` (rate limit) error, with delays of 5s, 10s,
20s. Non-429 errors fail immediately so we don't waste time retrying
hopeless requests (e.g. 401s, 400s).

In batch mode there is also a **2-second inter-batch delay** to spread
requests below the per-minute rate limit.

---

## 7. Hallucination Mitigation

Hallucination is the central failure mode of LLM-based extraction. We
counter it with overlapping defenses:

1. **Mandatory evidence quotes.** Every `ExtractedField` requires
   `evidenceQuote` ≥ 1 character. The model must literally point at the
   text it is extracting from.
2. **Mandatory source IDs the model did not invent.** The
   `sourceDocumentId` and `sourcePage` are surfaced in chunk headers; the
   schema rejects values that aren't valid UUIDs. We can (and the route
   does) cross-check that the UUID was actually present in the prompt.
3. **Low temperature (0.1).** Deterministic-ish sampling reduces creative
   completions.
4. **Confidence floor advice.** The rubric instructs "Below 0.5: Uncertain,
   avoid extracting." Combined with optional fields, this gives the model
   an honest "I don't know" path.
5. **Permissive optionality.** Required fields are minimal (`fullName` only
   on each borrower). The model is never forced to invent a missing SSN or
   email.
6. **Human-in-the-loop downstream.** Extracted borrowers land with
   `reviewStatus: PENDING_REVIEW`. The review UI surfaces the evidence
   quote alongside the extracted value so a human can verify before
   approval.
7. **Explicit enum constraints.** Income type and frequency are enums; an
   imagined value like `"BIANNUAL"` is rejected at the validator and either
   triggers a retry or is dropped.

Known residual risks are listed in [§13](#13-known-limitations).

---

## 8. Confidence Scoring

Every `ExtractedField` carries a `confidence ∈ [0, 1]`. The prompt instructs:

| Band       | Meaning                                          |
| ---------- | ------------------------------------------------ |
| 0.90–1.00  | Explicit, clear statement in the document.       |
| 0.70–0.89  | Strong inference from surrounding context.       |
| 0.50–0.69  | Reasonable inference with some ambiguity.        |
| < 0.50     | Too uncertain – do not extract.                  |

These bands are **self-reported by the model** and are not (yet) calibrated
against a labeled validation set. We treat confidence as a relative
ranking, not an absolute probability:

- The review UI sorts and color-codes by confidence to direct human
  attention.
- When the same field is extracted in multiple batches,
  `mergeBorrowerRecords()` keeps the higher-confidence value.
- Calibration against ground truth is a Phase-7+ enhancement.

---

## 9. Source Attribution Requirements

Source attribution is non-negotiable. Every leaf field in the borrower
schema is wrapped in:

```ts
{
  value: T,
  confidence: number,           // 0..1
  sourceDocumentId: string,     // UUID from the prompt
  sourcePage: number,           // 1-indexed
  evidenceQuote: string,        // verbatim from the document
  boundingBox?: [x, y, w, h],   // reserved for OCR phase
  extractedAt?: Date,
  notes?: string
}
```

Storage: the API persists each leaf as a row in `borrower_fields` (EAV
pattern), preserving `field_name`, `confidence`, `source_document_id`,
`source_page`, and `evidence_quote`. This means the review UI can render
"value → quote → page → document" for every cell without joining back to
the chunk store.

Compliance benefit: regulators (and internal auditors) can ask "where did
this SSN come from?" and get a deterministic answer.

---

## 10. OpenAI Model Selection Rationale

Default: `gpt-4o-2024-11-20` (overridable via `OPENAI_MODEL` env var).

| Criterion                | Rationale                                                 |
| ------------------------ | --------------------------------------------------------- |
| Accuracy on extraction   | GPT-4o-class models reliably follow a JSON skeleton and respect enum constraints in our test corpus. |
| 128K context window      | Comfortably fits a 5-document / 30-chunk batch with headroom for the schema and retry prompt. |
| JSON-mode capable        | Future-proofs the move to native structured output without changing the model. |
| Cost vs. accuracy        | Cheaper models (gpt-4o-mini, GPT-3.5) regress on confidence calibration and on copying long evidence quotes verbatim. |
| Vision capability        | Reserved for future OCR / scanned-document phase.         |
| Stable snapshot          | Pinning to `2024-11-20` avoids silent behavior drift from version aliases. |

The model is **not** hard-coded; deployments can point at a different
snapshot or a different provider's compatible endpoint via env vars.

---

## 11. Trade-offs vs. Traditional NLP

| Dimension              | LLM (current)                                         | Rule-based / classical NLP                            |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Setup cost             | One prompt + schema, ~hours.                          | Per-field regex / NER models / templates, ~weeks.     |
| Format robustness      | Handles novel layouts, paraphrasing, OCR noise well.  | Brittle to format variation; new templates per lender.|
| Recall on PII / income | High; understands context like "Borrower:" vs. "Co-borrower:". | High only when patterns are pre-encoded.       |
| Determinism            | Stochastic; same input may yield slightly different confidences. | Fully deterministic.                          |
| Latency                | Seconds per batch (network + inference).              | Milliseconds.                                         |
| Cost                   | Per-token API spend (~$0.10/batch typical).           | Compute only after upfront engineering.               |
| Auditability           | Strong with mandatory evidence quotes (this design).  | Strong by construction.                               |
| Hallucination risk     | Real – mitigated, not eliminated.                     | None (only false negatives, not false positives).     |
| Maintenance            | Prompt + schema iteration.                            | Per-template patching.                                |

We chose the LLM path because mortgage corpora are heterogeneous (every
lender ships a different template, and OCR noise is endemic) and because
the same prompt scales to new field types without engineering work. The
mitigations above buy back most of the determinism and auditability that
classical NLP gives for free.

---

## 12. Sample Extraction Prompt

The following is a condensed version of the prompt body produced by
`buildExtractionPrompt()` for a one-document, one-chunk corpus:

````text
You are an expert at extracting structured borrower information from mortgage loan documents.

CONTEXT - Document chunks to analyze:

=== DOCUMENT: 1003-application-doe.pdf (ID: 8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70) ===

[CHUNK 0a1b2c3d-... - Page 1]
Uniform Residential Loan Application
Borrower: John Q. Doe
SSN: 123-45-6789   DOB: 1985-04-12
Current Address: 123 Main St, Springfield, IL 62701
Employer: Acme Corp        Position: Software Engineer
Income: $8,500 / month (W-2)         Employed since: 2020-01-15

TASK:
Extract all borrower information from the documents above. Return a JSON object with the following structure:

{
  "borrowers": [
    {
      "fullName": {
        "value": "John Doe",
        "confidence": 0.95,
        "sourceDocumentId": "uuid-of-document",
        "sourcePage": 1,
        "evidenceQuote": "exact quote from document"
      },
      "firstName":  { ... },
      "lastName":   { ... },
      "ssn":        { ... },
      "dateOfBirth":{ ... },
      "currentAddress": {
        "street":  { "value": "...", "confidence": 0.9, "sourceDocumentId": "...", "sourcePage": 1, "evidenceQuote": "..." },
        "city":    { ... },
        "state":   { ... },
        "zipCode": { ... }
      },
      "incomeHistory": {
        "value": [
          {
            "employer":    { "value": "...", "confidence": 0.9, "sourceDocumentId": "...", "sourcePage": 1, "evidenceQuote": "..." },
            "incomeType":  { "value": "W2", ... },
            "frequency":   { "value": "MONTHLY", ... },
            "grossAmount": { "value": 8500, ... },
            "startDate":   { "value": "2020-01-15", ... },
            "isCurrent":   { "value": true, ... }
          }
        ],
        "confidence": 0.9,
        "sourceDocumentId": "uuid",
        "sourcePage": 1,
        "evidenceQuote": "quote"
      },
      "documentIds": ["uuid1"]
    }
  ]
}

CRITICAL REQUIREMENTS:
1. EVERY field must include value, confidence, sourceDocumentId, sourcePage, evidenceQuote.
2. incomeType ∈ {W2, SELF_EMPLOYMENT, RENTAL, INVESTMENT, RETIREMENT, SOCIAL_SECURITY, OTHER}.
3. frequency  ∈ {HOURLY, WEEKLY, BIWEEKLY, SEMIMONTHLY, MONTHLY, QUARTERLY, ANNUAL}.
4. If a borrower appears in multiple documents, list all documentIds.
5. Include only fields where you have evidence. Omit fields you cannot find.
6. Confidence: 0.9–1.0 explicit, 0.7–0.89 strong inference, 0.5–0.69 reasonable inference, <0.5 do not extract.
7. Return ONLY the JSON object, no additional text.

Extract the borrower information now:
````

---

## 13. Sample Valid Response

A response that passes both `JSON.parse` and
`OpenAIExtractionResponseSchema`:

```json
{
  "borrowers": [
    {
      "fullName": {
        "value": "John Q. Doe",
        "confidence": 0.97,
        "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
        "sourcePage": 1,
        "evidenceQuote": "Borrower: John Q. Doe"
      },
      "firstName": {
        "value": "John",
        "confidence": 0.95,
        "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
        "sourcePage": 1,
        "evidenceQuote": "Borrower: John Q. Doe"
      },
      "lastName": {
        "value": "Doe",
        "confidence": 0.95,
        "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
        "sourcePage": 1,
        "evidenceQuote": "Borrower: John Q. Doe"
      },
      "ssn": {
        "value": "123-45-6789",
        "confidence": 0.99,
        "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
        "sourcePage": 1,
        "evidenceQuote": "SSN: 123-45-6789"
      },
      "currentAddress": {
        "street": {
          "value": "123 Main St",
          "confidence": 0.93,
          "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
          "sourcePage": 1,
          "evidenceQuote": "Current Address: 123 Main St, Springfield, IL 62701"
        },
        "city": {
          "value": "Springfield",
          "confidence": 0.93,
          "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
          "sourcePage": 1,
          "evidenceQuote": "Current Address: 123 Main St, Springfield, IL 62701"
        },
        "state": {
          "value": "IL",
          "confidence": 0.93,
          "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
          "sourcePage": 1,
          "evidenceQuote": "Current Address: 123 Main St, Springfield, IL 62701"
        },
        "zipCode": {
          "value": "62701",
          "confidence": 0.93,
          "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
          "sourcePage": 1,
          "evidenceQuote": "Current Address: 123 Main St, Springfield, IL 62701"
        }
      },
      "incomeHistory": {
        "value": [
          {
            "employer": {
              "value": "Acme Corp",
              "confidence": 0.95,
              "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
              "sourcePage": 1,
              "evidenceQuote": "Employer: Acme Corp"
            },
            "incomeType": {
              "value": "W2",
              "confidence": 0.9,
              "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
              "sourcePage": 1,
              "evidenceQuote": "Income: $8,500 / month (W-2)"
            },
            "frequency": {
              "value": "MONTHLY",
              "confidence": 0.9,
              "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
              "sourcePage": 1,
              "evidenceQuote": "Income: $8,500 / month (W-2)"
            },
            "grossAmount": {
              "value": 8500,
              "confidence": 0.95,
              "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
              "sourcePage": 1,
              "evidenceQuote": "Income: $8,500 / month (W-2)"
            },
            "startDate": {
              "value": "2020-01-15",
              "confidence": 0.9,
              "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
              "sourcePage": 1,
              "evidenceQuote": "Employed since: 2020-01-15"
            },
            "isCurrent": {
              "value": true,
              "confidence": 0.9,
              "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
              "sourcePage": 1,
              "evidenceQuote": "Employed since: 2020-01-15"
            }
          }
        ],
        "confidence": 0.92,
        "sourceDocumentId": "8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70",
        "sourcePage": 1,
        "evidenceQuote": "Employer: Acme Corp ... Income: $8,500 / month (W-2)"
      },
      "documentIds": ["8f7a2c1e-1d3b-4c2a-9e8f-2b3c4d5e6f70"]
    }
  ]
}
```

This response:

- Parses as JSON.
- Satisfies `OpenAIExtractionResponseSchema` (UUIDs, page numbers,
  confidences in range, enums correct).
- Round-trips through `convertToBorrowerRecord()` into a `BorrowerRecord`
  with `reviewStatus: PENDING_REVIEW`.

---

## 14. Sample Invalid Response

A response that violates the schema and triggers retry:

```json
{
  "borrowers": [
    {
      "fullName": {
        "value": "John Q. Doe",
        "confidence": 1.5,
        "sourceDocumentId": "doc-1",
        "sourcePage": 0,
        "evidenceQuote": ""
      },
      "incomeHistory": {
        "value": [
          {
            "employer": {
              "value": "Acme Corp",
              "confidence": 0.9,
              "sourceDocumentId": "doc-1",
              "sourcePage": 1,
              "evidenceQuote": "Employer: Acme Corp"
            },
            "incomeType": {
              "value": "BIANNUAL",
              "confidence": 0.7,
              "sourceDocumentId": "doc-1",
              "sourcePage": 1,
              "evidenceQuote": "Income: $8,500 / month (W-2)"
            },
            "frequency": {
              "value": "MONTHLY",
              "confidence": 0.9,
              "sourceDocumentId": "doc-1",
              "sourcePage": 1,
              "evidenceQuote": "Income: $8,500 / month (W-2)"
            },
            "grossAmount": {
              "value": -8500,
              "confidence": 0.95,
              "sourceDocumentId": "doc-1",
              "sourcePage": 1,
              "evidenceQuote": "Income: $8,500 / month (W-2)"
            },
            "startDate": {
              "value": "2020-01-15",
              "confidence": 0.9,
              "sourceDocumentId": "doc-1",
              "sourcePage": 1,
              "evidenceQuote": "Employed since: 2020-01-15"
            },
            "isCurrent": {
              "value": true,
              "confidence": 0.9,
              "sourceDocumentId": "doc-1",
              "sourcePage": 1,
              "evidenceQuote": "Employed since: 2020-01-15"
            }
          }
        ],
        "confidence": 0.9,
        "sourceDocumentId": "doc-1",
        "sourcePage": 1,
        "evidenceQuote": "Employer..."
      }
    }
  ]
}
```

Specific violations:

| Field path                                                         | Violation                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| `borrowers[0].fullName.confidence`                                 | `1.5` exceeds the `[0, 1]` range.                        |
| `borrowers[0].fullName.sourceDocumentId`                           | `"doc-1"` is not a valid UUID.                           |
| `borrowers[0].fullName.sourcePage`                                 | `0` is not a positive integer.                           |
| `borrowers[0].fullName.evidenceQuote`                              | Empty string fails `min(1)`.                             |
| `borrowers[0].incomeHistory.value[0].incomeType.value`             | `"BIANNUAL"` is outside the enum.                        |
| `borrowers[0].incomeHistory.value[0].grossAmount.value`            | Negative number fails `.positive()`.                     |
| `borrowers[0].incomeHistory.sourceDocumentId` (and others)         | `"doc-1"` is not a valid UUID.                           |

---

## 15. How Invalid Responses Are Handled

Pseudo-flow inside `extractBorrowersFromAllDocuments()` /
`extractBorrowersInBatches()`:

```text
response = callOpenAI(prompt)
parseResult = parseAndValidateResponse(response)

if (!parseResult.success):
    log.warn("First extraction attempt failed", error=parseResult.error)
    retryPrompt = buildRetryPrompt(context, parseResult.error)
    response    = callOpenAI(retryPrompt)            # rate-limit retry inside
    parseResult = parseAndValidateResponse(response)
    parseResult.retryAttempted = true

if (parseResult.success):
    return convertToBorrowerRecords(parseResult.borrowers)
else:
    log.error("Extraction failed after retry", validationErrors=...)
    return { success: false, error, validationErrors }
```

Concrete behavior for the response in [§14](#14-sample-invalid-response):

1. `JSON.parse` succeeds; the response is structurally JSON.
2. `OpenAIExtractionResponseSchema.safeParse` returns `success: false` with
   issues like:
   - `borrowers.0.fullName.confidence: Confidence must be between 0 and 1`
   - `borrowers.0.fullName.sourceDocumentId: Source document ID must be a valid UUID`
   - `borrowers.0.fullName.sourcePage: Source page must be a positive integer`
   - `borrowers.0.fullName.evidenceQuote: Evidence quote is required`
   - `borrowers.0.incomeHistory.value.0.incomeType.value: Invalid enum value. Expected 'W2' | 'SELF_EMPLOYMENT' | … received 'BIANNUAL'`
   - `borrowers.0.incomeHistory.value.0.grossAmount.value: Number must be greater than 0`
3. The service builds a retry prompt that **appends the error string** plus
   the focused reminder block, and calls OpenAI again.
4. If the retry response validates, it is returned with
   `retryAttempted: true` (so the route can record the retry in metrics).
5. If the retry also fails:
   - In single-batch mode: the API route returns **HTTP 422** with
     `errors[].type = "validation"` and the validation error list.
   - In batched mode: the failed batch is dropped and the loop moves on;
     the route still returns the borrowers from successful batches and
     surfaces the failure in metrics / logs.
6. Nothing is written to `borrowers` or `borrower_fields` for a failed
   batch – the database is never populated with unvalidated data.

Operationally, persistent validation failure is treated as a **prompt or
schema bug**, not a transient error. The expected response is to inspect
the logged `validationErrors` and either tighten the prompt or relax the
schema, not to keep retrying.

---

## 16. Known Limitations

These are documented honestly so reviewers know what the system does *not*
do:

1. **Self-reported confidence is uncalibrated.** Numbers are useful for
   ranking but should not be interpreted as probabilities until we
   benchmark against a labeled set.
2. **Evidence quotes are not verified against the source.** The schema
   requires a non-empty quote, but does not yet check that the quote
   actually appears in the chunk text. A motivated hallucination could
   pass validation. This is a high-priority enhancement.
3. **`sourceDocumentId` is checked for UUID shape, not for presence in the
   batch.** The model could in principle quote a UUID it saw earlier in
   another batch. Future work: validate the UUID is one of the documents
   actually included in the prompt.
4. **Single retry on validation failure.** If the model needs more than two
   tries (rare), the batch is dropped.
5. **All chunks for a document are loaded into memory.** Very large corpora
   can exhaust the API process; cursor-based streaming is on the roadmap.
6. **No streaming output.** We wait for the full completion; the user sees
   no partial progress mid-batch.
7. **Page numbers are sometimes synthetic.** `ChunkingService` currently
   defaults `pageNumber: 1` for non-PDF parsers. The model attributes to
   page 1 in those cases, which is technically correct but not granular.
8. **Multi-borrower disambiguation is heuristic.** `mergeDuplicateBorrowers`
   keys on SSN with full-name fallback; two borrowers with identical names
   and no SSN will incorrectly merge.
9. **Cost is per-call.** No caching of identical prompts. A re-run of
   extraction over an unchanged corpus pays full price.
10. **Model snapshot drift.** We pin the snapshot, but OpenAI eventually
    deprecates snapshots. A scheduled regression suite against a fixed
    corpus is a planned safeguard.
11. **English-only.** No internationalization in the prompt or schema.
12. **No PII redaction in logs.** Validation errors and prompts can include
    PII; ensure log sinks honor data-handling requirements.

---

## 17. References

- Implementation: [`apps/api/src/services/ExtractionService.ts`](../apps/api/src/services/ExtractionService.ts)
- Schema:         [`apps/api/src/schemas/borrowerExtraction.schema.ts`](../apps/api/src/schemas/borrowerExtraction.schema.ts)
- Chunking:       [`apps/api/src/services/ChunkingService.ts`](../apps/api/src/services/ChunkingService.ts)
- Phase 06 notes: [`agent-work/prompts/06-openai-extraction.md`](../agent-work/prompts/06-openai-extraction.md)
- Authoring prompt for this doc: [`agent-work/prompts/10.5-prompt-strategy.md`](../agent-work/prompts/10.5-prompt-strategy.md)
