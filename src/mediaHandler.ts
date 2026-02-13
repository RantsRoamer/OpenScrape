/**
 * Media and asset handling: resolve URLs, download to folder, base64-embed small images
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { MediaDownload, MediaEmbedded } from './types';

const DEFAULT_BASE64_MAX_BYTES = 51200; // 50KB

/**
 * Resolve a possibly relative URL against a base URL
 */
export function resolveUrl(baseUrl: string, href: string): string {
  if (!href || href.startsWith('data:')) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * Resolve multiple URLs against a base URL (deduplicated, absolute only)
 */
export function resolveImageUrls(baseUrl: string, urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const resolved = resolveUrl(baseUrl, u);
    if (resolved && !resolved.startsWith('data:') && !seen.has(resolved)) {
      seen.add(resolved);
      out.push(resolved);
    }
  }
  return out;
}

/**
 * Sanitize a string for use in a folder name
 */
function sanitizeForDir(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'index';
}

/**
 * Build a folder path from page URL: hostname + path slug
 */
function folderSlugForUrl(pageUrl: string): string {
  try {
    const u = new URL(pageUrl);
    const host = u.hostname.replace(/\./g, '_');
    const pathSlug = sanitizeForDir(u.pathname.slice(1).replace(/\//g, '_').slice(0, 80));
    return path.join(host, pathSlug || 'index');
  } catch {
    return 'media';
  }
}

/**
 * Get a safe filename from URL (preserve extension, avoid overwrites)
 */
function filenameFromUrl(url: string, index: number): string {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname) || `asset_${index}`;
    const ext = path.extname(base) || '';
    const name = path.basename(base, ext) || `asset_${index}`;
    const safe = sanitizeForDir(name).slice(0, 64);
    return `${safe}${ext}` || `asset_${index}`;
  } catch {
    return `asset_${index}`;
  }
}

/**
 * Download media URLs to a local folder with structure: outputDir / host_pathslug / filename
 */
export async function downloadMedia(
  urls: string[],
  pageUrl: string,
  outputDir: string,
  options: { userAgent?: string; timeout?: number } = {}
): Promise<MediaDownload[]> {
  const results: MediaDownload[] = [];
  const slug = folderSlugForUrl(pageUrl);
  const dir = path.join(outputDir, slug);
  await fs.mkdir(dir, { recursive: true });

  const { userAgent, timeout = 15000 } = options;
  const headers: Record<string, string> = {};
  if (userAgent) headers['User-Agent'] = userAgent;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(to);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = path.extname(new URL(url).pathname) || mimeToExt(contentType) || '';
      const filename = filenameFromUrl(url, i);
      const base = path.basename(filename, path.extname(filename));
      const ext2 = ext || path.extname(filename);
      const finalName = `${base}_${i}${ext2}`;
      const localPath = path.join(dir, finalName);
      await fs.writeFile(localPath, buffer);
      results.push({
        url,
        localPath: path.relative(outputDir, localPath),
        mimeType: contentType.split(';')[0].trim() || undefined,
      });
    } catch {
      // Skip failed downloads
    }
  }
  return results;
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
  };
  return map[mime.split(';')[0].trim()] || '';
}

/**
 * Fetch images and embed as base64 data URLs if under maxBytes
 */
export async function embedSmallImages(
  urls: string[],
  pageUrl: string,
  maxBytes: number = DEFAULT_BASE64_MAX_BYTES,
  options: { userAgent?: string; timeout?: number } = {}
): Promise<MediaEmbedded[]> {
  const results: MediaEmbedded[] = [];
  const { userAgent, timeout = 15000 } = options;
  const headers: Record<string, string> = {};
  if (userAgent) headers['User-Agent'] = userAgent;

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(to);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > maxBytes) continue;
      const contentType = res.headers.get('content-type')?.split(';')[0].trim() || 'image/png';
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;
      results.push({ url, dataUrl, mimeType: contentType });
    } catch {
      // Skip failed fetches
    }
  }
  return results;
}
