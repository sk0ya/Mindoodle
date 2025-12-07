import React, { useEffect, useRef } from 'react';
import { viewportService } from '@/app/core/services';
import { menuStyles, menuContainerStyles } from '../../shared/menuStyles';

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
          ${menuContainerStyles}
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

        [data-theme="dark"] .node-title {
          color: #e0e0e0;
        }

        [data-theme="dark"] .node-description {
          color: #aaa;
        }

        ${menuStyles}
      `}</style>
    </div>
  );
};

export default ContextMenu;
