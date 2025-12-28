
import React, { useState } from 'react';
import { useSettingsHandler } from '@mindmap/hooks/useSettingsHandler';
import { embeddingService } from '@core/services/EmbeddingService';
import { useEventListener } from '@shared/hooks/system/useEventListener';
import { logger } from '@shared/utils';
import { colorSetStyles } from './colorSetStyles';
import { sharedSidebarStyles } from './sharedSidebarStyles';

interface SettingsSidebarProps {
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = () => {
  const { settings, handleSettingChange } = useSettingsHandler();
  const [isInitializingEmbedding, setIsInitializingEmbedding] = useState(false);
  const [embeddingProgress, setEmbeddingProgress] = useState<string>('');
  const [embeddingError, setEmbeddingError] = useState<string>('');

  // モデルダウンロード進捗リスナー
  const handleProgress = (e: Event) => {
    const customEvent = e as CustomEvent;
    const progress = customEvent.detail;
    if (progress.status === 'progress' && progress.file) {
      const percent = progress.progress ? Math.round(progress.progress * 100) : 0;
      setEmbeddingProgress(`Downloading ${progress.file}: ${percent}%`);
    } else if (progress.status === 'done') {
      setEmbeddingProgress('Model loaded successfully!');
      setTimeout(() => {
        setEmbeddingProgress('');
        setIsInitializingEmbedding(false);
      }, 2000);
    }
  };

  useEventListener('embedding-progress' as keyof WindowEventMap, handleProgress as EventListener, { target: window });

  
  const handleKnowledgeGraphToggle = async (enabled: boolean) => {
    handleSettingChange('knowledgeGraph', { ...settings.knowledgeGraph, enabled });

    if (enabled && !settings.knowledgeGraph.modelDownloaded) {
      setIsInitializingEmbedding(true);
      setEmbeddingError('');
      setEmbeddingProgress('Initializing embedding model...');

      try {
        await embeddingService.initialize();
        handleSettingChange('knowledgeGraph', { enabled: true, modelDownloaded: true });
      } catch (error) {
        logger.error('Failed to initialize embedding service:', error);
        setEmbeddingError(error instanceof Error ? error.message : 'Failed to initialize');
        setIsInitializingEmbedding(false);
        
        handleSettingChange('knowledgeGraph', { enabled: false, modelDownloaded: false });
      }
    }
  };

  return (
    <div className="settings-sidebar">
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
              value={settings.nodeSpacing}
              onChange={(e) => handleSettingChange('nodeSpacing', parseInt(e.target.value))}
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
              id="visual-content-default-visible"
              checked={settings.showVisualContentByDefault !== false}
              onChange={(e) => handleSettingChange('showVisualContentByDefault', e.target.checked)}
            />
            <label htmlFor="visual-content-default-visible" className="settings-toggle-label">
              画像・テーブル・Mermaid をデフォルトで表示
            </label>
          </div>
          <div className="settings-description">
            新規ノードや既存ノードで非表示フラグが未設定の場合の既定動作を切り替えます
          </div>

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


      {}

      <div className="settings-section">
        <h3 className="settings-section-title">マークダウン設定</h3>
        <div className="settings-section-content">
          <div className="settings-toggle">
            <input
              type="checkbox"
              id="blank-line-heading"
              checked={settings.addBlankLineAfterHeading}
              onChange={(e) => handleSettingChange('addBlankLineAfterHeading', e.target.checked)}
            />
            <label htmlFor="blank-line-heading" className="settings-toggle-label">
              見出し後に空行を追加
            </label>
          </div>
          <div className="settings-description">
            見出しノードの下に子ノードを追加したとき、マークダウンで空行を自動的に挿入します
          </div>

          <div className="settings-input-group" style={{ marginTop: '16px' }}>
            <label className="settings-input-label">デフォルト折りたたみ階層</label>
            <select
              value={settings.defaultCollapseDepth ?? 2}
              onChange={(e) => handleSettingChange('defaultCollapseDepth', parseInt(e.target.value))}
              className="settings-select"
            >
              <option value="0">折りたたまない</option>
              <option value="1">1階層目から折りたたむ</option>
              <option value="2">2階層目から折りたたむ</option>
              <option value="3">3階層目から折りたたむ</option>
              <option value="4">4階層目から折りたたむ</option>
              <option value="5">5階層目から折りたたむ</option>
              <option value="6">6階層目から折りたたむ</option>
            </select>
            <div className="settings-description">
              マークダウン読み込み時に、指定した階層より深いノードを自動的に折りたたみます
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">ナレッジグラフ設定</h3>
        <div className="settings-section-content">
          <div className="settings-toggle">
            <input
              type="checkbox"
              id="knowledge-graph-enabled"
              checked={settings.knowledgeGraph.enabled}
              onChange={(e) => handleKnowledgeGraphToggle(e.target.checked)}
              disabled={isInitializingEmbedding}
            />
            <label htmlFor="knowledge-graph-enabled" className="settings-toggle-label">
              ナレッジグラフ機能を有効化
            </label>
          </div>
          <div className="settings-description">
            ONにすると、.mdファイルを多言語対応AIモデルでベクトル化し、2D空間で類似ファイルを可視化できます。
            初回は約100MBのモデルダウンロードが必要です。
          </div>

          {isInitializingEmbedding && (
            <div className="settings-description" style={{ marginTop: '8px', color: 'var(--accent-color)' }}>
              {embeddingProgress || 'Initializing...'}
            </div>
          )}

          {embeddingError && (
            <div className="settings-description" style={{ marginTop: '8px', color: '#ff6b6b' }}>
              Error: {embeddingError}
            </div>
          )}

          {settings.knowledgeGraph.enabled && !isInitializingEmbedding && (
            <div className="settings-description" style={{ marginTop: '8px', color: 'var(--accent-color)' }}>
              ✓ 有効化されました。ファイル編集時に自動でベクトル化されます。
            </div>
          )}
        </div>
      </div>


      <style>{`
        .settings-sidebar {
          padding: 16px;
          overflow-y: auto;
          background-color: var(--bg-primary);
        }

        ${sharedSidebarStyles}

        .settings-color-input {
          padding: 4px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-primary);
          cursor: pointer;
          width: 60px;
          height: 32px;
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

        ${colorSetStyles}
      `}</style>

      {}
    </div>
  );
};

export default React.memo(SettingsSidebar);
