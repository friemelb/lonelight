# LoanLens - Intelligent Document Extraction System

LoanLens is an AI-powered document extraction system designed to process unstructured loan documents and extract structured borrower information. The system handles variable-format documents (PDFs, images, scanned documents) and extracts key data points including personal identifying information (PII), income history, account numbers, and maintains full traceability to source documents.

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript (strict mode)
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
│   │   │   ├── middleware/ # Express middleware
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

## Features

### Current (v0.1.0)
- Monorepo structure with npm workspaces
- Backend API with health check endpoint
- Frontend with Material UI app shell
- Left navigation drawer (Dashboard, Documents, Borrowers)
- Dashboard displays API health status
- Zustand state management
- Vitest testing setup
- TypeScript strict mode

### Planned
- Document upload and management
- AI/LLM-based extraction pipeline
- Structured data extraction (PII, income, accounts)
- Source traceability and confidence scoring
- Data visualization and export
- Advanced search and filtering

## Architecture

### Data Flow Pipeline (Planned)
1. **Ingestion**: Document upload via multipart/form-data
2. **Preprocessing**: Format detection, OCR for images, text extraction
3. **Extraction**: LLM-based structured data extraction
4. **Validation**: Confidence scoring, data quality checks
5. **Storage**: Persist documents, extracted data, and source references
6. **Retrieval**: API endpoints for querying extracted data

### Scaling Considerations
- **10x Scale**: Queue-based processing, horizontal API scaling, caching
- **100x Scale**: Microservices, object storage, distributed caching, auto-scaling

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

## License

UNLICENSED - Private repository

## Questions

For questions or clarifications, please reach out to the project maintainer.
