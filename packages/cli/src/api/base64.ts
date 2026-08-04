/**
 * Base64 helpers that work on every runtime this package targets.
 *
 * The shared code runs under Node for the CLI and stdio server and under
 * workerd for the optional Cloudflare Worker, so it avoids `Buffer` and uses
 * the web-standard `btoa`/`atob` pair that both provide.
 */

/** Encode raw bytes as standard (non-URL-safe) base64. */
export function bytesToBase64(bytes: Uint8Array): string {
  // Chunked to keep the argument list well inside the engine's limit for
  // `String.fromCharCode.apply`; documents can be several megabytes.
  const CHUNK = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

/** Encode a UTF-8 string as base64. */
export function utf8ToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}
