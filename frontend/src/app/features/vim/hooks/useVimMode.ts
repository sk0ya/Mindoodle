import { useState, useCallback, useMemo, useEffect } from 'react';
import { useMindMapStore } from '../../mindmap/store/mindMapStore';
import type { MindMapNode } from '@shared/types';
import { JUMP_CHARS } from '../constants';
// import { parseVimMappingsText } from '../utils/parseVimMappings';

export type VimMode = 'normal' | 'insert' | 'visual' | 'command' | 'search' | 'jumpy';

interface VimState {
  mode: VimMode;
  isEnabled: boolean;
  lastCommand: string;
  commandBuffer: string;
  commandLineBuffer: string;
  commandOutput: string;
  searchQuery: string;
  searchResults: string[];
  currentSearchIndex: number;
  jumpyLabels: Array<{ nodeId: string; label: string }>;
  jumpyBuffer: string;
}

interface VimActions {
  setMode: (_mode: VimMode) => void;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  executeCommand: (_command: string) => void;
  appendToCommandBuffer: (_char: string) => void;
  clearCommandBuffer: () => void;
  getCurrentRootNode: () => MindMapNode | null;
  startSearch: () => void;
  updateSearchQuery: (_query: string) => void;
  executeSearch: () => void;
  nextSearchResult: () => void;
  previousSearchResult: () => void;
  exitSearch: () => void;
  startJumpy: () => void;
  exitJumpy: () => void;
  jumpToNode: (_label: string) => void;
  // Command line mode actions
  startCommandLine: () => void;
  updateCommandLineBuffer: (_buffer: string) => void;
  executeCommandLine: (_command: string) => Promise<void>;
  exitCommandLine: () => void;
  setCommandOutput: (_output: string) => void;
}

export interface VimModeHook extends VimState, VimActions {}

export const useVimMode = (_mindMapInstance?: any): VimModeHook => {
  const { settings, updateSetting, setSearchQuery: setUISearchQuery } = useMindMapStore();
  const [state, setState] = useState<Omit<VimState, 'isEnabled'>>({
    mode: 'normal',
    lastCommand: '',
    commandBuffer: '',
    commandLineBuffer: '',
    commandOutput: '',
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
    updateSetting('vimMindMap', true);
  }, [updateSetting]);

  const disable = useCallback(() => {
    updateSetting('vimMindMap', false);
  }, [updateSetting]);

  const toggle = useCallback(() => {
    if ((settings as any).vimMindMap) {
      disable();
    } else {
      enable();
    }
  }, [(settings as any).vimMindMap, enable, disable]);

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

  // Command line mode methods
  const startCommandLine = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'command' as const,
      commandLineBuffer: '',
      commandOutput: ''
    }));
  }, []);

  const updateCommandLineBuffer = useCallback((buffer: string) => {
    setState(prev => ({ ...prev, commandLineBuffer: buffer }));
  }, []);

  const setCommandOutput = useCallback((output: string) => {
    setState(prev => ({ ...prev, commandOutput: output }));
  }, []);

  const executeCommandLine = useCallback(async (command: string) => {
    // Parse the command
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    // Get the store state
    const store = useMindMapStore.getState() as any;

    try {
      // Helper to rebuild editor source from current settings (editor is source of truth)
      const rebuildMappingsSource = () => {
        try {
          const st = useMindMapStore.getState() as any;
          const { vimLeader, vimCustomKeybindings, vimMappingsSource } = st.settings || {};
          const baseSrc: string = vimMappingsSource || '';
          const lines = (baseSrc || '').split(/\r?\n/);
          let idx = 0;
          while (idx < lines.length) {
            const t = (lines[idx] || '').trim();
            if (t === '' || t.startsWith('"')) idx++; else break;
          }
          const commentBlock = lines.slice(0, idx).join('\n');
          const leaderStr = (vimLeader === ' ' ? '<Space>' : (vimLeader || ','));
          const maps = Object.entries((vimCustomKeybindings as Record<string,string>) || {}).sort(([a],[b]) => a.localeCompare(b));
          const body = [
            `set leader ${leaderStr}`,
            '',
            ...maps.map(([k,v]) => `map ${k} ${v}`)
          ].join('\n');
          const rebuilt = `${commentBlock ? commentBlock + '\n' : ''}${body}\n`;
          st.updateSetting('vimMappingsSource', rebuilt);
        } catch {}
      };

      switch (cmd) {
        case 'set': {
          // :set leader=,  or  :set leader ,  or :set leader <Space>
          const [opt, rawVal] = [args[0], args[1] ?? ''];
          if (!opt) {
            setCommandOutput('Usage: set leader <key>');
            break;
          }
          if (opt === 'leader') {
            const valPart = rawVal || (cmd.includes('=') ? cmd.split('=')[1] : '');
            let leader = valPart.trim();
            if (!leader && args.length >= 1 && (args[0] || '').includes('=')) {
              // handle `set leader=,` form parsed as single arg
              const m = (args[0] || '').split('=');
              leader = (m[1] || '').trim();
            }
            // Normalize <Space> token
            if (/^<\s*space\s*>$/i.test(leader)) leader = ' ';
            if (leader.length !== 1) {
              setCommandOutput('Error: leader must be a single character or <Space>');
              break;
            }
            const store = useMindMapStore.getState() as any;
            store.updateSetting('vimLeader', leader);
            setCommandOutput(`Leader set to "${leader === ' ' ? '<Space>' : leader}"`);
            // Sync back into editor text
            rebuildMappingsSource();
          } else {
            setCommandOutput('Unknown option. Supported: leader');
          }
          break;
        }

        case 'nmap':
        case 'nnoremap':
        case 'noremap':
        case 'map': {
          // :map <lhs> <command>
          if (args.length < 2) {
            setCommandOutput('Usage: map <lhs> <command>');
            break;
          }
          const lhs = args[0];
          const rhs = args.slice(1).join(' ');
          if (!lhs || !rhs) {
            setCommandOutput('Usage: map <lhs> <command>');
            break;
          }
          const store = useMindMapStore.getState() as any;
          const current: Record<string, string> = { ...(store.settings?.vimCustomKeybindings || {}) };
          current[lhs] = rhs;
          store.updateSetting('vimCustomKeybindings', current);
          setCommandOutput(`Mapped ${lhs} -> ${rhs}`);
          rebuildMappingsSource();
          break;
        }

        case 'unmap':
        case 'nunmap':
        case 'unmap!': {
          if (args.length < 1) {
            setCommandOutput('Usage: unmap <lhs>');
            break;
          }
          const lhs = args[0];
          const store = useMindMapStore.getState() as any;
          const current: Record<string, string> = { ...(store.settings?.vimCustomKeybindings || {}) };
          if (lhs in current) {
            delete current[lhs];
            store.updateSetting('vimCustomKeybindings', current);
            setCommandOutput(`Unmapped ${lhs}`);
            rebuildMappingsSource();
          } else {
            setCommandOutput(`No mapping for ${lhs}`);
          }
          break;
        }

        case 'mapclear':
        case 'unmapall': {
          const store = useMindMapStore.getState() as any;
          store.updateSetting('vimCustomKeybindings', {});
          setCommandOutput('Cleared all custom mappings');
          rebuildMappingsSource();
          break;
        }

        case 'maps':
        case 'maplist': {
          const store = useMindMapStore.getState() as any;
          const m: Record<string, string> = store.settings?.vimCustomKeybindings || {};
          const entries = Object.entries(m);
          if (entries.length === 0) {
            setCommandOutput('No custom mappings');
          } else {
            const list = entries.map(([k,v]) => `${k} -> ${v}`).join(', ');
            setCommandOutput(list);
          }
          break;
        }

        case 'mapshow': {
          // :mapshow <lhs>
          if (args.length < 1) { setCommandOutput('Usage: mapshow <lhs>'); break; }
          const lhs = args[0];
          const store = useMindMapStore.getState() as any;
          const m: Record<string, string> = store.settings?.vimCustomKeybindings || {};
          const rhs = m[lhs];
          setCommandOutput(rhs ? `${lhs} -> ${rhs}` : `No mapping for ${lhs}`);
          break;
        }
        case 'u':
        case 'undo': {
          // Vim-style undo
          if (store.canUndo && store.canUndo()) {
            store.undo();
            setCommandOutput('Undo completed');
          } else {
            setCommandOutput('Already at oldest change');
          }
          break;
        }

        case 'redo': {
          // Vim-style redo (Ctrl+R)
          if (store.canRedo && store.canRedo()) {
            store.redo();
            setCommandOutput('Redo completed');
          } else {
            setCommandOutput('Already at newest change');
          }
          break;
        }

        case 'mkdir':
        case 'newfolder': {
          if (args.length === 0) {
            setCommandOutput('Usage: mkdir <folder-path>');
            break;
          }

          const folderPath = args[0];
          const currentWorkspace = store.data?.mapIdentifier?.workspaceId;

          // Use Explorer's createFolder via global function
          const fullPath = folderPath.startsWith('/') ? folderPath : `/${currentWorkspace}/${folderPath}`;

          try {
            if (typeof (window as any).mindoodleCreateFolder === 'function') {
              await (window as any).mindoodleCreateFolder(fullPath);
              setCommandOutput(`Created folder: ${folderPath}`);
            } else {
              setCommandOutput('Error: Global createFolder not available');
            }
          } catch (error) {
            setCommandOutput(`Error creating folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          break;
        }

        case 'newmap':
        case 'touch': {
          if (args.length === 0) {
            setCommandOutput('Usage: newmap <map-name> [folder-path]');
            break;
          }
          const fullPath = args[0];
          const workspaceId = store.data?.mapIdentifier?.workspaceId;

          if (!workspaceId) {
            setCommandOutput('Error: No workspace available');
            break;
          }

          try {
            if (typeof (window as any).mindoodleCreateAndSelectMap === 'function') {
              // Extract filename from path (everything after the last '/')
              const mapName = fullPath.includes('/') ? fullPath.split('/').pop() || fullPath : fullPath;
              // Use the full path as category if it contains '/'
              const actualCategory = fullPath.includes('/') ? fullPath.replace(/\/[^/]*$/, '') : '';

              await (window as any).mindoodleCreateAndSelectMap(mapName, workspaceId, actualCategory);
              setCommandOutput(`Created map: ${mapName}${actualCategory ? ` in ${actualCategory}` : ''}`);
            } else {
              setCommandOutput('Error: Global createAndSelectMap not available');
            }
          } catch (error) {
            setCommandOutput(`Error creating map: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          break;
        }

        case 'w':
        case 'write':
          // Save current map
          if (store.data && store.saveMapMarkdown) {
            const markdown = store.subscribeMarkdownFromNodes ? 
              await new Promise<string>((resolve) => {
                const unsub = store.subscribeMarkdownFromNodes((md: string) => {
                  unsub();
                  resolve(md);
                });
              }) : '';
            await store.saveMapMarkdown(store.data.mapIdentifier, markdown);
            setCommandOutput('Map saved');
          }
          break;

        case 'pwd': {
          // Show current workspace and map location
          const currentMap = store.data?.mapIdentifier;
          // Get workspaces from window global (set by MindMapApp.tsx)
          const workspaces = (window as any).mindoodleWorkspaces || [];
          const workspaceName = workspaces.find((w: any) => w.id === currentMap?.workspaceId)?.name || 'Unknown';

          setCommandOutput(`${workspaceName}/${currentMap?.mapId || 'none'}`);
          break;
        }

        case 'ls': {
          // List maps in current workspace
          const currentWs = store.data?.mapIdentifier?.workspaceId;
          const maps = store.allMindMaps?.filter((map: any) => map.mapIdentifier.workspaceId === currentWs) || [];
          const mapList = maps.map((map: any) => {
            const prefix = map.mapIdentifier.mapId === store.data?.mapIdentifier?.mapId ? '*' : '';
            return `${prefix}${map.mapIdentifier.mapId}`;
          }).join(' ');
          setCommandOutput(`${maps.length} maps: ${mapList || 'none'}`);
          break;
        }

        case 'q':
        case 'quit':
          // Just exit command mode for now
          break;

        default:
          setCommandOutput(`Unknown command: ${cmd}`);
      }
    } catch (error) {
      setCommandOutput(`Error: ${error instanceof Error ? error.message : 'Command execution failed'}`);
    }
  }, [setCommandOutput]);

  const exitCommandLine = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'normal',
      commandLineBuffer: ''
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

    // Update UI store searchQuery for unified highlighting
    setUISearchQuery(query);

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
  }, [getAllNodes, setUISearchQuery]);

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
    const { searchQuery } = state;
    if (!searchQuery.trim()) return;

    // Re-execute search to get fresh results (handles node changes)
    const allNodes = getAllNodes();
    const results: string[] = [];

    allNodes.forEach(node => {
      if (node.text?.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push(node.id);
      }
    });

    if (results.length === 0) return;

    // Find next result after current selected node
    const { selectedNodeId } = useMindMapStore.getState() as any;
    let nextIndex = 0;

    if (selectedNodeId) {
      const currentIndex = results.indexOf(selectedNodeId);
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + 1) % results.length;
      }
    }

    setState(prev => ({
      ...prev,
      searchResults: results,
      currentSearchIndex: nextIndex
    }));

    const { selectNode } = useMindMapStore.getState() as any;
    selectNode(results[nextIndex]);
  }, [state.searchQuery, getAllNodes]);

  const previousSearchResult = useCallback(() => {
    const { searchQuery } = state;
    if (!searchQuery.trim()) return;

    // Re-execute search to get fresh results (handles node changes)
    const allNodes = getAllNodes();
    const results: string[] = [];

    allNodes.forEach(node => {
      if (node.text?.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push(node.id);
      }
    });

    if (results.length === 0) return;

    // Find previous result before current selected node
    const { selectedNodeId } = useMindMapStore.getState() as any;
    let prevIndex = results.length - 1;

    if (selectedNodeId) {
      const currentIndex = results.indexOf(selectedNodeId);
      if (currentIndex !== -1) {
        prevIndex = currentIndex <= 0 ? results.length - 1 : currentIndex - 1;
      }
    }

    setState(prev => ({
      ...prev,
      searchResults: results,
      currentSearchIndex: prevIndex
    }));

    const { selectNode } = useMindMapStore.getState() as any;
    selectNode(results[prevIndex]);
  }, [state.searchQuery, getAllNodes]);

  const exitSearch = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: 'normal',
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1
    }));
    
    // Also clear UI search query for unified highlighting
    setUISearchQuery('');
  }, [setUISearchQuery]);;

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

  // Clear command output when mode changes away from normal
  useEffect(() => {
    if (state.mode !== 'normal') {
      setState(prev => ({ ...prev, commandOutput: '' }));
    }
  }, [state.mode]);

  return useMemo(() => ({
    ...state,
    isEnabled: (settings as any).vimMindMap,
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
    jumpToNode,
    // Command line methods
    startCommandLine,
    updateCommandLineBuffer,
    executeCommandLine,
    exitCommandLine,
    setCommandOutput
  }), [
    state,
    (settings as any).vimMindMap,
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
    jumpToNode,
    startCommandLine,
    updateCommandLineBuffer,
    executeCommandLine,
    exitCommandLine,
    setCommandOutput
  ]);
};;
