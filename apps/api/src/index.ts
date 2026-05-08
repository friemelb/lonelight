import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '@/config';
import { getDatabase, closeDatabase } from '@/database';
import { healthRouter } from '@/routes/health';
import { documentsRouter } from '@/routes/documents';
import { borrowersRouter } from '@/routes/borrowers';
import { ingestRouter } from '@/routes/ingest';
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

// Error handling (must be last)
app.use(errorHandler);

// Initialize database
console.log('🔌 Initializing database...');
getDatabase();

// Start server
const server = app.listen(config.port, config.host, () => {
  console.log(`🚀 API server running at http://${config.host}:${config.port}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`🔧 API Version: ${config.apiVersion}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    closeDatabase();
    console.log('Database connection closed');
  });
});

export { app };
