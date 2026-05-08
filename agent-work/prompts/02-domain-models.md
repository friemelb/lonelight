# Phase 2: Domain Models and Validation

## Overview

Created shared TypeScript domain models and Zod validation schemas in `packages/domain` to establish type-safe, validated data structures across the LoanLens monorepo. This package provides the foundation for all document extraction, borrower data management, and processing status tracking.

## What Was Created

### Package Structure

```
packages/domain/
├── src/
│   ├── types/
│   │   ├── status.types.ts       # Processing status enums
│   │   ├── document.types.ts     # Document and chunk types
│   │   ├── borrower.types.ts     # Borrower and ExtractedField types
│   │   ├── income.types.ts       # Income history types
│   │   └── index.ts
│   ├── schemas/
│   │   ├── status.schemas.ts     # Status validation schemas
│   │   ├── document.schemas.ts   # Document validation schemas
│   │   ├── borrower.schemas.ts   # Borrower validation schemas
│   │   ├── income.schemas.ts     # Income validation schemas
│   │   └── index.ts
│   ├── validators/
│   │   ├── common.validators.ts  # Helper validation functions
│   │   └── index.ts
│   └── index.ts                  # Main barrel export
├── test/
│   ├── setup.ts                  # Test configuration
│   ├── extracted-field.test.ts   # ExtractedField validation tests (22 cases)
│   ├── borrower.test.ts          # BorrowerRecord validation tests (16 cases)
│   └── document.test.ts          # Document validation tests (19 cases)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Core Domain Models

#### ExtractedField<T>

**Purpose**: Every piece of extracted data must be traceable to its source document with evidence.

**Type Definition** (`borrower.types.ts:3-12`):
```typescript
export interface ExtractedField<T = string> {
  value: T;                      // The extracted value (generic type)
  confidence: number;            // 0-1 confidence score from LLM
  sourceDocumentId: string;      // UUID of source document
  sourcePage: number;            // 1-indexed page number
  evidenceQuote: string;         // Exact text from document
  boundingBox?: [number, number, number, number];  // Optional coordinates
  extractedAt?: Date;            // Optional extraction timestamp
  notes?: string;                // Optional extraction notes
}
```

**Validation Schema** (`borrower.schemas.ts:4-39`):
- `value`: Validated by generic schema parameter
- `confidence`: Must be 0-1 (inclusive)
- `sourceDocumentId`: Required, non-empty UUID
- `sourcePage`: Positive integer (1-indexed)
- `evidenceQuote`: Required, non-empty string
- `boundingBox`: Optional, must be 4 non-negative numbers
- `extractedAt`: Optional Date
- `notes`: Optional string

**Why This Matters**: Source traceability is critical for loan processing compliance. Every extracted field can be audited back to the exact location in the source document.

#### BorrowerRecord

**Purpose**: Represents a loan applicant with all extracted personal information.

**Type Definition** (`borrower.types.ts:14-27`):
```typescript
export interface BorrowerRecord {
  id: string;                                    // UUID
  fullName: ExtractedField<string>;             // Required
  firstName?: ExtractedField<string>;           // Optional
  middleName?: ExtractedField<string>;          // Optional
  lastName?: ExtractedField<string>;            // Optional
  ssn?: ExtractedField<string>;                 // Optional
  dateOfBirth?: ExtractedField<Date>;           // Optional
  email?: ExtractedField<string>;               // Optional
  phone?: ExtractedField<string>;               // Optional
  currentAddress?: ExtractedField<Address>;     // Optional
  employmentStatus?: ExtractedField<string>;    // Optional
  documentIds: string[];                        // UUIDs of source documents
}
```

**Validation Schema** (`borrower.schemas.ts:52-65`):
- `id`: Required UUID
- `fullName`: Required StringExtractedField
- Optional fields validated with appropriate ExtractedField schemas
- `documentIds`: Array of UUIDs, must have at least one

#### DocumentRecord

**Purpose**: Represents an uploaded document with metadata and processing status.

**Type Definition** (`document.types.ts:3-22`):
```typescript
export interface DocumentRecord {
  id: string;                    // UUID
  fileName: string;              // Original filename
  mimeType: string;              // application/pdf, image/jpeg, etc.
  fileSizeBytes: number;         // File size in bytes
  uploadedAt: Date;              // Upload timestamp
  status: ProcessingStatus;      // Current processing status
  storageUrl?: string;           // Optional S3/storage URL
  pageCount?: number;            // Number of pages
  borrowerId?: string;           // Optional UUID of associated borrower
  extractedAt?: Date;            // Optional extraction completion time
  errorMessage?: string;         // Optional error message if failed
}
```

**Validation Schema** (`document.schemas.ts:4-20`):
- `id`: Required UUID
- `fileName`: Required non-empty string
- `mimeType`: Must be one of: `application/pdf`, `image/jpeg`, `image/png`, `image/tiff`
- `fileSizeBytes`: Non-negative number
- `status`: One of: `pending`, `processing`, `processed`, `error`
- `pageCount`: Optional positive integer
- `borrowerId`: Optional UUID

#### DocumentChunk

**Purpose**: Represents a parsed section of a document (page or region) with OCR/parsing metadata.

**Type Definition** (`document.types.ts:24-36`):
```typescript
export interface DocumentChunk {
  id: string;                    // Unique chunk identifier
  documentId: string;            // UUID of parent document
  pageNumber: number;            // 1-indexed page number
  content: string;               // Extracted text content
  confidence: number;            // 0-1 OCR/parsing confidence
  boundingBox?: [number, number, number, number];  // Optional coordinates
  metadata?: Record<string, unknown>;  // Optional chunk metadata
}
```

**Validation Schema** (`document.schemas.ts:22-31`):
- `documentId`: Required UUID
- `pageNumber`: Positive integer
- `content`: Required non-empty string
- `confidence`: Must be 0-1
- `boundingBox`: Optional, must be 4 non-negative numbers

#### IncomeHistoryItem

**Purpose**: Represents a single income entry extracted from employment/income documents.

**Type Definition** (`income.types.ts:15-25`):
```typescript
export interface IncomeHistoryItem {
  id: string;                                   // UUID
  borrowerId: string;                           // UUID
  employer?: ExtractedField<string>;           // Optional
  incomeType: ExtractedField<IncomeType>;      // Required
  amount: ExtractedField<number>;              // Required
  frequency: ExtractedField<IncomeFrequency>;  // Required
  startDate?: ExtractedField<Date>;            // Optional
  endDate?: ExtractedField<Date>;              // Optional
  documentIds: string[];                       // UUIDs
}
```

**Enums**:
- `IncomeType`: `SALARY`, `HOURLY`, `COMMISSION`, `BONUS`, `SELF_EMPLOYED`, `RENTAL`, `INVESTMENT`, `OTHER`
- `IncomeFrequency`: `HOURLY`, `DAILY`, `WEEKLY`, `BIWEEKLY`, `SEMI_MONTHLY`, `MONTHLY`, `QUARTERLY`, `ANNUALLY`

### Validation Utilities

**Helper Functions** (`common.validators.ts`):

```typescript
// Throws ZodError if validation fails
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T

// Returns result object with success flag
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError }
```

### Test Coverage

Created comprehensive test suite with **57 test cases** across three files:

#### extracted-field.test.ts (22 tests)
- Valid scenarios: all required fields, optional bounding box, timestamp, notes
- Missing source references: sourceDocumentId, sourcePage, evidenceQuote
- Invalid confidence: negative, >1, boundary values (0, 1)
- Edge cases: missing value, invalid bounding box, negative coordinates

#### borrower.test.ts (16 tests)
- Valid scenarios: required fields, optional SSN, DOB, multiple documents
- Missing required fields: id, fullName, documentIds
- Invalid ExtractedField: missing source, invalid confidence, empty evidence
- DocumentIds validation: invalid UUIDs, empty array, mixed valid/invalid

#### document.test.ts (19 tests)
- Valid scenarios: all required fields, optional storage URL, error message, all MIME types
- Invalid scenarios: unsupported MIME type, negative file size, zero/negative page count
- DocumentChunk: valid/invalid confidence, page numbers, bounding boxes

**Running Tests**:
```bash
npm run test:domain           # Run domain package tests
npm test                      # Run all workspace tests
```

## Integration with Apps

### API Integration

**Updated Files**:
- `apps/api/package.json`: Added `@loanlens/domain` workspace dependency
- `apps/api/tsconfig.json`: Added path aliases for `@loanlens/domain`

**Usage Example**:
```typescript
import { BorrowerRecord, BorrowerRecordSchema } from '@loanlens/domain';
import { validate } from '@loanlens/domain';

// Validate incoming API data
const borrower = validate(BorrowerRecordSchema, req.body);
```

### Web Integration

**Updated Files**:
- `apps/web/package.json`: Added `@loanlens/domain` workspace dependency
- `apps/web/tsconfig.json`: Added path aliases for `@loanlens/domain`

**Usage Example**:
```typescript
import { DocumentRecord, ProcessingStatus } from '@loanlens/domain/types';

interface DocumentListProps {
  documents: DocumentRecord[];
}
```

## Key Design Decisions

### 1. Source Traceability First

**Decision**: Every `ExtractedField` requires `sourceDocumentId`, `sourcePage`, and `evidenceQuote`.

**Rationale**: Loan processing requires audit trails. Regulators and loan officers must be able to verify extracted data against source documents. This design enforces traceability at the type level.

**Trade-off**: More verbose data structures, but eliminates entire class of compliance issues.

### 2. Generic ExtractedField<T>

**Decision**: Use TypeScript generics for `ExtractedField<T>` rather than separate types per value type.

**Rationale**:
- DRY principle - single definition of extraction metadata
- Type-safe value access - `ExtractedField<Date>` vs `ExtractedField<string>`
- Flexible Zod schema composition

**Example**:
```typescript
const StringExtractedFieldSchema = ExtractedFieldSchema(z.string().min(1));
const DateExtractedFieldSchema = ExtractedFieldSchema(z.date());
const NumberExtractedFieldSchema = ExtractedFieldSchema(z.number());
```

### 3. Confidence Scores on Everything

**Decision**: All extracted data and document chunks include 0-1 confidence scores.

**Rationale**:
- LLM outputs are probabilistic
- Low confidence scores can trigger human review
- Enables automated quality thresholds
- Supports progressive enhancement (start with high-confidence, iterate on low)

### 4. Strict UUID Validation

**Decision**: All IDs must be valid UUIDs, validated by Zod.

**Rationale**:
- Prevents ID collision across distributed systems
- Standard format for database keys
- Built-in Zod validation (`z.string().uuid()`)

### 5. Separate Types and Schemas

**Decision**: Maintain separate `types/` and `schemas/` directories rather than co-located definitions.

**Rationale**:
- Types can be imported without Zod dependency
- Schemas used for runtime validation only
- Clear separation between compile-time and runtime validation
- Smaller bundle sizes for frontend (can import types without schemas)

**Import Patterns**:
```typescript
// Type-only import (no runtime cost)
import type { BorrowerRecord } from '@loanlens/domain/types';

// Schema import (includes Zod)
import { BorrowerRecordSchema } from '@loanlens/domain/schemas';

// Both
import { BorrowerRecord, BorrowerRecordSchema } from '@loanlens/domain';
```

## Validation Error Messages

All Zod schemas include custom error messages for better developer experience:

```typescript
z.string().uuid({ message: 'Source document ID must be a valid UUID' })
z.string().min(1, { message: 'Evidence quote is required and cannot be empty' })
z.number().positive({ message: 'Source page must be positive' })
z.number().min(0, { message: 'Confidence must be at least 0' })
z.number().max(1, { message: 'Confidence must be at most 1' })
```

## Next Steps

### Immediate
1. ✅ Install dependencies: `npm install`
2. ✅ Run type checking: `npm run type-check`
3. ✅ Run domain tests: `npm run test:domain`

### Future Enhancements
1. **Add Validation Middleware**: Create Express middleware to auto-validate request bodies
2. **Add Serialization Helpers**: Date serialization for API responses (ISO strings)
3. **Add Database Schemas**: Prisma/Drizzle schemas matching domain types
4. **Add React Hooks**: Custom hooks for type-safe form validation with Zod
5. **Add OpenAPI Specs**: Generate OpenAPI/Swagger from Zod schemas

## Dependencies

**Runtime**:
- `zod@^3.22.4` - Runtime type validation

**Dev Dependencies**:
- `typescript@^5.3.3` - Type checking
- `vitest@^1.1.0` - Testing framework

## Commands

```bash
# Build domain package
npm run build:domain

# Run domain tests
npm run test:domain

# Type check domain package
npm run type-check --workspace=packages/domain

# Watch mode for development
npm run test:watch --workspace=packages/domain
```

## Files Changed

### New Files
- `packages/domain/src/types/*.ts` (5 files)
- `packages/domain/src/schemas/*.ts` (5 files)
- `packages/domain/src/validators/*.ts` (1 file)
- `packages/domain/test/*.ts` (4 files)
- `packages/domain/package.json`
- `packages/domain/tsconfig.json`
- `packages/domain/vitest.config.ts`

### Modified Files
- `package.json` - Added `packages/*` to workspaces, added domain scripts
- `apps/api/package.json` - Added `@loanlens/domain` dependency
- `apps/api/tsconfig.json` - Added path aliases
- `apps/web/package.json` - Added `@loanlens/domain` dependency
- `apps/web/tsconfig.json` - Added path aliases

## Conclusion

The domain package establishes a solid foundation for type-safe, validated data structures across LoanLens. The focus on source traceability, confidence scoring, and comprehensive validation ensures data integrity from extraction through processing. All 57 tests pass, providing confidence in the validation logic.
