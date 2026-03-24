import type { z } from 'zod';
import type { APIClient } from '../api/client.js';

/** Standard tool annotations for all tools (read-only, hits external API) */
export const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * A Zod raw shape — an object where keys are field names and values are Zod schemas.
 * This is what the MCP SDK expects for `inputSchema`.
 */
export type ZodRawShape = Record<string, z.ZodTypeAny>;

export interface ToolDefinition {
  name: string;
  description: string;
  /** Zod raw shape for the MCP SDK (e.g. { company_number: z.string() }) */
  inputSchema: ZodRawShape;
  /**
   * Full Zod object schema for internal parsing/validation (with defaults, refines, etc.).
   * If not provided, the server will just pass the raw params to execute.
   */
  parseSchema?: z.ZodType;
  annotations: typeof TOOL_ANNOTATIONS;
  execute: (client: APIClient, params: unknown) => Promise<ToolResult>;
}

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values());
}

export function makeTextResult(text: string, structured?: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent: structured,
  };
}

export function makeErrorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}
