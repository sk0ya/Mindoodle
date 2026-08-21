import type { CommandContext } from '../system/types';

export type EditCursorPosition = 'start' | 'end';

export const setVimInsertMode = (context: CommandContext): void => {
  if (context.vim?.isEnabled) context.vim.setMode('insert');
};

export const startEditWithCursor = (
  nodeId: string,
  position: EditCursorPosition,
  context: CommandContext
): void => {
  setTimeout(() => {
    if (position === 'end') {
      context.handlers.startEditWithCursorAtEnd(nodeId);
    } else {
      context.handlers.startEditWithCursorAtStart(nodeId);
    }
  }, 10);
};
