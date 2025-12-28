import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { viewportService } from '@/app/core/services';
import { menuStyles, menuContainerStyles } from '../../shared/menuStyles';

export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  separator?: boolean;
  disabled?: boolean;
  danger?: boolean;
  submenu?: ContextMenuItem[];
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
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const submenuTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setOpenSubmenu(null);
      return;
    }

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

          const hasSubmenu = item.submenu && item.submenu.length > 0;

          return (
            <div
              key={index}
              className="menu-item-wrapper"
              onMouseEnter={() => {
                if (hasSubmenu) {
                  if (submenuTimerRef.current) {
                    clearTimeout(submenuTimerRef.current);
                  }
                  setOpenSubmenu(index);
                }
              }}
              onMouseLeave={() => {
                if (hasSubmenu) {
                  submenuTimerRef.current = setTimeout(() => {
                    setOpenSubmenu(null);
                  }, 200);
                }
              }}
            >
              <button
                className={`menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''}`}
                onClick={() => {
                  if (!item.disabled && !hasSubmenu && item.onClick) {
                    item.onClick();
                    onClose();
                  }
                }}
                disabled={item.disabled}
              >
                {item.icon && <span className="menu-icon">{item.icon}</span>}
                {item.label && <span className="menu-text">{item.label}</span>}
                {hasSubmenu && <ChevronRight size={14} className="submenu-arrow" />}
              </button>

              {hasSubmenu && openSubmenu === index && (() => {
                console.log('[ContextMenu] Rendering submenu for index:', index, 'with', item.submenu?.length, 'items');
                return (
                <div className="submenu" style={{display: 'block'}}>
                  {item.submenu!.map((subItem, subIndex) => {
                    if (subItem.separator) {
                      return <div key={subIndex} className="menu-divider" />;
                    }

                    return (
                      <button
                        key={subIndex}
                        className={`menu-item ${subItem.disabled ? 'disabled' : ''} ${subItem.danger ? 'danger' : ''}`}
                        onClick={() => {
                          if (!subItem.disabled && subItem.onClick) {
                            subItem.onClick();
                            onClose();
                          }
                        }}
                        disabled={subItem.disabled}
                      >
                        {subItem.icon && <span className="menu-icon">{subItem.icon}</span>}
                        {subItem.label && <span className="menu-text">{subItem.label}</span>}
                      </button>
                    );
                  })}
                </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      <style>{`
        .node-context-menu {
          ${menuContainerStyles}
        }

        .node-context-menu .menu-items {
          overflow: visible;
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

        .menu-item-wrapper {
          position: relative;
          width: 100%;
        }

        .menu-item-wrapper .menu-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .submenu-arrow {
          margin-left: 8px;
          flex-shrink: 0;
        }

        .submenu {
          position: absolute;
          left: calc(100% + 4px);
          top: 0;
          min-width: 200px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          padding: 4px 0;
          z-index: 10002;
        }

        [data-theme="dark"] .submenu {
          background: #2a2a2a;
          border-color: #444;
        }

        ${menuStyles}
      `}</style>
    </div>
  );
};

export default ContextMenu;
