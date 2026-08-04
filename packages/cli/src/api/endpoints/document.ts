/**
 * Companies House Document API.
 *
 * Filed documents live on a different host to the main REST API and use a
 * two-step flow:
 *
 *   1. `GET /document/{id}`          — metadata, including a `resources` map of
 *                                      the content types actually held for that
 *                                      document and each one's byte length.
 *   2. `GET /document/{id}/content`  — a 302 to a short-lived signed S3 URL.
 *
 * The redirect must be followed *without* the Companies House credential: the
 * signed URL carries its own authentication and S3 rejects requests that
 * present two authentication mechanisms.
 */

import { CompaniesHouseAPIError, CompaniesHouseNetworkError } from '../client.js';
import type { APIClient } from '../client.js';
import type { DocumentMetadata } from '../../types/index.js';

export const DOCUMENT_API_BASE_URL = 'https://document-api.company-information.service.gov.uk';

/**
 * Hosts the content redirect is allowed to point at.
 *
 * Companies House hands out a signed URL on its own S3 bucket. Following an
 * arbitrary `Location` would let a compromised or misbehaving upstream steer
 * this server at any address it liked, including one on the private network
 * the server sits in, and return the body to the caller.
 *
 * The S3 entry is the regional endpoint Companies House actually uses rather
 * than all of `amazonaws.com`, which would be every bucket on AWS.
 */
const ALLOWED_CONTENT_HOST_SUFFIXES = [
  '.company-information.service.gov.uk',
  '.s3.eu-west-2.amazonaws.com',
  's3.eu-west-2.amazonaws.com',
] as const;

/** Redirect hops to follow before giving up. One is what the API needs. */
const MAX_CONTENT_REDIRECTS = 3;

export function isAllowedContentUrl(candidate: string, base: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(candidate, base);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') return undefined;

  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_CONTENT_HOST_SUFFIXES.some(
    suffix => host === suffix.slice(1) || host.endsWith(suffix)
  );
  return allowed ? url : undefined;
}

/**
 * Accept the raw id, a `/document/{id}` path, or the full
 * `links.document_metadata` URL that filing history items carry.
 */
export function normaliseDocumentId(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  const withoutContent = trimmed.replace(/\/content$/, '');
  const marker = '/document/';
  const index = withoutContent.lastIndexOf(marker);
  if (index >= 0) return withoutContent.slice(index + marker.length);
  return withoutContent.split('/').pop() ?? withoutContent;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function getDocumentMetadata(
  client: APIClient,
  documentId: string
): Promise<DocumentMetadata> {
  const endpoint = `/document/${documentId}`;
  const response = await client.fetchWithAuth(
    `${DOCUMENT_API_BASE_URL}/document/${encodeURIComponent(documentId)}`,
    { headers: { Accept: 'application/json' } },
    endpoint
  );

  if (!response.ok) {
    throw CompaniesHouseAPIError.fromResponse(
      response.status,
      endpoint,
      await safeReadText(response)
    );
  }

  return (await response.json()) as DocumentMetadata;
}

export type FetchedDocumentContent =
  | { tooLarge: false; bytes: Uint8Array; contentType: string }
  /** The body was refused before being buffered. */
  | { tooLarge: true; reportedSize?: number };

export interface FetchDocumentOptions {
  /** Refuse the body rather than buffering more than this many bytes. */
  maxBytes?: number;
}

/**
 * Read the body without ever holding more than `maxBytes` of it.
 *
 * `content-length` is checked first, but it is advisory and absent on a
 * chunked response, so the stream is also counted as it arrives and abandoned
 * the moment it goes over. Buffering first and checking afterwards would let a
 * large document exhaust a Worker isolate before the limit could apply.
 */
async function readCappedBody(
  response: Response,
  maxBytes: number
): Promise<{ bytes: Uint8Array } | { tooLarge: true; reportedSize?: number }> {
  const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    return { tooLarge: true, reportedSize: declared };
  }

  if (!response.body) {
    // No stream to meter. `content-length` was already checked above, and a
    // body small enough to arrive without one is not a memory risk.
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > maxBytes
      ? { tooLarge: true, reportedSize: bytes.byteLength }
      : { bytes };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
}

export async function fetchDocumentContent(
  client: APIClient,
  documentId: string,
  accept: string,
  { maxBytes = Number.POSITIVE_INFINITY }: FetchDocumentOptions = {}
): Promise<FetchedDocumentContent> {
  const endpoint = `/document/${documentId}/content`;
  const contentUrl = `${DOCUMENT_API_BASE_URL}/document/${encodeURIComponent(documentId)}/content`;
  const firstResponse = await client.fetchWithAuth(
    contentUrl,
    { method: 'GET', redirect: 'manual', headers: { Accept: accept } },
    endpoint
  );

  // Follow redirects by hand, checking every hop. Handing the chain to
  // `fetch` would check only the first `Location` and then follow wherever
  // that led, including off an allowed host onto an arbitrary address.
  let finalResponse = firstResponse;
  let currentUrl = contentUrl;

  for (let hop = 0; finalResponse.status >= 300 && finalResponse.status < 400; hop++) {
    if (hop >= MAX_CONTENT_REDIRECTS) {
      throw new CompaniesHouseAPIError(
        'The Document API redirected too many times, so the document was not fetched.',
        finalResponse.status,
        endpoint
      );
    }

    const location = finalResponse.headers.get('location');
    if (!location) {
      throw new CompaniesHouseAPIError(
        `Document API returned ${finalResponse.status} with no Location header.`,
        finalResponse.status,
        endpoint
      );
    }

    const target = isAllowedContentUrl(location, currentUrl);
    if (!target) {
      throw new CompaniesHouseAPIError(
        'The Document API redirected somewhere unexpected, so the document was not fetched.',
        finalResponse.status,
        endpoint
      );
    }

    try {
      // Deliberately unauthenticated: the signed URL authenticates itself, and
      // S3 rejects a request presenting two authentication mechanisms.
      finalResponse = await fetch(target, { method: 'GET', redirect: 'manual' });
    } catch (error) {
      throw CompaniesHouseNetworkError.fromError(error, endpoint);
    }
    currentUrl = target.toString();
  }

  if (!finalResponse.ok) {
    throw CompaniesHouseAPIError.fromResponse(
      finalResponse.status,
      endpoint,
      await safeReadText(finalResponse)
    );
  }

  let body: Awaited<ReturnType<typeof readCappedBody>>;
  try {
    body = await readCappedBody(finalResponse, maxBytes);
  } catch (error) {
    // A stream that dies mid-read is a network failure, not a bug; report it
    // as one rather than letting a raw TypeError escape.
    throw CompaniesHouseNetworkError.fromError(error, endpoint);
  }
  if ('tooLarge' in body) return body;

  const contentType =
    finalResponse.headers.get('content-type')?.split(';')[0]?.trim() ||
    accept ||
    'application/octet-stream';

  return { tooLarge: false, bytes: body.bytes, contentType };
}
