/**
 * Tests for REST API
 */

import request from 'supertest';
import { app } from '../api';

describe('API', () => {
  test('health check endpoint should return ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });

  test('POST /crawl should create a job', async () => {
    const response = await request(app)
      .post('/crawl')
      .send({ url: 'https://example.com' });

    expect(response.status).toBe(200);
    expect(response.body.jobId).toBeDefined();
    expect(response.body.status).toBe('pending');
    expect(response.body.url).toBe('https://example.com');
  });

  test('POST /crawl should return 400 for missing URL', async () => {
    const response = await request(app)
      .post('/crawl')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('URL is required');
  });

  test('GET /status/:jobId should return job status', async () => {
    // First create a job
    const createResponse = await request(app)
      .post('/crawl')
      .send({ url: 'https://example.com' });

    const jobId = createResponse.body.jobId;

    // Then check status
    const statusResponse = await request(app).get(`/status/${jobId}`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.id).toBe(jobId);
    expect(statusResponse.body.status).toBeDefined();
  });

  test('GET /status/:jobId should return 404 for non-existent job', async () => {
    const response = await request(app).get('/status/non-existent-id');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Job not found');
  });

  test('GET /jobs should return list of jobs', async () => {
    // Create a job first
    await request(app)
      .post('/crawl')
      .send({ url: 'https://example.com' });

    const response = await request(app).get('/jobs');

    expect(response.status).toBe(200);
    expect(response.body.jobs).toBeDefined();
    expect(Array.isArray(response.body.jobs)).toBe(true);
  });
});
