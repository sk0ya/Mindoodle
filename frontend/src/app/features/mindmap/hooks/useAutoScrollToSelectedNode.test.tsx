import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoScrollToSelectedNode } from './useAutoScrollToSelectedNode';

interface HarnessProps {
  selectedNodeId: string | null;
  ensureSelectedNodeVisible: (options?: { force?: boolean }) => void;
  disabled?: boolean;
}

const Harness = (props: HarnessProps) => {
  useAutoScrollToSelectedNode(props);
  return null;
};

describe('useAutoScrollToSelectedNode', () => {
  let animationFrames: FrameRequestCallback[];

  const flushAnimationFrame = () => {
    const callbacks = animationFrames.splice(0);
    act(() => {
      callbacks.forEach(callback => callback(0));
    });
  };

  beforeEach(() => {
    animationFrames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not bypass layout auto-pan suppression on selection changes', () => {
    const ensureSelectedNodeVisible = vi.fn();

    const { rerender } = render(
      <Harness
        selectedNodeId={null}
        ensureSelectedNodeVisible={ensureSelectedNodeVisible}
      />
    );

    rerender(
      <Harness
        selectedNodeId="node-1"
        ensureSelectedNodeVisible={ensureSelectedNodeVisible}
      />
    );

    flushAnimationFrame();
    flushAnimationFrame();

    expect(ensureSelectedNodeVisible).toHaveBeenCalledTimes(1);
    expect(ensureSelectedNodeVisible).toHaveBeenCalledWith();
    expect(ensureSelectedNodeVisible).not.toHaveBeenCalledWith({ force: true });
  });
});
