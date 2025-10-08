import React from 'react';
import type { VimModeHook } from '../hooks/useVimMode';

interface Props {
  vim: VimModeHook;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const JumpyLabels: React.FC<Props> = ({ vim }) => {
  if (vim.mode !== 'jumpy' || vim.jumpyLabels.length === 0) {
    return null;
  }

  // Get node positions from DOM elements
  const getNodePosition = (nodeId: string): NodePosition | null => {
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
    if (!nodeElement) {
      return null;
    }

    const rect = nodeElement.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height
    };
  };

  // Render label with highlighting
  const renderLabel = (label: string, buffer: string) => {
    if (!buffer) {
      return <span>{label}</span>;
    }

    const matchLength = buffer.length;
    const matchedPart = label.slice(0, matchLength);
    const remainingPart = label.slice(matchLength);

    return (
      <span>
        <span className="jumpy-label-highlight">{matchedPart}</span>
        <span>{remainingPart}</span>
      </span>
    );
  };

  return (
    <div className="jumpy-labels-overlay">
      {vim.jumpyLabels.map(({ nodeId, label }) => {
        // Only show labels that start with the current buffer
        if (vim.jumpyBuffer && !label.startsWith(vim.jumpyBuffer)) {
          return null;
        }

        const position = getNodePosition(nodeId);
        if (!position) return null;

        return (
          <div
            key={nodeId}
            className="jumpy-label"
            style={{
              position: 'fixed',
              left: position.x - 8,
              top: position.y - 8,
              zIndex: 10000,
            }}
          >
            {renderLabel(label, vim.jumpyBuffer)}
          </div>
        );
      })}

      <style>{`
        .jumpy-labels-overlay {
          pointer-events: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 9999;
        }

        .jumpy-label {
          background: #fed7aa;
          color: #000000;
          padding: 0px 3px;
          border-radius: 2px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          border: 1px solid #fdba74;
          min-width: 16px;
          text-align: center;
          line-height: 1.2;
        }

        .jumpy-label-highlight {
          color: #666666;
        }
      `}</style>
    </div>
  );
};

export default JumpyLabels;