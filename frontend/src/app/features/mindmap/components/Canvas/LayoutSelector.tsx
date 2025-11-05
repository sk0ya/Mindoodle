import React from 'react';
import { Network, GitBranch } from 'lucide-react';
import { useMindMapStore } from '../../store';
import '../../styles/LayoutSelector.css';

/**
 * Layout selector component for switching between mindmap and tree layouts
 * Positioned in the bottom-left corner of the canvas, adjusted for activity bar and sidebar
 */
const LayoutSelector: React.FC = () => {
  const { settings, updateSetting } = useMindMapStore();

  const handleLayoutChange = (layoutType: 'mindmap' | 'tree') => {
    updateSetting('layoutType', layoutType);
  };

  // Inside canvas container: simple padding from the edges
  const leftPosition = 12;
  const bottomPosition = 12;

  return (
    <div className="layout-selector" style={{ left: `${leftPosition}px`, bottom: `${bottomPosition}px` }}>
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
