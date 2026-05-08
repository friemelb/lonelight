import { Router, Request, Response } from 'express';

export const healthRouter = Router();

interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
}

/**
 * GET /api/health
 * Health check endpoint
 */
healthRouter.get('/', (_req: Request, res: Response<HealthResponse>) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'loanlens-api',
    version: '0.1.0'
  };

  res.status(200).json(response);
});
