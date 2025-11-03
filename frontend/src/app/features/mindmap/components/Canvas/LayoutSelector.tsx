import React from 'react';
import { Network, GitBranch } from 'lucide-react';
import { useMindMapStore } from '../../store';
import '../../styles/LayoutSelector.css';

const ACTIVITY_BAR_WIDTH = 48;
const SIDEBAR_WIDTH = 280;

/**
 * Layout selector component for switching between mindmap and tree layouts
 * Positioned in the bottom-left corner of the canvas, adjusted for activity bar and sidebar
 */
const LayoutSelector: React.FC = () => {
  const { settings, updateSetting, ui } = useMindMapStore();

  const handleLayoutChange = (layoutType: 'mindmap' | 'tree') => {
    updateSetting('layoutType', layoutType);
  };

  // Calculate left position based on activity bar and sidebar state
  // Match the offset calculation used in TopLeftTitlePanel
  const leftPosition = ACTIVITY_BAR_WIDTH + (ui.activeView && !ui.sidebarCollapsed ? SIDEBAR_WIDTH : 0) + 8;

  // Dynamically lift the selector above the bottom note panel if visible
  const bottomOffsetCss = `calc(var(--vim-statusbar-height, 24px) + 6px + ${Math.max(ui.nodeNotePanelHeight || 0, 0)}px)`;

  return (
    <div
      className="layout-selector"
      style={{ left: `${leftPosition}px`, bottom: bottomOffsetCss }}
    >
      <button
        className={`layout-option ${settings.layoutType === 'mindmap' ? 'active' : ''}`}
        onClick={() => handleLayoutChange('mindmap')}
        title="マインドマップレイアウト"
        aria-label="Switch to mindmap layout"
      >
        <Network size={20} />
        <span>マインドマップ</span>
      </button>
      <button
        className={`layout-option ${settings.layoutType === 'tree' ? 'active' : ''}`}
        onClick={() => handleLayoutChange('tree')}
        title="ツリーレイアウト"
        aria-label="Switch to tree layout"
      >
        <GitBranch size={20} />
        <span>ツリー</span>
      </button>
    </div>
  );
};

export default LayoutSelector;
