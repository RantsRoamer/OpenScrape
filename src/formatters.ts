/**
 * Output formatters: HTML, text, CSV, YAML
 */

import yaml from 'js-yaml';
import type { ScrapedData } from './types';

/** Serialize to cleaned HTML string */
export function toHtml(data: ScrapedData): string {
  return data.cleanedHtml ?? data.content ?? '';
}

/** Serialize to plain text */
export function toText(data: ScrapedData): string {
  if (data.text) return data.text;
  const content = data.content ?? '';
  return content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Serialize to CSV (from tableData if present, else single-row with main fields) */
export function toCsv(data: ScrapedData): string {
  const rows = data.tableData;
  if (rows && rows.length > 0) {
    return rows.map(row => row.map(cell => escapeCsvCell(cell)).join(',')).join('\n');
  }
  // Fallback: one row with key fields
  const headers = ['url', 'title', 'author', 'publishDate', 'content'];
  const values = [
    data.url ?? '',
    data.title ?? '',
    data.author ?? '',
    data.publishDate ?? '',
    (data.content ?? '').replace(/\s+/g, ' ').slice(0, 500),
  ];
  return [headers.join(','), values.map(escapeCsvCell).join(',')].join('\n');
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serialize to YAML (safe dump, no custom types) */
export function toYaml(data: ScrapedData): string {
  const obj: Record<string, unknown> = {
    url: data.url,
    title: data.title,
    author: data.author,
    publishDate: data.publishDate,
    content: data.content,
    markdown: data.markdown,
    text: data.text,
    images: data.images,
    metadata: data.metadata,
    timestamp: data.timestamp,
  };
  if (data.cleanedHtml) obj.cleanedHtml = data.cleanedHtml;
  if (data.tableData) obj.tableData = data.tableData;
  if (data.listItems) obj.listItems = data.listItems;
  if (data.mediaDownloads) obj.mediaDownloads = data.mediaDownloads;
  if (data.mediaEmbedded) obj.mediaEmbedded = data.mediaEmbedded?.map(e => ({ url: e.url, mimeType: e.mimeType }));
  return yaml.dump(obj, { lineWidth: -1, noRefs: true });
}
