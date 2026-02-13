# OpenScrape

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

OpenScrape is a fully open-source web scraping library that mimics the core features of commercial scraping APIs. Built with TypeScript for Node.js 18+, it provides headless browser rendering, automatic pagination detection, clean data extraction, and both CLI and REST API interfaces.

## Features

- 🚀 **Headless Browser Rendering** - Full JavaScript rendering using Playwright
- 📄 **Pagination & Navigation** - Automatic detection of "next" links and "load more" buttons
- 🧹 **Data Extraction & Normalization** - Clean markdown or JSON output with noise removal
- ⚡ **Rate Limiting & Concurrency** - Safe request throttling with exponential backoff
- 🖥️ **CLI Interface** - Easy-to-use command-line tools
- 🌐 **REST API** - HTTP endpoints for programmatic access
- 🔧 **Extensible** - Custom extraction schemas and pagination callbacks

## Installation

```bash
npm install openscrape
```

Or install globally for CLI usage:

```bash
npm install -g openscrape
```

**Important:** After installation, you need to install Playwright browsers:

```bash
npx playwright install chromium
```

This downloads the Chromium browser required for headless rendering.

## Quick Start

### CLI Usage

Scrape a single URL:

```bash
openscrape crawl https://example.com/article --output article.json
```

Scrape multiple URLs from a file:

```bash
openscrape batch urls.txt --output-dir ./scraped --format markdown
```

Start the API server:

```bash
openscrape serve --port 3000
```

### Programmatic Usage

```typescript
import { OpenScrape } from 'openscrape';

const scraper = new OpenScrape();

// Scrape a single URL
const data = await scraper.scrape({
  url: 'https://example.com/article',
  render: true,
  format: 'json',
  extractImages: true,
});

console.log(data.title);
console.log(data.content);
console.log(data.markdown);

await scraper.close();
```

### REST API

Start the server:

```bash
openscrape serve
```

Scrape a URL:

```bash
curl -X POST http://localhost:3000/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

Check job status:

```bash
curl http://localhost:3000/status/{jobId}
```

## Configuration

### Scrape Options

```typescript
interface ScrapeOptions {
  url: string;                    // URL to scrape (required)
  render?: boolean;                // Enable JS rendering (default: true)
  waitTime?: number;              // Wait time after load in ms (default: 2000)
  maxDepth?: number;              // Max pagination depth (default: 10)
  nextSelector?: string;          // Custom CSS selector for next link
  paginationCallback?: Function;  // Custom pagination detection
  format?: 'markdown' | 'json';   // Output format (default: 'json')
  extractionSchema?: object;      // Custom extraction schema
  userAgent?: string;             // Custom user agent
  timeout?: number;               // Request timeout in ms (default: 30000)
  extractImages?: boolean;        // Extract images (default: true)
  extractMedia?: boolean;         // Extract embedded media (default: false)
}
```

### Custom Extraction Schema

```typescript
const schema = {
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
      name: 'views',
      selector: '.views',
      transform: (value: string) => parseInt(value, 10),
    },
  ],
};

const data = await scraper.scrape({
  url: 'https://example.com/article',
  extractionSchema: schema,
});
```

### Rate Limiting

```typescript
const scraper = new OpenScrape({
  maxRequestsPerSecond: 5,
  maxConcurrency: 3,
});
```

## CLI Commands

### `crawl <URL>`

Scrape a single URL and save to file.

**Options:**
- `-o, --output <path>` - Output file path (default: `output.json`)
- `--no-render` - Disable JavaScript rendering
- `--format <format>` - Output format: `json` or `markdown` (default: `json`)
- `--wait-time <ms>` - Wait time after page load (default: `2000`)
- `--max-depth <number>` - Maximum pagination depth (default: `10`)
- `--next-selector <selector>` - CSS selector for next link
- `--timeout <ms>` - Request timeout (default: `30000`)
- `--user-agent <ua>` - Custom user agent string

**Example:**
```bash
openscrape crawl https://example.com/article \
  --output article.md \
  --format markdown \
  --max-depth 5
```

### `batch <file>`

Scrape multiple URLs from a file (one URL per line).

**Options:**
- `-o, --output-dir <path>` - Output directory (default: `./output`)
- `--no-render` - Disable JavaScript rendering
- `--format <format>` - Output format: `json` or `markdown` (default: `json`)
- `--wait-time <ms>` - Wait time after page load (default: `2000`)
- `--max-depth <number>` - Maximum pagination depth (default: `10`)
- `--timeout <ms>` - Request timeout (default: `30000`)
- `--max-concurrency <number>` - Maximum concurrent requests (default: `3`)

**Example:**
```bash
openscrape batch urls.txt \
  --output-dir ./scraped \
  --format markdown \
  --max-concurrency 5
```

### `serve`

Start the REST API server.

**Options:**
- `-p, --port <number>` - Port number (default: `3000`)
- `--host <host>` - Host address (default: `0.0.0.0`)

**Example:**
```bash
openscrape serve --port 8080
```

## REST API Endpoints

### `POST /crawl`

Scrape a URL asynchronously.

**Request:**
```json
{
  "url": "https://example.com/article",
  "options": {
    "render": true,
    "format": "json",
    "maxDepth": 5
  }
}
```

**Response:**
```json
{
  "jobId": "uuid-here",
  "status": "pending",
  "url": "https://example.com/article"
}
```

### `GET /status/:jobId`

Get the status and result of a crawl job.

**Response:**
```json
{
  "id": "uuid-here",
  "status": "completed",
  "url": "https://example.com/article",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:00:05.000Z",
  "result": {
    "url": "https://example.com/article",
    "title": "Article Title",
    "content": "...",
    "markdown": "...",
    "timestamp": "2024-01-01T00:00:05.000Z"
  }
}
```

### `GET /jobs`

List all crawl jobs.

### `GET /health`

Health check endpoint.

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
git clone https://github.com/yourusername/openscrape.git
cd openscrape
npm install
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Lint

```bash
npm run lint
```


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by Firecrawl API
- Built with [Playwright](https://playwright.dev/)
- Uses [Turndown](https://github.com/mixmark-io/turndown) for HTML to Markdown conversion

## Roadmap

- [ ] Browserless.com integration
- [ ] AWS Lambda support
- [ ] Proxy rotation
- [ ] User-agent randomization
- [ ] Plugin system for custom extraction logic
- [ ] GraphQL API support
- [ ] WebSocket support for real-time updates
