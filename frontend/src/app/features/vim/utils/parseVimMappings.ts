export interface ParsedMappings {
  leader: string;
  mappings: Record<string, string>;
  errors: string[];
  warnings: string[];
}

const parseLeaderDirective = (parts: string[], lineNumber: number): { leader?: string; error?: string } | null => {
  if (parts[0] !== 'set' || parts[1] !== 'leader') return null;
  const rawValue = parts.slice(2).join(' ').trim();
  const leader = /^<\s*space\s*>$/i.test(rawValue) ? ' ' : rawValue;
  return leader.length === 1
    ? { leader }
    : { error: `Line ${lineNumber}: leader must be a single character or <Space>` };
};

const parseMappingDirective = (parts: string[], lineNumber: number, mappings: Record<string, string>): { handled: boolean; error?: string } => {
  const command = parts[0];
  if (!['map', 'nmap', 'noremap', 'nnoremap'].includes(command)) return { handled: false };
  if (parts.length < 3) {
    return { handled: true, error: `Line ${lineNumber}: Usage: ${command} <lhs> <rhs>` };
  }
  mappings[parts[1]] = parts.slice(2).join(' ');
  return { handled: true };
};

const parseUnmappingDirective = (parts: string[], lineNumber: number, mappings: Record<string, string>): { handled: boolean; error?: string } => {
  const command = parts[0];
  if (!['unmap', 'nunmap', 'unmap!'].includes(command)) return { handled: false };
  if (!parts[1]) return { handled: true, error: `Line ${lineNumber}: Usage: ${command} <lhs>` };
  delete mappings[parts[1]];
  return { handled: true };
};

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

    const leaderResult = parseLeaderDirective(parts, i + 1);
    if (leaderResult) {
      if (leaderResult.error) errors.push(leaderResult.error);
      else leader = leaderResult.leader ?? leader;
      continue;
    }

    const mappingResult = parseMappingDirective(parts, i + 1, mappings);
    const unmappingResult = mappingResult.handled ? { handled: true } : parseUnmappingDirective(parts, i + 1, mappings);
    if (mappingResult.error || unmappingResult.error) {
      errors.push(mappingResult.error ?? unmappingResult.error ?? 'Unknown mapping error');
      continue;
    }
    if (mappingResult.handled || unmappingResult.handled) {
      continue;
    }

    warnings.push(`Line ${i + 1}: Unknown directive "${cmd}"`);
  }

  return { leader, mappings, errors, warnings };
}

