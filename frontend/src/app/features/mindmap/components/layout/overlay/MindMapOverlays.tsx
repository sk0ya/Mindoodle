
import React from 'react';
import KeyboardShortcutHelper from '../../KeyboardShortcutHelper';

type Props = {

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
    </>
  );
};

export default MindMapOverlays;
