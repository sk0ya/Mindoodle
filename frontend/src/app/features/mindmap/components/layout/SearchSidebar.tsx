import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { MapIdentifier } from '@shared/types';
import {
  searchFilesForContent,
  findNodeByLineNumber,
  getMatchPosition,
  type FileBasedSearchResult
} from '@shared/utils';
import { useLoadingState } from '@/app/shared/hooks';
import '@shared/styles/layout/SearchSidebar.css';


interface SearchSidebarProps {
  onNodeSelect?: (nodeId: string) => void;
  onMapSwitch?: (id: MapIdentifier) => Promise<void>;
  // Storage adapter for file-based search
  storageAdapter?: any;
  // Workspaces for path display
  workspaces?: Array<{ id: string; name: string }>;
}

const SearchSidebar: React.FC<SearchSidebarProps> = ({
  onNodeSelect,
  onMapSwitch,
  storageAdapter,
  workspaces
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [fileBasedResults, setFileBasedResults] = useState<FileBasedSearchResult[]>([]);
  const { isLoading: isSearching, startLoading: startSearching, stopLoading: stopSearching } = useLoadingState();
  const inputRef = useRef<HTMLInputElement>(null);

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
          setFileBasedResults([]);
          return;
        }

        if (!storageAdapter) {
          console.warn('🔍 [SearchSidebar] Storage adapter not available for search');
          return;
        }

        startSearching();
        try {
          console.log('🔍 [SearchSidebar] Performing file-based search');
          const fileResults = await searchFilesForContent(searchQuery, storageAdapter, workspaces);
          setFileBasedResults(fileResults);
        } catch (error) {
          console.error('🔍 [SearchSidebar] File-based search error:', error);
          setFileBasedResults([]);
        } finally {
          stopSearching();
        }
      };
      void run();
    }, 300); // デバウンス

    return () => clearTimeout(timer);
  }, [searchQuery, storageAdapter, workspaces, startSearching, stopSearching]);


  const handleFileResultDoubleClick = async (result: FileBasedSearchResult) => {
    console.log('🔍 [SearchSidebar] handleFileResultDoubleClick called:', {
      filePath: result.filePath,
      lineNumber: result.lineNumber,
      mapId: result.mapId,
      workspaceId: result.workspaceId
    });

    try {
      // まず、storageAdapterから直接マップデータを取得
      if (!storageAdapter) {
        console.error('🔍 [SearchSidebar] Storage adapter not available');
        return;
      }

      let mapData = null;

      // 利用可能な関数を順番に試行
      if (typeof storageAdapter.loadMapById === 'function') {
        console.log('🔍 [SearchSidebar] Using loadMapById');
        mapData = await storageAdapter.loadMapById(result.mapId, result.workspaceId);
      } else if (typeof storageAdapter.loadMap === 'function') {
        console.log('🔍 [SearchSidebar] Using loadMap');
        mapData = await storageAdapter.loadMap({
          mapId: result.mapId,
          workspaceId: result.workspaceId
        });
      } else if (typeof storageAdapter.loadAllMaps === 'function') {
        console.log('🔍 [SearchSidebar] Using loadAllMaps as fallback');
        const allMaps = await storageAdapter.loadAllMaps();
        mapData = allMaps.find((map: any) =>
          map.mapIdentifier?.mapId === result.mapId &&
          map.mapIdentifier?.workspaceId === result.workspaceId
        );
      }

      if (!mapData) {
        console.error('🔍 [SearchSidebar] Failed to load map data');
        return;
      }

      // 行番号からノードを特定
      const nodeResult = findNodeByLineNumber(mapData, result.lineNumber);

      if (nodeResult?.node) {
        console.log('🔍 [SearchSidebar] Found node by line number:', nodeResult.node.id);

        // マップを切り替えてからノードを選択
        await onMapSwitch?.({ mapId: result.mapId, workspaceId: result.workspaceId });

        // 少し待ってからノード選択
        setTimeout(() => {
          onNodeSelect?.(nodeResult.node.id);
        }, 300);
      } else {
        console.warn('🔍 [SearchSidebar] Node not found for line number:', result.lineNumber);
      }
    } catch (error) {
      console.error('🔍 [SearchSidebar] Error in file result navigation:', error);
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



  return (
    <div className="search-sidebar">
      <div className="search-sidebar-header">
        <h2>
          ファイル検索
        </h2>

        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            placeholder="すべてのファイルから検索..."
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

        {!isSearching && searchQuery && fileBasedResults.length === 0 && (
          <div className="search-no-results">
            検索結果が見つかりませんでした
          </div>
        )}

        {!isSearching && fileBasedResults.length > 0 && (
          <>
            <div className="search-results-count">
              {fileBasedResults.length}件の検索結果
            </div>
            <div className="search-results-list">
              {fileBasedResults.map((result, index) => (
                <div
                  key={`${result.mapId}-${result.lineNumber}-${index}`}
                  className="search-result-item file-result"
                  onDoubleClick={() => handleFileResultDoubleClick(result)}
                  title="ダブルクリックでノードに移動"
                >
                  <div className="search-result-header">
                    <h4 className="search-result-title">
                      {highlightMatch(result.lineContent, searchQuery)}
                    </h4>
                    <span className="search-result-line-number">
                      行 {result.lineNumber}
                    </span>
                  </div>

                  <div className="search-result-file-info">
                    <div className="search-result-file-path">
                      {result.filePath}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {!searchQuery && (
          <div className="search-placeholder">
            <div className="search-placeholder-text">
              ファイル内容を検索できます
            </div>
            <div className="search-placeholder-tips">
              <h4>検索のヒント:</h4>
              <ul>
                <li>マークダウン形式で行単位で検索されます</li>
                <li>大文字小文字は区別されません</li>
                <li>ダブルクリックでノードに移動します</li>
                <li>ファイルパスと行番号が表示されます</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchSidebar;
