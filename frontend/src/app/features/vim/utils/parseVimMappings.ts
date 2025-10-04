export interface ParsedMappings {
  leader: string;
  mappings: Record<string, string>;
  errors: string[];
  warnings: string[];
}

/**
 * Parse a minimal Vim-like mappings text into leader + mapping table.
 * Supported lines:
 *  - set leader <char|<Space>>
 *  - map|nmap|noremap|nnoremap <lhs> <rhs>
 *  - unmap|nunmap|unmap! <lhs>
 *  - comments starting with '"'
 */
export function parseVimMappingsText(src: string): ParsedMappings {
  const lines = (src || '').split(/\r?\n/);
  let leader = ',';
  const mappings: Record<string, string> = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  const trim = (s: string) => s.trim();
  const isComment = (s: string) => /^\s*"/.test(s);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = trim(raw);
    if (!line || isComment(line)) continue;

    const parts = line.split(/\s+/);
    const cmd = parts[0];

    // set leader X
    if (cmd === 'set' && parts[1] === 'leader') {
      const val = parts.slice(2).join(' ');
      let v = trim(val);
      if (/^<\s*space\s*>$/i.test(v)) v = ' ';
      if (v.length !== 1) {
        errors.push(`Line ${i + 1}: leader must be a single character or <Space>`);
        continue;
      }
      leader = v;
      continue;
    }

    // map variants
    if (['map', 'nmap', 'noremap', 'nnoremap'].includes(cmd)) {
      if (parts.length < 3) {
        errors.push(`Line ${i + 1}: Usage: ${cmd} <lhs> <rhs>`);
        continue;
      }
      const lhs = parts[1];
      const rhs = parts.slice(2).join(' ');
      mappings[lhs] = rhs;
      continue;
    }

    // unmap variants
    if (['unmap', 'nunmap', 'unmap!'].includes(cmd)) {
      const lhs = parts[1];
      if (!lhs) {
        errors.push(`Line ${i + 1}: Usage: ${cmd} <lhs>`);
        continue;
      }
      if (lhs in mappings) delete mappings[lhs];
      continue;
    }

    warnings.push(`Line ${i + 1}: Unknown directive "${cmd}"`);
  }

  return { leader, mappings, errors, warnings };
}

