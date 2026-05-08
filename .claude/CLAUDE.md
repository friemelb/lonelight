# LoanLens: Unstructured Document Extraction System

## Project Overview

LoanLens is an intelligent document extraction system designed to process unstructured loan documents and extract structured borrower information. The system handles variable-format documents (PDFs, images, scanned documents) and extracts key data points including personal identifying information (PII), income history, account numbers, and maintains full traceability to source documents.

**Core Value Proposition**: Transform hours of manual document review into seconds of automated extraction while maintaining accuracy and source references.

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Database**: SQLite (better-sqlite3)
- **Testing**: Vitest
- **Document Processing**: [To be determined - PDF.js, Tesseract OCR, etc.]
- **AI/LLM**: [To be determined - OpenAI, Anthropic, AWS Textract, etc.]

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **UI Library**: Material UI (MUI)
- **State Management**: Zustand (preferred over Redux for simplicity)
- **Routing**: React Router
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest

### Infrastructure
- **Monorepo**: npm workspaces
- **Package Manager**: npm 9+
- **Version Control**: Git (GitHub)
- **Validation**: Zod runtime type validation

### Shared Packages
- **@loanlens/domain**: Shared TypeScript types and Zod schemas
  - DocumentRecord, DocumentChunk types
  - BorrowerRecord, ExtractedField types
  - IncomeHistoryItem types
  - ProcessingStatus enums
  - Validation schemas and helpers

## Architecture Pattern

### Monorepo Structure
```
lonelight/
├── apps/
│   ├── api/              # Express backend API
│   └── web/              # React frontend SPA
├── packages/
│   └── domain/           # Shared TypeScript types and Zod schemas
├── Loan Documents/       # Sample document corpus
├── agent-work/           # Development notes and prompts
└── .claude/              # AI agent configuration
```

### Data Flow Pipeline
1. **Ingestion**: Document upload via multipart/form-data (planned)
2. **Preprocessing**: Format detection, OCR for images, text extraction (planned)
3. **Extraction**: LLM-based structured data extraction with prompts (planned)
4. **Validation**: Confidence scoring, data quality checks
5. **Storage**: Persist documents, extracted data, and source references via SQLite repositories
6. **Retrieval**: RESTful API endpoints for querying extracted data

### API-Driven Architecture
- RESTful API for all document and borrower operations
- Repository pattern for data access abstraction
- SQLite persistence with transaction support
- Async processing for long-running extractions (planned)
- WebSocket/polling for status updates (planned)
- Comprehensive error handling and retry logic

## Domain Context

### Document Corpus
**Location**: `/Loan Documents/Loan 214/`

Sample documents include:
- Tax returns (1040 forms)
- Bank statements
- Paystubs
- W-2 forms
- Closing disclosures
- Title reports
- Other loan-related documents

**Characteristics**:
- Variable formatting (structured PDFs, scanned images, mixed)
- Multi-page documents
- Tables, forms, and unstructured text
- Various date formats, phone formats, address formats

### Target Extraction Fields

**Personal Identifying Information (PII)**:
- Full names (borrowers, co-borrowers)
- Social Security Numbers (SSN)
- Date of birth
- Phone numbers
- Email addresses

**Addresses**:
- Current residence
- Previous addresses
- Property addresses
- Mailing addresses

**Income History**:
- Employer names
- Job titles
- Gross income
- Net income
- Income dates/periods
- Income types (salary, commission, bonuses)

**Account/Loan Numbers**:
- Bank account numbers
- Loan numbers
- Credit card numbers
- Investment account numbers

**Source References**:
- Document filename
- Page number
- Bounding box coordinates (if applicable)
- Extraction confidence score

## Key Requirements

### Functional Requirements
1. **Document Upload**: Support PDF, PNG, JPG formats up to 50MB
2. **Batch Processing**: Handle multiple documents simultaneously
3. **Extraction Accuracy**: >95% precision/recall for PII fields
4. **Source Traceability**: Every data point must link to source document
5. **Confidence Scoring**: Provide extraction confidence (0-1 scale)
6. **Data Export**: Export extracted data as JSON, CSV
7. **Document Viewer**: Display source documents with highlighted extractions

### Non-Functional Requirements
1. **Scalability**: Design for 10x scale (immediate) and 100x scale (future planning)
2. **Performance**: <30 seconds per document processing time (target)
3. **Error Handling**: Graceful failures with user-friendly error messages
4. **Data Privacy**: PII encryption at rest and in transit
5. **Accessibility**: WCAG 2.1 Level AA compliance for frontend
6. **Browser Support**: Latest 2 versions of Chrome, Firefox, Safari

### Quality Requirements
1. **Testing**: >80% code coverage for critical paths
2. **Type Safety**: TypeScript strict mode, no `any` types
3. **Logging**: Comprehensive structured logging for debugging
4. **Observability**: Request tracing, performance metrics
5. **Documentation**: Inline code comments for complex logic

## Coding Standards

### TypeScript
- **Strict Mode**: Enabled in all tsconfig.json files
- **Type Safety**: Explicit types, avoid `any`, use `unknown` when necessary
- **Interfaces**: Prefer interfaces for object shapes, types for unions
- **Naming**: PascalCase for types/interfaces, camelCase for variables/functions

### React/Frontend
- **Components**: Functional components with hooks
- **File Structure**: One component per file, co-locate styles
- **Material UI**: Use theme-based styling, avoid inline styles
- **State Management**: Zustand stores for global state, useState for local
- **Props**: Explicit interface definitions for all component props

### Backend/API
- **Error Handling**: Try-catch blocks, centralized error middleware
- **Validation**: Input validation on all API endpoints
- **Async/Await**: Prefer over promise chains, handle rejections
- **RESTful Design**: Standard HTTP methods, status codes
- **Logging**: Use structured logging with context

### Testing
- **Unit Tests**: Test pure functions and business logic
- **Integration Tests**: Test API endpoints with mocked dependencies
- **Component Tests**: Test React components with user interactions
- **E2E Tests**: Test critical user workflows (future)

## Development Commands

### Setup
```bash
npm install              # Install all dependencies
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### Development
```bash
npm run dev              # Start both API and web dev servers
npm run dev:api          # Start API only (http://localhost:3001)
npm run dev:web          # Start web only (http://localhost:5173)
```

### Building
```bash
npm run build            # Build all workspaces
npm run build:api        # Build API
npm run build:web        # Build web
npm run build:domain     # Build domain package
```

### Testing
```bash
npm test                 # Run all tests
npm run test:api         # Run API tests
npm run test:web         # Run web tests
npm run test:domain      # Run domain tests (57 test cases)
npm run type-check       # TypeScript type checking
```

### Cleanup
```bash
npm run clean            # Remove all node_modules and dist folders
```

## Design Patterns

### Frontend Patterns
- **Container/Presenter**: Separate data-fetching from presentation
- **Custom Hooks**: Extract reusable logic into hooks
- **Error Boundaries**: Catch React errors gracefully
- **Lazy Loading**: Code-split routes with React.lazy

### Backend Patterns
- **Middleware**: Use Express middleware for cross-cutting concerns
- **Repository Pattern**: Abstract data access layer (implemented with SQLite)
  - DocumentRepository, ChunkRepository, BorrowerRepository, ErrorRepository
  - Interface-based design for testability and future database migration
  - Transaction support for multi-table operations
- **Service Layer**: Business logic separate from controllers (future)
- **Dependency Injection**: Pass dependencies explicitly (repositories injected with DB instance)

## PII Data Handling

### Security Considerations
- **Encryption**: Encrypt PII at rest (database) and in transit (HTTPS)
- **Access Control**: Role-based access for sensitive data
- **Audit Logging**: Log all PII access for compliance
- **Data Retention**: Define clear retention policies
- **Masking**: Mask sensitive fields in UI (SSN, account numbers)

### Privacy by Design
- **Minimize Collection**: Only extract required fields
- **Purpose Limitation**: Use data only for stated purpose
- **User Consent**: Clear privacy policy and consent flow
- **Data Portability**: Export functionality for user data

## Common Tasks

### Adding a New Extraction Field
1. Update domain models in `packages/domain/src/types/`
2. Update Zod schemas in `packages/domain/src/schemas/`
3. Add validation tests in `packages/domain/test/`
4. Update database schema (if applicable)
5. Update extraction prompts/logic in backend
6. Update frontend display components
7. Update tests for new field

### Adding a New Document Type
1. Add format detection logic
2. Create document-specific parser
3. Update extraction prompts
4. Test with sample documents
5. Update documentation

### Scaling Considerations
1. Implement queue-based processing (Redis, SQS)
2. Add horizontal scaling for API servers
3. Implement caching (Redis) for extracted data
4. Use object storage (S3) for documents
5. Add database read replicas

## Agent Collaboration Notes

### When to Use Each Agent
- **/designer**: UI/UX design, Material UI components, user flows, accessibility
- **/architect**: System design, technology choices, scaling strategy, API design
- **/senior-dev**: Implementation, coding, LLM integration, bug fixes
- **/qa-eng**: Test planning, quality assurance, validation, bug identification

### Multi-Agent Workflows
- **Sequential**: Architecture → Development → QA
- **Parallel**: Designer + Architect review together
- **Team Mode**: Spawn concurrent agents for feature development

## Project Status

**Current Phase**: SQLite persistence complete ✅

**Completed**:

*Phase 1: Monorepo Scaffolding* ✅
- Repository setup and git configuration
- Monorepo structure with npm workspaces
- Multi-agent system configuration (Designer, Architect, Senior Dev, QA Eng)
- Backend API with Express + TypeScript
- Health check endpoint (GET /api/health)
- Frontend with React + Vite + Material UI + Zustand
- Material UI app shell with left navigation
- Dashboard page with API health status display
- Documents and Borrowers placeholder pages
- Basic Vitest testing setup for both apps
- TypeScript strict mode configuration
- Development workflow (npm run dev starts both apps)
- Environment configuration (.env.example files)
- Comprehensive README with setup instructions
- Agent work documentation (agent-work/prompts/01-scaffold.md)

*Phase 2: Domain Models* ✅
- Created `packages/domain` shared package
- Core domain types: ExtractedField<T>, BorrowerRecord, DocumentRecord, DocumentChunk, IncomeHistoryItem
- Zod validation schemas for all domain models
- ExtractedField enforces source traceability (sourceDocumentId, sourcePage, evidenceQuote)
- Confidence scoring on all extracted data (0-1 scale)
- Comprehensive validation error messages
- 57 test cases across 3 test files (extracted-field, borrower, document)
- Integrated with apps/api and apps/web via workspace dependencies
- TypeScript path aliases configured for clean imports
- Agent work documentation (agent-work/prompts/02-domain-models.md)

*Phase 3: SQLite Persistence* ✅
- Installed better-sqlite3 (v12.9.0) for fast, synchronous database operations
- Database connection management with singleton pattern and graceful shutdown
- 5-table schema with foreign key constraints:
  - `documents`: Document metadata and processing status
  - `document_chunks`: Parsed text segments with page references
  - `borrowers`: Basic borrower information
  - `borrower_fields`: ExtractedField storage using EAV pattern
  - `processing_errors`: Error tracking and diagnostics
- Repository pattern implementation with interfaces:
  - DocumentRepository: CRUD, filtering, pagination, status updates
  - ChunkRepository: chunk management, content search
  - BorrowerRepository: ExtractedField normalization for source traceability
  - ErrorRepository: error tracking and resolution
- RESTful API routes:
  - GET /api/documents (list, filter by status/borrowerId, paginate)
  - GET /api/documents/:id
  - GET /api/documents/:id/chunks
  - GET /api/borrowers (list, search, paginate)
  - GET /api/borrowers/:id
  - GET /api/borrowers/:id/documents
- Comprehensive test coverage:
  - Repository unit tests (11 tests)
  - Route integration tests (21 tests)
  - All 36 API tests passing, 97 total tests across monorepo
- Database initialization on API startup with graceful shutdown
- Configuration via DATABASE_PATH and DATABASE_VERBOSE environment variables
- Agent work documentation (agent-work/prompts/03-sqlite.md)

**Current Status**:
- Full-stack infrastructure complete with persistence layer
- Type-safe, validated data structures across monorepo
- RESTful API with database backing for documents and borrowers
- Apps are locally runnable with `npm run dev`
- All 97 tests passing (API: 36, Web: 2, Domain: 59)
- Ready for document upload and LLM integration

**Next Steps**:
1. Implement document upload UI and multipart/form-data API endpoint
2. Choose and integrate LLM provider (Anthropic Claude or OpenAI)
3. Build document processing pipeline (PDF parsing, OCR)
4. Create extraction prompt templates using domain schemas
5. Implement extraction service that populates borrower data
6. Build data visualization in Dashboard
7. Add document viewer with highlighted extractions
8. Implement data export functionality (JSON, CSV)
9. Expand E2E test coverage
10. Write system design document

## References

- [Material UI Documentation](https://mui.com/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/)
- [Vite Documentation](https://vitejs.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
