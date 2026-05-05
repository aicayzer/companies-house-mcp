import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { APIClient } from '../../../src/api/client.js';
import { getTool } from '../../../src/tools/registry.js';

vi.mock('../../../src/config.js', () => ({
  resolveApiKey: vi.fn(() => ({ key: 'test-api-key', source: 'env' })),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
}));

import '../../../src/tools/download-filing-document.js';
import { resolveApiKey } from '../../../src/config.js';
import { writeFile, mkdir } from 'node:fs/promises';

// Minimal client — download_filing_document doesn't use APIClient at all,
// but execute() takes one as its first argument.
const client = new APIClient({ api_key: 'test', cache_enabled: false });

const FAKE_PDF = Buffer.from('%PDF-1.4 fake content');
const S3_URL = 'https://s3.amazonaws.com/companies-house-documents/fake-signed-url';
const MOCK_METADATA = { company_number: '12345678', description: 'Annual accounts' };

function makeFetchMock({
  metaOk = true,
  contentStatus = 302,
  s3Status = 200,
  s3Body = FAKE_PDF,
}: {
  metaOk?: boolean;
  contentStatus?: number;
  s3Status?: number;
  s3Body?: Buffer;
} = {}) {
  return vi.fn(async (url: string) => {
    const u = typeof url === 'string' ? url : String(url);

    // Metadata endpoint
    if (u.includes('/document/') && !u.includes('/content')) {
      if (!metaOk) return new Response('{}', { status: 500 });
      return new Response(JSON.stringify(MOCK_METADATA), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Content endpoint (returns redirect or direct response)
    if (u.includes('/content')) {
      if (contentStatus >= 300 && contentStatus < 400) {
        return new Response(null, {
          status: contentStatus,
          headers: { Location: S3_URL },
        });
      }
      // Direct 200 (no redirect)
      return new Response(new Uint8Array(s3Body), {
        status: contentStatus,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }

    // S3 URL — should have no auth header
    if (u === S3_URL) {
      if (s3Status !== 200) {
        return new Response('Error', { status: s3Status });
      }
      return new Response(new Uint8Array(s3Body), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      });
    }

    throw new Error(`Unexpected fetch URL: ${u}`);
  }) as typeof globalThis.fetch;
}

describe('download_filing_document', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalEnv = process.env.COMPANIES_HOUSE_DOWNLOAD_DIR;
    delete process.env.COMPANIES_HOUSE_DOWNLOAD_DIR;
    vi.mocked(resolveApiKey).mockReturnValue({ key: 'test-api-key', source: 'env' });
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) {
      process.env.COMPANIES_HOUSE_DOWNLOAD_DIR = originalEnv;
    } else {
      delete process.env.COMPANIES_HOUSE_DOWNLOAD_DIR;
    }
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // normaliseDocumentId — tested indirectly via the URL fetch is called with
  // -------------------------------------------------------------------------

  it('accepts a bare document ID', async () => {
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    await tool.execute(client, { document_id: 'ABC123', return_as: 'base64' });
    const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
    expect(calls.some(u => u.includes('/document/ABC123'))).toBe(true);
  });

  it('strips /document/ path prefix from ID', async () => {
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    await tool.execute(client, { document_id: '/document/ABC123', return_as: 'base64' });
    const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
    // Should NOT double-encode /document/document/
    expect(calls.some(u => u.endsWith('/document/ABC123') || u.endsWith('/document/ABC123/content'))).toBe(true);
    expect(calls.every(u => !u.includes('/document/document/'))).toBe(true);
  });

  it('strips full Document API URL to bare ID', async () => {
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    const fullUrl = 'https://document-api.company-information.service.gov.uk/document/ABC123';
    await tool.execute(client, { document_id: fullUrl, return_as: 'base64' });
    const calls = vi.mocked(globalThis.fetch).mock.calls.map(([u]) => u as string);
    expect(calls.every(u => !u.includes('/document/document/'))).toBe(true);
    expect(calls.some(u => u.includes('/document/ABC123'))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Successful download — file_path mode
  // -------------------------------------------------------------------------

  it('writes bytes to disk and returns file_path', async () => {
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    const result = await tool.execute(client, {
      document_id: 'DOC001',
      format: 'pdf',
      return_as: 'file_path',
      save_dir: '/tmp/test-downloads',
    });
    expect(result.isError).toBeFalsy();
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith('/tmp/test-downloads', { recursive: true });
    expect(vi.mocked(writeFile)).toHaveBeenCalledOnce();
    const [filePath, buf] = vi.mocked(writeFile).mock.calls[0] as [string, Buffer];
    expect(filePath).toMatch(/^\/tmp\/test-downloads\/.+\.pdf$/);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect((result.structuredContent as Record<string, unknown>)?.return_as).toBe('file_path');
    expect((result.structuredContent as Record<string, unknown>)?.file_path).toBe(filePath);
  });

  // -------------------------------------------------------------------------
  // S3 redirect: auth header must NOT be forwarded
  // -------------------------------------------------------------------------

  it('does not send Authorization header to S3', async () => {
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    await tool.execute(client, { document_id: 'DOC002', return_as: 'base64' });

    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls as Array<[string, RequestInit?]>;
    const s3Call = fetchCalls.find(([u]) => u === S3_URL);
    expect(s3Call).toBeDefined();
    const s3Init = s3Call![1];
    const headers = s3Init?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBeUndefined();
    expect(headers?.['authorization']).toBeUndefined();
  });

  it('sends Authorization header to Document API', async () => {
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    await tool.execute(client, { document_id: 'DOC002', return_as: 'base64' });

    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls as Array<[string, RequestInit?]>;
    const contentCall = fetchCalls.find(([u]) => (u as string).includes('/content'));
    expect(contentCall).toBeDefined();
    const headers = contentCall![1]?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toMatch(/^Basic /);
  });

  // -------------------------------------------------------------------------
  // base64 return mode
  // -------------------------------------------------------------------------

  it('returns bytes inline as base64, no disk write', async () => {
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    const result = await tool.execute(client, {
      document_id: 'DOC003',
      return_as: 'base64',
    });
    expect(result.isError).toBeFalsy();
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
    const sc = result.structuredContent as Record<string, unknown>;
    expect(sc?.return_as).toBe('base64');
    expect(typeof sc?.content_base64).toBe('string');
    // Decoded bytes should match what the mock returned
    const decoded = Buffer.from(sc!.content_base64 as string, 'base64');
    expect(decoded).toEqual(FAKE_PDF);
  });

  // -------------------------------------------------------------------------
  // save_dir precedence
  // -------------------------------------------------------------------------

  it('save_dir param takes precedence over env var', async () => {
    globalThis.fetch = makeFetchMock();
    process.env.COMPANIES_HOUSE_DOWNLOAD_DIR = '/tmp/env-dir';
    const tool = getTool('download_filing_document')!;
    await tool.execute(client, {
      document_id: 'DOC004',
      return_as: 'file_path',
      save_dir: '/tmp/param-dir',
    });
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith('/tmp/param-dir', { recursive: true });
    const [filePath] = vi.mocked(writeFile).mock.calls[0] as [string, Buffer];
    expect(filePath).toMatch(/^\/tmp\/param-dir\//);
  });

  it('COMPANIES_HOUSE_DOWNLOAD_DIR env var used when no save_dir param', async () => {
    globalThis.fetch = makeFetchMock();
    process.env.COMPANIES_HOUSE_DOWNLOAD_DIR = '/tmp/env-dir';
    const tool = getTool('download_filing_document')!;
    await tool.execute(client, { document_id: 'DOC005', return_as: 'file_path' });
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith('/tmp/env-dir', { recursive: true });
    const [filePath] = vi.mocked(writeFile).mock.calls[0] as [string, Buffer];
    expect(filePath).toMatch(/^\/tmp\/env-dir\//);
  });

  it('falls back to OS tmpdir when no save_dir or env var', async () => {
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    await tool.execute(client, { document_id: 'DOC006', return_as: 'file_path' });
    const [filePath] = vi.mocked(writeFile).mock.calls[0] as [string, Buffer];
    expect(filePath).toMatch(new RegExp(`^${tmpdir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  });

  // -------------------------------------------------------------------------
  // Direct 200 response (no redirect)
  // -------------------------------------------------------------------------

  it('handles direct 200 content response without a second fetch', async () => {
    globalThis.fetch = makeFetchMock({ contentStatus: 200 });
    const tool = getTool('download_filing_document')!;
    const result = await tool.execute(client, { document_id: 'DOC007', return_as: 'base64' });
    expect(result.isError).toBeFalsy();
    // Only two fetch calls: metadata + content (no S3 hop)
    const fetchCalls = vi.mocked(globalThis.fetch).mock.calls as Array<[string, unknown]>;
    const s3Calls = fetchCalls.filter(([u]) => u === S3_URL);
    expect(s3Calls).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('returns error result when content fetch returns non-200', async () => {
    globalThis.fetch = makeFetchMock({ contentStatus: 404 });
    const tool = getTool('download_filing_document')!;
    const result = await tool.execute(client, { document_id: 'DOC008', return_as: 'base64' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Error');
  });

  it('returns error result when S3 fetch fails', async () => {
    globalThis.fetch = makeFetchMock({ s3Status: 403 });
    const tool = getTool('download_filing_document')!;
    const result = await tool.execute(client, { document_id: 'DOC009', return_as: 'base64' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Error');
  });

  it('returns error result when API key is not configured', async () => {
    vi.mocked(resolveApiKey).mockReturnValue(null);
    globalThis.fetch = makeFetchMock();
    const tool = getTool('download_filing_document')!;
    const result = await tool.execute(client, { document_id: 'DOC010', return_as: 'base64' });
    expect(result.isError).toBe(true);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('returns error result when redirect has no Location header', async () => {
    globalThis.fetch = vi.fn(async (url: string) => {
      if ((url as string).includes('/content')) {
        return new Response(null, { status: 302 }); // no Location
      }
      return new Response('{}', { status: 200 });
    }) as typeof globalThis.fetch;
    const tool = getTool('download_filing_document')!;
    const result = await tool.execute(client, { document_id: 'DOC011', return_as: 'base64' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Error');
  });
});
