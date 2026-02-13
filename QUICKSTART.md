# Quick Start Guide

## Installation

```bash
npm install openscrape
```

Or install globally:

```bash
npm install -g openscrape
```

## CLI Examples

### Scrape a single article

```bash
openscrape crawl https://example.com/article --output article.json
```

### Scrape and convert to markdown

```bash
openscrape crawl https://example.com/article --output article.md --format markdown
```

### Batch scraping

Create a file `urls.txt`:
```
https://example.com/article1
https://example.com/article2
https://example.com/article3
```

Then run:
```bash
openscrape batch urls.txt --output-dir ./scraped --format markdown
```

### Start API server

```bash
openscrape serve --port 3000
```

## Programmatic Usage

```typescript
import { OpenScrape } from 'openscrape';

const scraper = new OpenScrape();

const data = await scraper.scrape({
  url: 'https://example.com/article',
  render: true,
  format: 'json',
});

console.log(data.title);
console.log(data.markdown);

await scraper.close();
```

## API Usage

Start the server:
```bash
openscrape serve
```

Scrape via API:
```bash
curl -X POST http://localhost:3000/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

Check status:
```bash
curl http://localhost:3000/status/{jobId}
```

## Custom Extraction

```typescript
const schema = {
  title: '.article-title',
  author: '.author-name',
  content: '.article-body',
};

const data = await scraper.scrape({
  url: 'https://example.com/article',
  extractionSchema: schema,
});
```

## Rate Limiting

```typescript
const scraper = new OpenScrape({
  maxRequestsPerSecond: 5,
  maxConcurrency: 3,
});
```
