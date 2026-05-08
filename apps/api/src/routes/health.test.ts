import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { healthRouter } from './health';

describe('Health Check Endpoint', () => {
  const app = express();
  app.use('/api/health', healthRouter);

  it('should return 200 OK', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });

  it('should return correct health response structure', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('service', 'loanlens-api');
    expect(response.body).toHaveProperty('version', '0.1.0');
  });

  it('should return valid ISO timestamp', async () => {
    const response = await request(app).get('/api/health');
    const timestamp = new Date(response.body.timestamp);

    expect(timestamp.toString()).not.toBe('Invalid Date');
  });

  it('should return positive uptime', async () => {
    const response = await request(app).get('/api/health');

    expect(response.body.uptime).toBeGreaterThan(0);
  });
});
