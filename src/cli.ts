#!/usr/bin/env node

/**
 * Command-line interface for OpenScrape
 */

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OpenScrape } from './scraper';
import { ScrapeOptions } from './types';

const program = new Command();

program
  .name('openscrape')
  .description('Open-source web scraping library')
  .version('1.0.0');

program
  .command('crawl')
  .description('Scrape a single URL')
  .argument('<url>', 'URL to scrape')
  .option('-o, --output <path>', 'Output file path', 'output.json')
  .option('--no-render', 'Disable JavaScript rendering')
  .option('--format <format>', 'Output format (json|markdown)', 'json')
  .option('--wait-time <ms>', 'Wait time after page load (ms)', '2000')
  .option('--max-depth <number>', 'Maximum pagination depth', '10')
  .option('--next-selector <selector>', 'CSS selector for next link')
  .option('--timeout <ms>', 'Request timeout (ms)', '30000')
  .option('--user-agent <ua>', 'Custom user agent string')
  .action(async (url: string, options) => {
    try {
      const scraper = new OpenScrape();
      
      const scrapeOptions: ScrapeOptions = {
        url,
        render: options.render !== false,
        format: options.format === 'markdown' ? 'markdown' : 'json',
        waitTime: parseInt(options.waitTime, 10),
        maxDepth: parseInt(options.maxDepth, 10),
        nextSelector: options.nextSelector,
        timeout: parseInt(options.timeout, 10),
        userAgent: options.userAgent,
      };

      console.log(`Scraping ${url}...`);
      const data = await scraper.scrape(scrapeOptions);
      
      await scraper.close();

      // Write output
      const outputPath = path.resolve(options.output);
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      if (options.format === 'markdown') {
        const markdown = `# ${data.title || 'Untitled'}\n\n` +
          (data.author ? `**Author:** ${data.author}\n\n` : '') +
          (data.publishDate ? `**Published:** ${data.publishDate}\n\n` : '') +
          `**URL:** ${data.url}\n\n` +
          `---\n\n${data.markdown || data.content}\n`;
        await fs.writeFile(outputPath, markdown, 'utf-8');
      } else {
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
      }

      console.log(`✓ Scraped successfully. Output saved to ${outputPath}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Scrape multiple URLs from a file')
  .argument('<file>', 'File containing URLs (one per line)')
  .option('-o, --output-dir <path>', 'Output directory', './output')
  .option('--no-render', 'Disable JavaScript rendering')
  .option('--format <format>', 'Output format (json|markdown)', 'json')
  .option('--wait-time <ms>', 'Wait time after page load (ms)', '2000')
  .option('--max-depth <number>', 'Maximum pagination depth', '10')
  .option('--timeout <ms>', 'Request timeout (ms)', '30000')
  .option('--max-concurrency <number>', 'Maximum concurrent requests', '3')
  .action(async (file: string, options) => {
    try {
      const scraper = new OpenScrape({
        maxConcurrency: parseInt(options.maxConcurrency, 10),
      });

      // Read URLs from file
      const fileContent = await fs.readFile(file, 'utf-8');
      const urls = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      console.log(`Found ${urls.length} URLs to scrape`);

      // Create output directory
      const outputDir = path.resolve(options.outputDir);
      await fs.mkdir(outputDir, { recursive: true });

      const scrapeOptions: Partial<ScrapeOptions> = {
        render: options.render !== false,
        waitTime: parseInt(options.waitTime, 10),
        maxDepth: parseInt(options.maxDepth, 10),
        timeout: parseInt(options.timeout, 10),
      };

      const results = await scraper.scrapeBatch(urls, scrapeOptions);
      
      await scraper.close();

      // Save results
      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        const url = new URL(data.url);
        const filename = `${i + 1}_${url.hostname.replace(/\./g, '_')}.${options.format === 'markdown' ? 'md' : 'json'}`;
        const outputPath = path.join(outputDir, filename);

        if (options.format === 'markdown') {
          const markdown = `# ${data.title || 'Untitled'}\n\n` +
            (data.author ? `**Author:** ${data.author}\n\n` : '') +
            (data.publishDate ? `**Published:** ${data.publishDate}\n\n` : '') +
            `**URL:** ${data.url}\n\n` +
            `---\n\n${data.markdown || data.content}\n`;
          await fs.writeFile(outputPath, markdown, 'utf-8');
        } else {
          await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
        }
      }

      console.log(`✓ Scraped ${results.length} URLs. Results saved to ${outputDir}`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start the REST API server')
  .option('-p, --port <number>', 'Port number', '3000')
  .option('--host <host>', 'Host address', '0.0.0.0')
  .action(async (options) => {
    const { startServer } = await import('./api');
    const port = parseInt(options.port, 10);
    const host = options.host;
    
    await startServer(port, host);
    console.log(`OpenScrape API server running on http://${host}:${port}`);
    console.log(`WebSocket (real-time job updates): ws://${host === '0.0.0.0' ? 'localhost' : host}:${port}/ws`);
  });

program.parse();
