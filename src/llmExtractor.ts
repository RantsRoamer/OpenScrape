/**
 * LLM-based extraction: send cleaned HTML/Markdown to Ollama or LM Studio, get structured JSON
 */

import type { ScrapedData } from './types';

const DEFAULT_OLLAMA = 'http://localhost:11434';

const EXTRACT_PROMPT = `You are a web scraping assistant. Extract structured data from the following web page content.
Return ONLY a valid JSON object with these keys (use null for missing): title, author, publishDate, content (plain text summary or main body), metadata (object for any other fields).
No markdown, no explanation, only the JSON object.`;

/**
 * Call Ollama /api/generate or LM Studio /v1/chat/completions and parse JSON from response
 */
export async function extractWithLlm(
  content: string,
  options: {
    endpoint?: string;
    model?: string;
    timeout?: number;
    useMarkdown?: boolean;
  } = {}
): Promise<Partial<ScrapedData>> {
  const endpoint = (options.endpoint ?? DEFAULT_OLLAMA).replace(/\/$/, '');
  const model = options.model ?? 'llama2';
  const timeout = options.timeout ?? 60000;
  const body = options.useMarkdown
    ? `${EXTRACT_PROMPT}\n\n## Markdown content:\n${content.slice(0, 12000)}`
    : `${EXTRACT_PROMPT}\n\n## HTML content:\n${content.slice(0, 12000)}`;

  const isLmStudio = endpoint.includes('1234') || endpoint.includes('/v1');
  const url = isLmStudio ? `${endpoint.replace(/\/v1.*$/, '')}/v1/chat/completions` : `${endpoint}/api/generate`;
  const payload = isLmStudio
    ? {
        model: options.model ?? 'local',
        messages: [{ role: 'user', content: body }],
        max_tokens: 2048,
      }
    : { model, prompt: body, stream: false };

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(to);
    if (!res.ok) throw new Error(`LLM endpoint ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const raw = isLmStudio ? json.choices?.[0]?.message?.content : json.response;
    if (!raw || typeof raw !== 'string') throw new Error('No text in LLM response');
    const parsed = parseJsonFromText(raw);
    return normalizeLlmResult(parsed);
  } catch (e) {
    if (e instanceof Error) throw new Error(`LLM extraction failed: ${e.message}`);
    throw e;
  }
}

function parseJsonFromText(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}') + 1;
  if (start === -1 || end <= start) throw new Error('No JSON object in response');
  const str = raw.slice(start, end);
  return JSON.parse(str) as Record<string, unknown>;
}

function normalizeLlmResult(parsed: Record<string, unknown>): Partial<ScrapedData> {
  const out: Partial<ScrapedData> = {};
  if (typeof parsed.title === 'string') out.title = parsed.title;
  if (typeof parsed.author === 'string') out.author = parsed.author;
  if (typeof parsed.publishDate === 'string') out.publishDate = parsed.publishDate;
  if (typeof parsed.content === 'string') out.content = parsed.content;
  if (parsed.metadata && typeof parsed.metadata === 'object' && !Array.isArray(parsed.metadata)) {
    out.metadata = parsed.metadata as Record<string, unknown>;
  }
  return out;
}
