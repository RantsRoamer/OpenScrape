/**
 * Pagination detection and navigation
 */

import { Page } from 'playwright';
import { ScrapeOptions } from './types';

export class PaginationHandler {
  /**
   * Detect and follow pagination links
   */
  async handlePagination(
    page: Page,
    options: ScrapeOptions,
    visitedUrls: Set<string> = new Set()
  ): Promise<string[]> {
    const urls: string[] = [];
    const maxDepth = options.maxDepth ?? 10;
    let currentUrl = options.url;
    let depth = 0;

    while (depth < maxDepth) {
      if (visitedUrls.has(currentUrl)) {
        break;
      }

      visitedUrls.add(currentUrl);
      urls.push(currentUrl);

      const nextUrl = await this.findNextUrl(page, options, currentUrl);
      
      if (!nextUrl || visitedUrls.has(nextUrl)) {
        break;
      }

      currentUrl = nextUrl;
      depth++;
    }

    return urls;
  }

  /**
   * Find the next page URL
   */
  private async findNextUrl(
    page: Page,
    options: ScrapeOptions,
    currentUrl: string
  ): Promise<string | null> {
    // Use custom callback if provided
    if (options.paginationCallback) {
      return options.paginationCallback(page);
    }

    // Use custom selector if provided
    if (options.nextSelector) {
      try {
        const nextElement = await page.$(options.nextSelector);
        if (nextElement) {
          const href = await nextElement.getAttribute('href');
          if (href) {
            return this.resolveUrl(href, currentUrl);
          }
        }
      } catch (error) {
        // Selector not found, continue with default detection
      }
    }

    // Default pagination detection
    return this.detectNextLink(page, currentUrl);
  }

  /**
   * Detect next link using common patterns
   */
  private async detectNextLink(page: Page, currentUrl: string): Promise<string | null> {
    const patterns = [
      'a[rel="next"]',
      'a:has-text("Next")',
      'a:has-text("next")',
      '.next',
      '.pagination-next',
      '[aria-label*="next" i]',
      '[aria-label*="Next" i]',
    ];

    for (const pattern of patterns) {
      try {
        const element = await page.$(pattern);
        if (element) {
          const href = await element.getAttribute('href');
          if (href) {
            const resolvedUrl = this.resolveUrl(href, currentUrl);
            // Verify it's a different URL
            if (resolvedUrl !== currentUrl) {
              return resolvedUrl;
            }
          }
        }
      } catch (error) {
        // Continue to next pattern
      }
    }

    // Try to find "Load More" button
    const loadMoreSelectors = [
      'button:has-text("Load More")',
      'button:has-text("Load more")',
      '.load-more',
      '[data-action="load-more"]',
    ];

    for (const selector of loadMoreSelectors) {
      try {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
          // Click and wait for new content
          await button.click();
          await page.waitForTimeout(2000);
          
          // Check if URL changed (some sites use URL params for pagination)
          const newUrl = page.url();
          if (newUrl !== currentUrl) {
            return newUrl;
          }
          
          // If URL didn't change, content was loaded dynamically
          // Return current URL to continue scraping
          return currentUrl;
        }
      } catch (error) {
        // Continue
      }
    }

    return null;
  }

  /**
   * Resolve relative URL to absolute URL
   */
  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href;
    } catch (error) {
      return href;
    }
  }
}
