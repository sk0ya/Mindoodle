import { describe, expect, it } from 'vitest';
import { formatFileSize } from './fileSize';
import { LineEndingUtils } from './lineEndingUtils';
import { generateObjectHash, generateSimpleHash } from './hashUtils';
import { VimCountBuffer } from '../../features/vim/services/VimCountBuffer';
import { VimRepeatRegistry } from '../../features/vim/services/VimRepeatRegistry';

describe('line ending, hash, file size, and Vim buffers', () => {
  it('detects, counts, splits, joins, and normalizes line endings', () => {
    expect(LineEndingUtils.detectLineEnding('a\r\nb')).toBe('\r\n');
    expect(LineEndingUtils.detectLineEnding('a\rb')).toBe('\r');
    expect(LineEndingUtils.splitLines('a\r\nb\rc')).toEqual(['a', 'b', 'c']);
    expect(LineEndingUtils.joinLines(['a', 'b'], '\r\n')).toBe('a\r\nb');
    expect(LineEndingUtils.normalizeLineEndings('a\r\nb\rc')).toBe('a\nb\nc');
    expect(LineEndingUtils.getLineEndingStats('a\r\nb\r\nc\n')).toEqual({ crlf: 2, lf: 1, cr: 0, dominant: '\r\n' });
    expect(LineEndingUtils.isEmptyOrWhitespace('  ')).toBe(true);
    expect(LineEndingUtils.isEmpty('')).toBe(true);
  });

  it('formats sizes and creates deterministic hashes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(generateSimpleHash('same')).toBe(generateSimpleHash('same'));
    expect(generateSimpleHash('same')).not.toBe(generateSimpleHash('different'));
    expect(generateObjectHash({ a: 1 })).toBe(generateObjectHash({ a: 1 }));
  });

  it('buffers Vim counts and repeatable operations', () => {
    const buffer = new VimCountBuffer();
    expect(buffer.hasCount()).toBe(false);
    expect(buffer.getCount()).toBeUndefined();
    buffer.append('1');
    buffer.append('2');
    expect(buffer.getBuffer()).toBe('12');
    expect(buffer.getCount()).toBe(12);
    expect(() => buffer.append('x')).toThrow('Invalid digit');
    buffer.clear();
    expect(buffer.hasCount()).toBe(false);

    const registry = new VimRepeatRegistry();
    expect(registry.hasChange()).toBe(false);
    const operation = { commandName: 'delete', count: 2, context: {} };
    registry.record(operation);
    expect(registry.getLastChange()).toBe(operation);
    expect(registry.hasChange()).toBe(true);
    registry.clear();
    expect(registry.getLastChange()).toBeNull();
  });
});
