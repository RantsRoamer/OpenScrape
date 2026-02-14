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
- 📡 **WebSocket** - Real-time job status updates over WebSocket
- 📁 **Media handling** - Download images to an organized folder; optional base64-embed small images in JSON
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

### Docker

You can run OpenScrape in a container with no local Node or Playwright install.

**Build the image:**

```bash
docker build -t openscrape .
```

**Run the API server** (default; port 3000):

```bash
docker run -p 3000:3000 --init openscrape
```

Or with Docker Compose:

```bash
docker compose up --build
```

Then scrape via the API:

```bash
curl -X POST http://localhost:3000/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

**Use the CLI inside the container** (crawl a URL, write output to a mounted volume):

```bash
docker run --rm -v "$(pwd)/out:/out" openscrape crawl https://example.com/article -o /out/article.json
```

**Batch scrape** (mount a file with URLs and an output directory):

```bash
docker run --rm -v "$(pwd)/urls.txt:/app/urls.txt" -v "$(pwd)/scraped:/out" openscrape batch /app/urls.txt --output-dir /out --format markdown
```

**Custom command** (override the default `serve`):

```bash
docker run --rm openscrape crawl https://example.com -o /tmp/out.json --format json
```

The image includes Chromium and its dependencies; the default command is `serve --port 3000 --host 0.0.0.0`. Use `--init` to avoid zombie processes. For large workloads, you may need to increase memory for the container.

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

### WebSocket (real-time updates)

When you run `openscrape serve`, the server also exposes a WebSocket endpoint at path `/ws`. Connect to receive real-time events for crawl jobs.

**Endpoint:** `ws://localhost:3000/ws` (or `wss://` in production with TLS)

**Subscribe to a job:** Send a JSON message:

```json
{ "type": "subscribe", "jobId": "<jobId>" }
```

**Unsubscribe:**

```json
{ "type": "unsubscribe", "jobId": "<jobId>" }
```

**Server events** (you receive JSON):

| Event            | When                    |
|------------------|-------------------------|
| `job:created`    | A new crawl job was created |
| `job:processing` | Scraping has started    |
| `job:completed`  | Scraping finished; `job.result` has the data |
| `job:failed`     | Scraping failed; `job.error` has the message |

**Example message:**

```json
{
  "event": "job:completed",
  "jobId": "abc-123",
  "job": {
    "id": "abc-123",
    "url": "https://example.com/article",
    "status": "completed",
    "result": { "url": "...", "title": "...", "content": "...", "markdown": "..." },
    "createdAt": "2025-01-15T12:00:00.000Z",
    "completedAt": "2025-01-15T12:00:05.000Z"
  },
  "timestamp": "2025-01-15T12:00:05.000Z"
}
```

**Minimal client example (Node):**

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  // First POST /crawl to get jobId, then:
  ws.send(JSON.stringify({ type: 'subscribe', jobId: 'YOUR_JOB_ID' }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log(msg.event, msg.job?.status, msg.job?.result?.title);
});
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
  format?: 'json' | 'markdown' | 'html' | 'text' | 'csv' | 'yaml';  // Output format (default: 'json')
  extractionSchema?: object;      // Custom extraction schema
  autoDetectSchema?: boolean;     // Auto-detect schema from page (opt-in)
  schemaSamples?: string[];       // Sample URLs for schema detection (optional)
  llmExtract?: boolean;           // Use local LLM to extract structured JSON
  llmEndpoint?: string;           // Ollama or LM Studio endpoint URL
  llmModel?: string;              // Model name (default: 'llama2')
  userAgent?: string;             // Custom user agent
  proxy?: string | string[];      // Override proxy for this request (single URL or list for rotation)
  timeout?: number;               // Request timeout in ms (default: 30000)
  extractImages?: boolean;        // Extract images (default: true)
  extractMedia?: boolean;         // Extract embedded media (default: false)
  downloadMedia?: boolean;       // Download images to a local folder (default: false)
  mediaOutputDir?: string;       // Folder for downloads (default: ./media)
  base64EmbedImages?: boolean;   // Embed small images as base64 in JSON (default: false)
  base64EmbedMaxBytes?: number;  // Max size for embedding in bytes (default: 51200)
}
```

### Media & asset handling

You can save images (and other assets) locally and optionally embed small images as base64 in JSON.

**Download media to a folder** (organized by site and path):

```bash
openscrape crawl https://example.com/article --output article.json --download-media --media-dir ./media
```

Folder structure: `mediaOutputDir / hostname / path_slug / image_0.jpg`, e.g. `./media/example.com/article/image_0.jpg`.

**Base64-embed small images in JSON** (for self-contained output or small thumbnails):

```bash
openscrape crawl https://example.com/article --output article.json --embed-images --embed-images-max-size 51200
```

- Only images under the size limit (default 50KB) are embedded.
- Result includes `mediaEmbedded`: `[{ url, dataUrl, mimeType }]` with `data:image/...;base64,...` URLs.

**Programmatic usage:**

```typescript
const data = await scraper.scrape({
  url: 'https://example.com/article',
  downloadMedia: true,
  mediaOutputDir: './media',
  base64EmbedImages: true,
  base64EmbedMaxBytes: 51200,
});
// data.images       → original URLs
// data.mediaDownloads → [{ url, localPath, mimeType }]
// data.mediaEmbedded  → [{ url, dataUrl, mimeType }]
```

### Output formats

Besides `json` and `markdown`, OpenScrape can output:

| Format   | Use case |
|----------|----------|
| **html** | Cleaned HTML (no scripts/nav); good for archiving or re-rendering. |
| **text** | Plain text only; good for search indexes or NLP. |
| **csv**  | List/table-like pages: first `<table>` as rows; otherwise one row with url, title, author, content. |
| **yaml** | Full structured data (url, title, author, content, images, etc.) in YAML. |

**Examples:**

```bash
openscrape crawl https://example.com/article -o page.html --format html
openscrape crawl https://example.com/table -o data.csv --format csv
openscrape crawl https://example.com/article -o meta.yaml --format yaml
```

Programmatic usage: the scraper always returns full `ScrapedData`; use the formatters for string output:

```typescript
import { OpenScrape, toHtml, toText, toCsv, toYaml } from 'openscrape';

const scraper = new OpenScrape();
const data = await scraper.scrape({ url: 'https://example.com/article' });
await scraper.close();

const htmlString = toHtml(data);
const textString = toText(data);
const csvString = toCsv(data);
const yamlString = toYaml(data);
```

### LLM-based extraction (Ollama / LM Studio)

You can send the cleaned HTML or Markdown to a local LLM and get structured JSON (title, author, publishDate, content, metadata). Useful when pages have irregular structure.

**Requirements:** A local endpoint such as [Ollama](https://ollama.ai) or [LM Studio](https://lmstudio.ai).

**CLI:**

```bash
# Ollama (default endpoint http://localhost:11434)
openscrape crawl https://example.com/article -o out.json --llm-extract --llm-model llama2

# Custom Ollama or LM Studio endpoint
openscrape crawl https://example.com/article -o out.json --llm-extract \
  --llm-endpoint http://localhost:1234/v1 --llm-model my-model
```

**Programmatic:**

```typescript
const data = await scraper.scrape({
  url: 'https://example.com/article',
  llmExtract: true,
  llmEndpoint: 'http://localhost:11434',  // Ollama
  llmModel: 'llama2',
});
// data is merged with LLM-extracted fields; on error, data.metadata.llmError is set
```

- **Ollama:** use base URL (e.g. `http://localhost:11434`); the client calls `/api/generate`.
- **LM Studio:** use the chat completions URL (e.g. `http://localhost:1234/v1`); the client calls `/v1/chat/completions`.

### Auto-detect schema (opt-in)

With `autoDetectSchema: true`, OpenScrape infers an extraction schema from the page (e.g. title from `<title>` or `og:title`, content from `article` or `.content`). Use it when you don’t have a custom schema.

**CLI:**

```bash
openscrape crawl https://example.com/article -o out.json --auto-detect-schema
```

**Programmatic:**

```typescript
const data = await scraper.scrape({
  url: 'https://example.com/article',
  autoDetectSchema: true,
});
```

You can also use the schema detector directly:

```typescript
import { detectSchemaFromHtml } from 'openscrape';

const { schema, confidence, suggestions } = detectSchemaFromHtml(htmlString);
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

### Proxy support (rotating & residential)

Use a single proxy or a list for **round-robin rotation**. Supports **auth** (`http://user:pass@host:port`), **SOCKS5** (`socks5://host:port`), and residential proxy lists.

- **Constructor:** set a default proxy for all scrapes (single URL or array).
- **Per-scrape:** override with `options.proxy` for that request.
- **Retries:** on **403**, **429**, or **timeout**, the next proxy in the list is tried automatically.

**Formats:**

- `http://host:port` or `https://host:port`
- `http://user:pass@host:port` (auth)
- `socks5://host:port` or `socks5://user:pass@host:port`

**CLI:**

```bash
# Single proxy
openscrape crawl https://example.com --proxy http://user:pass@proxy.example.com:8080 -o out.json

# Rotating list (comma-separated)
openscrape crawl https://example.com --proxy "http://p1:8080,http://p2:8080,socks5://p3:1080" -o out.json

# Batch with proxy list
openscrape batch urls.txt --proxy "http://user:pass@residential.example.com:8080" --output-dir ./out
```

**Programmatic:**

```typescript
// Single proxy or rotating list at construction
const scraper = new OpenScrape({
  proxy: 'http://user:pass@proxy.example.com:8080',
  maxConcurrency: 3,
});

// Or pass an array for rotation
const scraper = new OpenScrape({
  proxy: ['http://p1:8080', 'socks5://p2:1080', 'http://user:pass@p3:8080'],
});

// Per-scrape override
const data = await scraper.scrape({
  url: 'https://example.com',
  proxy: 'socks5://localhost:1080',
});
```

**Low-level:** use `parseProxyString()`, `normalizeProxyInput()`, and `ProxyPool` from the package for custom rotation logic.

## CLI Commands

### `crawl <URL>`

Scrape a single URL and save to file.

**Options:**
- `-o, --output <path>` - Output file path (default: `output.json`)
- `--no-render` - Disable JavaScript rendering
- `--format <format>` - Output format: `json`, `markdown`, `html`, `text`, `csv`, or `yaml` (default: `json`)
- `--wait-time <ms>` - Wait time after page load (default: `2000`)
- `--max-depth <number>` - Maximum pagination depth (default: `10`)
- `--next-selector <selector>` - CSS selector for next link
- `--timeout <ms>` - Request timeout (default: `30000`)
- `--user-agent <ua>` - Custom user agent string
- `--llm-extract` - Use local LLM (Ollama/LM Studio) to extract structured data
- `--llm-endpoint <url>` - LLM endpoint (e.g. `http://localhost:11434` for Ollama)
- `--llm-model <name>` - Model name for LLM extraction (default: `llama2`)
- `--auto-detect-schema` - Auto-detect extraction schema from the page
- `--proxy <url>` - Proxy URL or comma-separated list for rotation (`http://user:pass@host:port`, `socks5://host:port`)

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
- `--format <format>` - Output format: `json`, `markdown`, `html`, `text`, `csv`, or `yaml` (default: `json`)
- `--wait-time <ms>` - Wait time after page load (default: `2000`)
- `--max-depth <number>` - Maximum pagination depth (default: `10`)
- `--timeout <ms>` - Request timeout (default: `30000`)
- `--max-concurrency <number>` - Maximum concurrent requests (default: `3`)
- `--llm-extract` - Use local LLM to extract structured data per URL
- `--llm-endpoint <url>` - LLM endpoint URL
- `--llm-model <name>` - Model name (default: `llama2`)
- `--auto-detect-schema` - Auto-detect extraction schema from each page
- `--proxy <url>` - Proxy URL or comma-separated list for rotation

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

### `GET /about`

Credits and repository info. Returns: `{ name, version, by, repository }` (e.g. by: John F. Gonzales, repository: https://github.com/RantsRoamer/OpenScrape).

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



