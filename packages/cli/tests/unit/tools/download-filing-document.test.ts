import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APIClient } from '../../../src/api/client.js';
import { getTool } from '../../../src/tools/registry.js';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
}));

import '../../../src/tools/download-filing-document.js';
import { writeFile, mkdir } from 'node:fs/promises';

const client = new APIClient({ api_key: 'factory-supplied-key', cache_enabled: false });

const FAKE_PDF = Buffer.from('%PDF-1.4 fake content');
const S3_URL = 'https://s3.amazonaws.com/companies-house-documents/fake-signed-url';

function metadataBody(overrides: Record<string, unknown> = {}) {
  return {
    company_number: '12345678',
    filename: '12345678_aa_2026-01-01',
    pages: 3,
    resources: { 'application/pdf': { content_length: FAKE_PDF.byteLength } },
    ...overrides,
  };
}

function makeFetchMock({
  metaOk = true,
  metadata = metadataBody(),
  contentStatus = 302,
  s3Status = 200,
  s3Body = FAKE_PDF,
  s3ContentType = 'application/pdf',
}: {
  metaOk?: boolean;
  metadata?: Record<string, unknown>;
  contentStatus?: number;
  s3Status?: number;
  s3Body?: Buffer;
  s3ContentType?: string;
} = {}) {
  return vi.fn(async (url: string) => {
    const u = typeof url === 'string' ? url : String(url);

    if (u.includes('/document/') && !u.includes('/content')) {
      if (!metaOk) return new Response('{}', { status: 500 });
      return new Response(JSON.stringify(metadata), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (u.includes('/content')) {
      if (contentStatus >= 300 && contentStatus < 400) {
        return new Response(null, { status: contentStatus, headers: { Location: S3_URL } });
      }
      return new Response(new Uint8Array(s3Body), {
        status: contentStatus,
        headers: { 'Content-Type': s3ContentType },
      });
    }

    if (u === S3_URL) {
      if (s3Status !== 200) return new Response('Error', { status: s3Status });
      return new Response(new Uint8Array(s3Body), {
        status: 200,
        headers: { 'Content-Type': s3ContentType },
      });
    }

    throw new Error(`Unexpected fetch URL: ${u}`);
  }) as typeof globalThis.fetch;
}

function structured(result: { structuredContent?: Record<string, unknown> }) {
  return result.structuredContent ?? {};
}

describe('download_filing_document', () => {
  let originalFetch: typeof globalThis.fetch;
  const tool = getTool('download_filing_document')!;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('document id normalisation', () => {
    it('accepts a bare document id', async () => {
      globalThis.fetch = makeFetchMock();
      await tool.execute(client, { document_id: 'ABC123' });
      const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
      expect(calls.some(u => u.includes('/document/ABC123'))).toBe(true);
    });

    it('strips a /document/ path prefix', async () => {
      globalThis.fetch = makeFetchMock();
      await tool.execute(client, { document_id: '/document/ABC123' });
      const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
      expect(calls.every(u => !u.includes('/document/document/'))).toBe(true);
    });

    it('strips a full Document API URL, including a /content suffix', async () => {
      globalThis.fetch = makeFetchMock();
      await tool.execute(client, {
        document_id:
          'https://document-api.company-information.service.gov.uk/document/ABC123/content',
      });
      const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
      expect(calls.every(u => !u.includes('/document/document/'))).toBe(true);
      expect(calls.some(u => u.endsWith('/document/ABC123'))).toBe(true);
    });
  });

  describe('returning the document to the caller', () => {
    it('attaches binary content as an embedded resource rather than a path', async () => {
      globalThis.fetch = makeFetchMock();
      const result = await tool.execute(client, { document_id: 'DOC001' });

      expect(result.isError).toBeFalsy();
      expect(result.content.map(block => block.type)).toEqual(['text', 'resource']);

      const block = result.content[1]!;
      if (block.type !== 'resource') throw new Error('expected a resource block');
      if (!('blob' in block.resource)) throw new Error('expected a binary blob');

      expect(block.resource.mimeType).toBe('application/pdf');
      expect(Buffer.from(block.resource.blob, 'base64')).toEqual(FAKE_PDF);
      expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
    });

    it('returns text formats as text, not base64', async () => {
      const body = Buffer.from('<html><body>accounts</body></html>');
      globalThis.fetch = makeFetchMock({
        metadata: metadataBody({
          resources: { 'application/xhtml+xml': { content_length: body.byteLength } },
        }),
        s3Body: body,
        s3ContentType: 'application/xhtml+xml',
      });

      const result = await tool.execute(client, { document_id: 'DOC002', format: 'xhtml' });
      const block = result.content[1]!;
      if (block.type !== 'resource') throw new Error('expected a resource block');
      if (!('text' in block.resource)) throw new Error('expected text content');
      expect(block.resource.text).toContain('accounts');
    });

    it('does not put the document bytes in structuredContent', async () => {
      globalThis.fetch = makeFetchMock();
      const result = await tool.execute(client, { document_id: 'DOC003' });
      const payload = JSON.stringify(structured(result));
      expect(payload).not.toContain(FAKE_PDF.toString('base64'));
      expect(structured(result).size_bytes).toBe(FAKE_PDF.byteLength);
    });

    it('names the file from the Companies House filename', async () => {
      globalThis.fetch = makeFetchMock();
      const result = await tool.execute(client, { document_id: 'DOC004' });
      expect(structured(result).filename).toBe('12345678_aa_2026-01-01.pdf');
    });
  });

  describe('metadata-first behaviour', () => {
    it('reports formats and sizes without transferring the document', async () => {
      globalThis.fetch = makeFetchMock();
      const result = await tool.execute(client, { document_id: 'DOC005', metadata_only: true });

      expect(structured(result).retrieved).toBe(false);
      expect(structured(result).available_formats).toEqual(['application/pdf']);
      const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
      expect(calls.some(u => u.includes('/content'))).toBe(false);
    });

    it('refuses a format Companies House does not hold, and says what it does hold', async () => {
      globalThis.fetch = makeFetchMock();
      const result = await tool.execute(client, { document_id: 'DOC006', format: 'xhtml' });

      expect(result.isError).toBeFalsy();
      expect(structured(result).retrieved).toBe(false);
      expect(structured(result).reason).toBe('format_not_available');
      const first = result.content[0]!;
      expect(first.type === 'text' && first.text).toContain('application/pdf');
    });

    it('still attempts a download when the metadata lists no resources', async () => {
      globalThis.fetch = makeFetchMock({ metadata: metadataBody({ resources: {} }) });
      const result = await tool.execute(client, { document_id: 'DOC007' });
      expect(structured(result).retrieved).toBe(true);
    });

    it('refuses an oversized document before transferring it', async () => {
      globalThis.fetch = makeFetchMock();
      const result = await tool.execute(client, { document_id: 'DOC008', max_bytes: 5 });

      expect(structured(result).retrieved).toBe(false);
      expect(structured(result).reason).toBe('too_large');
      const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
      expect(calls.some(u => u.includes('/content'))).toBe(false);
    });

    it('discards a body that exceeds the limit despite the metadata', async () => {
      globalThis.fetch = makeFetchMock({
        metadata: metadataBody({ resources: { 'application/pdf': { content_length: 1 } } }),
      });
      const result = await tool.execute(client, { document_id: 'DOC009', max_bytes: 4 });

      expect(structured(result).retrieved).toBe(false);
      expect(structured(result).reason).toBe('too_large');
      expect(result.content.some(block => block.type === 'resource')).toBe(false);
    });
  });

  describe('optional local save', () => {
    it('does not touch the filesystem unless save_to is given', async () => {
      globalThis.fetch = makeFetchMock();
      await tool.execute(client, { document_id: 'DOC010' });
      expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
      expect(vi.mocked(mkdir)).not.toHaveBeenCalled();
    });

    it('writes to the requested path and reports it', async () => {
      globalThis.fetch = makeFetchMock();
      const result = await tool.execute(client, {
        document_id: 'DOC011',
        save_to: '/tmp/test-downloads/doc.pdf',
      });

      expect(vi.mocked(mkdir)).toHaveBeenCalledWith('/tmp/test-downloads', { recursive: true });
      expect(vi.mocked(writeFile)).toHaveBeenCalledOnce();
      expect(structured(result).saved_to).toBe('/tmp/test-downloads/doc.pdf');
    });

    it('still returns the document when the local write fails', async () => {
      globalThis.fetch = makeFetchMock();
      vi.mocked(writeFile).mockRejectedValueOnce(new Error('read-only file system'));

      const result = await tool.execute(client, {
        document_id: 'DOC012',
        save_to: '/nowhere/doc.pdf',
      });

      expect(result.isError).toBeFalsy();
      expect(result.content.some(block => block.type === 'resource')).toBe(true);
      expect(String(structured(result).save_error)).toContain('read-only file system');
    });
  });

  describe('the Document API redirect', () => {
    it('does not forward the Companies House credential to the signed URL', async () => {
      globalThis.fetch = makeFetchMock();
      await tool.execute(client, { document_id: 'DOC013' });

      const calls = vi.mocked(globalThis.fetch).mock.calls as Array<[string, RequestInit?]>;
      const s3Call = calls.find(([u]) => u === S3_URL);
      expect(s3Call).toBeDefined();
      expect(new Headers(s3Call![1]?.headers).get('Authorization')).toBeNull();
    });

    it('sends the credential to the Document API itself', async () => {
      globalThis.fetch = makeFetchMock();
      await tool.execute(client, { document_id: 'DOC014' });

      const calls = vi.mocked(globalThis.fetch).mock.calls as Array<[string, RequestInit?]>;
      const contentCall = calls.find(([u]) => (u as string).includes('/content'));
      expect(new Headers(contentCall![1]?.headers).get('Authorization')).toBe(
        'Basic ' + Buffer.from('factory-supplied-key:').toString('base64')
      );
    });

    it('handles a direct 200 without a second hop', async () => {
      globalThis.fetch = makeFetchMock({ contentStatus: 200 });
      const result = await tool.execute(client, { document_id: 'DOC015' });

      expect(result.isError).toBeFalsy();
      const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
      expect(calls.filter(u => u === S3_URL)).toHaveLength(0);
    });
  });

  describe('failures', () => {
    it('reports an error when the metadata request fails', async () => {
      globalThis.fetch = makeFetchMock({ metaOk: false });
      const result = await tool.execute(client, { document_id: 'DOC016' });
      expect(result.isError).toBe(true);
    });

    it('reports an error when the content request fails', async () => {
      globalThis.fetch = makeFetchMock({ contentStatus: 404 });
      const result = await tool.execute(client, { document_id: 'DOC017' });
      expect(result.isError).toBe(true);
    });

    it('reports an error when the signed URL fails', async () => {
      globalThis.fetch = makeFetchMock({ s3Status: 403 });
      const result = await tool.execute(client, { document_id: 'DOC018' });
      expect(result.isError).toBe(true);
    });

    it('reports an error when a redirect carries no Location', async () => {
      globalThis.fetch = vi.fn(async (url: string) => {
        if ((url as string).includes('/content')) return new Response(null, { status: 302 });
        return new Response(JSON.stringify(metadataBody()), { status: 200 });
      }) as typeof globalThis.fetch;

      const result = await tool.execute(client, { document_id: 'DOC019' });
      expect(result.isError).toBe(true);
    });
  });
});
