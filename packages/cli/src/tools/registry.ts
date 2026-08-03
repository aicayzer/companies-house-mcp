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

/**
 * Annotations for the document tool. It is read-only against Companies House
 * but can write a file when the caller explicitly asks it to, so it does not
 * claim `readOnlyHint`. Repeating a call replaces the same deterministic
 * filename rather than accumulating files, so it is idempotent.
 */
export const DOWNLOAD_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const satisfies ToolAnnotations;

export interface TextContentBlock {
  type: 'text';
  text: string;
}

/** An MCP embedded resource — how binary content reaches a remote caller. */
export interface EmbeddedResourceBlock {
  type: 'resource';
  resource:
    | { uri: string; mimeType?: string; text: string }
    | { uri: string; mimeType?: string; blob: string };
}

export type ToolContentBlock = TextContentBlock | EmbeddedResourceBlock;

export interface ToolResult {
  [key: string]: unknown;
  content: ToolContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject;
  annotations: ToolAnnotations;
  /** Grouping used by the generated documentation and the CLI help. */
  group: ToolGroup;
  execute: (client: APIClient, params: unknown) => Promise<ToolResult>;
}

export type ToolGroup = 'search' | 'company' | 'people' | 'filings' | 'summaries';

export const TOOL_GROUP_TITLES: Record<ToolGroup, string> = {
  search: 'Search',
  company: 'Company record',
  people: 'Officers and ownership',
  filings: 'Filings and documents',
  summaries: 'Combined summaries',
};

export type ToolErrorKind = 'companies_house_api' | 'network' | 'internal';

export interface StructuredToolError {
  kind: ToolErrorKind;
  message: string;
  status_code?: number;
  endpoint?: string;
  retryable: boolean;
  retry_after_seconds?: number;
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

/** Registered tools in a stable, deterministic order. */
export function getAllTools(): ToolDefinition[] {
  return Array.from(tools.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

/**
 * What a tool actually retrieved for one part of the register.
 *
 * Companies House list endpoints are paginated and some sub-resources are
 * absent entirely for a given company. Recording coverage lets a summary state
 * what it looked at instead of implying it saw everything.
 */
export interface CoverageEntry {
  resource: string;
  status: 'complete' | 'partial' | 'unavailable' | 'not-applicable';
  retrieved?: number;
  total?: number;
  note?: string;
}

export function coverageLines(entries: CoverageEntry[]): string[] {
  if (!entries.length) return [];
  const lines = ['### Coverage', ''];
  for (const entry of entries) {
    const counts =
      entry.retrieved !== undefined && entry.total !== undefined
        ? ` (${entry.retrieved} of ${entry.total})`
        : entry.retrieved !== undefined
          ? ` (${entry.retrieved})`
          : '';
    const label =
      entry.status === 'complete'
        ? 'all records retrieved'
        : entry.status === 'partial'
          ? 'partially retrieved'
          : entry.status === 'unavailable'
            ? 'not retrieved'
            : 'not held for this company';
    lines.push(`- **${entry.resource}:** ${label}${counts}${entry.note ? ` — ${entry.note}` : ''}`);
  }
  lines.push('');
  return lines;
}

/**
 * The standing caveat for anything that reads like an assessment.
 *
 * Companies House states that it carries out basic checks on documents but has
 * neither the power nor the capability to verify the accuracy of what
 * companies send it, so no output here may read as verification or clearance.
 */
export const REGISTER_LIMITATIONS = [
  'This describes what is recorded on the Companies House public register at the time of the request. It is not a verification, credit check, sanctions or politically-exposed-person screening, or any form of clearance.',
  'Companies House carries out basic completeness checks on filings but does not verify that the information companies file is accurate.',
  'The register does not cover trading performance, litigation, sanctions, or beneficial ownership held outside the persons-with-significant-control regime.',
  'Identity verification for existing directors and persons with significant control is still being rolled out under the Economic Crime and Corporate Transparency Act, so an entry on the register does not mean the person behind it has been identity-checked.',
] as const;

export function limitationLines(): string[] {
  return ['### What this does not tell you', '', ...REGISTER_LIMITATIONS.map(line => `- ${line}`), ''];
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export function makeTextResult(text: string, structured?: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent: structured,
  };
}

/**
 * A text summary plus an embedded resource, so a remote caller receives the
 * bytes themselves rather than a path on a machine it cannot reach.
 */
export function makeResourceResult(
  summary: string,
  resource: EmbeddedResourceBlock['resource'],
  structured?: Record<string, unknown>
): ToolResult {
  return {
    content: [
      { type: 'text', text: summary },
      { type: 'resource', resource },
    ],
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

/** True when an error is Companies House reporting that a resource is absent. */
export function isNotFound(error: unknown): boolean {
  return error instanceof CompaniesHouseAPIError && error.statusCode === 404;
}

function classifyError(error: unknown): StructuredToolError {
  if (error instanceof CompaniesHouseAPIError) {
    return {
      kind: 'companies_house_api',
      message: error.message,
      status_code: error.statusCode,
      endpoint: error.endpoint,
      retryable: error.statusCode === 429 || error.statusCode >= 500,
      ...(error.retryAfterSeconds !== undefined
        ? { retry_after_seconds: error.retryAfterSeconds }
        : {}),
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
