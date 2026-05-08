/**
 * Companies House Document API tool — download the actual filed document
 * (PDF / XHTML / XML / JSON) for a given filing history item.
 *
 * The standard REST API (api.company-information.service.gov.uk) only returns
 * filing metadata. The underlying documents live on a separate service at
 * document-api.company-information.service.gov.uk and follow a two-step
 * request flow:
 *
 *   1. GET  /document/{document_id}             -> metadata + resources map
 *   2. GET  /document/{document_id}/content     -> 302 redirect to a signed
 *                                                  S3 URL containing the file
 *
 * This tool performs both steps and then EITHER:
 *   - writes the bytes to a file on the server's disk and returns the local
 *     path (default — `return_as: 'file_path'`); or
 *   - returns the bytes inline as a base64 string in the response payload
 *     (`return_as: 'base64'`), which is what you want when the MCP server
 *     runs on a different machine to the caller (e.g. hosted on Fly.io and
 *     accessed over HTTP via mcp-remote or Claude desktop's Custom
 *     Connector).
 *
 * NOTE on base64 mode: the payload (including `content_base64`) is JSON-
 * stringified into the *text content block* of the response — not just the
 * structured-content field. This is required for clients like Claude
 * desktop's Custom Connector that don't surface structuredContent to the
 * model. Clients should JSON-parse the text and pull out `content_base64`.
 *
 * Save location precedence (file_path mode only):
 *   1. `save_dir` parameter on the call
 *   2. `COMPANIES_HOUSE_DOWNLOAD_DIR` environment variable
 *   3. OS temp directory (the historical default)
 */

import { z } from 'zod';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  registerTool,
  TOOL_ANNOTATIONS,
  makeTextResult,
  makeErrorResult,
} from './registry.js';
import { resolveApiKey } from '../config.js';
import type { APIClient } from '../api/client.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOCUMENT_API_BASE_URL =
  'https://document-api.company-information.service.gov.uk';

const DOWNLOAD_DIR_ENV_VAR = 'COMPANIES_HOUSE_DOWNLOAD_DIR';

type Format = 'pdf' | 'xhtml' | 'xml' | 'json';

/** Map of user-facing format strings to the Accept header value the
 *  Document API expects. Companies House serves most filings as PDF and a
 *  subset (mostly modern accounts) as iXBRL/XHTML or XML. */
const FORMAT_ACCEPT: Record<Format, string> = {
  pdf: 'application/pdf',
  xhtml: 'application/xhtml+xml',
  xml: 'application/xml',
  json: 'application/json',
};

const FORMAT_EXTENSION: Record<Format, string> = {
  pdf: 'pdf',
  xhtml: 'xhtml',
  xml: 'xml',
  json: 'json',
};

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const shape = {
  document_id: z
    .string()
    .min(1)
    .describe(
      'The document id from a filing history item. Typically exposed on a ' +
        'filing as `links.document_metadata` (e.g. ".../document/ABC123"); ' +
        'pass just the final path segment here. NOTE this is different ' +
        'from the transaction_id — see `get_filings` description.',
    ),
  format: z
    .enum(['pdf', 'xhtml', 'xml', 'json'])
    .default('pdf')
    .describe(
      'Preferred content type. Defaults to pdf. The Document API will ' +
        'return the requested format if available and otherwise fall back ' +
        'to whatever it holds.',
    ),
  return_as: z
    .enum(['file_path', 'base64'])
    .default('file_path')
    .describe(
      'How to return the document. "file_path" (default) writes the bytes ' +
        'to disk on the server and returns the local path — works when ' +
        'the MCP server runs on the same machine as the caller (stdio ' +
        'mode). "base64" returns the bytes inline as a base64 string ' +
        'embedded in the response\'s text content block — required when ' +
        'the server is remote (HTTP) and the caller has no access to the ' +
        'server filesystem. JSON-parse the response text and extract the ' +
        '`content_base64` field, then base64-decode to recover the bytes.',
    ),
  company_number: z
    .string()
    .optional()
    .describe(
      'Optional — used only for the returned filename so you can tell ' +
        'multiple downloads apart.',
    ),
  transaction_id: z
    .string()
    .optional()
    .describe(
      'Optional transaction id from the filing history item. Included in ' +
        'the returned filename and response payload when supplied.',
    ),
  save_dir: z
    .string()
    .optional()
    .describe(
      'Optional absolute path to save the downloaded file into (file_path ' +
        'mode only). Overrides the `COMPANIES_HOUSE_DOWNLOAD_DIR` env var ' +
        'and the OS temp directory default. The directory will be created ' +
        'if it does not already exist. Ignored when `return_as` is ' +
        '"base64".',
    ),
};
const schema = z.object(shape);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip any leading path so callers can pass either a raw id or the full
 *  `links.document_metadata` URL the REST API hands back. */
function normaliseDocumentId(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  const marker = '/document/';
  const idx = trimmed.lastIndexOf(marker);
  if (idx >= 0) return trimmed.slice(idx + marker.length);
  return trimmed.split('/').pop() ?? trimmed;
}

/** Resolve the directory to save into, applying precedence:
 *  explicit param > env var > OS temp dir. */
function resolveSaveDir(paramValue: string | undefined): {
  dir: string;
  source: 'param' | 'env' | 'tmpdir';
} {
  if (paramValue && paramValue.trim()) {
    return { dir: paramValue.trim(), source: 'param' };
  }
  const envValue = process.env[DOWNLOAD_DIR_ENV_VAR];
  if (envValue && envValue.trim()) {
    return { dir: envValue.trim(), source: 'env' };
  }
  return { dir: tmpdir(), source: 'tmpdir' };
}

/** Build the HTTP Basic auth header the Document API expects (same scheme
 *  as the REST API — API key as username, empty password). */
function buildAuthHeader(apiKey: string): string {
  return 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
}

interface FetchedDocument {
  buffer: Buffer;
  contentType: string;
  metadata: Record<string, unknown> | null;
}

async function fetchDocument(
  documentId: string,
  format: Format,
  apiKey: string,
): Promise<FetchedDocument> {
  const auth = buildAuthHeader(apiKey);
  const accept = FORMAT_ACCEPT[format];

  // ---- Step 1: metadata (optional but cheap and helpful for diagnostics).
  let metadata: Record<string, unknown> | null = null;
  try {
    const metaRes = await fetch(
      `${DOCUMENT_API_BASE_URL}/document/${encodeURIComponent(documentId)}`,
      {
        headers: {
          Authorization: auth,
          Accept: 'application/json',
        },
      },
    );
    if (metaRes.ok) {
      metadata = (await metaRes.json()) as Record<string, unknown>;
    }
    // If metadata fetch fails we don't abort — content may still succeed.
  } catch {
    /* swallow — metadata is best-effort */
  }

  // ---- Step 2: content. The Document API responds with a 302 redirect to a
  //      signed S3 URL. We request redirect:'manual' so the auth header is
  //      NOT forwarded to S3 (which would reject it), then follow manually.
  const contentUrl =
    `${DOCUMENT_API_BASE_URL}/document/` +
    `${encodeURIComponent(documentId)}/content`;

  const firstRes = await fetch(contentUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      Authorization: auth,
      Accept: accept,
    },
  });

  let finalRes: Response;
  if (firstRes.status >= 300 && firstRes.status < 400) {
    const location = firstRes.headers.get('location');
    if (!location) {
      throw new Error(
        `Document API returned ${firstRes.status} with no Location header`,
      );
    }
    // Signed S3 URL — no auth header this time.
    finalRes = await fetch(location, { method: 'GET' });
  } else {
    finalRes = firstRes;
  }

  if (!finalRes.ok) {
    const body = await safeReadText(finalRes);
    throw new Error(
      `Document content fetch failed: ${finalRes.status} ${finalRes.statusText}` +
        (body ? ` — ${body.slice(0, 500)}` : ''),
    );
  }

  const arrayBuf = await finalRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const contentType =
    finalRes.headers.get('content-type') ?? accept ?? 'application/octet-stream';

  return { buffer, contentType, metadata };
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

registerTool({
  name: 'download_filing_document',
  description:
    'Download the actual filed document (PDF / XHTML / XML / JSON) for a ' +
    'Companies House filing history item via the Document API. By default ' +
    'writes to disk on the server and returns the file path; pass ' +
    '`return_as: "base64"` to get the bytes inline (required for remote ' +
    'MCP servers — the bytes are embedded in the response\'s text content ' +
    'as JSON; parse it and extract `content_base64`). Pair with ' +
    '`get_filings` — take the `document_id` it surfaces (NOT ' +
    '`transaction_id`) and pass it here.',
  inputSchema: shape,
  annotations: TOOL_ANNOTATIONS,
  async execute(_client: APIClient, params: unknown) {
    const input = schema.parse(params);
    const documentId = normaliseDocumentId(input.document_id);

    const resolved = resolveApiKey();
    if (!resolved) {
      return makeErrorResult(
        'Companies House API key not configured. Set the COMPANIES_HOUSE_API_KEY environment variable or run `ch config` to store one.',
      );
    }
    const apiKey = resolved.key;

    try {
      const { buffer, contentType, metadata } = await fetchDocument(
        documentId,
        input.format,
        apiKey,
      );

      const commonPayload: Record<string, unknown> = {
        content_type: contentType,
        size_bytes: buffer.byteLength,
        document_id: documentId,
        requested_format: input.format,
        ...(input.company_number
          ? { company_number: input.company_number }
          : {}),
        ...(input.transaction_id
          ? { transaction_id: input.transaction_id }
          : {}),
        ...(metadata ? { metadata } : {}),
      };

      // ---- base64 mode: return the bytes inline, no disk write.
      // We embed the entire payload (including `content_base64`) in the
      // response's text content block AS WELL AS in structuredContent.
      // Some MCP clients (notably Claude desktop's Custom Connector)
      // only surface text content to the model and would otherwise
      // miss the bytes entirely; others (Cowork, structured-aware
      // tooling, the existing unit tests) read structuredContent.
      // Putting it in both keeps every client working.
      if (input.return_as === 'base64') {
        const payload = {
          ...commonPayload,
          return_as: 'base64' as const,
          content_base64: buffer.toString('base64'),
        };
        return makeTextResult(JSON.stringify(payload), payload);
      }

      // ---- file_path mode (default): write to disk, return the path.
      const ext = FORMAT_EXTENSION[input.format] ?? 'bin';
      const companyPart = input.company_number ? `${input.company_number}_` : '';
      const txnPart = input.transaction_id ? `${input.transaction_id}_` : '';
      const filename = `${companyPart}${txnPart}${documentId}_${randomUUID().slice(
        0,
        8,
      )}.${ext}`;

      const { dir: saveDir, source: saveDirSource } = resolveSaveDir(
        input.save_dir,
      );

      try {
        await mkdir(saveDir, { recursive: true });
      } catch (err) {
        return makeErrorResult(
          `Could not create save directory '${saveDir}': ${(err as Error).message}`,
        );
      }

      const filePath = join(saveDir, filename);
      await writeFile(filePath, buffer);

      const payload = {
        ...commonPayload,
        return_as: 'file_path',
        file_path: filePath,
        filename,
        save_dir: saveDir,
        save_dir_source: saveDirSource,
      };

      const summary =
        `Saved ${buffer.byteLength.toLocaleString()} bytes (${contentType}) to ${filePath} ` +
        `[save_dir source: ${saveDirSource}]`;

      return makeTextResult(summary, payload);
    } catch (err) {
      return makeErrorResult((err as Error).message);
    }
  },
});
