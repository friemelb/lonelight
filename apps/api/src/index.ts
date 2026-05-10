import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '@/config';
import { getDatabase, closeDatabase } from '@/database';
import { healthRouter } from '@/routes/health';
import { documentsRouter } from '@/routes/documents';
import { borrowersRouter } from '@/routes/borrowers';
import { ingestRouter } from '@/routes/ingest';
import { debugRouter } from '@/routes/debug';
import { metricsRouter } from '@/routes/metrics';
import { searchRouter } from '@/routes/search';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// API routes
app.use('/api/health', healthRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/borrowers', borrowersRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/debug', debugRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/search', searchRouter);

// Error handling (must be last)
app.use(errorHandler);

// Initialize database
getDatabase();

// Start server
const server = app.listen(config.port, config.host);

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    closeDatabase();
  });
});

export { app };
