import React from 'react';
import { ChevronLeft, Workflow } from 'lucide-react';

interface SidebarHeaderProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onToggleCollapse?: () => void;
  onCreateMap?: () => void;
  canCreateMap?: boolean;
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  searchTerm,
  onSearchChange,
  onToggleCollapse,
  onCreateMap,
  canCreateMap = true,
}) => {
  return (
    <div className="sidebar-header">
      <div className="header-top">
        <div className="header-actions">
          {onCreateMap && (
            <button
              type="button"
              className="sidebar-create-map-button"
              onClick={onCreateMap}
              disabled={!canCreateMap}
              title={canCreateMap ? '新しいマップを作成' : 'ワークスペースを選択してください'}
            >
              <Workflow size={15} />
              <span>新規</span>
            </button>
          )}

          {onToggleCollapse && (
            <button
              type="button"
              className="sidebar-collapse-toggle"
              onClick={onToggleCollapse}
              title="サイドバーを隠す"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder="マインドマップを検索..."
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className="search-input"
        />
      </div>
    </div>
  );
};

export default SidebarHeader;
