# LoanLens - Intelligent Document Extraction System

LoanLens is an AI-powered document extraction system designed to process unstructured loan documents and extract structured borrower information. The system handles variable-format documents (PDFs, images, scanned documents) and extracts key data points including personal identifying information (PII), income history, account numbers, and maintains full traceability to source documents.

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
- **Database**: SQLite (better-sqlite3)
- **Testing**: Vitest

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **UI Library**: Material UI (MUI)
- **State Management**: Zustand
- **Routing**: React Router
- **Language**: TypeScript (strict mode)
- **Testing**: Vitest

### Infrastructure
- **Monorepo**: npm workspaces
- **Package Manager**: npm 9+

## Project Structure

```
lonelight/
├── apps/
│   ├── api/              # Express backend API
│   │   ├── src/
│   │   │   ├── config/   # Configuration
│   │   │   ├── database/ # SQLite connection and schema
│   │   │   ├── middleware/ # Express middleware
│   │   │   ├── repositories/ # Data access layer
│   │   │   ├── routes/   # API routes
│   │   │   └── index.ts  # Entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── web/              # React frontend SPA
│       ├── src/
│       │   ├── components/ # React components
│       │   ├── pages/    # Page components
│       │   ├── store/    # Zustand stores
│       │   ├── theme/    # Material UI theme
│       │   ├── test/     # Test utilities
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── Loan Documents/       # Sample document corpus
├── agent-work/           # Development notes and prompts
├── .claude/              # AI agent configuration
├── package.json          # Root package.json with workspaces
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd lonelight
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### Development

Start both API and web dev servers:
```bash
npm run dev
```

This will start:
- API server at http://localhost:3001
- Web app at http://localhost:5173

Or run them individually:
```bash
npm run dev:api  # Start API only
npm run dev:web  # Start web only
```

### Building

Build all workspaces:
```bash
npm run build
```

Or build individually:
```bash
npm run build:api  # Build API
npm run build:web  # Build web
```

### Testing

Run all tests:
```bash
npm test
```

Or test individually:
```bash
npm run test:api  # Test API
npm run test:web  # Test web
```

Type checking:
```bash
npm run type-check
```

### Cleanup

Remove all dependencies and build artifacts:
```bash
npm run clean
```

## API Endpoints

### Health Check
```
GET /api/health
```
Returns API status and metadata.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.45,
  "service": "loanlens-api",
  "version": "0.1.0"
}
```

### Documents
```
GET /api/documents              # List documents with filtering and pagination
GET /api/documents/:id          # Get single document by ID
GET /api/documents/:id/chunks   # Get all chunks for a document
```

**Query Parameters:**
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by processing status (UPLOADED, QUEUED, PROCESSING, EXTRACTED, ANALYZING, COMPLETED, FAILED, ERROR)
- `borrowerId`: Filter by borrower ID

### Borrowers
```
GET /api/borrowers                # List borrowers with search and pagination
GET /api/borrowers/:id            # Get single borrower with all extracted fields
GET /api/borrowers/:id/documents  # Get all documents for a borrower
```

**Query Parameters:**
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)
- `search`: Search across borrower fields (name, email, phone, etc.)

## Features

### Current (v0.1.0)
- Monorepo structure with npm workspaces
- Backend API with health check endpoint
- **SQLite persistence layer with Repository pattern**
  - DocumentRepository, ChunkRepository, BorrowerRepository, ErrorRepository
  - 5-table schema with foreign key constraints
  - ExtractedField normalization using EAV pattern for source traceability
  - In-memory testing with isolated test databases
- **RESTful API endpoints for documents and borrowers**
  - List, filter, paginate, and search functionality
  - 36 passing API tests (11 repository + 21 route integration + 4 health)
- Frontend with Material UI app shell
- Left navigation drawer (Dashboard, Documents, Borrowers)
- Dashboard displays API health status
- Zustand state management
- Comprehensive testing setup (97 total tests passing)
- TypeScript strict mode

### Planned
- Document upload and management
- AI/LLM-based extraction pipeline
- Structured data extraction (PII, income, accounts)
- Source traceability and confidence scoring
- Data visualization and export
- Advanced search and filtering

## Architecture

### Data Persistence
- **Database**: SQLite (better-sqlite3) for fast, synchronous operations
- **Schema**: 5 tables with foreign key constraints
  - `documents`: Document metadata and processing status
  - `document_chunks`: Parsed text segments with page references
  - `borrowers`: Basic borrower information
  - `borrower_fields`: ExtractedField storage (EAV pattern) for source traceability
  - `processing_errors`: Error tracking and diagnostics
- **Repository Pattern**: Abstract data access with interfaces for testability
- **Transactions**: Multi-table operations wrapped in transactions for atomicity

### Data Flow Pipeline
1. **Ingestion**: Document upload via multipart/form-data (planned)
2. **Preprocessing**: Format detection, OCR for images, text extraction (planned)
3. **Extraction**: LLM-based structured data extraction (planned)
4. **Validation**: Confidence scoring, data quality checks
5. **Storage**: Persist documents, extracted data, and source references via repositories
6. **Retrieval**: RESTful API endpoints for querying extracted data

### Scaling Considerations
- **Current**: Single SQLite database, suitable for 1-100K documents
- **10x Scale**: Queue-based processing, horizontal API scaling, caching, PostgreSQL migration
- **100x Scale**: Microservices, object storage (S3), distributed caching (Redis), auto-scaling

## Development

### Coding Standards
- TypeScript strict mode, no `any` types
- Functional React components with hooks
- Material UI theme-based styling
- Comprehensive error handling
- Structured logging
- Test critical paths

### Multi-Agent Workflow
This project uses Claude Code's multi-agent system:
- **/designer**: UI/UX design, Material UI components
- **/architect**: System design, technology choices, scaling
- **/senior-dev**: Implementation, coding, LLM integration
- **/qa-eng**: Test planning, quality assurance

See `.claude/CLAUDE.md` for detailed project context.

## Documentation

- [Prompt Strategy](docs/PROMPT_STRATEGY.md) - LLM extraction prompt design,
  chunking rationale, JSON / Zod validation strategy, retry behavior,
  hallucination mitigation, source attribution, confidence scoring,
  OpenAI model selection, trade-offs vs. traditional NLP, and known
  limitations (with sample valid and invalid responses).

## License

UNLICENSED - Private repository

## Questions

For questions or clarifications, please reach out to the project maintainer.
