/**
 * The version this Worker reports as its MCP server version.
 *
 * A Worker has no filesystem, so it cannot read its own package.json at
 * runtime. `pnpm test` asserts this constant matches the package manifest.
 */
export const WORKER_VERSION = '1.0.0';
