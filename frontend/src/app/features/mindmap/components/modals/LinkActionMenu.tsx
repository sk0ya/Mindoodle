import React, { useRef, useCallback } from 'react';
import { Link } from 'lucide-react';
import type { NodeLink } from '@shared/types';
import { viewportService } from '@/app/core/services';
import { useEventListener } from '@shared/hooks/system/useEventListener';

interface LinkActionMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  link: NodeLink;
  onClose: () => void;
  onNavigate: (link: NodeLink) => void;
}

const LinkActionMenu: React.FC<LinkActionMenuProps> = ({
  isOpen,
  position,
  link,
  onClose,
  onNavigate,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      onClose();
    }
  }, [onClose]);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEventListener('mousedown', handleClickOutside, { target: document, enabled: isOpen });
  useEventListener('keydown', handleEscape, { target: document, enabled: isOpen });

  
  const adjustedPosition = useCallback(() => {
    if (!menuRef.current) return position;

    const menuRect = menuRef.current.getBoundingClientRect();
    const { width: viewportWidth, height: viewportHeight } = viewportService.getSize();

    let { x, y } = position;

    
    if (x + menuRect.width > viewportWidth - 20) {
      x = viewportWidth - menuRect.width - 20;
    }

    
    if (y + menuRect.height > viewportHeight - 20) {
      y = Math.max(20, y - menuRect.height);
    }

    
    x = Math.max(20, x);
    y = Math.max(20, y);

    return { x, y };
  }, [position]);

  const handleNavigate = useCallback(() => {
    onNavigate(link);
    onClose();
  }, [link, onNavigate, onClose]);

  if (!isOpen) return null;

  const pos = adjustedPosition();

  return (
    <div
      ref={menuRef}
      className="link-action-menu"
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 10001
      }}
    >
      <div className="menu-items">
        <button className="menu-item primary" onClick={handleNavigate}>
          <span className="menu-icon"><Link size={14} /></span>
          <span className="menu-text">リンク先に移動</span>
        </button>
      </div>


      <style>{`
        .link-action-menu {
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

        .link-title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 2px;
          word-wrap: break-word;
        }

        .link-description {
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

        .menu-item:hover {
          background: #f3f4f6;
        }

        .menu-item.primary {
          color: #2563eb;
          font-weight: 500;
        }

        .menu-item.primary:hover {
          background: #dbeafe;
        }

        .menu-item.danger {
          color: #dc2626;
        }

        .menu-item.danger:hover {
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

        .menu-footer {
          padding: 8px 16px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
        }

        .link-info {
          font-size: 11px;
          color: #6b7280;
        }

        .info-item {
          display: flex;
          margin-bottom: 2px;
        }

        .info-item:last-child {
          margin-bottom: 0;
        }

        .info-label {
          font-weight: 500;
          margin-right: 4px;
          min-width: 55px;
        }

        .info-value {
          word-break: break-all;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default LinkActionMenu;