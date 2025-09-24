import { useState, useCallback, useMemo } from 'react';
import { useMindMapStore } from '../../mindmap/store/mindMapStore';
import type { MindMapNode } from '@shared/types';
import { JUMP_CHARS } from '../constants';

export type VimMode = 'normal' | 'insert' | 'visual' | 'command' | 'search' | 'jumpy';

interface VimState {
  mode: VimMode;
  isEnabled: boolean;
  lastCommand: string;
  commandBuffer: string;
  searchQuery: string;
  searchResults: string[];
  currentSearchIndex: number;
  jumpyLabels: Array<{ nodeId: string; label: string }>;
  jumpyBuffer: string;
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
  startJumpy: () => void;
  exitJumpy: () => void;
  jumpToNode: (label: string) => void;
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
    currentSearchIndex: -1,
    jumpyLabels: [],
    jumpyBuffer: ''
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

  // Generate jump labels avoiding partial matches
  const generateJumpLabels = useCallback((count: number): string[] => {
    const labels: string[] = [];
    const jumpChars = JUMP_CHARS;
    const maxSingleChar = jumpChars.length;
    const maxTwoChar = jumpChars.length * jumpChars.length;

    if (count <= maxSingleChar) {
      // If we can fit all nodes with single characters, use single characters
      for (let i = 0; i < count; i++) {
        labels.push(jumpChars[i]);
      }
    } else if (count <= maxTwoChar) {
      // If we need more labels, use only two-character combinations
      // to avoid partial matches (no single characters when two-character exist)
      for (let i = 0; i < jumpChars.length && labels.length < count; i++) {
        for (let j = 0; j < jumpChars.length && labels.length < count; j++) {
          labels.push(jumpChars[i] + jumpChars[j]);
        }
      }
    } else {
      // For very large numbers of nodes, use three-character combinations
      for (let i = 0; i < jumpChars.length && labels.length < count; i++) {
        for (let j = 0; j < jumpChars.length && labels.length < count; j++) {
          for (let k = 0; k < jumpChars.length && labels.length < count; k++) {
            labels.push(jumpChars[i] + jumpChars[j] + jumpChars[k]);
          }
        }
      }
    }

    return labels;
  }, []);

  const startJumpy = useCallback(() => {
    const allNodes = getAllNodes();
    const visibleNodes = allNodes.filter(_node => {
      // In a real implementation, you would check if the node is visible in the viewport
      // For now, we'll include all nodes
      return true;
    });

    const labels = generateJumpLabels(visibleNodes.length);
    const jumpyLabels = visibleNodes.map((node, index) => ({
      nodeId: node.id,
      label: labels[index] || `${index}`
    }));

    setState(prev => ({
      ...prev,
      mode: 'jumpy' as const,
      jumpyLabels,
      jumpyBuffer: ''
    }));
  }, [getAllNodes, generateJumpLabels]);

  const exitJumpy = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'normal',
      jumpyLabels: [],
      jumpyBuffer: ''
    }));
  }, []);

  const jumpToNode = useCallback((inputChar: string) => {
    const newBuffer = state.jumpyBuffer + inputChar;

    // Check if this buffer matches any label exactly
    const exactMatch = state.jumpyLabels.find(jl => jl.label === newBuffer);

    if (exactMatch) {
      // Jump immediately on exact match
      const { selectNode } = useMindMapStore.getState() as any;
      selectNode(exactMatch.nodeId);
      exitJumpy();
      return;
    }

    // Check if there are potential matches (labels that start with this buffer)
    const potentialMatches = state.jumpyLabels.filter(jl => jl.label.startsWith(newBuffer));
    if (potentialMatches.length > 0) {
      // Update buffer and wait for more input
      setState(prev => ({
        ...prev,
        jumpyBuffer: newBuffer
      }));
    } else {
      // No matches, reset buffer
      setState(prev => ({
        ...prev,
        jumpyBuffer: ''
      }));
    }
  }, [state.jumpyLabels, state.jumpyBuffer, exitJumpy]);

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
    exitSearch,
    startJumpy,
    exitJumpy,
    jumpToNode
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
    exitSearch,
    startJumpy,
    exitJumpy,
    jumpToNode
  ]);
};
