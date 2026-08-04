/**
 * The shared server must stay runnable on a runtime with no Node built-ins.
 *
 * The Cloudflare Worker imports `companies-house-cli/mcp` and runs with no
 * compatibility flags. A `Buffer` or a static `node:` import anywhere in that
 * graph still builds, typechecks and passes every other test under Node, and
 * only fails on the deployed Worker at the first request. This walks the real
 * import graph instead.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

/** Every module reachable from an entry point by static import. */
function collectGraph(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const source = readFileSync(file, 'utf8');
    // Static imports and re-exports, including the side-effect form the tool
    // registry relies on (`import './all.js'`). A dynamic import is a
    // deliberate opt-in and is allowed.
    const specifiers = [
      ...[...source.matchAll(/^\s*(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/gm)],
      ...[...source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)],
    ]
      .map(match => match[1]!)
      .filter(specifier => specifier.startsWith('.'));

    for (const specifier of specifiers) {
      queue.push(resolve(dirname(file), specifier.replace(/\.js$/, '.ts')));
    }
  }

  return [...seen];
}

describe('the shared MCP server graph', () => {
  const graph = collectGraph(resolve(srcRoot, 'server/mcp.ts'));

  it('reaches the tools, so the check is meaningful', () => {
    expect(graph.some(file => file.endsWith('tools/registry.ts'))).toBe(true);
    expect(graph.some(file => file.endsWith('tools/composite.ts'))).toBe(true);
    expect(graph.length).toBeGreaterThan(15);
  });

  it('has no static node: imports', () => {
    const offenders = graph.filter(file =>
      /^\s*(?:import|export)[^'"]*from\s+['"]node:/m.test(readFileSync(file, 'utf8'))
    );
    expect(
      offenders.map(file => file.replace(srcRoot, 'src')),
      'these would break the Cloudflare Worker, which runs without nodejs_compat'
    ).toEqual([]);
  });

  it('does not use Buffer', () => {
    const offenders = graph.filter(file =>
      /\bBuffer\s*\.(from|alloc|concat|isBuffer)\b/.test(readFileSync(file, 'utf8'))
    );
    expect(
      offenders.map(file => file.replace(srcRoot, 'src')),
      'Buffer does not exist on workerd; use the helpers in api/base64.ts'
    ).toEqual([]);
  });

  it('does not read process', () => {
    const offenders = graph.filter(file =>
      /\bprocess\s*\.(env|argv|exit|cwd)\b/.test(readFileSync(file, 'utf8'))
    );
    expect(
      offenders.map(file => file.replace(srcRoot, 'src')),
      'the Worker passes configuration explicitly; process is not populated'
    ).toEqual([]);
  });

  it('excludes the Node-only entry points', () => {
    for (const nodeOnly of ['config.ts', 'server/index.ts', 'cli/index.ts']) {
      expect(
        graph.some(file => file.endsWith(nodeOnly)),
        `${nodeOnly} is Node-only and must not be reachable from the shared server`
      ).toBe(false);
    }
  });
});
