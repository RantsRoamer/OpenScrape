/**
 * Core type definitions for OpenScrape
 */

import { Page } from 'playwright';

export interface ScrapeOptions {
  /** URL to scrape */
  url: string;
  /** Enable JavaScript rendering (default: true) */
  render?: boolean;
  /** Wait time in milliseconds after page load (default: 2000) */
  waitTime?: number;
  /** Maximum pagination depth (default: 10) */
  maxDepth?: number;
  /** Custom CSS selector for "next" link/button */
  nextSelector?: string;
  /** Custom callback for pagination detection */
  paginationCallback?: (page: Page) => Promise<string | null>;
  /** Output format */
  format?: 'markdown' | 'json';
  /** Custom extraction schema */
  extractionSchema?: ExtractionSchema;
  /** User agent string */
  userAgent?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to extract images */
  extractImages?: boolean;
  /** Whether to extract embedded media */
  extractMedia?: boolean;
}

export interface ExtractionSchema {
  /** CSS selector for title */
  title?: string;
  /** CSS selector for author */
  author?: string;
  /** CSS selector for publish date */
  publishDate?: string;
  /** CSS selector for main content */
  content?: string;
  /** CSS selector for images */
  images?: string;
  /** Custom extraction rules */
  custom?: Array<{
    name: string;
    selector: string;
    attribute?: string;
    transform?: (value: string) => any;
  }>;
}

export interface ScrapedData {
  url: string;
  title?: string;
  author?: string;
  publishDate?: string;
  content: string;
  markdown?: string;
  images?: string[];
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface CrawlJob {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ScrapedData;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface RateLimitConfig {
  /** Maximum requests per second */
  maxRequestsPerSecond?: number;
  /** Maximum concurrent requests */
  maxConcurrency?: number;
  /** Exponential backoff base delay in ms (default: 1000) */
  backoffBase?: number;
  /** Maximum backoff delay in ms (default: 60000) */
  maxBackoff?: number;
}

/** WebSocket event names for real-time job updates */
export type JobEventType = 'job:created' | 'job:processing' | 'job:completed' | 'job:failed';

/** WebSocket message payload for job events */
export interface JobEventMessage {
  event: JobEventType;
  jobId: string;
  job: Partial<CrawlJob>;
  timestamp: string;
}

/** Client → server: subscribe to a job's updates */
export interface WsSubscribeMessage {
  type: 'subscribe';
  jobId: string;
}

/** Client → server: unsubscribe from a job */
export interface WsUnsubscribeMessage {
  type: 'unsubscribe';
  jobId: string;
}

/** Client → server: list of message types */
export type WsClientMessage = WsSubscribeMessage | WsUnsubscribeMessage;
