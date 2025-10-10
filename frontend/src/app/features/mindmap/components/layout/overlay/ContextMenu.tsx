import React, { useEffect, useRef } from 'react';
import { viewportService } from '@/app/core/services';

export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  separator?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
  onClose: () => void;
  header?: {
    title: string;
    description?: string;
  };
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  position,
  items,
  onClose,
  header
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  
  useEffect(() => {
    if (isVisible && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const { width: viewportWidth, height: viewportHeight } = viewportService.getSize();

      let adjustedX = position.x;
      let adjustedY = position.y;

      
      if (position.x + rect.width > viewportWidth - 20) {
        adjustedX = viewportWidth - rect.width - 20;
      }

      
      if (position.y + rect.height > viewportHeight - 20) {
        adjustedY = Math.max(20, position.y - rect.height);
      }

      
      adjustedX = Math.max(20, adjustedX);
      adjustedY = Math.max(20, adjustedY);

      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [isVisible, position]);

  if (!isVisible) return null;

  return (
    <div
      ref={menuRef}
      className="node-context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10001
      }}
    >
      {header && (
        <>
          <div className="menu-header">
            <div className="node-title">{header.title}</div>
            {header.description && <div className="node-description">{header.description}</div>}
          </div>
          <div className="menu-divider" />
        </>
      )}

      <div className="menu-items">
        {items.map((item, index) => {
          if (item.separator) {
            return <div key={index} className="menu-divider" />;
          }

          return (
            <button
              key={index}
              className={`menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`}
              onClick={() => {
                if (!item.disabled && item.onClick) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
            >
              {item.icon && <span className="menu-icon">{item.icon}</span>}
              {item.label && <span className="menu-text">{item.label}</span>}
            </button>
          );
        })}
      </div>

      <style>{`
        .node-context-menu {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          min-width: 220px;
          max-width: 300px;
          overflow: hidden;
          font-size: 14px;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .menu-header {
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .node-title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 2px;
          word-wrap: break-word;
        }

        .node-description {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .menu-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 4px 0;
        }

        .menu-items {
          padding: 4px 0;
        }

        .menu-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 8px 16px;
          border: none;
          background: none;
          color: #374151;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .menu-item:hover:not(.disabled) {
          background: #f3f4f6;
        }

        .menu-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .menu-item.danger {
          color: #dc2626;
        }

        .menu-item.danger:hover:not(.disabled) {
          background: #fef2f2;
        }

        .menu-icon {
          margin-right: 8px;
          font-size: 14px;
          width: 16px;
          text-align: center;
        }

        .menu-text {
          flex: 1;
        }

        [data-theme="dark"] .node-context-menu {
          background: #2a2a2a;
          border: 1px solid #444;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
        }

        [data-theme="dark"] .menu-header {
          background: #333;
          border-bottom: 1px solid #555;
        }

        [data-theme="dark"] .node-title {
          color: #e0e0e0;
        }

        [data-theme="dark"] .node-description {
          color: #aaa;
        }

        [data-theme="dark"] .menu-divider {
          background: #555;
        }

        [data-theme="dark"] .menu-item {
          color: #e0e0e0;
        }

        [data-theme="dark"] .menu-item:hover:not(.disabled) {
          background: #404040;
        }

        [data-theme="dark"] .menu-item.danger {
          color: #ff6b6b;
        }

        [data-theme="dark"] .menu-item.danger:hover:not(.disabled) {
          background: #4a2c2c;
        }
      `}</style>
    </div>
  );
};

export default ContextMenu;
