/**
 * Auto-detect extraction schema from sample page(s) - heuristic analysis of DOM
 */

import type { ExtractionSchema } from './types';

export interface SchemaDetectionResult {
  schema: ExtractionSchema;
  confidence: number;
  suggestions: string[];
}

/**
 * Analyze HTML and suggest an ExtractionSchema (title, author, content, etc.)
 * Uses heuristics: og:title, h1, meta author, article/main, etc.
 */
export function detectSchemaFromHtml(html: string): SchemaDetectionResult {
  const suggestions: string[] = [];
  const schema: ExtractionSchema = {};
  let confidence = 0;

  // Use regex to avoid pulling in cheerio here (caller can use cheerio and pass $)
  const hasOgTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.test(html);
  const hasTitle = /<title[^>]*>([^<]+)<\/title>/i.test(html);
  const hasH1 = /<h1[^>]*>[\s\S]*?<\/h1>/i.test(html);
  const hasMetaAuthor = /<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i.test(html);
  const hasArticle = /<article[\s>]/i.test(html);
  const hasMain = /<main[\s>]/i.test(html);
  const hasContentClass = /class=["'][^"']*content[^"']*["']/i.test(html);
  const hasEntryContent = /class=["'][^"']*entry-content[^"']*["']/i.test(html);

  if (hasOgTitle) {
    schema.title = 'meta[property="og:title"]';
    confidence += 0.3;
    suggestions.push('Title from og:title');
  } else if (hasH1) {
    schema.title = 'h1';
    confidence += 0.25;
    suggestions.push('Title from first h1');
  } else if (hasTitle) {
    schema.title = 'title';
    confidence += 0.2;
    suggestions.push('Title from <title>');
  }

  if (hasMetaAuthor) {
    schema.author = 'meta[name="author"]';
    confidence += 0.2;
    suggestions.push('Author from meta author');
  }

  if (hasArticle) {
    schema.content = 'article';
    confidence += 0.3;
    suggestions.push('Content from article');
  } else if (hasMain) {
    schema.content = 'main';
    confidence += 0.25;
    suggestions.push('Content from main');
  } else if (hasEntryContent) {
    schema.content = '.entry-content';
    confidence += 0.2;
    suggestions.push('Content from .entry-content');
  } else if (hasContentClass) {
    schema.content = '.content';
    confidence += 0.15;
    suggestions.push('Content from .content');
  }

  return {
    schema,
    confidence: Math.min(1, confidence),
    suggestions,
  };
}
