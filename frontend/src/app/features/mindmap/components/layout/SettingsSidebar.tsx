import React, { useState } from 'react';
import { Moon, Sun, Keyboard, Cloud, HardDrive } from 'lucide-react';
import { useMindMapStore } from '../../store';
import { CloudStorageAdapter } from '../../../../core/storage/adapters';
import { WorkspaceService } from '@shared/services';

interface SettingsSidebarProps {
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
}) => {
  const { settings, updateSetting } = useMindMapStore();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [cloudAdapter, setCloudAdapter] = useState<CloudStorageAdapter | null>(null);

  // Debug logging
  React.useEffect(() => {
    console.log('SettingsSidebar state:', { cloudAdapter: !!cloudAdapter, isAuthModalOpen });
  }, [cloudAdapter, isAuthModalOpen]);

  const handleSettingChange = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSetting(key, value);
  };

  const handleStorageModeChange = (mode: typeof settings.storageMode) => {
    console.log('handleStorageModeChange called with mode:', mode);
    if (mode === 'local+cloud') {
      console.log('Creating cloud adapter for local+cloud mode');
      // Create cloud adapter and trigger auth modal via global event
      const adapter = new CloudStorageAdapter(settings.cloudApiEndpoint);
      setCloudAdapter(adapter);
      setIsAuthModalOpen(true);
      console.log('Set cloudAdapter and isAuthModalOpen to true');

      // Dispatch global event for auth modal
      window.dispatchEvent(new CustomEvent('mindoodle:showAuthModal', {
        detail: { cloudAdapter: adapter, onSuccess: handleAuthSuccess }
      }));
    } else {
      console.log('Switching to local mode');
      // Switch to local mode
      handleSettingChange('storageMode', mode);
    }
  };

  const handleAuthSuccess = (authenticatedAdapter: CloudStorageAdapter) => {
    // Successfully authenticated, update storage mode
    handleSettingChange('storageMode', 'local+cloud');

    // Add cloud workspace to workspace service
    const workspaceService = WorkspaceService.getInstance();
    workspaceService.addCloudWorkspace(authenticatedAdapter);
  };

  return (
    <div className="settings-sidebar">
      <div className="settings-section">
        <h3 className="settings-section-title">ストレージ設定</h3>
        <div className="settings-section-content">
          <div className="settings-radio-group">
            <label className="settings-radio-option">
              <input
                type="radio"
                name="storageMode"
                value="local"
                checked={settings.storageMode === 'local'}
                onChange={() => handleStorageModeChange('local')}
              />
              <span className="settings-radio-label">
                <span className="settings-icon"><HardDrive size={16} /></span>
                ローカルのみ
              </span>
            </label>
            <label className="settings-radio-option">
              <input
                type="radio"
                name="storageMode"
                value="local+cloud"
                checked={settings.storageMode === 'local+cloud'}
                onChange={() => handleStorageModeChange('local+cloud')}
              />
              <span className="settings-radio-label">
                <span className="settings-icon"><Cloud size={16} /></span>
                ローカル + クラウド
              </span>
            </label>
          </div>
          <div className="settings-description">
            クラウドストレージを選択すると、データをクラウドに同期できます。
          </div>
        </div>
      </div>

      {/* Workspace selection moved to Maps sidebar */}

      <div className="settings-section">
        <h3 className="settings-section-title">テーマ</h3>
        <div className="settings-section-content">
          <div className="settings-radio-group">
            <label className="settings-radio-option">
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={settings.theme === 'dark'}
                onChange={() => handleSettingChange('theme', 'dark')}
              />
              <span className="settings-radio-label">
                <span className="settings-icon"><Moon size={16} /></span>
                ダーク
              </span>
            </label>
            <label className="settings-radio-option">
              <input
                type="radio"
                name="theme"
                value="light"
                checked={settings.theme === 'light'}
                onChange={() => handleSettingChange('theme', 'light')}
              />
              <span className="settings-radio-label">
                <span className="settings-icon"><Sun size={16} /></span>
                ライト
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">フォント設定</h3>
        <div className="settings-section-content">
          <div className="settings-input-group">
            <label className="settings-input-label">フォントサイズ</label>
            <input
              type="number"
              min="10"
              max="24"
              value={settings.fontSize}
              onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
              className="settings-input"
            />
          </div>
          <div className="settings-input-group">
            <label className="settings-input-label">フォントファミリー</label>
            <select
              value={settings.fontFamily}
              onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
              className="settings-select"
            >
              <option value="system-ui">System UI</option>
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="sans-serif">Sans Serif</option>
              <option value="serif">Serif</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">レイアウト設定</h3>
        <div className="settings-section-content">
          <div className="settings-input-group">
            <label className="settings-input-label">ノード間隔 (px)</label>
            <input
              type="number"
              min="1"
              max="50"
              value={(settings as any).nodeSpacing}
              onChange={(e) => handleSettingChange('nodeSpacing' as keyof typeof settings, parseInt(e.target.value) as any)}
              className="settings-input"
            />
            <div className="settings-description">
              ノード間の縦方向の間隔を設定します（1-50px）
            </div>
          </div>
        </div>
      </div>


      <div className="settings-section">
        <h3 className="settings-section-title">エディタ設定</h3>
        <div className="settings-section-content">
          <div className="settings-toggle">
            <input
              type="checkbox"
              id="vim-mindmap"
              checked={(settings as any).vimMindMap}
              onChange={(e) => handleSettingChange('vimMindMap' as keyof typeof settings, e.target.checked as any)}
            />
            <label htmlFor="vim-mindmap" className="settings-toggle-label">
              <span className="settings-icon"><Keyboard size={16} /></span>
              マインドマップ Vim
            </label>
          </div>
          <div className="settings-description">
            マインドマップ上での Vim ライク操作（hjkl 移動、i で編集開始など）を有効にします
          </div>

          <div className="settings-toggle" style={{ marginTop: '8px' }}>
            <input
              type="checkbox"
              id="vim-editor"
              checked={(settings as any).vimEditor}
              onChange={(e) => handleSettingChange('vimEditor' as keyof typeof settings, e.target.checked as any)}
            />
            <label htmlFor="vim-editor" className="settings-toggle-label">
              <span className="settings-icon"><Keyboard size={16} /></span>
              エディタ Vim（Monaco）
            </label>
          </div>
          <div className="settings-description">
            右側のマークダウンエディタで Vim キーバインドを有効にします
          </div>
        </div>
      </div>

      <style>{`
        .settings-sidebar {
          padding: 16px;
          overflow-y: auto;
          background-color: var(--bg-primary);
        }

        .settings-section {
          margin-bottom: 24px;
        }

        .settings-section-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 12px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border-color);
        }

        .settings-section-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .settings-toggle {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 4px 0;
        }

        .settings-toggle input[type="checkbox"] {
          margin-right: 8px;
          accent-color: #007acc;
        }

        .settings-toggle-label {
          color: var(--text-primary);
          font-size: 14px;
        }

        .settings-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .settings-input-label {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .settings-input,
        .settings-select {
          padding: 6px 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 14px;
        }

        .settings-input:focus,
        .settings-select:focus {
          outline: none;
          border-color: var(--accent-color);
        }

        .settings-color-input {
          padding: 4px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          cursor: pointer;
          width: 60px;
          height: 32px;
        }

        .settings-radio-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .settings-radio-option {
          display: flex;
          align-items: center;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .settings-radio-option:hover {
          background-color: var(--hover-color);
        }

        .settings-radio-option input[type="radio"] {
          margin-right: 8px;
          accent-color: var(--accent-color);
        }

        .settings-radio-label {
          display: flex;
          align-items: center;
          color: var(--text-primary);
          font-size: 14px;
        }

        .settings-icon {
          margin-right: 8px;
        }

        .settings-button {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: none;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .settings-button:hover {
          background-color: var(--hover-color);
          border-color: var(--accent-color);
          color: var(--text-primary);
        }

        .settings-button-icon {
          margin-right: 8px;
        }

        .settings-action-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .data-stats {
          padding: 12px;
          background: var(--bg-secondary);
          border-radius: 6px;
          margin-bottom: 16px;
        }

        .data-stats-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .data-stats-item:last-child {
          margin-bottom: 0;
        }

        .data-stats-label {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .data-stats-value {
          font-size: 12px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .cleanup-error {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 12px;
          color: #ff6b6b;
        }

        .cleanup-error-icon {
          margin-right: 6px;
        }

        .cleanup-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .cleanup-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 16px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: none;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          min-height: 40px;
        }

        .cleanup-button:hover:not(:disabled) {
          background-color: var(--hover-color);
          border-color: var(--accent-color);
        }

        .cleanup-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .cleanup-button-danger {
          border-color: #ff6b6b;
          color: #ff6b6b;
        }

        .cleanup-button-danger:hover:not(:disabled) {
          background-color: rgba(255, 107, 107, 0.1);
          border-color: #ff5252;
        }

        .cleanup-button-cancel {
          border-color: var(--border-color);
          color: var(--text-secondary);
        }

        .cleanup-confirm {
          padding: 16px;
          background: var(--bg-secondary);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 6px;
        }

        .cleanup-confirm-text {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 16px 0;
          line-height: 1.4;
        }

        .cleanup-confirm-buttons {
          display: flex;
          gap: 8px;
        }

        .cleanup-confirm-buttons .cleanup-button {
          flex: 1;
          padding: 8px 12px;
          min-height: 36px;
        }

        .settings-description {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-top: 4px;
          padding-left: 4px;
        }
      `}</style>

      {/* Debug: console.log('Rendering SettingsSidebar:', { cloudAdapter: !!cloudAdapter, isAuthModalOpen }) */}
    </div>
  );
};

export default SettingsSidebar;
