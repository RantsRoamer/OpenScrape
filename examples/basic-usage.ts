/**
 * Basic usage example for OpenScrape
 */

import { OpenScrape } from '../src/index';

async function main() {
  const scraper = new OpenScrape({
    maxRequestsPerSecond: 5,
    maxConcurrency: 3,
  });

  try {
    // Scrape a single URL
    const data = await scraper.scrape({
      url: 'https://example.com/article',
      render: true,
      format: 'json',
      extractImages: true,
      maxDepth: 3,
    });

    console.log('Title:', data.title);
    console.log('Author:', data.author);
    console.log('Publish Date:', data.publishDate);
    console.log('Content length:', data.content.length);
    console.log('Images found:', data.images?.length || 0);
    console.log('\nMarkdown preview:');
    console.log(data.markdown?.substring(0, 200) + '...');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}

main();
