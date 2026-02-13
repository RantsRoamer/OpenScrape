# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage (bookworm full for Playwright system deps)
FROM node:20-bookworm AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev \
    && npx playwright install-deps chromium \
    && npx playwright install chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Default: run the API server. Override to use CLI (crawl, batch, etc.)
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["serve", "--port", "3000", "--host", "0.0.0.0"]
