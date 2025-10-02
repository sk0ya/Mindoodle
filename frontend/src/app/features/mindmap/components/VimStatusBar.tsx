import React, { useEffect, useRef } from 'react';
import { useVimMode } from '../../vim/hooks/useVimMode';
import { useStatusBar } from '@shared/hooks';
type Props = {
  vim: ReturnType<typeof useVimMode>;
};

const VimStatusBar: React.FC<Props> = ({ vim }) => {
  const { state: status } = useStatusBar();
  const unifiedInputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering search or command mode
  useEffect(() => {
    if ((vim.mode === 'search' || vim.mode === 'command') && unifiedInputRef.current) {
      unifiedInputRef.current.focus();
    }
  }, [vim.mode]);

  // Handle unified input for both search and command modes
  const handleInputChange = (value: string) => {
    if (value.length === 0) {
      // Empty input - return to normal mode
      if (vim.mode === 'search') {
        vim.exitSearch();
      } else if (vim.mode === 'command') {
        vim.exitCommandLine();
      }
      return;
    }

    const firstChar = value[0];
    const content = value.slice(1);

    if (firstChar === '/') {
      // Search mode
      if (vim.mode !== 'search') {
        vim.startSearch();
      }
      vim.updateSearchQuery(content);
    } else if (firstChar === ':') {
      // Command mode
      if (vim.mode !== 'command') {
        vim.startCommandLine();
      }
      vim.updateCommandLineBuffer(content);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (vim.mode === 'search') {
        vim.exitSearch();
      } else if (vim.mode === 'command') {
        vim.exitCommandLine();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (vim.mode === 'search') {
        vim.executeSearch();
        vim.setMode('normal');
      } else if (vim.mode === 'command') {
        const command = vim.commandLineBuffer.trim();
        if (command) {
          vim.executeCommandLine(command).then(() => {
            vim.exitCommandLine();
          });
        } else {
          vim.exitCommandLine();
        }
      }
      return;
    }

    // Handle backspace on first character (mode prefix)
    if (e.key === 'Backspace' && value.length === 1) {
      e.preventDefault();
      if (vim.mode === 'search') {
        vim.exitSearch();
      } else if (vim.mode === 'command') {
        vim.exitCommandLine();
      }
      return;
    }
  };

  // Get current input value based on mode
  const getInputValue = () => {
    if (vim.mode === 'search') {
      return '/' + vim.searchQuery;
    } else if (vim.mode === 'command') {
      return ':' + vim.commandLineBuffer;
    }
    return '';
  };

  const getModeColor = () => {
    switch (vim.mode) {
      case 'normal':
        return '#6366f1'; // Indigo
      case 'insert':
        return '#10b981'; // Green
      case 'visual':
        return '#f59e0b'; // Amber
      case 'command':
        return '#ef4444'; // Red
      case 'search':
        return '#8b5cf6'; // Purple
      case 'jumpy':
        return '#f97316'; // Orange
      default:
        return '#6b7280'; // Gray
    }
  };

  const getModeText = () => {
    switch (vim.mode) {
      case 'normal':
        return '-- NORMAL --';
      case 'insert':
        return '-- INSERT --';
      case 'visual':
        return '-- VISUAL --';
      case 'command':
        return '-- COMMAND --';
      case 'search':
        return '-- SEARCH --';
      case 'jumpy':
        return '-- JUMPY --';
      default:
        return '-- VIM --';
    }
  };

  return (
    <div className="vim-status-bar">
      {vim.isEnabled ? (
        <div
          className="vim-mode-indicator"
          style={{ backgroundColor: getModeColor() }}
        >
          {getModeText()}
        </div>
      ) : (
        <div className="vim-mode-indicator vim-off">STATUS</div>
      )}

      {vim.isEnabled && (vim.mode === 'search' || vim.mode === 'command') && (
        <div className={`vim-unified-input ${vim.mode === 'search' ? 'search-mode' : 'command-mode'}`}>
          <input
            ref={unifiedInputRef}
            type="text"
            value={getInputValue()}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="vim-unified-input-field"
            autoFocus
          />
          {vim.mode === 'search' && vim.searchResults.length > 0 && (
            <span className="search-results-count">
              [{vim.currentSearchIndex + 1}/{vim.searchResults.length}]
            </span>
          )}
        </div>
      )}
      {vim.isEnabled && vim.mode === 'jumpy' && (
        <div className="vim-jumpy-info">
          {vim.jumpyBuffer ? `Jumpy: ${vim.jumpyBuffer}` : `Type label to jump to node (${vim.jumpyLabels.length} nodes available)`}
        </div>
      )}
      {vim.isEnabled && vim.commandBuffer && vim.mode !== 'search' && vim.mode !== 'command' && (
        <div className="vim-command-buffer">
          :{vim.commandBuffer}
        </div>
      )}
      {vim.isEnabled && vim.lastCommand && (
        <div className="vim-last-command">
          Last: {vim.lastCommand}
        </div>
      )}
      {vim.isEnabled && vim.commandOutput && vim.mode === 'normal' && (
        <div className="vim-command-output">
          {vim.commandOutput}
        </div>
      )}

      <div className={`vim-status-message ${status.type}`}>
        {status.message || ''}
      </div>

      <style>{`
        .vim-status-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 24px;
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 0 12px;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          z-index: 1000;
          gap: 12px;
        }

        .vim-mode-indicator {
          color: white;
          padding: 2px 8px;
          border-radius: 3px;
          font-weight: bold;
          font-size: 11px;
          text-transform: uppercase;
        }

        .vim-mode-indicator.vim-off {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .vim-command-buffer {
          color: var(--text-primary);
          background: var(--bg-tertiary);
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
        }

        .vim-unified-input {
          color: var(--text-primary);
          background: var(--bg-tertiary);
          padding: 2px 6px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .vim-unified-input.search-mode {
          border: 1px solid #8b5cf6;
        }

        .vim-unified-input.command-mode {
          border: 1px solid #ef4444;
        }

        .vim-unified-input-field {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-family: inherit;
          font-size: inherit;
          padding: 0;
          margin: 0;
          flex: 1;
          min-width: 100px;
        }

        .search-results-count {
          color: var(--text-secondary);
          font-size: 10px;
          opacity: 0.8;
        }

        .vim-jumpy-info {
          color: var(--text-primary);
          background: var(--bg-tertiary);
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid #f97316;
          font-size: 11px;
        }

        .vim-last-command {
          color: var(--text-secondary);
          font-size: 10px;
          opacity: 0.7;
        }

        .vim-command-output {
          color: var(--text-primary);
          background: var(--bg-tertiary);
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid var(--border-color);
          font-size: 11px;
        }

        .vim-status-message {
          margin-left: auto;
          min-height: 16px;
          display: flex;
          align-items: center;
          color: var(--text-secondary);
        }
        .vim-status-message.success { color: #10b981; }
        .vim-status-message.error { color: #ef4444; }
        .vim-status-message.warning { color: #f59e0b; }
        .vim-status-message.info { color: #3b82f6; }
        .vim-status-message.neutral { color: var(--text-secondary); }

        /* Do not add extra body padding; scrolling logic already accounts for 24px */
      `}</style>
    </div>
  );
};

export default VimStatusBar;
