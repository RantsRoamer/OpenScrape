/**
 * Jest mock for Playwright. Avoids loading real Playwright (which uses dynamic
 * import and requires --experimental-vm-modules). API tests only need the app
 * to load; they don't run actual browser scraping.
 */

const noop = () => {};
const asyncNoop = async () => {};

const mockPage = {
  goto: asyncNoop,
  content: async () => '',
  close: asyncNoop,
  setExtraHTTPHeaders: asyncNoop,
  waitForTimeout: asyncNoop,
};

const mockBrowser = {
  newPage: async () => mockPage,
  close: asyncNoop,
};

const chromium = {
  launch: async () => mockBrowser,
};

module.exports = {
  chromium,
  firefox: { launch: async () => mockBrowser },
  webkit: { launch: async () => mockBrowser },
  // TypeScript expects Browser and Page as types; at runtime these are unused in the mock
  Browser: class Browser {},
  Page: class Page {},
};
