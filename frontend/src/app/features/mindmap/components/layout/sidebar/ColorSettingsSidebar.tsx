// moved to layout/sidebar
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useMindMapStore } from '../../../store';

interface ColorSettingsSidebarProps {
}

const ColorSettingsSidebar: React.FC<ColorSettingsSidebarProps> = () => {
  const { settings, updateSetting } = useMindMapStore();

  const handleSettingChange = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSetting(key, value);
  };

  return (
    <div className="color-settings-sidebar">
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
        <h3 className="settings-section-title">接続線の色設定</h3>
        <div className="settings-section-content">
          <div className="settings-description" style={{ marginBottom: '12px' }}>
            ルートノードから子ノードへの接続線のカラーセットを選択します。
          </div>
          <div className="color-set-grid">
            {Object.entries({
              vibrant: { name: '鮮やか', description: '色の区別がつきやすいビビッドな配色', colors: ['#FF6B6B', '#4ECDC4', '#FECA57', '#54A0FF', '#FF9FF3', '#96CEB4'] },
              gentle: { name: 'やさしい', description: '気持ちが軽くなるソフトな配色', colors: ['#FFB5B5', '#A8E6CF', '#FFE699', '#B5D7FF', '#FFD4F0', '#C4E8C2'] },
              pastel: { name: 'パステル', description: '柔らかく落ち着いたパステルカラー', colors: ['#FFD1DC', '#B4E7CE', '#FFF4C2', '#C2E0FF', '#E8D4FF', '#D4F1D4'] },
              nord: { name: 'Nord', description: 'Nord テーマ風の落ち着いた配色', colors: ['#BF616A', '#88C0D0', '#EBCB8B', '#5E81AC', '#B48EAD', '#A3BE8C'] },
              warm: { name: '暖色系', description: '温かみのある暖色中心の配色', colors: ['#FF6B6B', '#FF9F43', '#FECA57', '#FFB142', '#FF7979', '#F8B739'] },
              cool: { name: '寒色系', description: '落ち着いた寒色中心の配色', colors: ['#5DADE2', '#48C9B0', '#85C1E2', '#52B788', '#6C9BD1', '#45B39D'] },
              monochrome: { name: 'モノクロ', description: 'グレースケールのシンプルな配色', colors: ['#4A4A4A', '#707070', '#909090', '#B0B0B0', '#D0D0D0', '#606060'] },
              sunset: { name: '夕暮れ', description: '夕焼けをイメージした配色', colors: ['#FF6B9D', '#FF8E53', '#FFB627', '#FFA45B', '#FF7B89', '#FFAA5C'] }
            }).map(([key, colorSet]) => (
              <div
                key={key}
                className={`color-set-card ${(settings as any).edgeColorSet === key ? 'selected' : ''}`}
                onClick={() => handleSettingChange('edgeColorSet' as keyof typeof settings, key as any)}
              >
                <div className="color-set-header">
                  <span className="color-set-name">{colorSet.name}</span>
                  {(settings as any).edgeColorSet === key && <span className="color-set-check">✓</span>}
                </div>
                <div className="color-set-colors">
                  {colorSet.colors.map((color, idx) => (
                    <div key={idx} className="color-set-swatch" style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="color-set-description">{colorSet.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .color-settings-sidebar {
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
    </div>
  );
};

export default ColorSettingsSidebar;
