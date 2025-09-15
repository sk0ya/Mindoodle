import React from 'react';
import KeyboardShortcutHelper from '../../../../shared/components/ui/KeyboardShortcutHelper';
import VimStatusBar from '../../../../shared/components/ui/VimStatusBar';
// LoginModalは削除されました

type Props = {
  // keyboard helper
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (v: boolean) => void;

  // auth/login (削除済み)

  // mindmap data (for other overlays if needed)
  // no additional data needed
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
