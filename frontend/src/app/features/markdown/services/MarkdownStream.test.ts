import { describe, expect, it, vi } from 'vitest';
import { MarkdownStream } from './MarkdownStream';

describe('MarkdownStream flush', () => {
  it('keeps content whose save failed pending, so the next flush retries it', async () => {
    const stream = new MarkdownStream({ debounceMs: 10_000 });
    const save = vi.fn<(markdown: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('Not authenticated'))
      .mockResolvedValue(undefined);
    stream.replaceSinks([{ id: 'cloud', flush: save }]);

    stream.setMarkdown('# Edited', 'nodes');
    await stream.flush();
    await stream.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('# Edited');
  });

  it('does not save the same content again once it was saved', async () => {
    const stream = new MarkdownStream({ debounceMs: 10_000 });
    const save = vi.fn<(markdown: string) => Promise<void>>().mockResolvedValue(undefined);
    stream.replaceSinks([{ id: 'cloud', flush: save }]);

    stream.setMarkdown('# Saved', 'nodes');
    await stream.flush();
    await stream.flush();

    expect(save).toHaveBeenCalledTimes(1);
  });
});
