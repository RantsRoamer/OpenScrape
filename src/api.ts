/**
 * REST API server for OpenScrape
 */

import { readFileSync } from 'fs';
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import * as path from 'path';
import { OpenScrape } from './scraper';
import { ScrapeOptions, CrawlJob } from './types';
import { randomUUID } from 'crypto';
import { attachWebSocketServer, broadcastJobEvent, closeWebSocketServer } from './websocket';
import { getAboutInfo } from './about';

const pkg = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
) as { version: string };

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory job storage (in production, use Redis or a database)
const jobs = new Map<string, CrawlJob>();
const scraper = new OpenScrape();

/**
 * POST /crawl - Scrape a URL
 */
app.post('/crawl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, options = {} } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Create job
    const jobId = randomUUID();
    const job: CrawlJob = {
      id: jobId,
      url,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    jobs.set(jobId, job);
    broadcastJobEvent('job:created', jobId, job);

    // Process job asynchronously
    processJob(jobId, url, options).catch(error => {
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        job.completedAt = new Date().toISOString();
        broadcastJobEvent('job:failed', jobId, job);
      }
    });

    res.json({ jobId, status: 'pending', url });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /status/:jobId - Get job status
 */
app.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    id: job.id,
    status: job.status,
    url: job.url,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    error: job.error,
    result: job.result,
  });
});

/**
 * GET /jobs - List all jobs
 */
app.get('/jobs', (req: Request, res: Response) => {
  const allJobs = Array.from(jobs.values()).map(job => ({
    id: job.id,
    status: job.status,
    url: job.url,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  }));
  res.json({ jobs: allJobs });
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /about - Credits and repository
 */
app.get('/about', (req: Request, res: Response) => {
  res.json(getAboutInfo(pkg.version ?? '1.0.0'));
});

/**
 * Process crawl job
 */
async function processJob(jobId: string, url: string, options: Partial<ScrapeOptions>): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'processing';
    broadcastJobEvent('job:processing', jobId, job);

    const scrapeOptions: ScrapeOptions = {
      url,
      ...options,
    };

    const result = await scraper.scrape(scrapeOptions);

    job.status = 'completed';
    job.result = result;
    job.completedAt = new Date().toISOString();
    broadcastJobEvent('job:completed', jobId, job);
  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
    job.completedAt = new Date().toISOString();
    broadcastJobEvent('job:failed', jobId, job);
  }
}

/**
 * Error handler
 */
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

/**
 * Start server (HTTP + WebSocket on path /ws)
 */
export async function startServer(port: number = 3000, host: string = '0.0.0.0'): Promise<void> {
  const server = createServer(app);
  attachWebSocketServer(server);
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      resolve();
    });
  });
}

/**
 * Export app for testing
 */
export { app };

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  closeWebSocketServer();
  await scraper.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  closeWebSocketServer();
  await scraper.close();
  process.exit(0);
});
