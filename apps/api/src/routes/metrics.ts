import { Router, Request, Response } from 'express';
import { getDatabase } from '@/database';
import { MetricsRepository } from '@/repositories';

export const metricsRouter = Router();

/**
 * GET /api/metrics/summary
 * Get aggregated metrics summary for the dashboard
 */
metricsRouter.get('/summary', async (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const repository = new MetricsRepository(db);

    const summary = await repository.getMetricsSummary();

    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching metrics summary:', error);
    throw error;
  }
});

/**
 * GET /api/metrics/documents/:id
 * Get processing metrics for a specific document
 */
metricsRouter.get('/documents/:id', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const repository = new MetricsRepository(db);

    const metrics = await repository.getMetricsByDocumentId(req.params.id);
    const attempts = await repository.getExtractionAttempts(req.params.id);

    res.status(200).json({
      documentId: req.params.id,
      processingMetrics: metrics,
      extractionAttempts: attempts
    });
  } catch (error) {
    console.error('Error fetching document metrics:', error);
    throw error;
  }
});

/**
 * GET /api/metrics/errors
 * Get recent processing errors
 */
metricsRouter.get('/errors', async (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const repository = new MetricsRepository(db);

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const errors = await repository.getRecentErrors(limit);

    res.status(200).json({
      errors,
      count: errors.length
    });
  } catch (error) {
    console.error('Error fetching recent errors:', error);
    throw error;
  }
});
