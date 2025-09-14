import React from 'react';
import KeyboardShortcutHelper from '../../../../shared/components/ui/KeyboardShortcutHelper';
import VimStatusBar from '../../../../shared/components/ui/VimStatusBar';
import { LoginModal } from '../../../../components/auth';

type Props = {
  // keyboard helper
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (v: boolean) => void;

  // auth/login
  isCloudMode: boolean;
  authAdapter: any;
  showLoginModal: boolean;
  onLoginClose: () => void;

  // mindmap data (for other overlays if needed)
  // no additional data needed
};

const MindMapOverlays: React.FC<Props> = ({
  showKeyboardHelper,
  setShowKeyboardHelper,
  isCloudMode,
  authAdapter,
  showLoginModal,
  onLoginClose,
}) => {
  return (
    <>
      <KeyboardShortcutHelper
        isVisible={showKeyboardHelper}
        onClose={() => setShowKeyboardHelper(false)}
      />

      <VimStatusBar />

      {isCloudMode && authAdapter && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={onLoginClose}
        />
      )}

      {/* Import/Export modals removed */}
    </>
  );
};

export default MindMapOverlays;
