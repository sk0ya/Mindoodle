import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { MindMapData, MapIdentifier } from '@shared/types';
import { searchMultipleMaps, getMatchPosition, type SearchResult } from '@shared/utils';
import { useLoadingState } from '@/app/shared/hooks';
import '@shared/styles/layout/SearchSidebar.css';


interface SearchSidebarProps {
  currentMapData?: MindMapData | null;
  allMapsData?: MindMapData[];
  onNodeSelect?: (nodeId: string) => void;
  onMapSwitch?: (id: MapIdentifier) => Promise<void>;
  // Lazy loader for cross-map search (optional)
  loadAllMaps?: () => Promise<MindMapData[]>;
}

const SearchSidebar: React.FC<SearchSidebarProps> = ({
  currentMapData,
  allMapsData = [],
  onNodeSelect,
  onMapSwitch,
  loadAllMaps
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const { isLoading: isSearching, startLoading: startSearching, stopLoading: stopSearching } = useLoadingState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loadedAllMaps, setLoadedAllMaps] = useState<MindMapData[] | null>(null);

  // Focus search input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);


  // Handle search
  useEffect(() => {
    const timer = setTimeout(() => {
      const run = async () => {
        if (!searchQuery.trim()) {
          setSearchResults([]);
          return;
        }

        startSearching();
        try {
          // Always search all maps
          let mapsForSearch: MindMapData[] = allMapsData;
          if (typeof loadAllMaps === 'function') {
            try {
              // Cache after first load to avoid repeated heavy I/O
              const maps = loadedAllMaps ?? await loadAllMaps();
              if (!loadedAllMaps) setLoadedAllMaps(maps);
              mapsForSearch = maps;
            } catch {
              // If load fails, fallback to provided allMapsData
            }
          }
          const results = searchMultipleMaps(searchQuery, mapsForSearch || []);
          setSearchResults(results);
        } finally {
          stopSearching();
        }
      };
      void run();
    }, 300); // デバウンス

    return () => clearTimeout(timer);
  }, [searchQuery, currentMapData, allMapsData, loadAllMaps, loadedAllMaps, startSearching, stopSearching]);

  const handleNodeClick = async (result: SearchResult) => {
    // currentMapDataがundefinedの場合、または異なるマップの場合はマップ切り替えを実行
    const needMapSwitch = !currentMapData ||
                         (result.mapId && result.mapId !== currentMapData?.mapIdentifier?.mapId);

    if (needMapSwitch && result.mapId) {
      try {
        // シンプルな従来の方法を使用
        await onMapSwitch?.({ mapId: result.mapId, workspaceId: result.workspaceId });

        // マップ切り替え完了後、もう少し長めの遅延でノードを選択
        setTimeout(() => {
          onNodeSelect?.(result.nodeId);
        }, 500);
      } catch (error) {
        console.error('Failed to switch map:', error);
      }
    } else {
      onNodeSelect?.(result.nodeId);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    const matchPos = getMatchPosition(text, query);
    if (!matchPos) return text;
    
    const { beforeMatch, match, afterMatch } = matchPos;
    return (
      <>
        {beforeMatch}
        <mark className="search-highlight">{match}</mark>
        {afterMatch}
      </>
    );
  };


  const getMatchTypeLabel = (matchType: SearchResult['matchType']) => {
    switch (matchType) {
      case 'text':
        return 'テキスト';
      case 'note':
        return 'ノート';
      default:
        return '';
    }
  };

  return (
    <div className="search-sidebar">
      <div className="search-sidebar-header">
        <h2>検索</h2>
        
        
        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            placeholder="すべてのマップから検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="クリア"
            >
<X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="search-results">
        {isSearching && (
          <div className="search-loading">
            検索中...
          </div>
        )}

        {!isSearching && searchQuery && searchResults.length === 0 && (
          <div className="search-no-results">
            検索結果が見つかりませんでした
          </div>
        )}

        {!isSearching && searchResults.length > 0 && (
          <>
            <div className="search-results-count">
              {searchResults.length}件の検索結果
            </div>
            <div className="search-results-list">
              {searchResults.map((result) => (
                <div
                  key={`${result.mapId}-${result.nodeId}`}
                  className="search-result-item"
                  onClick={() => handleNodeClick(result)}
                >
                  <div className="search-result-header">
                    <h4 className="search-result-title">
                      {highlightMatch(result.text, searchQuery)}
                    </h4>
                    <span className="search-result-match-type">
                      {getMatchTypeLabel(result.matchType)}
                    </span>
                  </div>
                  
                  {result.note && (
                    <div className="search-result-content">
                      {highlightMatch(result.note, searchQuery)}
                    </div>
                  )}
                  
                  {result.mapTitle && (
                    <div className="search-result-map">
                      マップ: {result.mapTitle}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {!searchQuery && (
          <div className="search-placeholder">
            <div className="search-placeholder-icon"><Search size={24} /></div>
            <div className="search-placeholder-text">
              ノードのテキストやノートを検索できます
            </div>
            <div className="search-placeholder-tips">
              <h4>検索のヒント:</h4>
              <ul>
                <li>部分一致で検索されます</li>
                <li>大文字小文字は区別されません</li>
                <li>保存されたすべてのマップから検索します</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchSidebar;
