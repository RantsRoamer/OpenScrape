/**
 * Jest setup: polyfill globals required by undici (cheerio dependency) on Node 18.
 * Node 20+ provides global File; Node 18 does not.
 */
if (typeof globalThis.File === 'undefined' && typeof globalThis.Blob !== 'undefined') {
  globalThis.File = class File extends globalThis.Blob {
    constructor(bits, name, options = {}) {
      super(bits, options);
      this.name = name || '';
      this.lastModified = options.lastModified ?? Date.now();
    }
  };
}
