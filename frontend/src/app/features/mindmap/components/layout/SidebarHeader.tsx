import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface SidebarHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onToggleCollapse?: () => void;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onToggleCollapse,
}) => {

  return (
    <div className="sidebar-header">
      <div className="header-top">
        {onToggleCollapse && (
          <button
            className="sidebar-collapse-toggle"
            onClick={onToggleCollapse}
            title="サイドバーを隠す"
          >
<ChevronLeft size={16} />
          </button>
        )}
      </div>
      
      <div className="search-container">
        <input
          type="text"
          placeholder="マインドマップを検索..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>
    </div>
  );
};

export default SidebarHeader;
