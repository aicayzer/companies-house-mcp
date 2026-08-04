import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
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

/**
 * Write the config file with owner-only permissions.
 *
 * `writeFileSync`'s `mode` applies only when the file is created, so an
 * existing file — restored from a backup, or copied from another machine by a
 * tool that did not preserve modes — would silently keep world-readable
 * permissions on a credential. The explicit chmod makes the guarantee real.
 */
function writeConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  try {
    chmodSync(CONFIG_FILE, 0o600);
  } catch {
    // Best effort: some filesystems (and Windows) do not support it.
  }
}

export function writeApiKey(key: string): void {
  const config = readConfig();
  config.apiKey = key;
  writeConfig(config);
}

/** Remove the saved key. Returns true when there was one to remove. */
export function clearApiKey(): boolean {
  if (!existsSync(CONFIG_FILE)) return false;
  const config = readConfig();
  if (!config.apiKey) return false;
  delete config.apiKey;
  writeConfig(config);
  return true;
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
