/**
 * Core scraping engine with headless browser support
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { OpenScrapeConfig, ScrapeOptions, ScrapedData } from './types';
import { DataExtractor } from './extractor';
import { PaginationHandler } from './pagination';
import { RateLimiter } from './rateLimiter';
import { resolveImageUrls, downloadMedia, embedSmallImages } from './mediaHandler';
import { detectSchemaFromHtml } from './schemaDetector';
import { extractWithLlm } from './llmExtractor';
import { ProxyPool, normalizeProxyInput, type PlaywrightProxyConfig } from './proxy';

const RETRYABLE_STATUSES = [403, 429];
const RETRYABLE_MESSAGES = /timeout|timed out|deadline/i;

export class OpenScrape {
  private browser: Browser | null = null;
  private rateLimiter: RateLimiter;
  private extractor: DataExtractor;
  private paginationHandler: PaginationHandler;
  private defaultProxyPool: ProxyPool | null = null;

  constructor(config?: OpenScrapeConfig) {
    this.rateLimiter = new RateLimiter(config);
    this.extractor = new DataExtractor();
    this.paginationHandler = new PaginationHandler();
    if (config?.proxy) {
      this.defaultProxyPool = new ProxyPool(config.proxy);
    }
  }

  /**
   * Initialize browser instance
   */
  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
      });
    }
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Resolve proxy configs for this request (per-scrape override or default pool).
   */
  private getProxyConfigsForRequest(options: ScrapeOptions): PlaywrightProxyConfig[] {
    if (options.proxy !== undefined) return normalizeProxyInput(options.proxy);
    if (this.defaultProxyPool) {
      const list: PlaywrightProxyConfig[] = [];
      for (let i = 0; i < this.defaultProxyPool.size; i++) list.push(this.defaultProxyPool.getNext());
      return list;
    }
    return [];
  }

  /**
   * Create a browser context (with optional proxy) and page, navigate to url; retry with next proxy on 403/429/timeout.
   */
  private async createPageAndNavigate(
    options: ScrapeOptions,
    proxyConfigs: PlaywrightProxyConfig[]
  ): Promise<{ context: BrowserContext; page: Page }> {
    const timeout = options.timeout ?? 30000;
    const waitUntil = options.render !== false ? 'networkidle' : 'domcontentloaded' as const;
    const maxTries = Math.max(proxyConfigs.length, 1);

    for (let tryIndex = 0; tryIndex < maxTries; tryIndex++) {
      const proxy = proxyConfigs.length > 0 ? proxyConfigs[tryIndex % proxyConfigs.length] : undefined;
      const context = await this.browser!.newContext(proxy ? { proxy } : {});

      try {
        const page = await context.newPage();
        if (options.userAgent) {
          await page.setExtraHTTPHeaders({ 'User-Agent': options.userAgent });
        }
        const response = await page.goto(options.url, { waitUntil, timeout });

        const status = response?.status() ?? 0;
        if (response && RETRYABLE_STATUSES.includes(status) && tryIndex < maxTries - 1) {
          await context.close();
          continue;
        }

        return { context, page };
      } catch (err) {
        await context.close();
        const msg = err instanceof Error ? err.message : String(err);
        if (RETRYABLE_MESSAGES.test(msg) && tryIndex < maxTries - 1) continue;
        throw err;
      }
    }

    throw new Error(`Failed to load ${options.url} after ${maxTries} attempt(s)`);
  }

  /**
   * Scrape a single URL
   */
  async scrape(options: ScrapeOptions): Promise<ScrapedData> {
    await this.init();

    return this.rateLimiter.execute(async () => {
      const proxyConfigs = this.getProxyConfigsForRequest(options);
      const { context, page } = await this.createPageAndNavigate(options, proxyConfigs);

      try {
        // Wait for additional time if specified
        if (options.waitTime) {
          await page.waitForTimeout(options.waitTime);
        }

        // Get HTML content
        let html = await page.content();
        
        // Handle pagination if enabled
        if (options.maxDepth !== undefined && options.maxDepth > 0) {
          const visitedUrls = new Set<string>([options.url]);
          const urls = await this.paginationHandler.handlePagination(
            page,
            options,
            visitedUrls
          );

          // If pagination found additional pages, combine content
          if (urls.length > 1) {
            const allContent: string[] = [html]; // Start with current page
            for (const url of urls) {
              if (url !== options.url) {
                await page.goto(url, {
                  waitUntil: options.render !== false ? 'networkidle' : 'domcontentloaded',
                  timeout: options.timeout ?? 30000,
                });
                if (options.waitTime) {
                  await page.waitForTimeout(options.waitTime);
                }
                const pageHtml = await page.content();
                allContent.push(pageHtml);
              }
            }

            // Merge HTML from all pages
            html = this.mergeHtml(allContent);
          }
          // If no additional pages found, use original HTML
        }

        // Optional: auto-detect schema from this page
        let schema = options.extractionSchema;
        if (options.autoDetectSchema) {
          const detected = detectSchemaFromHtml(html);
          schema = detected.schema;
        }

        // Extract data
        const extractor = new DataExtractor(schema);
        const data = extractor.extract(
          html,
          options.url,
          options.extractImages !== false
        );

        // Media: download and/or base64-embed images
        const imageUrls = data.images?.length ? resolveImageUrls(options.url, data.images) : [];
        const fetchOpts = { userAgent: options.userAgent, timeout: options.timeout ?? 30000 };

        if (options.downloadMedia && imageUrls.length > 0) {
          const outDir = options.mediaOutputDir ?? './media';
          data.mediaDownloads = await downloadMedia(imageUrls, options.url, outDir, fetchOpts);
        }

        if (options.base64EmbedImages && imageUrls.length > 0) {
          const maxBytes = options.base64EmbedMaxBytes ?? 51200;
          data.mediaEmbedded = await embedSmallImages(imageUrls, options.url, maxBytes, fetchOpts);
        }

        // Optional: LLM-based extraction (merge structured fields from local Ollama/LM Studio)
        if (options.llmExtract && options.llmEndpoint) {
          try {
            const llmContent = data.markdown || data.content || '';
            const llmResult = await extractWithLlm(llmContent, {
              endpoint: options.llmEndpoint,
              model: options.llmModel,
              timeout: options.timeout ?? 60000,
              useMarkdown: true,
            });
            if (llmResult.title !== undefined) data.title = llmResult.title;
            if (llmResult.author !== undefined) data.author = llmResult.author;
            if (llmResult.publishDate !== undefined) data.publishDate = llmResult.publishDate;
            if (llmResult.content !== undefined) data.content = llmResult.content;
            if (llmResult.metadata) data.metadata = { ...data.metadata, ...llmResult.metadata };
          } catch (e) {
            // Don't fail the whole scrape if LLM is down
            if (data.metadata == null) data.metadata = {};
            data.metadata.llmError = e instanceof Error ? e.message : String(e);
          }
        }

        return data;
      } catch (error) {
        throw new Error(`Failed to scrape ${options.url}: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        await context.close();
      }
    });
  }

  /**
   * Merge HTML from multiple pages
   */
  private mergeHtml(htmlPages: string[]): string {
    // Simple merge: combine all body content
    // In a real implementation, you might want more sophisticated merging
    return htmlPages.join('\n');
  }

  /**
   * Scrape multiple URLs
   */
  async scrapeBatch(
    urls: string[],
    options: Partial<ScrapeOptions> = {}
  ): Promise<ScrapedData[]> {
    const results: ScrapedData[] = [];

    for (const url of urls) {
      try {
        const data = await this.scrape({ ...options, url });
        results.push(data);
      } catch (error) {
        // Log error but continue with other URLs
        console.error(`Error scraping ${url}:`, error);
        results.push({
          url,
          content: '',
          timestamp: new Date().toISOString(),
          metadata: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    return results;
  }
}
