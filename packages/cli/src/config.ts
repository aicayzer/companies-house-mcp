import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'companies-house');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface Config {
  apiKey?: string;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

function readConfig(): Config {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as Config;
  } catch {
    return {};
  }
}

export function writeApiKey(key: string): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const config = readConfig();
  config.apiKey = key;
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

/**
 * Resolve the API key from available sources.
 * Precedence: flag > env var > config file.
 */
export function resolveApiKey(flagValue?: string): { key: string; source: string } | null {
  if (flagValue) {
    return { key: flagValue, source: 'flag' };
  }

  const envKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (envKey) {
    return { key: envKey, source: 'env' };
  }

  const config = readConfig();
  if (config.apiKey) {
    return { key: config.apiKey, source: 'config' };
  }

  return null;
}
