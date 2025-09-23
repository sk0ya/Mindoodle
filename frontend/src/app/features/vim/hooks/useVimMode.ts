import { useState, useCallback, useMemo } from 'react';
import { useMindMapStore } from '../../mindmap/store/mindMapStore';
import type { MindMapNode } from '@shared/types';

export type VimMode = 'normal' | 'insert' | 'visual' | 'command' | 'search';

interface VimState {
  mode: VimMode;
  isEnabled: boolean;
  lastCommand: string;
  commandBuffer: string;
  searchQuery: string;
  searchResults: string[];
  currentSearchIndex: number;
}

interface VimActions {
  setMode: (mode: VimMode) => void;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  executeCommand: (command: string) => void;
  appendToCommandBuffer: (char: string) => void;
  clearCommandBuffer: () => void;
  getCurrentRootNode: () => MindMapNode | null;
  startSearch: () => void;
  updateSearchQuery: (query: string) => void;
  executeSearch: () => void;
  nextSearchResult: () => void;
  previousSearchResult: () => void;
  exitSearch: () => void;
}

export interface VimModeHook extends VimState, VimActions {}

export const useVimMode = (): VimModeHook => {
  const { settings, updateSetting } = useMindMapStore();
  const [state, setState] = useState<Omit<VimState, 'isEnabled'>>({
    mode: 'normal',
    lastCommand: '',
    commandBuffer: '',
    searchQuery: '',
    searchResults: [],
    currentSearchIndex: -1
  });

  const setMode = useCallback((mode: VimMode) => {
    setState(prev => ({ ...prev, mode }));
  }, []);

  const enable = useCallback(() => {
    updateSetting('vimMode', true);
  }, [updateSetting, setMode]);

  const disable = useCallback(() => {
    updateSetting('vimMode', false);
  }, [updateSetting, setMode]);

  const toggle = useCallback(() => {
    if (settings.vimMode) {
      disable();
    } else {
      enable();
    }
  }, [settings.vimMode, enable, disable]);

  const executeCommand = useCallback((command: string) => {
    setState(prev => ({ 
      ...prev, 
      lastCommand: command,
      commandBuffer: ''
    }));
  }, []);

  const appendToCommandBuffer = useCallback((char: string) => {
    setState(prev => ({ 
      ...prev, 
      commandBuffer: prev.commandBuffer + char 
    }));
  }, []);

  const clearCommandBuffer = useCallback(() => {
    setState(prev => ({
      ...prev,
      commandBuffer: ''
    }));
  }, []);

  const getCurrentRootNode = useCallback((): MindMapNode | null => {
    const { data, selectedNodeId } = useMindMapStore.getState() as any;
    const roots: MindMapNode[] = data?.rootNodes || [];
    if (roots.length === 0) return null;
    if (selectedNodeId) {
      for (const r of roots) {
        const stack: MindMapNode[] = [r];
        while (stack.length) {
          const n = stack.pop()!;
          if (!n) continue;
          if (n.id === selectedNodeId) return r;
          if (n.children?.length) stack.push(...n.children);
        }
      }
    }
    return roots[0] || null;
  }, []);

  const startSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'search' as const,
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1
    }));
  }, []);

  const getAllNodes = useCallback((): MindMapNode[] => {
    const { data } = useMindMapStore.getState() as any;
    const roots: MindMapNode[] = data?.rootNodes || [];
    const allNodes: MindMapNode[] = [];

    const collectNodes = (node: MindMapNode) => {
      allNodes.push(node);
      if (node.children) {
        node.children.forEach(collectNodes);
      }
    };

    roots.forEach(collectNodes);
    return allNodes;
  }, []);

  const updateSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));

    // リアルタイム検索を実行
    if (query.trim()) {
      const allNodes = getAllNodes();
      const results: string[] = [];

      allNodes.forEach(node => {
        if (node.text?.toLowerCase().includes(query.toLowerCase())) {
          results.push(node.id);
        }
      });

      setState(prev => ({
        ...prev,
        searchResults: results,
        currentSearchIndex: results.length > 0 ? 0 : -1
      }));
    } else {
      setState(prev => ({ ...prev, searchResults: [], currentSearchIndex: -1 }));
    }
  }, [getAllNodes]);

  const executeSearch = useCallback(() => {
    const { searchQuery } = state;
    if (!searchQuery.trim()) {
      setState(prev => ({ ...prev, searchResults: [], currentSearchIndex: -1 }));
      return;
    }

    const allNodes = getAllNodes();
    const results: string[] = [];

    allNodes.forEach(node => {
      if (node.text?.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push(node.id);
      }
    });

    setState(prev => ({
      ...prev,
      searchResults: results,
      currentSearchIndex: results.length > 0 ? 0 : -1
    }));

    // 最初の結果に移動
    if (results.length > 0) {
      const { selectNode } = useMindMapStore.getState() as any;
      selectNode(results[0]);
    }
  }, [state.searchQuery, getAllNodes]);

  const nextSearchResult = useCallback(() => {
    const { searchResults, currentSearchIndex } = state;
    if (searchResults.length === 0) return;

    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setState(prev => ({ ...prev, currentSearchIndex: nextIndex }));

    const { selectNode } = useMindMapStore.getState() as any;
    selectNode(searchResults[nextIndex]);
  }, [state.searchResults, state.currentSearchIndex]);

  const previousSearchResult = useCallback(() => {
    const { searchResults, currentSearchIndex } = state;
    if (searchResults.length === 0) return;

    const prevIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setState(prev => ({ ...prev, currentSearchIndex: prevIndex }));

    const { selectNode } = useMindMapStore.getState() as any;
    selectNode(searchResults[prevIndex]);
  }, [state.searchResults, state.currentSearchIndex]);

  const exitSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'normal',
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1
    }));
  }, []);

  return useMemo(() => ({
    ...state,
    isEnabled: settings.vimMode,
    setMode,
    enable,
    disable,
    toggle,
    executeCommand,
    appendToCommandBuffer,
    clearCommandBuffer,
    getCurrentRootNode,
    startSearch,
    updateSearchQuery,
    executeSearch,
    nextSearchResult,
    previousSearchResult,
    exitSearch
  }), [
    state,
    settings.vimMode,
    setMode,
    enable,
    disable,
    toggle,
    executeCommand,
    appendToCommandBuffer,
    clearCommandBuffer,
    getCurrentRootNode,
    startSearch,
    updateSearchQuery,
    executeSearch,
    nextSearchResult,
    previousSearchResult,
    exitSearch
  ]);
};
