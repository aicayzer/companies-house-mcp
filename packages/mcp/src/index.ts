#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { runServer } from 'companies-house-cli/server';

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };

runServer({ version }).catch(error => {
  console.error('Fatal error:', error);
  process.exitCode = 1;
});
