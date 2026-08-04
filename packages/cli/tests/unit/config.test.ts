/**
 * The config file holds a credential, so where it lives, how it is protected
 * and which source wins all matter.
 *
 * These run against a temporary HOME so the developer's real key is never
 * touched or read.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, statSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let home = '';

// config.ts resolves its directory at module scope, so homedir has to be
// mocked before the module is ever imported.
vi.mock('node:os', async importOriginal => {
  const actual = await importOriginal<typeof import('node:os')>();
  return { ...actual, homedir: () => home };
});

type ConfigModule = typeof import('../../src/config.js');

async function freshConfigModule(): Promise<ConfigModule> {
  vi.resetModules();
  return import('../../src/config.js');
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'ch-config-'));
  vi.stubEnv('COMPANIES_HOUSE_API_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

describe('API key resolution', () => {
  it('prefers an explicit value over everything else', async () => {
    const { resolveApiKey, writeApiKey } = await freshConfigModule();
    writeApiKey('from-config');
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'from-env');

    expect(resolveApiKey('from-flag')).toEqual({ key: 'from-flag', source: 'flag' });
  });

  it('prefers the environment over the config file', async () => {
    const { resolveApiKey, writeApiKey } = await freshConfigModule();
    writeApiKey('from-config');
    vi.stubEnv('COMPANIES_HOUSE_API_KEY', 'from-env');

    expect(resolveApiKey()).toEqual({ key: 'from-env', source: 'env' });
  });

  it('falls back to the config file', async () => {
    const { resolveApiKey, writeApiKey } = await freshConfigModule();
    writeApiKey('from-config');

    expect(resolveApiKey()).toEqual({ key: 'from-config', source: 'config' });
  });

  it('reports no key rather than an empty one', async () => {
    const { resolveApiKey } = await freshConfigModule();
    expect(resolveApiKey()).toBeNull();
  });

  it('survives a corrupt config file instead of throwing', async () => {
    const { getConfigPath, resolveApiKey, writeApiKey } = await freshConfigModule();
    writeApiKey('x');
    writeFileSync(getConfigPath(), 'not json at all');

    expect(resolveApiKey()).toBeNull();
  });
});

describe('config file protection', () => {
  it('creates the file readable only by its owner', async () => {
    const { writeApiKey, getConfigPath } = await freshConfigModule();
    writeApiKey('a-key');

    expect(statSync(getConfigPath()).mode & 0o777).toBe(0o600);
  });

  // writeFileSync's mode applies only on creation, so an existing file — one
  // restored from a backup, or copied by a tool that dropped its mode — would
  // otherwise keep world-readable permissions on a credential.
  it('tightens permissions on a file that already existed', async () => {
    const { writeApiKey, getConfigPath } = await freshConfigModule();
    writeApiKey('first');
    chmodSync(getConfigPath(), 0o644);

    writeApiKey('second');
    expect(statSync(getConfigPath()).mode & 0o777).toBe(0o600);
  });
});

describe('clearApiKey', () => {
  it('removes a saved key and reports that it did', async () => {
    const { writeApiKey, clearApiKey, resolveApiKey } = await freshConfigModule();
    writeApiKey('a-key');

    expect(clearApiKey()).toBe(true);
    expect(resolveApiKey()).toBeNull();
  });

  it('reports nothing to do when no key is saved', async () => {
    const { clearApiKey } = await freshConfigModule();
    expect(clearApiKey()).toBe(false);
  });

  it('leaves the file in place rather than deleting unrelated settings', async () => {
    const { writeApiKey, clearApiKey, getConfigPath } = await freshConfigModule();
    writeApiKey('a-key');
    clearApiKey();

    expect(existsSync(getConfigPath())).toBe(true);
  });
});
