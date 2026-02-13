/**
 * Proxy parsing and rotation for OpenScrape.
 * Supports http://user:pass@host:port, socks5://host:port, and residential proxy lists.
 */

/** Playwright-compatible proxy config */
export interface PlaywrightProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

/**
 * Parse a proxy string into Playwright format.
 * Supports: http://host:port, https://host:port, socks5://host:port,
 * and auth: http://user:pass@host:port, socks5://user:pass@host:port.
 */
export function parseProxyString(proxyString: string): PlaywrightProxyConfig {
  const s = proxyString.trim();
  if (!s) throw new Error('Empty proxy string');

  // Ensure protocol for URL parsing (default http)
  let urlInput = s;
  if (!/^[\w+.-]+:\/\//i.test(s)) urlInput = `http://${s}`;

  let url: URL;
  try {
    url = new URL(urlInput);
  } catch {
    throw new Error(`Invalid proxy URL: ${proxyString}`);
  }

  const protocol = url.protocol.replace(/:$/, '').toLowerCase();
  if (!['http', 'https', 'socks5'].includes(protocol)) {
    throw new Error(`Unsupported proxy protocol: ${protocol}. Use http, https, or socks5`);
  }

  const port = url.port || (protocol === 'https' ? '443' : protocol === 'socks5' ? '1080' : '80');
  const server = `${protocol}://${url.hostname}:${port}`;
  const username = url.username ? decodeURIComponent(url.username) : undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;

  return { server, username: username || undefined, password: password || undefined };
}

/**
 * Normalize proxy input (string or array) into an array of PlaywrightProxyConfig.
 */
export function normalizeProxyInput(proxy: string | string[]): PlaywrightProxyConfig[] {
  const list = Array.isArray(proxy) ? proxy : [proxy];
  return list.map((p) => parseProxyString(p));
}

/**
 * Round-robin proxy pool with optional retry-on-failure (403/429/timeout).
 * getNext() returns the next proxy in rotation.
 */
export class ProxyPool {
  private configs: PlaywrightProxyConfig[];
  private index: number = 0;

  constructor(proxy: string | string[]) {
    this.configs = normalizeProxyInput(proxy);
    if (this.configs.length === 0) throw new Error('At least one proxy is required');
  }

  /** Get the next proxy in rotation (round-robin). */
  getNext(): PlaywrightProxyConfig {
    const config = this.configs[this.index % this.configs.length];
    this.index += 1;
    return config;
  }

  /** Number of proxies in the pool. */
  get size(): number {
    return this.configs.length;
  }

  /** Reset rotation index (e.g. before a new retry cycle). */
  reset(): void {
    this.index = 0;
  }
}
