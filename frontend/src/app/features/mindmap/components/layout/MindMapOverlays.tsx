import React from 'react';
import KeyboardShortcutHelper from '../ui/KeyboardShortcutHelper';
import VimStatusBar from '../ui/VimStatusBar';
import { useVimMode } from '../../../vim/hooks/useVimMode';

type Props = {
  // keyboard helper
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (v: boolean) => void;
  vim: ReturnType<typeof useVimMode>;
};

const MindMapOverlays: React.FC<Props> = ({
  showKeyboardHelper,
  setShowKeyboardHelper,
  vim,
}) => {
  return (
    <>
      <KeyboardShortcutHelper
        isVisible={showKeyboardHelper}
        onClose={() => setShowKeyboardHelper(false)}
      />

      <VimStatusBar vim={vim}/>
    </>
  );
};

export default MindMapOverlays;
