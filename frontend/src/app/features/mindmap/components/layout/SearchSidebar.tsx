import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { MapIdentifier } from '@shared/types';
import {
  searchFilesForContent,
  getMatchPosition,
  type FileBasedSearchResult
} from '@shared/utils';
import { useLoadingState } from '@/app/shared/hooks';
import { useMindMapStore } from '../../store';
import { performNodeSearch } from '../../utils';
import '@shared/styles/layout/SearchSidebar.css';


interface SearchSidebarProps {
  onMapSwitch?: (mapIdentifier: MapIdentifier) => Promise<void>;
  onNodeSelectByLine?: (lineNumber: number) => Promise<void>;
  // Storage adapter for file-based search
  storageAdapter?: any;
  // Workspaces for path display
  workspaces?: Array<{ id: string; name: string }>;
}

const SearchSidebar: React.FC<SearchSidebarProps> = ({
  onMapSwitch,
  onNodeSelectByLine,
  storageAdapter,
  workspaces
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const [fileBasedResults, setFileBasedResults] = useState<FileBasedSearchResult[]>([]);
  const { isLoading: isSearching, startLoading: startSearching, stopLoading: stopSearching } = useLoadingState();
  const inputRef = useRef<HTMLInputElement>(null);

  // Get mindmap store functions for node highlighting with stable references
  const setStoreSearchQuery = useMindMapStore(state => state.setSearchQuery);
  const setSearchHighlightedNodes = useMindMapStore(state => state.setSearchHighlightedNodes);
  const clearSearchHighlight = useMindMapStore(state => state.clearSearchHighlight);


  // Focus search input when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle current map node highlighting
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchQuery.trim()) {
        clearSearchHighlight();
        return;
      }

      setStoreSearchQuery(searchQuery);

      // Get fresh normalized data at execution time to avoid dependency issues
      const currentNormalizedData = useMindMapStore.getState().normalizedData;
      const { highlightedNodes } = performNodeSearch(searchQuery, currentNormalizedData);
      setSearchHighlightedNodes(highlightedNodes);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle file-based search
  useEffect(() => {
    // Skip entirely if search query is empty
    if (!searchQuery.trim()) {
      setFileBasedResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      if (!storageAdapter) {
        console.warn('🔍 [SearchSidebar] Storage adapter not available for search');
        return;
      }

      startSearching();
      try {
        const fileResults = await searchFilesForContent(searchQuery, storageAdapter, workspaces);
        setFileBasedResults(fileResults);
      } catch (error) {
        console.error('🔍 [SearchSidebar] File-based search error:', error);
        setFileBasedResults([]);
      } finally {
        stopSearching();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);


  const handleFileResultDoubleClick = async (result: FileBasedSearchResult) => {
    await onMapSwitch?.({ mapId: result.mapId, workspaceId: result.workspaceId });
    await onNodeSelectByLine?.(result.lineNumber);
  }

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
          検索
        </h2>

        <div className="search-input-container">
          <input
            ref={inputRef}
            type="text"
            placeholder=".mdファイルから検索..."
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
