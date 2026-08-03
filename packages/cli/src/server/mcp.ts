import { McpServer, type McpServerFactory } from '@modelcontextprotocol/server';
import { APIClient } from '../api/client.js';
import '../tools/all.js';
import { getAllTools } from '../tools/registry.js';

export interface CompaniesHouseMcpFactoryOptions {
  apiKey: string;
  version: string;
}

/**
 * Create the transport-neutral Companies House MCP server factory.
 *
 * The API client lives in the factory closure so its cache and rate limiter
 * are shared across the short-lived server instances created by HTTP and
 * across the selected protocol-era instance created for stdio.
 */
export function createCompaniesHouseMcpFactory({
  apiKey,
  version,
}: CompaniesHouseMcpFactoryOptions): McpServerFactory {
  const normalisedApiKey = apiKey.trim();
  const normalisedVersion = version.trim();

  if (!normalisedApiKey) {
    throw new Error('A Companies House API key is required.');
  }
  if (!normalisedVersion) {
    throw new Error('An MCP server version is required.');
  }

  const client = new APIClient({ api_key: normalisedApiKey });
  const tools = getAllTools();

  return () => {
    const server = new McpServer({
      name: 'companies-house',
      version: normalisedVersion,
    });

    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
        },
        async params => tool.execute(client, params)
      );
    }

    return server;
  };
}
