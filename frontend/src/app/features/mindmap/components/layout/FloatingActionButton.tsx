import React, { useState } from 'react';
import { RotateCcw, RotateCw, Menu, X } from 'lucide-react';
import { ShortcutTooltip } from '../KeyboardShortcutHelper';

interface FloatingActionButtonProps {
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  showNotesPanel?: boolean;
  showNodeNotePanel?: boolean;
  markdownPanelWidth?: number;
  nodeNotePanelHeight?: number;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  showNotesPanel = false,
  showNodeNotePanel = false,
  markdownPanelWidth = 0,
  nodeNotePanelHeight = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate right offset for markdown panel
  const rightOffset = showNotesPanel ? markdownPanelWidth + 24 : 24;

  // Calculate bottom offset for node note panel
  const bottomOffset = showNodeNotePanel ? nodeNotePanelHeight + 24 : 24;

  return (
    <div
      className="floating-action-button"
      style={{
        position: 'fixed',
        bottom: bottomOffset,
        right: rightOffset,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        transition: 'bottom 0.3s ease, right 0.3s ease',
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Expanded buttons */}
      {isExpanded && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            animation: 'fabSlideIn 0.2s ease-out',
          }}
        >
          <ShortcutTooltip shortcut="Ctrl+Z" description="元に戻す">
            <button
              className={`fab-button ${!canUndo ? 'disabled' : ''}`}
              onClick={onUndo}
              disabled={!canUndo}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--background-primary)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canUndo ? 'pointer' : 'not-allowed',
                opacity: canUndo ? 1 : 0.5,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (canUndo) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = 'var(--background-primary)';
              }}
            >
              <RotateCcw size={18} />
            </button>
          </ShortcutTooltip>

          <ShortcutTooltip shortcut="Ctrl+Y" description="やり直し">
            <button
              className={`fab-button ${!canRedo ? 'disabled' : ''}`}
              onClick={onRedo}
              disabled={!canRedo}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--background-primary)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: canRedo ? 'pointer' : 'not-allowed',
                opacity: canRedo ? 1 : 0.5,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (canRedo) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = 'var(--background-primary)';
              }}
            >
              <RotateCw size={18} />
            </button>
          </ShortcutTooltip>

          <ShortcutTooltip description={`ズームリセット (現在: ${Math.round(zoom * 100)}%)`}>
            <button
              className="fab-button"
              onClick={onZoomReset}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--background-primary)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                transition: 'all 0.2s',
                fontSize: 11,
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.backgroundColor = 'var(--background-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.backgroundColor = 'var(--background-primary)';
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
          </ShortcutTooltip>
        </div>
      )}

      {/* Main FAB button */}
      <button
        className="fab-main-button"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--accent-color)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        }}
      >
        {isExpanded ? <X size={24} /> : <Menu size={24} />}
      </button>

      <style>{`
        @keyframes fabSlideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default FloatingActionButton;
