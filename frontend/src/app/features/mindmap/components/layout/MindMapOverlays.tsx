import React from 'react';
import KeyboardShortcutHelper from '../../../../shared/components/ui/KeyboardShortcutHelper';
import VimStatusBar from '../../../../shared/components/ui/VimStatusBar';
import { LoginModal } from '../../../../components/auth';
import ExportModal from '../modals/ExportModal';
import ImportModal from '../modals/ImportModal';

type Props = {
  // keyboard helper
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (v: boolean) => void;

  // auth/login
  isCloudMode: boolean;
  authAdapter: any;
  showLoginModal: boolean;
  onLoginClose: () => void;

  // export/import
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (v: boolean) => void;
  onImportSuccess: (...args: any[]) => void;

  // mindmap data
  data: any;
};

const MindMapOverlays: React.FC<Props> = ({
  showKeyboardHelper,
  setShowKeyboardHelper,
  isCloudMode,
  authAdapter,
  showLoginModal,
  onLoginClose,
  showExportModal,
  setShowExportModal,
  showImportModal,
  setShowImportModal,
  onImportSuccess,
  data,
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

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        mindMapData={data}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={onImportSuccess}
      />
    </>
  );
};

export default MindMapOverlays;
