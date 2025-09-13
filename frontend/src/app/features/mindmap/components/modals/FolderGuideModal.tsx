import React from 'react';
import { FolderOpen } from 'lucide-react';

interface FolderGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: () => Promise<void>;
}

const FolderGuideModal: React.FC<FolderGuideModalProps> = ({ isOpen, onClose, onSelectFolder }) => {
  if (!isOpen) return null;

  return (
    <div className="folder-guide-overlay" onClick={onClose}>
      <div className="folder-guide-content" onClick={(e) => e.stopPropagation()}>
        <div className="folder-guide-header">
          <h2>フォルダベース運用ガイド</h2>
        </div>
        <div className="folder-guide-body">
          <p>Mindoodleはフォルダ内の <code>map.md</code> を中心にデータを保存・読み込みします。</p>
          <ul>
            <li>「フォルダを選択」を押して作業用フォルダを選んでください。</li>
            <li>フォルダ直下に <code>map.md</code> を保存します。</li>
            <li>添付ファイルは <code>attachments/ノードID/</code> 配下に配置されます。</li>
          </ul>
          <div className="folder-guide-actions">
            <button className="select-folder" onClick={async () => { await onSelectFolder(); }}> 
              <FolderOpen size={16} style={{ marginRight: 6 }} /> フォルダを選択
            </button>
            <button className="skip" onClick={onClose}>今はスキップ</button>
          </div>
          <p className="note">このダイアログはメニューからいつでも再度開けます。</p>
        </div>
      </div>
      <style>{`
        .folder-guide-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .folder-guide-content { background: #fff; color: #333; width: 520px; max-width: 92vw; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; }
        [data-theme="dark"] .folder-guide-content { background: #1f1f1f; color: #eee; }
        .folder-guide-header { padding: 16px 20px; border-bottom: 1px solid rgba(0,0,0,0.08); font-weight: 600; }
        .folder-guide-body { padding: 16px 20px; font-size: 14px; }
        .folder-guide-body ul { margin: 8px 0 16px 18px; }
        .folder-guide-actions { display: flex; gap: 10px; margin: 10px 0 8px; }
        .select-folder { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; display: inline-flex; align-items: center; }
        .select-folder:hover { background: #1d4ed8; }
        .skip { background: transparent; color: inherit; border: 1px solid rgba(0,0,0,0.2); border-radius: 6px; padding: 8px 12px; cursor: pointer; }
        [data-theme="dark"] .skip { border-color: #555; }
        .note { opacity: 0.7; margin-top: 8px; font-size: 12px; }
      `}</style>
    </div>
  );
};

export default FolderGuideModal;

