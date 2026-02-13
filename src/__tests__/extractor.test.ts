/**
 * Tests for DataExtractor
 */

import { DataExtractor } from '../extractor';
import { ExtractionSchema } from '../types';

describe('DataExtractor', () => {
  let extractor: DataExtractor;

  beforeEach(() => {
    extractor = new DataExtractor();
  });

  test('should extract title from HTML', () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <article>
            <h1>Article Title</h1>
            <p>Article content here.</p>
          </article>
        </body>
      </html>
    `;

    const result = extractor.extract(html, 'https://example.com');
    expect(result.title).toBe('Test Page');
    expect(result.content).toContain('Article Title');
  });

  test('should extract content from article tag', () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Main Article</h1>
            <p>This is the main content.</p>
          </article>
          <nav>Navigation</nav>
        </body>
      </html>
    `;

    const result = extractor.extract(html, 'https://example.com');
    expect(result.content).toContain('Main Article');
    expect(result.content).toContain('main content');
    expect(result.content).not.toContain('Navigation');
  });

  test('should convert HTML to markdown', () => {
    const html = `
      <article>
        <h1>Heading</h1>
        <p>Paragraph text.</p>
      </article>
    `;

    const result = extractor.extract(html, 'https://example.com');
    expect(result.markdown).toBeDefined();
    expect(result.markdown).toContain('# Heading');
    expect(result.markdown).toContain('Paragraph text');
  });

  test('should extract images', () => {
    const html = `
      <article>
        <img src="https://example.com/image1.jpg" alt="Image 1" />
        <img src="https://example.com/image2.png" alt="Image 2" />
      </article>
    `;

    const result = extractor.extract(html, 'https://example.com', true);
    expect(result.images).toHaveLength(2);
    expect(result.images).toContain('https://example.com/image1.jpg');
    expect(result.images).toContain('https://example.com/image2.png');
  });

  test('should use custom extraction schema', () => {
    const schema: ExtractionSchema = {
      title: '.custom-title',
      author: '.author-name',
      content: '.main-content',
    };

    const html = `
      <html>
        <body>
          <div class="custom-title">Custom Title</div>
          <div class="author-name">John Doe</div>
          <div class="main-content">Main content here.</div>
        </body>
      </html>
    `;

    const customExtractor = new DataExtractor(schema);
    const result = customExtractor.extract(html, 'https://example.com');
    
    expect(result.title).toBe('Custom Title');
    expect(result.author).toBe('John Doe');
    expect(result.content).toContain('Main content here');
  });

  test('should extract metadata with custom rules', () => {
    const schema: ExtractionSchema = {
      custom: [
        {
          name: 'category',
          selector: '.category',
        },
        {
          name: 'views',
          selector: '.views',
          transform: (value) => parseInt(value, 10),
        },
      ],
    };

    const html = `
      <html>
        <body>
          <div class="category">Technology</div>
          <div class="views">1234</div>
        </body>
      </html>
    `;

    const customExtractor = new DataExtractor(schema);
    const result = customExtractor.extract(html, 'https://example.com');
    
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.category).toBe('Technology');
    expect(result.metadata?.views).toBe(1234);
  });

  test('should remove noise elements', () => {
    const html = `
      <html>
        <body>
          <nav>Navigation</nav>
          <header>Header</header>
          <article>
            <h1>Article Title</h1>
            <p>Content</p>
          </article>
          <footer>Footer</footer>
          <div class="ad">Advertisement</div>
        </body>
      </html>
    `;

    const result = extractor.extract(html, 'https://example.com');
    expect(result.content).toContain('Article Title');
    expect(result.content).toContain('Content');
    expect(result.content).not.toContain('Navigation');
    expect(result.content).not.toContain('Advertisement');
  });
});
