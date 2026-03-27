#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { APIClient } from '../api/client.js';
import { getAllTools } from '../tools/registry.js';
import { resolveApiKey } from '../config.js';

// Import all tool modules to trigger registration
import '../tools/search.js';
import '../tools/company.js';
import '../tools/officers.js';
import '../tools/ownership.js';
import '../tools/filings.js';
import '../tools/financial.js';
import '../tools/extended.js';
import '../tools/composite.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
) as { version: string };

function getApiKey(): string {
  const resolved = resolveApiKey();
  if (!resolved) {
    console.error(
      'Error: No API key found.\n\n' +
        'Set one using either:\n' +
        '  1. COMPANIES_HOUSE_API_KEY env var (in MCP config or shell)\n' +
        '  2. Config file: run "ch config set-key <key>"\n\n' +
        'Get a free API key at https://developer.company-information.service.gov.uk/'
    );
    process.exit(1);
  }
  return resolved.key;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isHttp = args.includes('--http');
  const portArgIdx = args.indexOf('--port');
  const portArg = portArgIdx !== -1 ? args[portArgIdx + 1] : undefined;

  const apiKey = getApiKey();
  const client = new APIClient({ api_key: apiKey });

  const server = new McpServer({
    name: 'companies-house',
    version,
  });

  // Register all tools using the new SDK registerTool method
  const tools = getAllTools();
  for (const tool of tools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    }, async (params: Record<string, unknown>) => {
      return tool.execute(client, params);
    });
  }

  if (isHttp) {
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const http = await import('node:http');
    const port = portArg ? parseInt(portArg, 10) : 3000;

    const httpServer = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      if (url.pathname === '/mcp') {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
      } else if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', tools: tools.length }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    httpServer.listen(port, () => {
      console.error(`Companies House MCP server (HTTP) listening on port ${port}`);
      console.error(`MCP endpoint: http://localhost:${port}/mcp`);
      console.error(`Health check: http://localhost:${port}/health`);
      console.error(`${tools.length} tools registered`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Companies House MCP server (stdio) started — ${tools.length} tools registered`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
