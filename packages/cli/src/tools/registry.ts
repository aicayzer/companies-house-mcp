import type { z } from 'zod';
import {
  CompaniesHouseAPIError,
  CompaniesHouseNetworkError,
  type APIClient,
} from '../api/client.js';

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

/** Standard annotations for tools that only read from Companies House. */
export const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const satisfies ToolAnnotations;

/** Conservative annotations for the tool that can write a document to disk. */
export const DOWNLOAD_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const satisfies ToolAnnotations;

export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject;
  annotations: ToolAnnotations;
  execute: (client: APIClient, params: unknown) => Promise<ToolResult>;
}

export type ToolErrorKind = 'companies_house_api' | 'network' | 'internal';

export interface StructuredToolError {
  kind: ToolErrorKind;
  message: string;
  status_code?: number;
  endpoint?: string;
  retryable: boolean;
}

interface ErrorResultOptions {
  prefix?: string;
  suffix?: string;
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

export function makeErrorResult(error: unknown, options: ErrorResultOptions = {}): ToolResult {
  const details = classifyError(error);
  const message = [options.prefix, details.message, options.suffix]
    .filter((part): part is string => Boolean(part))
    .join(' ');
  const structuredError: StructuredToolError = { ...details, message };

  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    structuredContent: { error: structuredError },
    isError: true,
  };
}

function classifyError(error: unknown): StructuredToolError {
  if (error instanceof CompaniesHouseAPIError) {
    return {
      kind: 'companies_house_api',
      message: error.message,
      status_code: error.statusCode,
      endpoint: error.endpoint,
      retryable: error.statusCode === 429 || error.statusCode >= 500,
    };
  }

  if (error instanceof CompaniesHouseNetworkError) {
    return {
      kind: 'network',
      message: error.message,
      endpoint: error.endpoint,
      retryable: true,
    };
  }

  return {
    kind: 'internal',
    message:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unexpected internal error.',
    retryable: false,
  };
}
