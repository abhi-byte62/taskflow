import { describe, it, expect, vi } from 'vitest';
const request = require('supertest');
const { createApp, attachErrorHandling } = require('../src/app.js');

describe('App & Health Routes', () => {
  const app = createApp();
  attachErrorHandling(app);

  it('GET /api/health should return ok status and uptime', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeDefined();
  });

  it('GET /api/nonexistent-route should return 404 RESOURCE_NOT_FOUND', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('should include Helmet security headers in responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});
