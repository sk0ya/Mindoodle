
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useSettings, useUpdateSetting } from '../../../hooks/useStoreSelectors';
import { colorSetStyles } from './colorSetStyles';
import { sharedSidebarStyles } from './sharedSidebarStyles';

interface ColorSettingsSidebarProps {
}

const ColorSettingsSidebar: React.FC<ColorSettingsSidebarProps> = () => {
  const settings = useSettings();
  const updateSetting = useUpdateSetting();

  const handleSettingChange = React.useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    updateSetting(key, value);
  }, [updateSetting]);

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
            } as const).map(([key, colorSet]) => (
              <div
                key={key}
                className={`color-set-card ${settings.edgeColorSet === key ? 'selected' : ''}`}
                onClick={() => handleSettingChange('edgeColorSet', key)}
              >
                <div className="color-set-header">
                  <span className="color-set-name">{colorSet.name}</span>
                  {settings.edgeColorSet === key && <span className="color-set-check">✓</span>}
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

        ${sharedSidebarStyles}
        ${colorSetStyles}
      `}</style>
    </div>
  );
};

export default React.memo(ColorSettingsSidebar);
