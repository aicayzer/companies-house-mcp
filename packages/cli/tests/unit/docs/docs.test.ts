/**
 * Keep the documentation honest about the code.
 *
 * The tool reference and llms.txt are generated from the registry. Everything
 * else is prose, so it is checked rather than generated: every tool must be
 * mentioned, and no file may mention a tool that does not exist.
 *
 * Run `UPDATE_DOCS=1 pnpm test:unit` to regenerate the generated files.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateToolsReference, generateLlmsTxt, toolNames } from './generate.js';
import { COMMANDS } from '../../../src/cli/commands.js';
import { getTool } from '../../../src/tools/registry.js';

import '../../../src/tools/all.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const shouldWrite = process.env.UPDATE_DOCS === '1';

function repoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

const GENERATED = [
  { path: 'docs/tools.md', generate: generateToolsReference },
  { path: 'docs/public/llms.txt', generate: generateLlmsTxt },
];

describe('generated documentation', () => {
  it.each(GENERATED)('$path matches the tool registry', ({ path, generate }) => {
    const expected = generate();
    const absolute = resolve(repoRoot, path);

    if (shouldWrite) {
      writeFileSync(absolute, expected);
      return;
    }

    expect(existsSync(absolute), `${path} is missing`).toBe(true);
    expect(
      readFileSync(absolute, 'utf8'),
      `${path} is out of date. Run: UPDATE_DOCS=1 pnpm test:unit`
    ).toBe(expected);
  });
});

/** Prose files that describe the tool set to a reader or an agent. */
const PROSE_WITH_TOOL_LISTS = [
  'packages/mcp/README.md',
  'packages/mcp/.claude/skills/companies-house/SKILL.md',
];

describe('prose documentation', () => {
  it.each(PROSE_WITH_TOOL_LISTS)('%s mentions every tool', path => {
    const content = repoFile(path);
    const missing = toolNames().filter(name => !content.includes(name));
    expect(missing, `${path} does not mention: ${missing.join(', ')}`).toEqual([]);
  });

  it.each([...PROSE_WITH_TOOL_LISTS, 'README.md', 'docs/mcp.md', 'docs/cli.md'])(
    '%s mentions no tool that does not exist',
    path => {
      const content = repoFile(path);
      const known = new Set(toolNames());
      // Tool parameters are snake_case too, so a mention only counts as a
      // stale tool reference when it is neither a tool nor a parameter.
      const parameters = new Set(
        toolNames().flatMap(name => Object.keys(getTool(name)!.inputSchema.shape))
      );
      const verbs = ['get_', 'search_', 'download_', 'company_', 'due_', 'officer_'];

      const suspicious = [...content.matchAll(/`([a-z][a-z0-9_]{4,})`/g)]
        .map(match => match[1]!)
        .filter(
          name =>
            name.includes('_') &&
            verbs.some(verb => name.startsWith(verb)) &&
            !known.has(name) &&
            !parameters.has(name)
        );

      expect([...new Set(suspicious)], `${path} references unknown tool(s)`).toEqual([]);
    }
  );

  it('the CLI reference lists every command the CLI actually has', () => {
    const content = repoFile('docs/cli.md');
    const missing = COMMANDS.filter(command => !content.includes(`ch ${command.name}`));
    expect(missing.map(command => command.name)).toEqual([]);
  });
});

describe('command table', () => {
  it('maps every command to a registered tool', () => {
    for (const command of COMMANDS) {
      expect(getTool(command.tool), `${command.name} maps to unknown tool ${command.tool}`).toBeDefined();
    }
  });

  it('gives every tool a command, so the CLI and the MCP server agree', () => {
    const covered = new Set(COMMANDS.map(command => command.tool));
    const uncovered = toolNames().filter(name => !covered.has(name));
    expect(uncovered, `tools with no CLI command: ${uncovered.join(', ')}`).toEqual([]);
  });

  it('names every positional after a real parameter of its tool', () => {
    for (const command of COMMANDS) {
      const shape = getTool(command.tool)!.inputSchema.shape;
      for (const positional of command.positionals) {
        expect(
          Object.keys(shape),
          `${command.name} positional "${positional}" is not a parameter of ${command.tool}`
        ).toContain(positional);
      }
    }
  });

  it('aliases only real parameters', () => {
    for (const command of COMMANDS) {
      const shape = getTool(command.tool)!.inputSchema.shape;
      for (const [alias, parameter] of Object.entries(command.aliases ?? {})) {
        expect(
          Object.keys(shape),
          `${command.name} alias ${alias} points at unknown parameter "${parameter}"`
        ).toContain(parameter);
      }
    }
  });
});
