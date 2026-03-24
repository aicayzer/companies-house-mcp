#!/usr/bin/env node

import { APIClient } from '../api/client.js';
import { getTool, getAllTools } from '../tools/registry.js';

// Import all tools to trigger registration
import '../tools/search.js';
import '../tools/company.js';
import '../tools/officers.js';
import '../tools/ownership.js';
import '../tools/filings.js';
import '../tools/financial.js';
import '../tools/extended.js';
import '../tools/composite.js';

function getClient(): APIClient {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    console.error(
      'Error: COMPANIES_HOUSE_API_KEY environment variable is required.\n' +
        'Get an API key at https://developer.company-information.service.gov.uk/'
    );
    process.exit(1);
  }
  return new APIClient({ api_key: apiKey });
}

interface CommandDef {
  name: string;
  tool: string;
  description: string;
  positional?: string; // maps positional arg to this tool param
  flags?: Record<string, { param: string; type: 'string' | 'number' | 'boolean'; description: string }>;
}

const COMMANDS: CommandDef[] = [
  {
    name: 'search',
    tool: 'search_companies',
    description: 'Search for companies by name',
    positional: 'query',
    flags: {
      '--status': { param: 'company_status', type: 'string', description: 'Filter by status' },
      '--type': { param: 'company_type', type: 'string', description: 'Filter by type' },
      '--sic': { param: 'sic_codes', type: 'string', description: 'Filter by SIC code' },
      '--location': { param: 'location', type: 'string', description: 'Filter by location' },
      '--limit': { param: 'items_per_page', type: 'number', description: 'Results per page' },
    },
  },
  {
    name: 'profile',
    tool: 'get_company_profile',
    description: 'Get company profile',
    positional: 'company_number',
  },
  {
    name: 'officers',
    tool: 'get_officers',
    description: 'Get company officers',
    positional: 'company_number',
    flags: {
      '--all': { param: 'include_resigned', type: 'boolean', description: 'Include resigned' },
      '--limit': { param: 'items_per_page', type: 'number', description: 'Results per page' },
    },
  },
  {
    name: 'ownership',
    tool: 'get_ownership',
    description: 'Get PSCs (ownership)',
    positional: 'company_number',
  },
  {
    name: 'filings',
    tool: 'get_filings',
    description: 'Get filing history',
    positional: 'company_number',
    flags: {
      '--category': { param: 'category', type: 'string', description: 'Filing category' },
      '--limit': { param: 'items_per_page', type: 'number', description: 'Results per page' },
    },
  },
  {
    name: 'charges',
    tool: 'get_charges',
    description: 'Get company charges',
    positional: 'company_number',
  },
  {
    name: 'insolvency',
    tool: 'get_insolvency',
    description: 'Get insolvency data',
    positional: 'company_number',
  },
  {
    name: 'report',
    tool: 'company_report',
    description: 'Full company report',
    positional: 'company_number',
  },
  {
    name: 'check',
    tool: 'due_diligence_check',
    description: 'Due diligence red-flag scan',
    positional: 'company_number',
  },
  {
    name: 'network',
    tool: 'officer_network',
    description: 'Officer network map',
    positional: 'officer_name',
    flags: {
      '--id': { param: 'officer_id', type: 'string', description: 'Officer ID (instead of name)' },
    },
  },
  {
    name: 'search-officers',
    tool: 'search_officers',
    description: 'Search for officers by name',
    positional: 'query',
    flags: {
      '--limit': { param: 'items_per_page', type: 'number', description: 'Results per page' },
    },
  },
];

function printUsage(): void {
  console.log('Companies House CLI v2\n');
  console.log('Usage: ch <command> [arguments] [flags]\n');
  console.log('Commands:');
  const maxLen = Math.max(...COMMANDS.map(c => c.name.length));
  for (const cmd of COMMANDS) {
    console.log(`  ${cmd.name.padEnd(maxLen + 2)} ${cmd.description}`);
  }
  console.log('\nFlags:');
  console.log('  --json    Output raw JSON (pipe-friendly)');
  console.log('  --help    Show this help message');
  console.log('\nExamples:');
  console.log('  ch search "Anthropic"');
  console.log('  ch report 13861484');
  console.log('  ch check 13861484');
  console.log('  ch officers 13861484 --all');
  console.log('  ch network "John Smith"');
  console.log('  ch search "tech" --status active --sic 62011 --json');
}

function parseArgs(args: string[], cmdDef: CommandDef): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  const flags = cmdDef.flags ?? {};

  let i = 0;
  let positionalSet = false;

  while (i < args.length) {
    const arg = args[i]!;

    if (arg === '--json') {
      i++;
      continue; // handled separately
    }

    if (arg.startsWith('--')) {
      const flagDef = flags[arg];
      if (!flagDef) {
        console.error(`Unknown flag: ${arg}`);
        process.exit(1);
      }
      if (flagDef.type === 'boolean') {
        params[flagDef.param] = true;
        i++;
      } else {
        const val = args[i + 1];
        if (val === undefined) {
          console.error(`Flag ${arg} requires a value`);
          process.exit(1);
        }
        params[flagDef.param] = flagDef.type === 'number' ? parseInt(val, 10) : val;
        i += 2;
      }
    } else if (!positionalSet && cmdDef.positional) {
      params[cmdDef.positional] = arg;
      positionalSet = true;
      i++;
    } else {
      i++;
    }
  }

  return params;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Handle "serve" command — start MCP server
  if (args[0] === 'serve') {
    const serverArgs = args.slice(1);
    process.argv = [process.argv[0]!, process.argv[1]!, ...serverArgs];
    await import('../server/index.js');
    return;
  }

  const commandName = args[0]!;
  const cmdDef = COMMANDS.find(c => c.name === commandName);

  if (!cmdDef) {
    console.error(`Unknown command: ${commandName}\nRun "ch --help" for usage.`);
    process.exit(1);
  }

  const tool = getTool(cmdDef.tool);
  if (!tool) {
    console.error(`Tool not found: ${cmdDef.tool}`);
    process.exit(1);
  }

  const outputJson = args.includes('--json');
  const cmdArgs = args.slice(1).filter(a => a !== '--json');
  const params = parseArgs(cmdArgs, cmdDef);

  // Validate positional arg is provided
  if (cmdDef.positional && !params[cmdDef.positional]) {
    // Special case: network can use --id instead
    if (cmdDef.name !== 'network' || !params['officer_id']) {
      console.error(`Missing required argument: ${cmdDef.positional}`);
      process.exit(1);
    }
  }

  const client = getClient();

  try {
    const result = await tool.execute(client, params);

    if (outputJson && result.structuredContent) {
      console.log(JSON.stringify(result.structuredContent, null, 2));
    } else {
      for (const content of result.content) {
        if (content.type === 'text') {
          console.log(content.text);
        }
      }
    }

    if (result.isError) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
