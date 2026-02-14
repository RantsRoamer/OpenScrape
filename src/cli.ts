#!/usr/bin/env node

/**
 * Command-line interface for OpenScrape
 */

import { readFileSync } from 'fs';
import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { OpenScrape } from './scraper';
import { ScrapeOptions } from './types';
import { toHtml, toText, toCsv, toYaml } from './formatters';
import { ABOUT, getAboutInfo } from './about';

const packageJson = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
) as { version: string };
const version = packageJson.version ?? '1.0.0';

const program = new Command();

program
  .name('openscrape')
  .description('Open-source web scraping library. By: ' + ABOUT.by + ' | ' + ABOUT.repository)
  .version(version);

program
  .command('crawl')
  .description('Scrape a single URL')
  .argument('<url>', 'URL to scrape')
  .option('-o, --output <path>', 'Output file path', 'output.json')
  .option('--no-render', 'Disable JavaScript rendering')
  .option('--format <format>', 'Output format: json|markdown|html|text|csv|yaml', 'json')
  .option('--wait-time <ms>', 'Wait time after page load (ms)', '2000')
  .option('--max-depth <number>', 'Maximum pagination depth', '10')
  .option('--next-selector <selector>', 'CSS selector for next link')
  .option('--timeout <ms>', 'Request timeout (ms)', '30000')
  .option('--user-agent <ua>', 'Custom user agent string')
  .option('--download-media', 'Download images to a local folder (organized by site/path)')
  .option('--media-dir <path>', 'Directory for downloaded media (default: ./media)', './media')
  .option('--embed-images', 'Base64-embed small images in JSON output')
  .option('--embed-images-max-size <bytes>', 'Max size in bytes for embedded images (default: 51200)', '51200')
  .option('--llm-extract', 'Use local LLM (Ollama/LM Studio) to extract structured JSON')
  .option('--llm-endpoint <url>', 'LLM endpoint (e.g. http://localhost:11434 for Ollama)')
  .option('--llm-model <name>', 'Model name (e.g. llama2)', 'llama2')
  .option('--auto-detect-schema', 'Auto-detect extraction schema from the page (opt-in)')
  .option('--proxy <url>', 'Proxy URL (or comma-separated list for rotation). Supports http://user:pass@host:port and socks5://host:port')
  .action(async (url: string, options) => {
    try {
      const proxyInput = options.proxy ? (options.proxy.includes(',') ? options.proxy.split(',').map((p: string) => p.trim()).filter(Boolean) : options.proxy) : undefined;
      const scraper = new OpenScrape(proxyInput ? { proxy: proxyInput } : undefined);

      const format = ['json', 'markdown', 'html', 'text', 'csv', 'yaml'].includes(options.format) ? options.format : 'json';
      const scrapeOptions: ScrapeOptions = {
        url,
        render: options.render !== false,
        format: format as ScrapeOptions['format'],
        waitTime: parseInt(options.waitTime, 10),
        maxDepth: parseInt(options.maxDepth, 10),
        nextSelector: options.nextSelector,
        timeout: parseInt(options.timeout, 10),
        userAgent: options.userAgent,
        proxy: proxyInput,
        downloadMedia: options.downloadMedia === true,
        mediaOutputDir: options.mediaDir,
        base64EmbedImages: options.embedImages === true,
        base64EmbedMaxBytes: parseInt(options.embedImagesMaxSize, 10) || 51200,
        llmExtract: options.llmExtract === true,
        llmEndpoint: options.llmEndpoint,
        llmModel: options.llmModel,
        autoDetectSchema: options.autoDetectSchema === true,
      };

      console.log(`Scraping ${url}...`);
      const data = await scraper.scrape(scrapeOptions);
      
      await scraper.close();

      // Write output
      const outputPath = path.resolve(options.output);
      const outputDir = path.dirname(outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      const fmt = format;
      if (fmt === 'markdown') {
        const markdown = `# ${data.title || 'Untitled'}\n\n` +
          (data.author ? `**Author:** ${data.author}\n\n` : '') +
          (data.publishDate ? `**Published:** ${data.publishDate}\n\n` : '') +
          `**URL:** ${data.url}\n\n` +
          `---\n\n${data.markdown || data.content}\n`;
        await fs.writeFile(outputPath, markdown, 'utf-8');
      } else if (fmt === 'html') {
        await fs.writeFile(outputPath, toHtml(data), 'utf-8');
      } else if (fmt === 'text') {
        await fs.writeFile(outputPath, toText(data), 'utf-8');
      } else if (fmt === 'csv') {
        await fs.writeFile(outputPath, toCsv(data), 'utf-8');
      } else if (fmt === 'yaml') {
        await fs.writeFile(outputPath, toYaml(data), 'utf-8');
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
  .option('--format <format>', 'Output format: json|markdown|html|text|csv|yaml', 'json')
  .option('--wait-time <ms>', 'Wait time after page load (ms)', '2000')
  .option('--max-depth <number>', 'Maximum pagination depth', '10')
  .option('--timeout <ms>', 'Request timeout (ms)', '30000')
  .option('--max-concurrency <number>', 'Maximum concurrent requests', '3')
  .option('--download-media', 'Download images to a local folder')
  .option('--media-dir <path>', 'Directory for downloaded media (default: <output-dir>/media)', '')
  .option('--embed-images', 'Base64-embed small images in JSON output')
  .option('--embed-images-max-size <bytes>', 'Max size in bytes for embedded images (default: 51200)', '51200')
  .option('--llm-extract', 'Use local LLM (Ollama/LM Studio) to extract structured data')
  .option('--llm-endpoint <url>', 'LLM endpoint (e.g. http://localhost:11434 for Ollama)')
  .option('--llm-model <name>', 'Model name for LLM extraction', 'llama2')
  .option('--auto-detect-schema', 'Auto-detect extraction schema from each page')
  .option('--proxy <url>', 'Proxy URL or comma-separated list for rotation (http://user:pass@host:port, socks5://host:port)')
  .action(async (file: string, options) => {
    try {
      const proxyInput = options.proxy ? (options.proxy.includes(',') ? options.proxy.split(',').map((p: string) => p.trim()).filter(Boolean) : options.proxy) : undefined;
      const scraper = new OpenScrape({
        maxConcurrency: parseInt(options.maxConcurrency, 10),
        proxy: proxyInput,
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

      const mediaDir = options.mediaDir || path.join(outputDir, 'media');
      const batchFormat = ['json', 'markdown', 'html', 'text', 'csv', 'yaml'].includes(options.format) ? options.format : 'json';
      const scrapeOptions: Partial<ScrapeOptions> = {
        render: options.render !== false,
        format: batchFormat as ScrapeOptions['format'],
        waitTime: parseInt(options.waitTime, 10),
        maxDepth: parseInt(options.maxDepth, 10),
        timeout: parseInt(options.timeout, 10),
        downloadMedia: options.downloadMedia === true,
        mediaOutputDir: options.downloadMedia ? mediaDir : undefined,
        base64EmbedImages: options.embedImages === true,
        base64EmbedMaxBytes: parseInt(options.embedImagesMaxSize, 10) || 51200,
        llmExtract: options.llmExtract === true,
        llmEndpoint: options.llmEndpoint,
        llmModel: options.llmModel,
        autoDetectSchema: options.autoDetectSchema === true,
      };

      const results = await scraper.scrapeBatch(urls, scrapeOptions);
      
      await scraper.close();

      const extMap: Record<string, string> = { json: 'json', markdown: 'md', html: 'html', text: 'txt', csv: 'csv', yaml: 'yaml' };
      const ext = extMap[batchFormat] ?? 'json';
      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        const url = new URL(data.url);
        const filename = `${i + 1}_${url.hostname.replace(/\./g, '_')}.${ext}`;
        const outputPath = path.join(outputDir, filename);

        if (batchFormat === 'markdown') {
          const markdown = `# ${data.title || 'Untitled'}\n\n` +
            (data.author ? `**Author:** ${data.author}\n\n` : '') +
            (data.publishDate ? `**Published:** ${data.publishDate}\n\n` : '') +
            `**URL:** ${data.url}\n\n` +
            `---\n\n${data.markdown || data.content}\n`;
          await fs.writeFile(outputPath, markdown, 'utf-8');
        } else if (batchFormat === 'html') {
          await fs.writeFile(outputPath, toHtml(data), 'utf-8');
        } else if (batchFormat === 'text') {
          await fs.writeFile(outputPath, toText(data), 'utf-8');
        } else if (batchFormat === 'csv') {
          await fs.writeFile(outputPath, toCsv(data), 'utf-8');
        } else if (batchFormat === 'yaml') {
          await fs.writeFile(outputPath, toYaml(data), 'utf-8');
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
  .command('about')
  .description('Show credits and repository')
  .action(() => {
    const info = getAboutInfo(version);
    console.log(`${info.name} v${info.version}`);
    console.log(`By: ${info.by}`);
    console.log(info.repository);
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
