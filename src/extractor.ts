/**
 * Data extraction and normalization
 */

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import * as cheerio from 'cheerio';
import { ExtractionSchema, ScrapedData } from './types';

export class DataExtractor {
  private turndown: TurndownService;
  private schema?: ExtractionSchema;

  constructor(schema?: ExtractionSchema) {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
    this.turndown.use(gfm);
    this.schema = schema;

    // Configure turndown to preserve images
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (content, node: any) => {
        const src = node.getAttribute('src');
        const alt = node.getAttribute('alt') || '';
        return src ? `![${alt}](${src})` : '';
      },
    });
  }

  /**
   * Extract data from HTML content
   */
  extract(html: string, url: string, extractImages: boolean = true): ScrapedData {
    const $ = cheerio.load(html || '');

    const data: ScrapedData = {
      url,
      content: '',
      timestamp: new Date().toISOString(),
    };

    // Extract title first (before noise removal)
    if (this.schema?.title) {
      data.title = this.extractBySelector($, this.schema.title);
    } else {
      data.title = this.extractTitle($);
    }

    // Extract author
    if (this.schema?.author) {
      data.author = this.extractBySelector($, this.schema.author);
    } else {
      data.author = this.extractAuthor($);
    }

    // Extract publish date
    if (this.schema?.publishDate) {
      data.publishDate = this.extractBySelector($, this.schema.publishDate);
    } else {
      data.publishDate = this.extractPublishDate($);
    }

    // Extract main content - try custom schema first
    let extractedContent = '';
    if (this.schema?.content) {
      const contentElement = $(this.schema.content).first();
      extractedContent = contentElement.html() || '';
    }

    // If no custom schema or it didn't work, use default extraction
    if (!extractedContent || extractedContent.trim().length < 50) {
      // Work with a fresh copy of the HTML to avoid modifying the original
      const $fresh = cheerio.load(html);
      
      // Remove scripts, styles, noscript first
      $fresh('script, style, noscript').remove();
      
      // Try to find main content areas (prioritize semantic/content selectors)
      const articleSelectors = [
        'article',
        '[role="article"]',
        'main',
        '[role="main"]',
        '.article',
        '.post',
        '.content',
        '.entry-content',
        '#content',
        '#main',
        '.main-content',
        '.page-content',
      ];

      let found = false;
      for (const selector of articleSelectors) {
        const element = $fresh(selector).first();
        if (element.length > 0) {
          const text = element.text().trim();
          if (text.length > 50) {
            extractedContent = element.html() || '';
            found = true;
            break;
          }
        }
      }

      // If no specific content area found, use body content
      if (!found) {
        const body = $fresh('body');
        const bodyText = body.text().trim();
        if (bodyText.length > 50) {
          // Get inner HTML of body - get children to avoid body tag wrapper
          const bodyChildren = body.children();
          if (bodyChildren.length > 0) {
            // Get HTML of each child and join
            const childrenHtml = bodyChildren.map((_, el) => {
              const html = $fresh(el).html();
              return html || '';
            }).get().filter(html => html && html.trim().length > 0);
            
            if (childrenHtml.length > 0) {
              extractedContent = childrenHtml.join('\n');
            }
          }
          
          // Fallback to body.html() if children didn't work
          if (!extractedContent || extractedContent.trim().length === 0) {
            const bodyHtml = body.html();
            extractedContent = bodyHtml || '';
          }
        }
      }
    }
    
    // Ensure we have content - if still empty, use body as last resort
    if (!extractedContent || extractedContent.trim().length === 0) {
      const $fallback = cheerio.load(html);
      $fallback('script, style, noscript').remove();
      const body = $fallback('body');
      if (body.length > 0) {
        const bodyChildren = body.children();
        if (bodyChildren.length > 0) {
          const childrenHtml = bodyChildren.map((_, el) => {
            const html = $fallback(el).html();
            return html || '';
          }).get().filter(h => h && h.trim().length > 0);
          
          if (childrenHtml.length > 0) {
            extractedContent = childrenHtml.join('\n');
          } else {
            extractedContent = body.html() || '';
          }
        } else {
          extractedContent = body.html() || '';
        }
      }
    }

    // Set content - remove noise if we have content
    // IMPORTANT: Always ensure content is set, even if noise removal fails
    if (extractedContent && extractedContent.trim().length > 0) {
      // For now, use content directly without noise removal to ensure it works
      // TODO: Re-enable noise removal once basic extraction is confirmed working
      data.content = extractedContent;
      
      // Attempt basic noise removal (just scripts/styles, not nav/header/footer)
      try {
        const content$ = cheerio.load(extractedContent);
        content$('script, style, noscript').remove();
        const body = content$('body');
        if (body.length > 0) {
          const cleaned = body.html();
          if (cleaned && cleaned.trim().length > 0) {
            data.content = cleaned;
          }
        } else {
          // No body tag, try root children
          const rootChildren = content$.root().children();
          if (rootChildren.length > 0) {
            const cleaned = rootChildren.map((_, el) => content$(el).html()).get().filter(h => h).join('\n');
            if (cleaned && cleaned.trim().length > 0) {
              data.content = cleaned;
            }
          }
        }
      } catch (error) {
        // If cleaning fails, keep original content
        // data.content already set above
      }
    } else {
      data.content = '';
    }

    // Extract images
    if (extractImages) {
      data.images = this.extractImages($);
    }

    // Convert to markdown
    data.markdown = this.turndown.turndown(data.content);

    // Extract custom fields
    if (this.schema?.custom) {
      data.metadata = {};
      for (const rule of this.schema.custom) {
        const value = this.extractBySelector($, rule.selector, rule.attribute);
        if (value !== undefined) {
          data.metadata[rule.name] = rule.transform ? rule.transform(value) : value;
        }
      }
    }

    return data;
  }

  /**
   * Remove noise elements (ads, navigation, etc.)
   */
  private removeNoise($: cheerio.CheerioAPI): void {
    // Common noise selectors - be more selective to avoid removing content
    const noiseSelectors = [
      '.ad',
      '.ads',
      '.advertisement',
      '.sidebar',
      '.social-share',
      '.comments',
      '.related-posts',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.cookie-banner',
      '.newsletter',
      '.popup',
      'script',
      'style',
      'noscript',
    ];

    noiseSelectors.forEach(selector => {
      $(selector).remove();
    });

    // Remove nav, header, footer but only if they don't contain article/main content
    $('nav').each((_, el) => {
      const $el = $(el);
      // Only remove if it doesn't contain article or main content
      if ($el.find('article, main, [role="main"], [role="article"]').length === 0) {
        $el.remove();
      }
    });

    $('header').each((_, el) => {
      const $el = $(el);
      if ($el.find('article, main, [role="main"], [role="article"]').length === 0) {
        $el.remove();
      }
    });

    $('footer').each((_, el) => {
      const $el = $(el);
      if ($el.find('article, main, [role="main"], [role="article"]').length === 0) {
        $el.remove();
      }
    });
  }

  /**
   * Extract title from page
   */
  private extractTitle($: cheerio.CheerioAPI): string | undefined {
    return $('meta[property="og:title"]').attr('content') ||
           $('title').text() ||
           $('h1').first().text() ||
           undefined;
  }

  /**
   * Extract author from page
   */
  private extractAuthor($: cheerio.CheerioAPI): string | undefined {
    return $('meta[name="author"]').attr('content') ||
           $('meta[property="article:author"]').attr('content') ||
           $('[rel="author"]').text() ||
           $('.author').first().text() ||
           undefined;
  }

  /**
   * Extract publish date from page
   */
  private extractPublishDate($: cheerio.CheerioAPI): string | undefined {
    return $('meta[property="article:published_time"]').attr('content') ||
           $('time[datetime]').attr('datetime') ||
           $('time').attr('datetime') ||
           $('.published').text() ||
           $('.date').first().text() ||
           undefined;
  }

  /**
   * Extract main content from page
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    // Try common article selectors
    const articleSelectors = [
      'article',
      '[role="article"]',
      '.article',
      '.post',
      '.content',
      '.entry-content',
      'main',
      '[role="main"]',
    ];

    for (const selector of articleSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        // Lower threshold to 50 characters instead of 100
        if (text.length > 50) {
          return element.html() || '';
        }
      }
    }

    // Try to find content in common containers
    const containerSelectors = [
      '.container',
      '.wrapper',
      '#content',
      '#main',
      '.main-content',
      '.page-content',
    ];

    for (const selector of containerSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 50) {
          return element.html() || '';
        }
      }
    }

    // Fallback to body content, but exclude scripts and styles
    const body = $('body').clone();
    body.find('script, style, noscript').remove();
    const bodyHtml = body.html() || '';
    
    // If body has substantial content, return it
    if (body.text().trim().length > 50) {
      return bodyHtml;
    }

    return '';
  }

  /**
   * Extract images from page
   */
  private extractImages($: cheerio.CheerioAPI): string[] {
    const images: string[] = [];
    $('img').each((_, element) => {
      const src = $(element).attr('src') || $(element).attr('data-src');
      if (src) {
        images.push(src);
      }
    });
    return images;
  }

  /**
   * Extract value by CSS selector
   */
  private extractBySelector(
    $: cheerio.CheerioAPI,
    selector: string,
    attribute?: string
  ): string | undefined {
    const element = $(selector).first();
    if (element.length === 0) {
      return undefined;
    }

    if (attribute) {
      return element.attr(attribute) || undefined;
    }

    return element.text().trim() || undefined;
  }
}
