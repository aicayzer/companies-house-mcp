/**
 * Generate the documentation that describes the tools.
 *
 * The tool reference is produced from the registry rather than written by
 * hand, so a tool's parameters, defaults and description cannot drift away
 * from what the server actually exposes. `docs.test.ts` regenerates and
 * compares; run it with UPDATE_DOCS=1 to write the files.
 */

import { getAllTools, TOOL_GROUP_TITLES, type ToolGroup } from '../../../src/tools/registry.js';
import { describeParameters, type ToolParameter } from '../../../src/cli/schema-introspect.js';
import { COMMANDS } from '../../../src/cli/commands.js';

const GENERATED_NOTICE =
  '<!-- Generated from the tool registry. Run `UPDATE_DOCS=1 pnpm test:unit` to regenerate. Do not edit by hand. -->';

function parameterType(parameter: ToolParameter): string {
  if (parameter.kind === 'enum') return parameter.choices?.map(c => `\`${c}\``).join(' \\| ') ?? 'string';
  return parameter.kind;
}

function parameterRow(parameter: ToolParameter): string {
  const required = parameter.required ? 'Yes' : 'No';
  const fallback =
    parameter.defaultValue !== undefined ? ` Default \`${String(parameter.defaultValue)}\`.` : '';
  const description = (parameter.description ?? '').replace(/\|/g, '\\|');
  return `| \`${parameter.name}\` | ${parameterType(parameter)} | ${required} | ${description}${fallback} |`;
}

/** The CLI command that calls a given tool, if there is one. */
function commandFor(toolName: string): string | undefined {
  return COMMANDS.find(command => command.tool === toolName)?.name;
}

export function generateToolsReference(): string {
  const tools = getAllTools();
  const lines: string[] = [
    GENERATED_NOTICE,
    '',
    '# Tools reference',
    '',
    `The MCP server exposes ${tools.length} tools. Every tool returns readable text for people and a structured payload for programs.`,
    '',
    'Company numbers are eight characters, zero-padded — `00445790`. Scottish companies use an `SC` prefix, Northern Irish `NI`, LLPs `OC`, overseas companies `FC`. Shorter all-digit numbers are padded automatically.',
    '',
    'Every tool that returns a list tells you where you are in it and how to ask for the next page.',
    '',
  ];

  for (const [group, title] of Object.entries(TOOL_GROUP_TITLES) as Array<[ToolGroup, string]>) {
    const inGroup = tools.filter(tool => tool.group === group);
    if (!inGroup.length) continue;

    lines.push(`## ${title}`, '');
    for (const tool of inGroup) {
      const command = commandFor(tool.name);
      lines.push(`### \`${tool.name}\``, '');
      lines.push(tool.description, '');
      if (command) lines.push(`CLI: \`ch ${command}\``, '');

      const parameters = describeParameters(tool.inputSchema);
      if (parameters.length) {
        lines.push('| Parameter | Type | Required | Description |');
        lines.push('|-----------|------|----------|-------------|');
        for (const parameter of parameters) lines.push(parameterRow(parameter));
      } else {
        lines.push('Takes no parameters.');
      }
      lines.push('');
    }
  }

  lines.push(
    '## What the register does not tell you',
    '',
    'Companies House records what companies file. It carries out basic completeness checks but does not verify that the information is accurate, so nothing these tools return is a verification, a credit check, a sanctions or politically-exposed-person screening, or a clearance decision.',
    '',
    'The register also does not cover trading performance, litigation, or beneficial ownership held outside the persons-with-significant-control regime. Identity verification for existing directors and PSCs is still being rolled out under the Economic Crime and Corporate Transparency Act, so a name on the register does not mean the person behind it has been identity-checked.',
    ''
  );

  return lines.join('\n');
}

export function generateLlmsTxt(): string {
  const tools = getAllTools();
  const lines: string[] = [
    '# Companies House CLI and MCP',
    '',
    `> An unofficial CLI and MCP server for the UK Companies House public register. ${tools.length} tools covering company search, company records, officers, ownership, filings, documents and combined summaries. Bring your own free API key.`,
    '',
    '## Packages',
    '',
    '- companies-house-cli (https://www.npmjs.com/package/companies-house-cli): the `ch` command for the terminal. `npm install -g companies-house-cli`',
    '- companies-house-mcp (https://www.npmjs.com/package/companies-house-mcp): the MCP server for Claude Code, Claude Desktop, Codex, Cursor, Zed and other MCP clients. `npx -y companies-house-mcp`',
    '',
    '## API key',
    '',
    'Every user supplies their own free key from https://developer.company-information.service.gov.uk/. There is no shared key, no hosted backend and no proxy. Requests go from your machine, or from a server you deployed yourself, straight to Companies House.',
    '',
    '## Tools',
    '',
  ];

  for (const [group, title] of Object.entries(TOOL_GROUP_TITLES) as Array<[ToolGroup, string]>) {
    const inGroup = tools.filter(tool => tool.group === group);
    if (!inGroup.length) continue;
    lines.push(`### ${title}`, '');
    for (const tool of inGroup) {
      // First sentence only: llms.txt is an index, not a manual.
      const summary = tool.description.split('. ')[0]!.replace(/\.$/, '');
      lines.push(`- ${tool.name} — ${summary}`);
    }
    lines.push('');
  }

  lines.push(
    '## CLI commands',
    '',
    '```',
    ...COMMANDS.map(command => `ch ${command.name.padEnd(18)} ${command.summary}`),
    `ch ${'serve'.padEnd(18)} Run the MCP server (stdio, or --http for Streamable HTTP)`,
    `ch ${'config'.padEnd(18)} Manage the saved API key`,
    `ch ${'tools'.padEnd(18)} List the MCP tools this build exposes`,
    '```',
    '',
    'Output modes: default terminal formatting, --md for markdown, --json for the structured payload.',
    '',
    '## Transports and clients',
    '',
    '- stdio: the default and the recommended setup for every local client.',
    '- Streamable HTTP: for local use, or for a remote server you deploy yourself. Binds to 127.0.0.1 by default; any other binding requires MCP_BEARER_TOKEN.',
    '- Protocol: the 2026-07-28 revision, with the legacy handshake era still served for older clients.',
    '- Remote: an optional Cloudflare Worker you deploy into your own account, protected by your own bearer token. Claude Code, Cursor and VS Code support this. Claude.ai and Claude Desktop custom connectors do not, because their generally available authentication is OAuth, which this project does not implement.',
    '',
    '## Limits',
    '',
    'Data comes from the Companies House public register. Companies House performs basic completeness checks on filings but does not verify their accuracy. Nothing here is a verification, credit check, sanctions or politically-exposed-person screening, or a clearance decision. This project is not affiliated with Companies House.',
    '',
    '## Source',
    '',
    'https://github.com/aicayzer/companies-house-mcp',
    '',
  );

  return lines.join('\n');
}

/** Every tool name, for checking that prose documentation stays in step. */
export function toolNames(): string[] {
  return getAllTools().map(tool => tool.name);
}
