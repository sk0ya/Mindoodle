import React, { useRef, useCallback } from 'react';
import { Link } from 'lucide-react';
import type { NodeLink } from '@shared/types';
import { viewportService } from '@/app/core/services';
import { menuStyles, menuContainerStyles } from '../shared/menuStyles';
import { useClickOutside } from '../shared/useModalBehavior';

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

  useClickOutside(menuRef, isOpen, onClose);

  
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
          ${menuContainerStyles}
        }

        ${menuStyles}
      `}</style>
    </div>
  );
};

export default LinkActionMenu;
