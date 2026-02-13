# Contributing to OpenScrape

Thank you for your interest in contributing to OpenScrape! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/openscrape.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Building

```bash
npm run build
```

### Testing

Run tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Linting

Check code style:

```bash
npm run lint
```

Fix linting issues:

```bash
npm run lint:fix
```

## Making Changes

### Code Style

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small
- Write tests for new features

### Commit Messages

Use clear, descriptive commit messages:

```
feat: Add proxy rotation support
fix: Handle 429 responses correctly
docs: Update README with new examples
test: Add tests for pagination handler
refactor: Simplify rate limiter logic
```

### Pull Request Process

1. Ensure your code passes all tests
2. Ensure your code passes linting
3. Update documentation if needed
4. Add tests for new features
5. Update CHANGELOG.md with your changes
6. Create a pull request with a clear description

## Project Structure

```
openscrape/
├── src/
│   ├── __tests__/      # Test files
│   ├── api.ts          # REST API server
│   ├── cli.ts          # CLI interface
│   ├── extractor.ts    # Data extraction
│   ├── index.ts        # Main entry point
│   ├── pagination.ts   # Pagination handling
│   ├── rateLimiter.ts  # Rate limiting
│   ├── scraper.ts      # Core scraping engine
│   └── types.ts        # TypeScript types
├── dist/               # Compiled output
├── tests/              # Integration tests
└── docs/               # Documentation
```

## Areas for Contribution

- Bug fixes
- Performance improvements
- New features (see roadmap in README)
- Documentation improvements
- Test coverage
- Examples and tutorials

## Questions?

Feel free to open an issue for questions or discussions about contributions.

Thank you for contributing to OpenScrape!
