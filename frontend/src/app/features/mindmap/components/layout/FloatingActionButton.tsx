import React, { useState } from 'react';
import { RotateCcw, RotateCw, Menu, X, Network, GitBranch, StickyNote, FileText } from 'lucide-react';
import { ShortcutTooltip } from '../KeyboardShortcutHelper';
import { useMindMapStore } from '../../store';

interface FloatingActionButtonProps {
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  showNotesPanel?: boolean;
  showNodeNotePanel?: boolean;
}

const btnBase = {
  width: 44, height: 44, borderRadius: '50%',
  border: '1px solid var(--border-color)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', transition: 'all 0.2s',
  color: 'var(--text-primary)',
};

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onUndo, onRedo, canUndo, canRedo, zoom, onZoomReset,
  showNotesPanel = false,
  showNodeNotePanel = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    settings,
    updateSetting,
    setShowNotesPanel,
    setShowNodeNotePanel,
    selectedNodeId,
  } = useMindMapStore();
  const canToggleNodeNotePanel = showNodeNotePanel || !!selectedNodeId;

  const handleBtnEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.05)';
    e.currentTarget.style.backgroundColor = 'var(--hover-color)';
  };

  const handleBtnLeave = (e: React.MouseEvent<HTMLButtonElement>, defaultBg = 'var(--bg-secondary)') => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.backgroundColor = defaultBg;
  };

  return (
    <div
      style={{ position: 'absolute', bottom: 24, left: 24, zIndex: 1000,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
        transition: 'left 0.3s ease' }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'fabSlideIn 0.2s ease-out' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['mindmap', 'tree'].map(type => (
              <ShortcutTooltip key={type} description={type === 'mindmap' ? 'マインドマップレイアウト' : 'ツリーレイアウト'}>
                <button
                  onClick={() => updateSetting('layoutType', type as 'mindmap' | 'tree')}
                  style={{ ...btnBase, backgroundColor: settings.layoutType === type ? 'var(--hover-color)' : 'var(--bg-secondary)', cursor: 'pointer' }}
                  onMouseEnter={handleBtnEnter}
                  onMouseLeave={e => handleBtnLeave(e, settings.layoutType === type ? 'var(--hover-color)' : 'var(--bg-secondary)')}
                >
                  {type === 'mindmap' ? <Network size={18} /> : <GitBranch size={18} />}
                </button>
              </ShortcutTooltip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ShortcutTooltip description="マップのMarkdownを表示/非表示">
              <button
                onClick={() => setShowNotesPanel(!showNotesPanel)}
                style={{
                  ...btnBase,
                  backgroundColor: showNotesPanel ? 'var(--hover-color)' : 'var(--bg-secondary)',
                  cursor: 'pointer'
                }}
                onMouseEnter={handleBtnEnter}
                onMouseLeave={e => handleBtnLeave(e, showNotesPanel ? 'var(--hover-color)' : 'var(--bg-secondary)')}
              >
                <FileText size={18} />
              </button>
            </ShortcutTooltip>
            <ShortcutTooltip description="選択ノードのノートを表示/非表示">
              <button
                onClick={() => setShowNodeNotePanel?.(!showNodeNotePanel)}
                disabled={!canToggleNodeNotePanel}
                style={{
                  ...btnBase,
                  backgroundColor: showNodeNotePanel ? 'var(--hover-color)' : 'var(--bg-secondary)',
                  cursor: canToggleNodeNotePanel ? 'pointer' : 'not-allowed',
                  opacity: canToggleNodeNotePanel ? 1 : 0.5
                }}
                onMouseEnter={canToggleNodeNotePanel ? handleBtnEnter : undefined}
                onMouseLeave={e => handleBtnLeave(e, showNodeNotePanel ? 'var(--hover-color)' : 'var(--bg-secondary)')}
              >
                <StickyNote size={18} />
              </button>
            </ShortcutTooltip>
          </div>
          {[
            { label: 'Ctrl+Z', desc: '元に戻す', action: onUndo, enabled: canUndo, Icon: RotateCcw },
            { label: 'Ctrl+Y', desc: 'やり直し', action: onRedo, enabled: canRedo, Icon: RotateCw },
          ].map(({ label, desc, action, enabled, Icon }) => (
            <ShortcutTooltip key={label} shortcut={label} description={desc}>
              <button
                onClick={action}
                disabled={!enabled}
                style={{ ...btnBase, backgroundColor: 'var(--bg-secondary)', cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : 0.5 }}
                onMouseEnter={enabled ? handleBtnEnter : undefined}
                onMouseLeave={e => handleBtnLeave(e)}
              >
                <Icon size={18} />
              </button>
            </ShortcutTooltip>
          ))}
          <ShortcutTooltip description={`ズームリセット (現在: ${Math.round(zoom * 100)}%)`}>
            <button
              onClick={onZoomReset}
              style={{ ...btnBase, backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
              onMouseEnter={handleBtnEnter}
              onMouseLeave={e => handleBtnLeave(e)}
            >
              {Math.round(zoom * 100)}%
            </button>
          </ShortcutTooltip>
        </div>
      )}
      <button
        style={{ ...btnBase, width: 56, height: 56, backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)' }}
        onMouseEnter={handleBtnEnter}
        onMouseLeave={e => handleBtnLeave(e)}
      >
        {isExpanded ? <X size={24} /> : <Menu size={24} />}
      </button>
      <style>{`@keyframes fabSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
};

export default FloatingActionButton;
