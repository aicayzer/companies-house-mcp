// ANSI escape codes for terminal formatting.
// Respects NO_COLOR (https://no-color.org/) and non-TTY output.

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;

const c = {
  bold: useColour ? '\x1b[1m' : '',
  dim: useColour ? '\x1b[2m' : '',
  reset: useColour ? '\x1b[0m' : '',
  cyan: useColour ? '\x1b[36m' : '',
  green: useColour ? '\x1b[32m' : '',
  red: useColour ? '\x1b[31m' : '',
  yellow: useColour ? '\x1b[33m' : '',
  blue: useColour ? '\x1b[34m' : '',
  magenta: useColour ? '\x1b[35m' : '',
};

function colourStatus(text: string): string {
  if (/\bActive\b/.test(text)) return text.replace('Active', `${c.green}Active${c.reset}`);
  if (/\bDissolved\b/.test(text)) return text.replace('Dissolved', `${c.red}Dissolved${c.reset}`);
  if (/\bIn Liquidation\b/.test(text)) return text.replace('In Liquidation', `${c.red}In Liquidation${c.reset}`);
  if (/\bIn Receivership\b/.test(text)) return text.replace('In Receivership', `${c.red}In Receivership${c.reset}`);
  if (/\bIn Administration\b/.test(text)) return text.replace('In Administration', `${c.red}In Administration${c.reset}`);
  return text;
}

function colourRisk(text: string): string {
  if (/\bHIGH\b/.test(text)) return text.replace('HIGH', `${c.red}${c.bold}HIGH${c.reset}`);
  if (/\bMEDIUM\b/.test(text)) return text.replace('MEDIUM', `${c.yellow}${c.bold}MEDIUM${c.reset}`);
  if (/\bLOW\b/.test(text)) return text.replace('LOW', `${c.green}LOW${c.reset}`);
  if (/\bCLEAR\b/.test(text)) return text.replace('CLEAR', `${c.green}${c.bold}CLEAR${c.reset}`);
  return text;
}

function stripBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1');
}

/**
 * Transform markdown output from MCP tools into clean terminal formatting.
 */
export function markdownToTerminal(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Horizontal rule → blank line
    if (/^---+$/.test(line.trim())) {
      out.push('');
      continue;
    }

    // ## Main heading → bold cyan
    if (line.startsWith('## ')) {
      const text = stripBold(line.slice(3));
      if (out.length > 0) out.push('');
      out.push(`${c.bold}${c.cyan}${text}${c.reset}`);
      continue;
    }

    // ### Subheading → bold, with status colouring
    if (line.startsWith('### ')) {
      const text = stripBold(line.slice(4));
      if (out.length > 0) out.push('');
      out.push(colourStatus(`${c.bold}${text}${c.reset}`));
      continue;
    }

    // #### Sub-subheading (used in due diligence severity sections)
    if (line.startsWith('#### ')) {
      const text = stripBold(line.slice(5));
      if (out.length > 0) out.push('');
      out.push(colourRisk(`  ${c.bold}${text}${c.reset}`));
      continue;
    }

    // Nested list item: "  - **Key:** Value" or "  - text"
    if (/^ {4}- /.test(line)) {
      const content = stripBold(line.slice(6));
      out.push(colourStatus(`      ${content}`));
      continue;
    }

    // Indented continuation (e.g. practitioner details)
    if (/^ {4}\S/.test(line)) {
      out.push(`      ${line.trimStart()}`);
      continue;
    }

    // List item: "- **Key:** Value"
    if (line.startsWith('- **')) {
      const content = stripBold(line.slice(2));
      out.push(colourStatus(colourRisk(`  ${c.bold}${content.split(':')[0]}:${c.reset}${content.slice(content.indexOf(':') + 1)}`)));
      continue;
    }

    // List item: "- *text*" (italic, e.g. "Paper filed")
    if (line.startsWith('- *') && !line.startsWith('- **')) {
      const text = line.slice(2).replace(/\*/g, '');
      out.push(`  ${c.dim}${text}${c.reset}`);
      continue;
    }

    // List item: "- text"
    if (line.startsWith('- ')) {
      const content = stripBold(line.slice(2));
      out.push(colourStatus(`  ${content}`));
      continue;
    }

    // Standalone bold line: "**Key:** Value" (no bullet)
    if (line.startsWith('**')) {
      const content = stripBold(line);
      const colonIdx = content.indexOf(':');
      if (colonIdx !== -1) {
        const key = content.slice(0, colonIdx + 1);
        const val = content.slice(colonIdx + 1);
        out.push(colourStatus(colourRisk(`  ${c.bold}${key}${c.reset}${val}`)));
      } else {
        out.push(`  ${c.bold}${content}${c.reset}`);
      }
      continue;
    }

    // Summary lines ("Found X", "Showing X of Y", "N officer(s):")
    if (/^(Found|Showing|\d+ \w+\(s?\))/.test(line.trim())) {
      out.push(`${c.dim}${line}${c.reset}`);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      // Collapse multiple blank lines
      if (out.length > 0 && out[out.length - 1]?.trim() !== '') {
        out.push('');
      }
      continue;
    }

    // Anything else — pass through
    out.push(colourStatus(stripBold(line)));
  }

  // Trim trailing blank lines
  while (out.length > 0 && out[out.length - 1]?.trim() === '') {
    out.pop();
  }

  return out.join('\n');
}
