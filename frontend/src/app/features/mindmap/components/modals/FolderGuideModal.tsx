import React from 'react';
import { FolderOpen } from 'lucide-react';
import { BaseModal } from '../shared/BaseModal';

interface FolderGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: () => Promise<void>;
}

const FolderGuideModal: React.FC<FolderGuideModalProps> = ({ isOpen, onClose, onSelectFolder }) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="フォルダベース運用ガイド"
      size="medium"
      showCloseButton={false}
    >
      <div>
        <p>Mindoodleはフォルダ内の .md ファイルをマインドマップとして表示します</p>
        <ul style={{ margin: '8px 0 16px 18px' }}>
          <li>「フォルダを選択」を押して作業用フォルダを選んでください。</li>
          <li>フォルダ直下に <code>map.md</code> を保存します。</li>
        </ul>
        <div className="folder-guide-actions">
          <button className="select-folder" onClick={async () => { await onSelectFolder(); }}>
            <FolderOpen size={16} style={{ marginRight: 6 }} /> フォルダを選択
          </button>
          <button className="skip" onClick={onClose}>今はスキップ</button>
        </div>
      </div>

      <style>{`
        .folder-guide-actions { display: flex; gap: 10px; margin: 10px 0 8px; }
        .select-folder { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; display: inline-flex; align-items: center; }
        .select-folder:hover { background: #1d4ed8; }
        .skip { background: transparent; color: inherit; border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; padding: 8px 12px; cursor: pointer; }
        [data-theme="dark"] .skip { border-color: #555; }
      `}</style>
    </BaseModal>
  );
};

export default FolderGuideModal;

