import React from 'react';
import KeyboardShortcutHelper from '../../../../shared/components/ui/KeyboardShortcutHelper';
import VimStatusBar from '../../../../shared/components/ui/VimStatusBar';

type Props = {
  // keyboard helper
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (v: boolean) => void;
};

const MindMapOverlays: React.FC<Props> = ({
  showKeyboardHelper,
  setShowKeyboardHelper,
}) => {
  return (
    <>
      <KeyboardShortcutHelper
        isVisible={showKeyboardHelper}
        onClose={() => setShowKeyboardHelper(false)}
      />

      <VimStatusBar />

      {/* LoginModal削除済み */}

      {/* Import/Export modals removed */}
    </>
  );
};

export default MindMapOverlays;
