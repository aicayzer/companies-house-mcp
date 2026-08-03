import type { ToolResult } from '../src/tools/registry.js';

/** The text a tool returned, with every text block joined. */
export function textOf(result: ToolResult): string {
  return result.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n');
}
