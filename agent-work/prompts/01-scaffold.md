# Scaffolding Prompt: LoanLens Monorepo

## Objective
Create a minimal, clean, locally runnable monorepo for the LoanLens document extraction system with both backend API and frontend web application.

## Requirements

### 1. Monorepo Structure
- Use npm workspaces for monorepo management
- Two main apps: `apps/api` (backend) and `apps/web` (frontend)
- Keep structure simple and flat
- No shared packages initially (add later as needed)

### 2. Backend (apps/api)
- **Stack**: Node.js + Express + TypeScript
- **Testing**: Vitest
- **Features**:
  - Health check endpoint at `GET /api/health`
  - Returns: `{ status: 'ok', timestamp, uptime, service, version }`
  - Proper TypeScript configuration with strict mode
  - CORS enabled for frontend
  - Environment configuration via .env
  - Request logging middleware
  - Error handling middleware
  - Basic test for health endpoint

### 3. Frontend (apps/web)
- **Stack**: React 18 + Vite + Material UI + Zustand
- **Testing**: Vitest
- **Features**:
  - Material UI app shell with:
    - Fixed left navigation drawer (240px width)
    - App bar at top
    - Main content area
  - Three navigation items:
    - Dashboard (home page)
    - Documents (placeholder)
    - Borrowers (placeholder)
  - Dashboard displays:
    - API health status (fetched from backend)
    - Placeholder cards for metrics
  - Zustand store for API health state
  - Responsive design (mobile drawer)
  - Proper TypeScript configuration with strict mode
  - Vite proxy for API calls
  - Basic component tests

### 4. Development Experience
- Single command to run both apps: `npm run dev`
- Hot reload for both frontend and backend
- TypeScript type checking for both apps
- Clear console output showing where servers are running
- Environment variables properly configured

### 5. Testing
- Vitest configured for both apps
- Basic test coverage for:
  - Backend: Health endpoint
  - Frontend: App component rendering
- Easy to run: `npm test`

### 6. Documentation
- Update root README.md with:
  - Project description
  - Tech stack
  - Setup instructions
  - Development commands
  - Project structure
- Keep it concise and actionable

## What NOT to Include (Yet)
- Document upload functionality
- LLM integration
- Database setup
- Authentication
- Document processing logic
- Extraction pipeline
- Complex state management
- E2E testing
- Docker configuration
- CI/CD pipelines

## Success Criteria
1. Run `npm install` successfully
2. Run `npm run dev` and see both servers start
3. Open http://localhost:5173 and see Material UI app shell
4. Navigate between Dashboard, Documents, Borrowers pages
5. Dashboard shows API health status with "ok"
6. Run `npm test` and all tests pass
7. TypeScript type checking passes: `npm run type-check`
8. Code is clean, well-structured, and ready for next phase

## Implementation Order
1. Create root package.json with workspaces
2. Scaffold apps/api with Express + TypeScript
3. Add health endpoint and middleware
4. Scaffold apps/web with React + Vite + Material UI
5. Create app shell with navigation
6. Create Dashboard page with health check
7. Add Zustand store
8. Add tests for both apps
9. Update README.md
10. Test everything end-to-end

## Key Principles
- **Minimal**: Only what's needed for the scaffold
- **Clean**: Well-organized, no clutter
- **Runnable**: Works immediately after setup
- **Testable**: Has basic tests that pass
- **Documented**: Clear README with setup instructions
- **Type-safe**: TypeScript strict mode, no any types
- **Conventional**: Follow standard patterns and best practices

## Implementation Notes

### Backend Architecture
- Entry point (`index.ts`): Express app setup, middleware, routes, server start
- Configuration (`config/index.ts`): Environment variables, typed config object
- Middleware:
  - `errorHandler.ts`: Global error handling with JSON responses
  - `requestLogger.ts`: Request logging (method, path, status, duration)
- Routes:
  - `health.ts`: GET /api/health endpoint with status response
  - `health.test.ts`: Vitest tests for health endpoint

### Frontend Architecture
- Entry point (`main.tsx`): React DOM render with providers (Router, Theme, CssBaseline)
- App (`App.tsx`): Route configuration with React Router
- Theme (`theme/index.ts`): Material UI theme customization
- Components:
  - `AppShell.tsx`: Layout with permanent drawer, app bar, responsive mobile drawer
- Pages:
  - `Dashboard.tsx`: Home page with API health card and metric placeholders
  - `Documents.tsx`: Placeholder page
  - `Borrowers.tsx`: Placeholder page
- Store (`store/appStore.ts`): Zustand store for API health state with fetch action
- Tests:
  - `test/setup.ts`: Vitest + Testing Library setup
  - `App.test.tsx`: Basic rendering tests

### Configuration Details
- **API Port**: 3001
- **Web Port**: 5173
- **Proxy**: Vite proxies `/api/*` to `http://localhost:3001`
- **TypeScript**: Strict mode, path aliases (`@/*`), ESM modules
- **Material UI**: Dark drawer (#1e1e1e), primary blue (#1976d2)

## Completion Status
✅ **COMPLETED** - All requirements met:
- Root package.json with workspaces
- Backend API with Express + TypeScript + health endpoint
- Frontend with React + Vite + Material UI + app shell
- Zustand state management
- Vitest testing for both apps
- TypeScript strict mode throughout
- Development scripts (`npm run dev`)
- Comprehensive README
- Clean, minimal, locally runnable

**Ready for next phase**: LLM integration and document processing
