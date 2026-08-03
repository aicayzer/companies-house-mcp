#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { APIClient } from '../api/client.js';
import { getTool, getAllTools, TOOL_GROUP_TITLES, type ToolGroup } from '../tools/registry.js';
import { resolveApiKey, writeApiKey, clearApiKey, getConfigPath } from '../config.js';
import { markdownToTerminal } from './terminal-format.js';
import { COMMANDS, type CommandDefinition } from './commands.js';
import { describeParameters, type ToolParameter } from './schema-introspect.js';

// Import the canonical tool set to trigger registration.
import '../tools/all.js';

const { version: cliVersion } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version: string };

const GLOBAL_FLAGS = new Set(['--json', '--md', '--markdown', '--help', '-h', '--version', '-v']);

/** Exit codes callers can branch on. */
const EXIT_OK = 0;
const EXIT_USAGE = 2;
const EXIT_NO_API_KEY = 3;
const EXIT_TOOL_ERROR = 1;

function fail(message: string, code: number): never {
  console.error(message);
  process.exit(code);
}

function getClient(keyFlag?: string): APIClient {
  const resolved = resolveApiKey(keyFlag);
  if (!resolved) {
    fail(
      'No Companies House API key found.\n\n' +
        'Set one, highest priority first:\n' +
        '  1. --key <key>                          for a single command\n' +
        '  2. export COMPANIES_HOUSE_API_KEY=<key>  for the shell session\n' +
        '  3. ch config set-key <key>               saved to ' +
        getConfigPath() +
        '\n\n' +
        'Registration is free at https://developer.company-information.service.gov.uk/',
      EXIT_NO_API_KEY
    );
  }
  return new APIClient({ api_key: resolved.key });
}

function parameterFlag(name: string): string {
  return `--${name.replace(/_/g, '-')}`;
}

/** Flags a command accepts: derived parameter flags plus declared aliases. */
function commandFlags(command: CommandDefinition): Map<string, ToolParameter> {
  const tool = getTool(command.tool);
  if (!tool) return new Map();
  const parameters = describeParameters(tool.inputSchema);
  const byName = new Map(parameters.map(parameter => [parameter.name, parameter]));
  const flags = new Map<string, ToolParameter>();

  for (const parameter of parameters) {
    flags.set(parameterFlag(parameter.name), parameter);
  }
  for (const [alias, parameterName] of Object.entries(command.aliases ?? {})) {
    const parameter = byName.get(parameterName);
    if (parameter) flags.set(alias, parameter);
  }
  return flags;
}

function printRootUsage(): void {
  const width = Math.max(...COMMANDS.map(c => c.name.length), 'config'.length, 'serve'.length) + 2;
  const lines: string[] = [
    'ch — Companies House CLI',
    '',
    'Read the UK Companies House public register from the terminal, using your own API key.',
    '',
    'Usage: ch <command> [arguments] [flags]',
    '',
    'Commands:',
  ];

  const byGroup = new Map<ToolGroup, CommandDefinition[]>();
  for (const command of COMMANDS) {
    const tool = getTool(command.tool);
    if (!tool) continue;
    const group = byGroup.get(tool.group) ?? [];
    group.push(command);
    byGroup.set(tool.group, group);
  }

  for (const [group, title] of Object.entries(TOOL_GROUP_TITLES) as Array<[ToolGroup, string]>) {
    const commands = byGroup.get(group);
    if (!commands?.length) continue;
    lines.push('', `  ${title}`);
    for (const command of commands) {
      lines.push(`    ${command.name.padEnd(width)}${command.summary}`);
    }
  }

  lines.push(
    '',
    '  Server and configuration',
    `    ${'serve'.padEnd(width)}Run the MCP server (stdio by default, --http for Streamable HTTP)`,
    `    ${'config'.padEnd(width)}Manage the saved API key (set-key, show, path, clear)`,
    `    ${'tools'.padEnd(width)}List the MCP tools this build exposes`,
    '',
    'Output:',
    '  (default)  Formatted for a terminal',
    '  --md       Markdown, for files and notes',
    '  --json     The structured payload, for scripting',
    '',
    'Global flags:',
    '  --key <key>   Use this API key for one command',
    '  --help, -h    Show help. Use "ch <command> --help" for a command',
    '  --version,-v  Print the version',
    '',
    'API key, checked in order: --key, COMPANIES_HOUSE_API_KEY, then ' + getConfigPath() + '.',
    'Get one free at https://developer.company-information.service.gov.uk/',
    '',
    'Examples:',
    '  ch search "Tesco"',
    '  ch profile 00445790',
    '  ch report 00445790',
    '  ch check SC311560',
    '  ch report 00445790 --json | jq .profile.company_status',
    '',
    'Data comes from the Companies House public register. It records what companies have',
    'filed; Companies House does not verify that it is accurate. This tool is not',
    'affiliated with Companies House.'
  );
  console.log(lines.join('\n'));
}

function printCommandUsage(command: CommandDefinition): void {
  const tool = getTool(command.tool);
  if (!tool) return;
  const parameters = describeParameters(tool.inputSchema);
  const positionalSet = new Set(command.positionals);
  const aliasesByParameter = new Map<string, string[]>();
  for (const [alias, parameterName] of Object.entries(command.aliases ?? {})) {
    aliasesByParameter.set(parameterName, [...(aliasesByParameter.get(parameterName) ?? []), alias]);
  }

  const argumentSignature = command.positionals
    .map(name => {
      const parameter = parameters.find(p => p.name === name);
      return parameter?.required === false ? `[${name}]` : `<${name}>`;
    })
    .join(' ');

  const lines: string[] = [
    `ch ${command.name} — ${command.summary}`,
    '',
    `Usage: ch ${command.name} ${argumentSignature} [flags]`.replace(/\s+$/, ''),
    '',
    'Calls the MCP tool: ' + tool.name,
    '',
    tool.description,
    '',
  ];

  const flagParameters = parameters.filter(parameter => !positionalSet.has(parameter.name));
  if (flagParameters.length) {
    lines.push('Flags:');
    for (const parameter of flagParameters) {
      const names = [
        ...new Set([parameterFlag(parameter.name), ...(aliasesByParameter.get(parameter.name) ?? [])]),
      ];
      const value =
        parameter.kind === 'boolean'
          ? ''
          : parameter.kind === 'enum'
            ? ` <${parameter.choices?.join('|')}>`
            : ` <${parameter.kind}>`;
      const suffix =
        parameter.defaultValue !== undefined ? ` (default: ${String(parameter.defaultValue)})` : '';
      lines.push(`  ${names.join(', ')}${value}`);
      lines.push(`      ${parameter.description ?? ''}${suffix}`.trimEnd());
    }
    lines.push('');
  }

  for (const name of command.positionals) {
    const parameter = parameters.find(p => p.name === name);
    if (!parameter?.description) continue;
    lines.push(`${name}:`, `  ${parameter.description}`, '');
  }

  lines.push('Output: --md for markdown, --json for the structured payload.', '', 'Examples:');
  for (const example of command.examples) lines.push(`  ${example}`);
  console.log(lines.join('\n'));
}

function printTools(asJson: boolean): void {
  const tools = getAllTools();
  if (asJson) {
    console.log(
      JSON.stringify(
        tools.map(tool => ({
          name: tool.name,
          title: tool.title,
          group: tool.group,
          description: tool.description,
          parameters: describeParameters(tool.inputSchema),
        })),
        null,
        2
      )
    );
    return;
  }
  console.log(`${tools.length} MCP tools:\n`);
  for (const [group, title] of Object.entries(TOOL_GROUP_TITLES) as Array<[ToolGroup, string]>) {
    const inGroup = tools.filter(tool => tool.group === group);
    if (!inGroup.length) continue;
    console.log(`${title}`);
    for (const tool of inGroup) console.log(`  ${tool.name.padEnd(32)}${tool.title}`);
    console.log('');
  }
}

function parseCommandArguments(
  args: string[],
  command: CommandDefinition
): Record<string, unknown> {
  const flags = commandFlags(command);
  const params: Record<string, unknown> = {};
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;

    if (GLOBAL_FLAGS.has(arg)) continue;
    if (arg === '--key') {
      index++; // consumes its value, handled globally
      continue;
    }

    if (arg.startsWith('--')) {
      const [flagName, inlineValue] = arg.includes('=')
        ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)]
        : [arg, undefined];
      const parameter = flags.get(flagName);
      if (!parameter) {
        fail(
          `Unknown flag for "ch ${command.name}": ${flagName}\nRun "ch ${command.name} --help" for the flags this command accepts.`,
          EXIT_USAGE
        );
      }

      if (parameter.kind === 'boolean') {
        params[parameter.name] = inlineValue === undefined ? true : inlineValue !== 'false';
        continue;
      }

      const value = inlineValue ?? args[++index];
      if (value === undefined) fail(`${flagName} needs a value.`, EXIT_USAGE);

      if (parameter.kind === 'number') {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) fail(`${flagName} needs a number, got "${value}".`, EXIT_USAGE);
        params[parameter.name] = parsed;
      } else {
        if (parameter.choices && !parameter.choices.includes(value)) {
          fail(
            `${flagName} must be one of: ${parameter.choices.join(', ')} — got "${value}".`,
            EXIT_USAGE
          );
        }
        params[parameter.name] = value;
      }
      continue;
    }

    positionals.push(arg);
  }

  for (const [position, name] of command.positionals.entries()) {
    const value = positionals[position];
    if (value !== undefined && params[name] === undefined) params[name] = value;
  }

  if (positionals.length > command.positionals.length) {
    fail(
      `ch ${command.name} takes ${command.positionals.length} argument(s), got ${positionals.length}.\nRun "ch ${command.name} --help" for usage.`,
      EXIT_USAGE
    );
  }

  return params;
}

function handleConfigCommand(args: string[]): void {
  const subcommand = args[0];

  if (subcommand === 'set-key') {
    const key = args[1];
    if (!key) fail('Usage: ch config set-key <api-key>', EXIT_USAGE);
    writeApiKey(key);
    console.log(`API key saved to ${getConfigPath()} with owner-only permissions.`);
    return;
  }

  if (subcommand === 'show') {
    const resolved = resolveApiKey();
    if (!resolved) {
      console.log('No API key configured.');
      console.log(`Config file would be: ${getConfigPath()}`);
      return;
    }
    // Only ever the last four characters, so the key cannot be reconstructed
    // from terminal scrollback or a pasted log.
    console.log(`API key: ****${resolved.key.slice(-4)}`);
    console.log(
      `Source:  ${
        resolved.source === 'env'
          ? 'COMPANIES_HOUSE_API_KEY environment variable'
          : resolved.source === 'config'
            ? getConfigPath()
            : '--key flag'
      }`
    );
    return;
  }

  if (subcommand === 'path') {
    console.log(getConfigPath());
    return;
  }

  if (subcommand === 'clear') {
    const removed = clearApiKey();
    console.log(
      removed
        ? `Removed the saved API key from ${getConfigPath()}.`
        : 'No saved API key to remove.'
    );
    return;
  }

  console.log(
    [
      'Usage: ch config <subcommand>',
      '',
      'Subcommands:',
      '  set-key <key>   Save an API key to the config file',
      '  show            Show which key source is active, masked',
      '  path            Print the config file path',
      '  clear           Remove the saved key',
    ].join('\n')
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    console.log(cliVersion);
    process.exit(EXIT_OK);
  }

  const commandName = args[0];
  const wantsHelp = args.includes('--help') || args.includes('-h');

  if (!commandName || (wantsHelp && !commandName)) {
    printRootUsage();
    process.exit(commandName ? EXIT_OK : EXIT_USAGE);
  }

  if (commandName === 'serve') {
    const { runServer } = await import('../server/index.js');
    await runServer({ version: cliVersion, argv: args.slice(1) });
    return;
  }

  if (commandName === 'config') {
    handleConfigCommand(args.slice(1));
    return;
  }

  if (commandName === 'tools') {
    printTools(args.includes('--json'));
    return;
  }

  const command = COMMANDS.find(candidate => candidate.name === commandName);
  if (!command) {
    if (wantsHelp) {
      printRootUsage();
      process.exit(EXIT_OK);
    }
    fail(
      `Unknown command: ${commandName}\nRun "ch --help" to see the available commands.`,
      EXIT_USAGE
    );
  }

  if (wantsHelp) {
    printCommandUsage(command);
    process.exit(EXIT_OK);
  }

  const tool = getTool(command.tool);
  if (!tool) fail(`Tool not registered: ${command.tool}`, EXIT_TOOL_ERROR);

  const keyIndex = args.indexOf('--key');
  const keyFlag = keyIndex !== -1 ? args[keyIndex + 1] : undefined;
  if (keyIndex !== -1 && (!keyFlag || keyFlag.startsWith('--'))) {
    fail('--key needs a value.', EXIT_USAGE);
  }

  const params = parseCommandArguments(args.slice(1), command);
  const outputJson = args.includes('--json');
  const outputMarkdown = args.includes('--md') || args.includes('--markdown');

  const missing = command.positionals.filter(name => params[name] === undefined);
  if (missing.length) {
    const parameters = describeParameters(tool.inputSchema);
    const stillRequired = missing.filter(
      name => parameters.find(parameter => parameter.name === name)?.required !== false
    );
    // `ch network` accepts --id instead of a name, so a missing optional
    // positional is only an error when nothing else satisfies the tool.
    if (stillRequired.length) {
      fail(
        `ch ${command.name} needs: ${stillRequired.join(', ')}\nRun "ch ${command.name} --help" for usage.`,
        EXIT_USAGE
      );
    }
  }

  const client = getClient(keyFlag);

  try {
    const result = await tool.execute(client, params);

    if (outputJson) {
      console.log(JSON.stringify(result.structuredContent ?? {}, null, 2));
    } else {
      for (const block of result.content) {
        if (block.type === 'text') {
          console.log(outputMarkdown ? block.text : markdownToTerminal(block.text));
        }
      }
    }

    // A retrieved document is bytes, not prose: write it where the caller
    // asked, or tell them how to ask, rather than printing base64.
    const saveTarget = params['save_to'];
    const resourceBlock = result.content.find(block => block.type === 'resource');
    if (resourceBlock?.type === 'resource' && !outputJson) {
      const { resource } = resourceBlock;
      if (typeof saveTarget === 'string' && saveTarget) {
        // The tool already wrote it; nothing more to do here.
      } else {
        const size = 'blob' in resource ? 'binary' : `${resource.text.length} characters`;
        console.log(
          `\nThe document (${size}) was not written to disk. Re-run with --out <path> to save it.`
        );
      }
    }

    if (result.isError) process.exit(EXIT_TOOL_ERROR);
  } catch (error) {
    fail(`Error: ${(error as Error).message}`, EXIT_TOOL_ERROR);
  }
}

main().catch(error => {
  console.error('Fatal error:', error instanceof Error ? error.message : error);
  process.exit(EXIT_TOOL_ERROR);
});
