/**
 * Read a tool's input schema so the CLI can offer a flag for every parameter.
 *
 * Deriving the flags from the same schema the MCP tool uses is what keeps
 * `ch <command> --help` from drifting away from the tool it calls.
 */

import type { z } from 'zod';

export type ParameterKind = 'string' | 'number' | 'boolean' | 'enum';

export interface ToolParameter {
  name: string;
  kind: ParameterKind;
  required: boolean;
  description?: string;
  choices?: string[];
  defaultValue?: unknown;
}

interface ZodInternals {
  def: {
    type: string;
    innerType?: ZodInternals;
    in?: ZodInternals;
    entries?: Record<string, string>;
    defaultValue?: unknown;
  };
  description?: string;
}

function unwrap(schema: ZodInternals): {
  kind: ParameterKind;
  required: boolean;
  choices?: string[];
  defaultValue?: unknown;
} {
  let current = schema;
  let required = true;
  let defaultValue: unknown;

  // Walk optional/default/pipe wrappers down to the value type.
  for (let depth = 0; depth < 10; depth++) {
    const type = current.def.type;
    if (type === 'optional' || type === 'nullable') {
      required = false;
      current = current.def.innerType!;
      continue;
    }
    if (type === 'default' || type === 'prefault') {
      required = false;
      defaultValue = current.def.defaultValue;
      current = current.def.innerType!;
      continue;
    }
    if (type === 'pipe') {
      // A transform: the input side is what the CLI must accept.
      current = current.def.in!;
      continue;
    }
    break;
  }

  const type = current.def.type;
  if (type === 'enum') {
    return {
      kind: 'enum',
      required,
      choices: Object.values(current.def.entries ?? {}),
      defaultValue,
    };
  }
  const kind: ParameterKind =
    type === 'number' || type === 'int' ? 'number' : type === 'boolean' ? 'boolean' : 'string';
  return { kind, required, defaultValue };
}

export function describeParameters(schema: z.ZodObject): ToolParameter[] {
  const shape = schema.shape as Record<string, unknown>;
  return Object.entries(shape).map(([name, value]) => {
    const zodValue = value as unknown as ZodInternals;
    const { kind, required, choices, defaultValue } = unwrap(zodValue);
    return {
      name,
      kind,
      required,
      description: zodValue.description,
      ...(choices ? { choices } : {}),
      ...(defaultValue !== undefined ? { defaultValue } : {}),
    };
  });
}
