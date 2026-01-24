import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useMindMapStore, type MindMapStore } from '../../mindmap/store/mindMapStore';
import type { MindMapNode, MapIdentifier } from '@shared/types';
import { JUMP_CHARS } from '../constants';
import { VimCountBuffer } from '../services/VimCountBuffer';
import { VimRepeatRegistry } from '../services/VimRepeatRegistry';

type ExtendedMindMapStore = MindMapStore & {
  saveMapMarkdown?: (identifier: MapIdentifier, markdown: string) => Promise<void>;
  subscribeMarkdownFromNodes?: (callback: (markdown: string) => void) => () => void;
  allMindMaps?: Array<{ mapIdentifier: MapIdentifier }>;
};

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
  countBuffer: string;
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
  startCommandLine: () => void;
  updateCommandLineBuffer: (_buffer: string) => void;
  executeCommandLine: (_command: string) => Promise<void>;
  exitCommandLine: () => void;
  setCommandOutput: (_output: string) => void;
  appendToCountBuffer: (_digit: string) => void;
  clearCountBuffer: () => void;
  getCount: () => number | undefined;
  hasCount: () => boolean;
  getCountBuffer: () => VimCountBuffer;
  getRepeatRegistry: () => VimRepeatRegistry;
}

export interface VimModeHook extends VimState, VimActions {}

// removed unused helper createStateUpdater

const rebuildMappingsSource = () => {
  try {
    const st = useMindMapStore.getState();
    const { vimLeader, vimCustomKeybindings, vimMappingsSource } = st.settings || {};
    const lines = (vimMappingsSource || '').split(/\r?\n/);
    let idx = 0;
    while (idx < lines.length && ((lines[idx] || '').trim() === '' || (lines[idx] || '').trim().startsWith('"'))) idx++;

    const commentBlock = lines.slice(0, idx).join('\n');
    const leaderStr = vimLeader === ' ' ? '<Space>' : (vimLeader || ',');
    const maps = Object.entries(vimCustomKeybindings || {}).sort(([a], [b]) => a.localeCompare(b));
    const body = ['set leader ' + leaderStr, '', ...maps.map(([k, v]) => `map ${k} ${v}`)].join('\n');

    st.updateSetting('vimMappingsSource', `${commentBlock ? commentBlock + '\n' : ''}${body}\n`);
  } catch {}
};

const flattenNodes = (nodes: MindMapNode[]): MindMapNode[] => {
  const collect = (node: MindMapNode): MindMapNode[] => [node, ...(node.children?.flatMap(collect) || [])];
  return nodes.flatMap(collect);
};

const searchNodes = (query: string, nodes: MindMapNode[]): string[] =>
  query.trim()
    ? flattenNodes(nodes)
        .filter(node => node.text?.toLowerCase().includes(query.toLowerCase()))
        .map(node => node.id)
    : [];

const findRootForNode = (roots: MindMapNode[], targetId: string): MindMapNode | null => {
  for (const root of roots) {
    const stack = [root];
    while (stack.length) {
      const node = stack.pop()!;
      if (node.id === targetId) return root;
      if (node.children?.length) stack.push(...node.children);
    }
  }
  return roots[0] || null;
};

const generateLabels = (count: number, chars: string): string[] => {
  const maxSingle = chars.length;
  const maxDouble = chars.length ** 2;

  if (count <= maxSingle) return Array.from({ length: count }, (_, i) => chars[i]);

  const generate = (depth: number): string[] => {
    const labels: string[] = [];
    const iterate = (prefix: string, remaining: number): void => {
      if (remaining === 0) {
        labels.push(prefix);
        return;
      }
      for (let i = 0; i < chars.length && labels.length < count; i++) {
        iterate(prefix + chars[i], remaining - 1);
      }
    };
    iterate('', depth);
    return labels;
  };

  return count <= maxDouble ? generate(2) : generate(3);
};

export const useVimMode = (_mindMapInstance?: unknown): VimModeHook => {
  const { settings, updateSetting, setSearchQuery: setUISearchQuery } = useMindMapStore();
  const countBufferRef = useRef(new VimCountBuffer());
  const repeatRegistryRef = useRef(new VimRepeatRegistry());

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
    jumpyBuffer: '',
    countBuffer: ''
  });

  const setMode = useCallback((mode: VimMode) => setState(prev => ({ ...prev, mode })), []);
  const enable = useCallback(() => updateSetting('vimMindMap', true), [updateSetting]);
  const disable = useCallback(() => updateSetting('vimMindMap', false), [updateSetting]);

  const toggle = useCallback(() => {
    const settingsWithVim = settings as typeof settings & { vimMindMap?: boolean };
    updateSetting('vimMindMap', !settingsWithVim.vimMindMap);
  }, [settings, updateSetting]);

  const executeCommand = useCallback((command: string) =>
    setState(prev => ({ ...prev, lastCommand: command, commandBuffer: '' })), []);

  const appendToCommandBuffer = useCallback((char: string) =>
    setState(prev => ({ ...prev, commandBuffer: prev.commandBuffer + char })), []);

  const clearCommandBuffer = useCallback(() =>
    setState(prev => ({ ...prev, commandBuffer: '' })), []);

  const startCommandLine = useCallback(() =>
    setState(prev => ({ ...prev, mode: 'command', commandLineBuffer: '', commandOutput: '' })), []);

  const updateCommandLineBuffer = useCallback((buffer: string) =>
    setState(prev => ({ ...prev, commandLineBuffer: buffer })), []);

  const setCommandOutput = useCallback((output: string) =>
    setState(prev => ({ ...prev, commandOutput: output })), []);

  const executeCommandLine = useCallback(async (command: string) => {
    const parts = command.trim().split(/\s+/);
    const [cmd, ...args] = parts;
    const store = useMindMapStore.getState();

    const handlers: Record<string, () => void | Promise<void>> = {
      set: () => {
        const [opt, rawVal] = [args[0], args[1] ?? ''];
        if (!opt) return setCommandOutput('Usage: set leader <key>');
        if (opt !== 'leader') return setCommandOutput('Unknown option. Supported: leader');

        let leader = rawVal.trim() || ((args[0] || '').includes('=') ? (args[0] || '').split('=')[1]?.trim() : '');
        if (/^<\s*space\s*>$/i.test(leader)) leader = ' ';
        if (leader.length !== 1) return setCommandOutput('Error: leader must be a single character or <Space>');

        store.updateSetting('vimLeader', leader);
        setCommandOutput(`Leader set to "${leader === ' ' ? '<Space>' : leader}"`);
        rebuildMappingsSource();
      },

      map: () => {
        if (args.length < 2) return setCommandOutput('Usage: map <lhs> <command>');
        const [lhs, ...rhs] = args;
        const current: Record<string, string> = { ...(store.settings?.vimCustomKeybindings || {}) };
        current[lhs] = rhs.join(' ');
        store.updateSetting('vimCustomKeybindings', current);
        setCommandOutput(`Mapped ${lhs} -> ${rhs.join(' ')}`);
        rebuildMappingsSource();
      },

      unmap: () => {
        if (args.length < 1) return setCommandOutput('Usage: unmap <lhs>');
        const lhs = args[0];
        const current: Record<string, string> = { ...(store.settings?.vimCustomKeybindings || {}) };
        if (lhs in current) {
          delete current[lhs];
          store.updateSetting('vimCustomKeybindings', current);
          setCommandOutput(`Unmapped ${lhs}`);
          rebuildMappingsSource();
        } else {
          setCommandOutput(`No mapping for ${lhs}`);
        }
      },

      mapclear: () => {
        store.updateSetting('vimCustomKeybindings', {});
        setCommandOutput('Cleared all custom mappings');
        rebuildMappingsSource();
      },

      maps: () => {
        const m: Record<string, string> = store.settings?.vimCustomKeybindings || {};
        const entries = Object.entries(m);
        setCommandOutput(entries.length === 0 ? 'No custom mappings' : entries.map(([k, v]) => `${k} -> ${v}`).join(', '));
      },

      mapshow: () => {
        if (args.length < 1) return setCommandOutput('Usage: mapshow <lhs>');
        const lhs = args[0];
        const m: Record<string, string> = store.settings?.vimCustomKeybindings || {};
        setCommandOutput(m[lhs] ? `${lhs} -> ${m[lhs]}` : `No mapping for ${lhs}`);
      },

      undo: () => {
        if (store.canUndo?.()) {
          store.undo();
          setCommandOutput('Undo completed');
        } else {
          setCommandOutput('Already at oldest change');
        }
      },

      redo: () => {
        if (store.canRedo?.()) {
          store.redo();
          setCommandOutput('Redo completed');
        } else {
          setCommandOutput('Already at newest change');
        }
      },

      mkdir: async () => {
        if (args.length === 0) return setCommandOutput('Usage: mkdir <folder-path>');
        const folderPath = args[0];
        const currentWorkspace = store.data?.mapIdentifier?.workspaceId;
        const fullPath = folderPath.startsWith('/') ? folderPath : `/${currentWorkspace}/${folderPath}`;

        try {
          const globalWindow = window as typeof window & { mindoodleCreateFolder?: (path: string) => Promise<void> };
          if (typeof globalWindow.mindoodleCreateFolder === 'function') {
            await globalWindow.mindoodleCreateFolder(fullPath);
            setCommandOutput(`Created folder: ${folderPath}`);
          } else {
            setCommandOutput('Error: Global createFolder not available');
          }
        } catch (error) {
          setCommandOutput(`Error creating folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },

      newmap: async () => {
        if (args.length === 0) return setCommandOutput('Usage: newmap <map-name> [folder-path]');
        const fullPath = args[0];
        const workspaceId = store.data?.mapIdentifier?.workspaceId;
        if (!workspaceId) return setCommandOutput('Error: No workspace available');

        try {
          const globalWindow = window as typeof window & {
            mindoodleCreateAndSelectMap?: (name: string, workspaceId: string, category: string) => Promise<void>
          };
          if (typeof globalWindow.mindoodleCreateAndSelectMap === 'function') {
            const mapName = fullPath.includes('/') ? fullPath.split('/').pop() || fullPath : fullPath;
            const actualCategory = fullPath.includes('/') ? fullPath.replace(/\/[^/]*$/, '') : '';
            await globalWindow.mindoodleCreateAndSelectMap(mapName, workspaceId, actualCategory);
            const categoryInfo = actualCategory ? ` in ${actualCategory}` : '';
            setCommandOutput(`Created map: ${mapName}${categoryInfo}`);
          } else {
            setCommandOutput('Error: Global createAndSelectMap not available');
          }
        } catch (error) {
          setCommandOutput(`Error creating map: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },

      write: async () => {
        const extendedStore = store as ExtendedMindMapStore;
        if (extendedStore.data && extendedStore.saveMapMarkdown) {
          const markdown = extendedStore.subscribeMarkdownFromNodes
            ? await new Promise<string>((resolve) => {
                const unsub = extendedStore.subscribeMarkdownFromNodes!((md: string) => {
                  unsub();
                  resolve(md);
                });
              })
            : '';
          await extendedStore.saveMapMarkdown(extendedStore.data.mapIdentifier, markdown);
          setCommandOutput('Map saved');
        }
      },

      pwd: () => {
        const currentMap = store.data?.mapIdentifier;
        const globalWindow = window as typeof window & { mindoodleWorkspaces?: Array<{ id: string; name: string }> };
        const workspaces = globalWindow.mindoodleWorkspaces || [];
        const workspaceName = workspaces.find(w => w.id === currentMap?.workspaceId)?.name || 'Unknown';
        setCommandOutput(`${workspaceName}/${currentMap?.mapId || 'none'}`);
      },

      ls: () => {
        const currentWs = store.data?.mapIdentifier?.workspaceId;
        const extendedStore = store as ExtendedMindMapStore;
        const maps = extendedStore.allMindMaps?.filter(map => map.mapIdentifier.workspaceId === currentWs) || [];
        const mapList = maps.map(map => {
          const prefix = map.mapIdentifier.mapId === store.data?.mapIdentifier?.mapId ? '*' : '';
          return `${prefix}${map.mapIdentifier.mapId}`;
        }).join(' ');
        setCommandOutput(`${maps.length} maps: ${mapList || 'none'}`);
      },

      quit: () => {},
    };

    // Alias mappings
    const aliases: Record<string, string> = {
      nmap: 'map', nnoremap: 'map', noremap: 'map',
      nunmap: 'unmap', 'unmap!': 'unmap',
      unmapall: 'mapclear',
      maplist: 'maps',
      u: 'undo',
      newfolder: 'mkdir',
      touch: 'newmap',
      w: 'write',
      q: 'quit'
    };

    try {
      const handler = handlers[aliases[cmd] || cmd];
      if (handler) {
        await handler();
      } else {
        setCommandOutput(`Unknown command: ${cmd}`);
      }
    } catch (error) {
      setCommandOutput(`Error: ${error instanceof Error ? error.message : 'Command execution failed'}`);
    }
  }, [setCommandOutput]);

  const exitCommandLine = useCallback(() =>
    setState(prev => ({ ...prev, mode: 'normal', commandLineBuffer: '' })), []);

  const getCurrentRootNode = useCallback((): MindMapNode | null => {
    const { data, selectedNodeId } = useMindMapStore.getState();
    const roots = data?.rootNodes || [];
    if (roots.length === 0) return null;
    return selectedNodeId ? findRootForNode(roots, selectedNodeId) : roots[0];
  }, []);

  const startSearch = useCallback(() =>
    setState(prev => ({ ...prev, mode: 'search', searchQuery: '', searchResults: [], currentSearchIndex: -1 })), []);

  const getAllNodes = useCallback((): MindMapNode[] => {
    const { data } = useMindMapStore.getState();
    return flattenNodes(data?.rootNodes || []);
  }, []);

  const updateSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
    setUISearchQuery(query);

    if (query.trim()) {
      const results = searchNodes(query, useMindMapStore.getState().data?.rootNodes || []);
      setState(prev => ({ ...prev, searchResults: results, currentSearchIndex: results.length > 0 ? 0 : -1 }));
    } else {
      setState(prev => ({ ...prev, searchResults: [], currentSearchIndex: -1 }));
    }
  }, [setUISearchQuery]);

  const executeSearch = useCallback(() => {
    const { searchQuery } = state;
    if (!searchQuery.trim()) {
      setState(prev => ({ ...prev, searchResults: [], currentSearchIndex: -1 }));
      return;
    }

    const results = searchNodes(searchQuery, useMindMapStore.getState().data?.rootNodes || []);
    setState(prev => ({ ...prev, searchResults: results, currentSearchIndex: results.length > 0 ? 0 : -1 }));

    if (results.length > 0) {
      useMindMapStore.getState().selectNode(results[0]);
    }
  }, [state]);

  const navigateSearch = useCallback((direction: 1 | -1) => {
    const { searchQuery } = state;
    if (!searchQuery.trim()) return;

    const results = searchNodes(searchQuery, useMindMapStore.getState().data?.rootNodes || []);
    if (results.length === 0) return;

    const { selectedNodeId } = useMindMapStore.getState();
    const currentIndex = selectedNodeId ? results.indexOf(selectedNodeId) : -1;

    let nextIndex: number;
    if (currentIndex === -1) {
      nextIndex = direction === 1 ? 0 : results.length - 1;
    } else if (direction === 1) {
      nextIndex = (currentIndex + 1) % results.length;
    } else {
      nextIndex = currentIndex <= 0 ? results.length - 1 : currentIndex - 1;
    }

    setState(prev => ({ ...prev, searchResults: results, currentSearchIndex: nextIndex }));
    useMindMapStore.getState().selectNode(results[nextIndex]);
  }, [state]);

  const nextSearchResult = useCallback(() => navigateSearch(1), [navigateSearch]);
  const previousSearchResult = useCallback(() => navigateSearch(-1), [navigateSearch]);

  const exitSearch = useCallback(() => {
    setState(prev => ({ ...prev, mode: 'normal', searchQuery: '', searchResults: [], currentSearchIndex: -1 }));
    setUISearchQuery('');
  }, [setUISearchQuery]);

  const startJumpy = useCallback(() => {
    const visibleNodes = getAllNodes();
    const labels = generateLabels(visibleNodes.length, JUMP_CHARS);
    const jumpyLabels = visibleNodes.map((node, index) => ({ nodeId: node.id, label: labels[index] || `${index}` }));
    setState(prev => ({ ...prev, mode: 'jumpy', jumpyLabels, jumpyBuffer: '' }));
  }, [getAllNodes]);

  const exitJumpy = useCallback(() =>
    setState(prev => ({ ...prev, mode: 'normal', jumpyLabels: [], jumpyBuffer: '' })), []);

  const jumpToNode = useCallback((inputChar: string) => {
    const newBuffer = state.jumpyBuffer + inputChar;
    const exactMatch = state.jumpyLabels.find(jl => jl.label === newBuffer);

    if (exactMatch) {
      useMindMapStore.getState().selectNode(exactMatch.nodeId);
      exitJumpy();
      return;
    }

    const potentialMatches = state.jumpyLabels.filter(jl => jl.label.startsWith(newBuffer));
    setState(prev => ({ ...prev, jumpyBuffer: potentialMatches.length > 0 ? newBuffer : '' }));
  }, [state.jumpyLabels, state.jumpyBuffer, exitJumpy]);

  const appendToCountBuffer = useCallback((digit: string) => {
    countBufferRef.current.append(digit);
    setState(prev => ({ ...prev, countBuffer: countBufferRef.current.getBuffer() }));
  }, []);

  const clearCountBuffer = useCallback(() => {
    countBufferRef.current.clear();
    setState(prev => ({ ...prev, countBuffer: '' }));
  }, []);

  const getCount = useCallback(() => countBufferRef.current.getCount(), []);
  const hasCount = useCallback(() => countBufferRef.current.hasCount(), []);
  const getCountBuffer = useCallback(() => countBufferRef.current, []);
  const getRepeatRegistry = useCallback(() => repeatRegistryRef.current, []);

  useEffect(() => {
    if (state.mode !== 'normal') setState(prev => ({ ...prev, commandOutput: '' }));
  }, [state.mode]);

  return useMemo(() => {
    const settingsWithVim = settings as typeof settings & { vimMindMap?: boolean };
    return {
      ...state,
      isEnabled: settingsWithVim.vimMindMap,
      setMode, enable, disable, toggle,
      executeCommand, appendToCommandBuffer, clearCommandBuffer,
      getCurrentRootNode,
      startSearch, updateSearchQuery, executeSearch,
      nextSearchResult, previousSearchResult, exitSearch,
      startJumpy, exitJumpy, jumpToNode,
      startCommandLine, updateCommandLineBuffer, executeCommandLine, exitCommandLine, setCommandOutput,
      appendToCountBuffer, clearCountBuffer, getCount, hasCount, getCountBuffer, getRepeatRegistry
    };
  }, [
    state, settings, setMode, enable, disable, toggle,
    executeCommand, appendToCommandBuffer, clearCommandBuffer,
    getCurrentRootNode,
    startSearch, updateSearchQuery, executeSearch,
    nextSearchResult, previousSearchResult, exitSearch,
    startJumpy, exitJumpy, jumpToNode,
    startCommandLine, updateCommandLineBuffer, executeCommandLine, exitCommandLine, setCommandOutput,
    appendToCountBuffer, clearCountBuffer, getCount, hasCount, getCountBuffer, getRepeatRegistry
  ]);
};
