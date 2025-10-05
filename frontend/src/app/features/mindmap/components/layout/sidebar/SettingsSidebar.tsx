// moved to layout/sidebar
import React, { useState } from 'react';
import { Cloud, HardDrive } from 'lucide-react';
import { useMindMapStore } from '@mindmap/store';
import { CloudStorageAdapter } from '@/app/core/storage/adapters';
import { WorkspaceService } from '@shared/services';

interface SettingsSidebarProps {
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = () => {
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
      console.log('Preparing cloud adapter for local+cloud mode');
      // Reuse a single shared adapter from WorkspaceService; create only if missing
      const workspaceService = WorkspaceService.getInstance();
      let adapter = workspaceService.getCloudAdapter();
      if (!adapter) {
        adapter = new CloudStorageAdapter(settings.cloudApiEndpoint);
        workspaceService.setCloudAdapter(adapter);
      }
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

          <div className="settings-toggle" style={{ marginTop: '12px' }}>
            <input
              type="checkbox"
              id="node-text-wrap-enabled"
              checked={settings.nodeTextWrapEnabled}
              onChange={(e) => handleSettingChange('nodeTextWrapEnabled', e.target.checked)}
            />
            <label htmlFor="node-text-wrap-enabled" className="settings-toggle-label">
              ノードテキストの折り返し
            </label>
          </div>
          <div className="settings-description">
            長いテキストを自動的に複数行で表示します
          </div>

          {settings.nodeTextWrapEnabled && (
            <div className="settings-input-group" style={{ marginTop: '12px' }}>
              <label className="settings-input-label">折り返し幅 (px)</label>
              <input
                type="number"
                min="120"
                max="600"
                value={settings.nodeTextWrapWidth}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value, 10);
                  const clamped = Number.isNaN(parsed)
                    ? settings.nodeTextWrapWidth
                    : Math.max(120, Math.min(600, parsed));
                  handleSettingChange('nodeTextWrapWidth', clamped);
                }}
                className="settings-input"
              />
              <div className="settings-description">
                折り返しを行う最大行幅を指定します（120-600px）
              </div>
            </div>
          )}

          <div className="settings-toggle" style={{ marginTop: '12px' }}>
            <input
              type="checkbox"
              id="visualize-inmap-links"
              checked={settings.visualizeInMapLinks}
              onChange={(e) => handleSettingChange('visualizeInMapLinks', e.target.checked)}
            />
            <label htmlFor="visualize-inmap-links" className="settings-toggle-label">
              マップ内リンクの可視化（点線の矢印）
            </label>
          </div>
          <div className="settings-description">
            同一マップ内のリンク関係を点線の矢印で表示します
          </div>
        </div>
      </div>


      {/* Vim editor toggles moved to Vim mappings sidebar */}

      <div className="settings-section">
        <h3 className="settings-section-title">マークダウン設定</h3>
        <div className="settings-section-content">
          <div className="settings-toggle">
            <input
              type="checkbox"
              id="blank-line-heading"
              checked={(settings as any).addBlankLineAfterHeading}
              onChange={(e) => handleSettingChange('addBlankLineAfterHeading' as keyof typeof settings, e.target.checked as any)}
            />
            <label htmlFor="blank-line-heading" className="settings-toggle-label">
              見出し後に空行を追加
            </label>
          </div>
          <div className="settings-description">
            見出しノードの下に子ノードを追加したとき、マークダウンで空行を自動的に挿入します
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

        .color-set-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          margin-top: 12px;
        }

        .color-set-card {
          padding: 12px;
          border: 2px solid var(--border-color);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--bg-secondary);
        }

        .color-set-card:hover {
          border-color: var(--accent-color);
          background: var(--hover-color);
        }

        .color-set-card.selected {
          border-color: var(--accent-color);
          background: rgba(0, 122, 204, 0.1);
        }

        .color-set-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .color-set-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .color-set-check {
          color: var(--accent-color);
          font-size: 16px;
          font-weight: bold;
        }

        .color-set-colors {
          display: flex;
          gap: 4px;
          margin-bottom: 8px;
        }

        .color-set-swatch {
          flex: 1;
          height: 24px;
          border-radius: 4px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .color-set-description {
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
      `}</style>

      {/* Debug: console.log('Rendering SettingsSidebar:', { cloudAdapter: !!cloudAdapter, isAuthModalOpen }) */}
    </div>
  );
};

export default SettingsSidebar;
