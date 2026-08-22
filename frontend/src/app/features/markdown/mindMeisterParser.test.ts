import { describe, expect, it } from 'vitest';
import { isMindMeisterFormat, parseMindMeisterMarkdown } from './mindMeisterParser';

describe('mindMeisterParser', () => {
  it('recognizes MindMeister exports and rejects unrelated text', () => {
    expect(isMindMeisterFormat('# [Project](https://www.mindmeister.com/map/123)\n- Task')).toBe(true);
    expect(isMindMeisterFormat('# Project\n- Task')).toBe(true);
    expect(isMindMeisterFormat('plain text\n- Task')).toBe(false);
    expect(isMindMeisterFormat('')).toBe(false);
  });

  it('parses linked roots, nested items, and checkbox state', () => {
    const result = parseMindMeisterMarkdown([
      '# [Project](https://www.mindmeister.com/map/123)',
      '- [ ] Todo',
      '  - [x] Done',
      '    - Nested',
      '- Plain item',
    ].join('\n'));

    expect(result).not.toBeNull();
    expect(result?.text).toBe('Project');
    expect(result?.fontSize).toBe(18);
    expect(result?.fontWeight).toBe('bold');
    expect(result?.children).toHaveLength(2);
    expect(result?.children[0]).toMatchObject({ text: 'Todo', collapsed: false });
    expect(result?.children[0].markdownMeta).toMatchObject({ isCheckbox: true, isChecked: false });
    expect(result?.children[0].children[0]).toMatchObject({ text: 'Done' });
    expect(result?.children[0].children[0].markdownMeta).toMatchObject({ isCheckbox: true, isChecked: true });
    expect(result?.children[0].children[0].children[0].text).toBe('Nested');
    expect(result?.children[1].text).toBe('Plain item');
    expect(result?.id).toMatch(/^node_/);
  });

  it('parses ordinary headings and ignores blank/non-list lines', () => {
    const result = parseMindMeisterMarkdown('\n## Roadmap\nnot a list line\n- Item\n');
    expect(result?.text).toBe('Roadmap');
    expect(result?.children.map(child => child.text)).toEqual(['Item']);
    expect(parseMindMeisterMarkdown(' \n\n')).toBeNull();
  });
});
