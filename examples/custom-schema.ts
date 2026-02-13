/**
 * Example using custom extraction schema
 */

import { OpenScrape } from '../src/index';
import { ExtractionSchema } from '../src/types';

async function main() {
  const scraper = new OpenScrape();

  // Define custom extraction schema
  const schema: ExtractionSchema = {
    title: '.article-title',
    author: '.author-name',
    publishDate: '.publish-date',
    content: '.article-body',
    custom: [
      {
        name: 'category',
        selector: '.category',
      },
      {
        name: 'tags',
        selector: '.tags',
        transform: (value: string) => value.split(',').map(tag => tag.trim()),
      },
      {
        name: 'views',
        selector: '.views-count',
        transform: (value: string) => parseInt(value.replace(/,/g, ''), 10),
      },
    ],
  };

  try {
    const data = await scraper.scrape({
      url: 'https://example.com/article',
      extractionSchema: schema,
    });

    console.log('Extracted data:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}

main();
