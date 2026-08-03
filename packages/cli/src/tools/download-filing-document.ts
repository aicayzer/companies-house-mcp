/**
 * Retrieve the document behind a Companies House filing.
 *
 * The document itself is returned to the caller as an MCP embedded resource:
 * binary formats as a base64 blob, text formats as text. That is what makes
 * the tool useful over a remote transport, where the caller has no access to
 * the machine the server runs on and a filesystem path would be meaningless.
 *
 * Writing to disk is available but must be asked for explicitly with
 * `save_to`, and only works when the server and the caller share a filesystem.
 *
 * Document metadata is always read first. It reports which content types
 * Companies House actually holds for that document and how large each one is,
 * so the size limit is applied before any bytes are transferred rather than
 * after.
 */

import { z } from 'zod';

import {
  registerTool,
  DOWNLOAD_TOOL_ANNOTATIONS,
  makeTextResult,
  makeResourceResult,
  makeErrorResult,
} from './registry.js';
import {
  DOCUMENT_API_BASE_URL,
  fetchDocumentContent,
  getDocumentMetadata,
  normaliseDocumentId,
} from '../api/endpoints/document.js';
import { bytesToBase64 } from '../api/base64.js';
import type { APIClient } from '../api/client.js';
import type { DocumentMetadata } from '../types/index.js';

type Format = 'pdf' | 'xhtml' | 'xml' | 'json';

const FORMAT_MEDIA_TYPE: Record<Format, string> = {
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

/** Media types that are safe and useful to return as text rather than base64. */
const TEXT_MEDIA_TYPES = ['application/xhtml+xml', 'application/xml', 'application/json', 'text/'];

/**
 * Default ceiling on inline content. Base64 inflates bytes by a third and the
 * result travels through the model's context, so the default is deliberately
 * modest and the caller raises it knowingly.
 */
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const ABSOLUTE_MAX_BYTES = 25 * 1024 * 1024;

const shape = {
  document_id: z
    .string()
    .min(1)
    .describe(
      'Document id from a filing. get_filings and get_filing_document report it as "Document ID". A full `links.document_metadata` URL or a `/document/{id}` path is also accepted.'
    ),
  format: z
    .enum(['pdf', 'xhtml', 'xml', 'json'])
    .default('pdf')
    .describe(
      'Preferred content type. Most filings exist only as pdf; modern accounts may also be held as xhtml (iXBRL). If the requested format is not held, the response lists what is and returns nothing.'
    ),
  max_bytes: z
    .number()
    .int()
    .min(1)
    .max(ABSOLUTE_MAX_BYTES)
    .default(DEFAULT_MAX_BYTES)
    .describe(
      `Refuse to return content larger than this many bytes (default ${DEFAULT_MAX_BYTES}, hard maximum ${ABSOLUTE_MAX_BYTES}). The size is checked against the document metadata before anything is transferred.`
    ),
  metadata_only: z
    .boolean()
    .default(false)
    .describe(
      'Return only the document metadata — available formats, sizes and page count — without transferring the document.'
    ),
  save_to: z
    .string()
    .optional()
    .describe(
      'Optional absolute path of a file to write the document to, in addition to returning it. Only meaningful when this server runs on the same machine as the caller; a remote server writes to its own disk, which the caller cannot read. Omit it unless you know the server is local.'
    ),
};
const schema = z.object(shape);

interface DocumentResources {
  available: string[];
  sizes: Record<string, number>;
}

function readResources(metadata: DocumentMetadata): DocumentResources {
  const resources = metadata.resources ?? {};
  const sizes: Record<string, number> = {};
  for (const [mediaType, entry] of Object.entries(resources)) {
    if (typeof entry?.content_length === 'number') sizes[mediaType] = entry.content_length;
  }
  return { available: Object.keys(resources), sizes };
}

function isTextMediaType(mediaType: string): boolean {
  return TEXT_MEDIA_TYPES.some(prefix => mediaType.startsWith(prefix));
}

function documentUri(documentId: string, extension: string): string {
  return `${DOCUMENT_API_BASE_URL}/document/${documentId}/content.${extension}`;
}

/** Prefer the filename Companies House recorded; fall back to the document id. */
function documentFilename(metadata: DocumentMetadata, documentId: string, extension: string): string {
  const recorded = typeof metadata.filename === 'string' ? metadata.filename.trim() : '';
  const base = recorded || documentId;
  const safe = base.replace(/[^A-Za-z0-9._-]/g, '_');
  return safe.toLowerCase().endsWith(`.${extension}`) ? safe : `${safe}.${extension}`;
}

/**
 * Write bytes to disk, loading the filesystem module only when asked. The
 * shared code also runs on runtimes with no filesystem, so the import stays
 * out of the module graph until a caller opts in.
 */
async function writeDocument(path: string, bytes: Uint8Array): Promise<void> {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

registerTool({
  name: 'download_filing_document',
  title: 'Download Filing Document',
  description:
    'Retrieve the document filed for a Companies House filing and return it to you directly — PDF and other binary formats as an embedded binary resource, XHTML, XML and JSON as text. Reads the document metadata first, so it reports the available formats, page count and exact size, and refuses oversized content before transferring it. Get the document id from get_filings. Set metadata_only to inspect a document without retrieving it. Pass save_to only when this server runs on your own machine.',
  inputSchema: schema,
  annotations: DOWNLOAD_TOOL_ANNOTATIONS,
  group: 'filings',
  async execute(client: APIClient, params: unknown) {
    const input = schema.parse(params);
    const documentId = normaliseDocumentId(input.document_id);
    const wantedMediaType = FORMAT_MEDIA_TYPE[input.format];
    const extension = FORMAT_EXTENSION[input.format];

    try {
      const metadata = await getDocumentMetadata(client, documentId);
      const { available, sizes } = readResources(metadata);
      const knownSize = sizes[wantedMediaType];

      const basePayload: Record<string, unknown> = {
        document_id: documentId,
        requested_format: input.format,
        available_formats: available,
        format_sizes_bytes: sizes,
        ...(metadata.pages !== undefined ? { pages: metadata.pages } : {}),
        ...(typeof metadata.filename === 'string' && metadata.filename
          ? { companies_house_filename: metadata.filename }
          : {}),
        metadata,
      };

      const describeAvailable = available.length
        ? `Formats held for this document: ${available.join(', ')}.`
        : 'Companies House lists no downloadable formats for this document.';

      if (input.metadata_only) {
        const lines = [
          `## Document ${documentId}`,
          '',
          describeAvailable,
          ...(metadata.pages !== undefined ? [`Pages: ${metadata.pages}.`] : []),
          ...Object.entries(sizes).map(
            ([mediaType, size]) => `- ${mediaType}: ${size.toLocaleString()} bytes`
          ),
        ];
        return makeTextResult(lines.join('\n'), { ...basePayload, retrieved: false });
      }

      // Only reject up front when the metadata positively says the format is
      // absent. Some documents report no `resources` map at all, and those are
      // still worth attempting.
      if (available.length > 0 && !available.includes(wantedMediaType)) {
        return makeTextResult(
          `Companies House does not hold this document as ${input.format}. ${describeAvailable} Call again with a format from that list.`,
          { ...basePayload, retrieved: false, reason: 'format_not_available' }
        );
      }

      if (knownSize !== undefined && knownSize > input.max_bytes) {
        return makeTextResult(
          `This document is ${knownSize.toLocaleString()} bytes, above the ${input.max_bytes.toLocaleString()}-byte limit for this call, so it was not transferred. Raise max_bytes to retrieve it, choose a smaller format, or use metadata_only to inspect it.`,
          { ...basePayload, retrieved: false, reason: 'too_large', size_bytes: knownSize }
        );
      }

      const { bytes, contentType } = await fetchDocumentContent(
        client,
        documentId,
        wantedMediaType
      );

      // The metadata size is authoritative in practice, but the transfer is
      // checked too so an unexpectedly large body can never be returned.
      if (bytes.byteLength > input.max_bytes) {
        return makeTextResult(
          `This document turned out to be ${bytes.byteLength.toLocaleString()} bytes, above the ${input.max_bytes.toLocaleString()}-byte limit for this call, so it was discarded. Raise max_bytes to retrieve it.`,
          {
            ...basePayload,
            retrieved: false,
            reason: 'too_large',
            size_bytes: bytes.byteLength,
          }
        );
      }

      const filename = documentFilename(metadata, documentId, extension);
      const uri = documentUri(documentId, extension);
      const payload: Record<string, unknown> = {
        ...basePayload,
        retrieved: true,
        content_type: contentType,
        size_bytes: bytes.byteLength,
        filename,
        uri,
      };

      let savedTo: string | undefined;
      if (input.save_to) {
        try {
          await writeDocument(input.save_to, bytes);
          savedTo = input.save_to;
          payload.saved_to = savedTo;
        } catch (error) {
          // A failed local write must not lose the document the caller asked
          // for, so it is reported alongside the content rather than thrown.
          payload.save_error = error instanceof Error ? error.message : String(error);
        }
      }

      const summaryParts = [
        `Retrieved ${bytes.byteLength.toLocaleString()} bytes of ${contentType} for document ${documentId}${
          metadata.pages !== undefined ? ` (${metadata.pages} page(s))` : ''
        }.`,
        'The document is attached to this result as a resource.',
      ];
      if (savedTo) summaryParts.push(`Also written to ${savedTo} on the machine running this tool.`);
      if (payload.save_error) {
        summaryParts.push(
          `Could not write to ${input.save_to}: ${String(payload.save_error)}. The document is still attached above.`
        );
      }

      const resource = isTextMediaType(contentType)
        ? { uri, mimeType: contentType, text: new TextDecoder().decode(bytes) }
        : { uri, mimeType: contentType, blob: bytesToBase64(bytes) };

      return makeResourceResult(summaryParts.join(' '), resource, payload);
    } catch (err) {
      return makeErrorResult(err, {
        notFoundSuffix: 'Use get_filings to confirm the document id for this filing.',
      });
    }
  },
});
