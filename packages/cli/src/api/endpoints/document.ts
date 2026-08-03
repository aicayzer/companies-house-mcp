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

export interface FetchedDocumentContent {
  bytes: Uint8Array;
  contentType: string;
}

export async function fetchDocumentContent(
  client: APIClient,
  documentId: string,
  accept: string
): Promise<FetchedDocumentContent> {
  const endpoint = `/document/${documentId}/content`;
  const firstResponse = await client.fetchWithAuth(
    `${DOCUMENT_API_BASE_URL}/document/${encodeURIComponent(documentId)}/content`,
    { method: 'GET', redirect: 'manual', headers: { Accept: accept } },
    endpoint
  );

  let finalResponse = firstResponse;
  if (firstResponse.status >= 300 && firstResponse.status < 400) {
    const location = firstResponse.headers.get('location');
    if (!location) {
      throw new CompaniesHouseAPIError(
        `Document API returned ${firstResponse.status} with no Location header.`,
        firstResponse.status,
        endpoint
      );
    }
    try {
      // Deliberately unauthenticated: the signed URL authenticates itself.
      finalResponse = await fetch(location, { method: 'GET' });
    } catch (error) {
      throw CompaniesHouseNetworkError.fromError(error, endpoint);
    }
  }

  if (!finalResponse.ok) {
    throw CompaniesHouseAPIError.fromResponse(
      finalResponse.status,
      endpoint,
      await safeReadText(finalResponse)
    );
  }

  const bytes = new Uint8Array(await finalResponse.arrayBuffer());
  const contentType =
    finalResponse.headers.get('content-type')?.split(';')[0]?.trim() ||
    accept ||
    'application/octet-stream';

  return { bytes, contentType };
}
