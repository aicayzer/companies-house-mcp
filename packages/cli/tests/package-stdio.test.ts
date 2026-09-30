import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, type VersionNegotiationOptions } from '@modelcontextprotocol/client';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/client/stdio';
import { describe, expect, it } from 'vitest';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const cliEntryPoint = resolve(testDirectory, '../dist/cli/index.js');
const mcpEntryPoint = resolve(testDirectory, '../../mcp/dist/index.js');

// Each entry point must report its own package's version, whatever the release.
const packageVersion = (path: string): string =>
  (JSON.parse(readFileSync(resolve(testDirectory, path), 'utf8')) as { version: string }).version;
const cliVersion = packageVersion('../package.json');
const mcpVersion = packageVersion('../../mcp/package.json');

async function inspectPackagedServer(
  entryPoint: string,
  args: string[],
  expectedVersion: string,
  mode: VersionNegotiationOptions['mode']
): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entryPoint, ...args],
    env: {
      ...getDefaultEnvironment(),
      COMPANIES_HOUSE_API_KEY: 'package-smoke-key',
    },
    stderr: 'pipe',
  });
  const client = new Client(
    { name: 'package-stdio-test', version: '1.0.0' },
    { versionNegotiation: { mode } }
  );

  try {
    await client.connect(transport);
    expect(client.getServerVersion()).toEqual({
      name: 'companies-house',
      version: expectedVersion,
    });
    expect((await client.listTools()).tools).toHaveLength(18);
  } finally {
    await client.close();
  }
}

describe('packaged stdio entry points', () => {
  it.each([
    ['legacy', 'legacy'],
    ['2026-07-28', { pin: '2026-07-28' }],
  ] as const)(`reports MCP wrapper ${mcpVersion} over %s`, async (_label, mode) => {
    await inspectPackagedServer(mcpEntryPoint, [], mcpVersion, mode);
  });

  it(`reports CLI ${cliVersion} over 2026-07-28`, async () => {
    await inspectPackagedServer(cliEntryPoint, ['serve'], cliVersion, { pin: '2026-07-28' });
  });
});
