/**
 * Core scraping engine with headless browser support
 */

import { chromium, Browser, Page } from 'playwright';
import { ScrapeOptions, ScrapedData } from './types';
import { DataExtractor } from './extractor';
import { PaginationHandler } from './pagination';
import { RateLimiter } from './rateLimiter';
import { resolveImageUrls, downloadMedia, embedSmallImages } from './mediaHandler';
import { detectSchemaFromHtml } from './schemaDetector';
import { extractWithLlm } from './llmExtractor';

export class OpenScrape {
  private browser: Browser | null = null;
  private rateLimiter: RateLimiter;
  private extractor: DataExtractor;
  private paginationHandler: PaginationHandler;

  constructor(rateLimitConfig?: { maxRequestsPerSecond?: number; maxConcurrency?: number }) {
    this.rateLimiter = new RateLimiter(rateLimitConfig);
    this.extractor = new DataExtractor();
    this.paginationHandler = new PaginationHandler();
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
   * Scrape a single URL
   */
  async scrape(options: ScrapeOptions): Promise<ScrapedData> {
    await this.init();

    return this.rateLimiter.execute(async () => {
      const page = await this.browser!.newPage();

      try {
        // Set user agent if provided
        if (options.userAgent) {
          await page.setExtraHTTPHeaders({
            'User-Agent': options.userAgent,
          });
        }

        // Navigate to URL
        await page.goto(options.url, {
          waitUntil: options.render !== false ? 'networkidle' : 'domcontentloaded',
          timeout: options.timeout ?? 30000,
        });

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
        let data = extractor.extract(
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
        await page.close();
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
