# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added
- Initial release
- Headless browser rendering with Playwright
- Automatic pagination detection and navigation
- Data extraction with markdown/JSON output
- Rate limiting and concurrency control
- CLI interface with crawl, batch, and serve commands
- REST API with /crawl and /status endpoints
- Custom extraction schemas
- Noise removal (ads, navigation, etc.)
- Image extraction
- Comprehensive test suite
- Full TypeScript support
- MIT license

### Features
- Single URL scraping
- Batch URL processing
- Configurable pagination depth
- Custom CSS selectors for extraction
- User-agent customization
- Request timeout configuration
- Exponential backoff on rate limits
