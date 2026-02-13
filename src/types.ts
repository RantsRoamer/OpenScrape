/**
 * Core type definitions for OpenScrape
 */

import { Page } from 'playwright';

/** Proxy for scraping: single URL or list for rotation. Supports http://user:pass@host:port, socks5://host:port */
export type ProxyInput = string | string[];

export interface ScrapeOptions {
  /** URL to scrape */
  url: string;
  /** Override proxy for this request: single proxy URL or list (rotated on retry). Supports auth and SOCKS5. */
  proxy?: ProxyInput;
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
  format?: 'json' | 'markdown' | 'html' | 'text' | 'csv' | 'yaml';
  /** Custom extraction schema */
  extractionSchema?: ExtractionSchema;
  /** Use LLM (Ollama/LM Studio) to extract structured JSON from cleaned content */
  llmExtract?: boolean;
  /** LLM endpoint (e.g. http://localhost:11434 for Ollama, http://localhost:1234 for LM Studio) */
  llmEndpoint?: string;
  /** Model name for Ollama (e.g. llama2) or LM Studio */
  llmModel?: string;
  /** Auto-detect extraction schema from sample page(s) (opt-in) */
  autoDetectSchema?: boolean;
  /** Number of sample URLs to use for schema detection (default: 1) */
  schemaSamples?: number;
  /** User agent string */
  userAgent?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Whether to extract images */
  extractImages?: boolean;
  /** Whether to extract embedded media */
  extractMedia?: boolean;
  /** Download images/videos/PDFs to a local folder */
  downloadMedia?: boolean;
  /** Output directory for downloaded media (used when downloadMedia is true). Default: ./media */
  mediaOutputDir?: string;
  /** Base64-embed small images in JSON (data URL). Default: false */
  base64EmbedImages?: boolean;
  /** Max size in bytes for base64 embedding (only smaller images are embedded). Default: 51200 (50KB) */
  base64EmbedMaxBytes?: number;
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
    transform?: (value: string) => unknown;
  }>;
}

/** One downloaded asset: original URL and local path */
export interface MediaDownload {
  url: string;
  localPath: string;
  /** Suggested MIME type from response or extension */
  mimeType?: string;
}

/** One base64-embedded asset (data URL) */
export interface MediaEmbedded {
  url: string;
  dataUrl: string;
  mimeType?: string;
}

/** Table data for CSV export (list-like / table pages) */
export interface TableRow {
  [column: string]: string;
}

export interface ScrapedData {
  url: string;
  title?: string;
  author?: string;
  publishDate?: string;
  content: string;
  markdown?: string;
  /** Cleaned HTML (no scripts/nav/ads) */
  cleanedHtml?: string;
  /** Plain text only (no HTML) */
  text?: string;
  /** Extracted table rows for CSV (when tables detected) */
  tableData?: string[][];
  /** List-like items (e.g. for schema-based CSV) */
  listItems?: TableRow[];
  images?: string[];
  /** Downloaded media (when downloadMedia is used) */
  mediaDownloads?: MediaDownload[];
  /** Base64-embedded small images (when base64EmbedImages is used) */
  mediaEmbedded?: MediaEmbedded[];
  metadata?: Record<string, unknown>;
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

/** Constructor options for OpenScrape (rate limit + optional default proxy) */
export interface OpenScrapeConfig extends RateLimitConfig {
  /** Default proxy for all scrapes: single URL or array for rotation. Supports http://user:pass@host:port, socks5://host:port */
  proxy?: ProxyInput;
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
