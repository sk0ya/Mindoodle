

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { getCommandRegistry } from '../../commands/system/registry';
import { registerAllCommands } from '../../commands/index';
import type { Command } from '../../commands/system/types';
import type { MindMapData } from '@shared/types';
import { getFolderName } from '../utils/folderUtils';
import { logger } from '@shared/utils';

interface StorageAdapter {
  loadAllMaps?: () => Promise<MindMapData[]>;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteCommand: (commandName: string, args?: Record<string, unknown>) => void;
  onSelectMap?: (mapId: { mapId: string; workspaceId: string }) => void;
  storageAdapter?: StorageAdapter;
}


interface MapItem {
  type: 'map';
  mapId: string;
  workspaceId: string;
  title: string;
  category: string;
  folderName: string;
  folderPath: string;
}

interface CombinedItem {
  type: 'command' | 'map';
  displayName: string;
  description: string;
  category: string;
  command?: Command;
  mapData?: MapItem;
}

type FilterMode = 'all' | 'maps' | 'commands';

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onExecuteCommand,
  onSelectMap,
  storageAdapter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedMaps, setLoadedMaps] = useState<MindMapData[]>([]);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  
  useEffect(() => {
    if (isOpen && !mapsLoading && loadedMaps.length === 0) {
      setMapsLoading(true);
      const loadMaps = async () => {
        try {
          const adapter = storageAdapter;
          if (adapter && typeof adapter.loadAllMaps === 'function') {
            const maps = await adapter.loadAllMaps();
            setLoadedMaps(maps);
          }
        } catch (error) {
          logger.warn('Failed to load maps from storage:', error);

          setLoadedMaps([]);
        } finally {
          setMapsLoading(false);
        }
      };
      loadMaps();
    }
  }, [isOpen, mapsLoading, loadedMaps.length, storageAdapter]);

  
  const allItems = useMemo(() => {
    const registry = getCommandRegistry();

    
    if (registry.getAll().length === 0) {
      registerAllCommands(registry);
    }

    const commands = registry.getAll();

    
    const commandItems: CombinedItem[] = commands.map(command => ({
      type: 'command' as const,
      displayName: command.name,
      description: command.description,
      category: command.category || 'general',
      command,
    }));

    
    const mapsToUse = loadedMaps;

    
    const mapItems: CombinedItem[] = mapsToUse.map(map => {
      
      const mapIdentifier = map.mapIdentifier;
      const title = map.title || 'Untitled Map';
      const category = map.category || '';
      const folderName = getFolderName(category);
      const folderPath = category || '（未分類）';

      // Get workspace name from global workspaces array
      interface Workspace {
        id: string;
        name: string;
      }
      const workspaces = ((window as Window & { mindoodleWorkspaces?: Workspace[] }).mindoodleWorkspaces) || [];
      const workspace = workspaces.find((w) => w.id === mapIdentifier.workspaceId);
      const workspaceName = workspace?.name || (mapIdentifier.workspaceId === '__default__' ? 'Default Workspace' : mapIdentifier.workspaceId);

      return {
        type: 'map' as const,
        displayName: title,
        description: workspaceName,
        category: 'Map',
        mapData: {
          type: 'map' as const,
          mapId: mapIdentifier.mapId,
          workspaceId: mapIdentifier.workspaceId,
          title: title,
          category: category,
          folderName: folderName,
          folderPath: folderPath,
        },
      };
    });

    
    return [...mapItems, ...commandItems];
  }, [loadedMaps]);

  
  const filteredItems = useMemo(() => {
    let itemsToFilter: typeof allItems;
    if (filterMode === 'commands') {
      itemsToFilter = allItems.filter(item => item.type === 'command');
    } else if (filterMode === 'maps') {
      itemsToFilter = allItems.filter(item => item.type === 'map');
    } else {
      itemsToFilter = allItems;
    }

    if (!searchQuery.trim()) {
      return itemsToFilter;
    }

    const lowerQuery = searchQuery.toLowerCase();

    return itemsToFilter.filter(item => {
      
      const displayNameMatch = item.displayName.toLowerCase().includes(lowerQuery);

      
      if (item.type === 'map' && item.mapData) {
        const pathMatch = item.mapData.folderPath.toLowerCase().includes(lowerQuery);
        return displayNameMatch || pathMatch;
      }

      return displayNameMatch;
    });
  }, [searchQuery, allItems, filterMode]);

  
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      setSearchQuery('');
      setSelectedIndex(0);
      setFilterMode('all');
    } else if (!isOpen) {
      
      setLoadedMaps([]);
      setMapsLoading(false);
    }
  }, [isOpen]);

  
  const cycleFilterMode = useCallback(() => {
    setFilterMode(prev => {
      switch (prev) {
        case 'all': return 'maps';
        case 'maps': return 'commands';
        case 'commands': return 'all';
        default: return 'all';
      }
    });
    setSelectedIndex(0);
  }, []);


  const handleSelectItem = useCallback((item: CombinedItem) => {
    if (item.type === 'command' && item.command) {
      onExecuteCommand(item.command.name);
    } else if (item.type === 'map' && item.mapData && onSelectMap) {
      onSelectMap({
        mapId: item.mapData.mapId,
        workspaceId: item.mapData.workspaceId,
      });
    }
    onClose();
  }, [onExecuteCommand, onSelectMap, onClose]);


  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;

      case 'p':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          cycleFilterMode();
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
        break;

      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelectItem(filteredItems[selectedIndex]);
        }
        break;
    }
  }, [isOpen, onClose, filteredItems, selectedIndex, cycleFilterMode, handleSelectItem]);

  
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'auto', 
        });
      }
    }
  }, [selectedIndex]);

  
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 1000,
        paddingTop: '20vh',
      }}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        style={{
          backgroundColor: 'var(--vscode-quickInput-background, #252526)',
          border: '1px solid var(--vscode-quickInput-border, #464647)',
          borderRadius: '6px',
          width: '600px',
          maxWidth: '90vw',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 16px 70px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {}
        <div style={{
          display: 'inline-flex',
          borderBottom: '1px solid var(--vscode-quickInput-border, #464647)',
          alignSelf: 'flex-start',
          flexShrink: 0,
        }}>
            {(['all', 'maps', 'commands'] as FilterMode[]).map((mode) => (
              <button
              key={mode}
              onClick={() => {
                setFilterMode(mode);
                setSelectedIndex(0);
              }}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: filterMode === mode
                  ? 'var(--vscode-tab-activeBackground, #1e1e1e)'
                  : 'transparent',
                color: filterMode === mode
                  ? 'var(--vscode-tab-activeForeground, #ffffff)'
                  : 'var(--vscode-tab-inactiveForeground, #969696)',
                borderBottom: filterMode === mode
                  ? '2px solid var(--vscode-focusBorder, #007acc)'
                  : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '16px',
                fontFamily: 'var(--vscode-font-family, "Segoe UI", Tahoma, sans-serif)',
                fontWeight: filterMode === mode ? '500' : 'normal',
                textTransform: 'capitalize',
                transition: 'all 0.1s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (filterMode !== mode) {
                  e.currentTarget.style.backgroundColor = 'var(--vscode-quickInputList-focusBackground, #094771)';
                }
              }}
              onMouseLeave={(e) => {
                if (filterMode !== mode) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {{ all: 'All', maps: 'Maps', commands: 'Commands' }[mode]}
            </button>
          ))}
        </div>

        {}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--vscode-quickInput-border, #464647)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}>
          <Search
            size={16}
            color="var(--vscode-quickInput-foreground, #cccccc)"
            style={{ flexShrink: 0 }}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Type a command..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--vscode-quickInput-foreground, #cccccc)',
              fontSize: '16px',
              fontFamily: 'var(--vscode-font-family, "Segoe UI", Tahoma, sans-serif)',
            }}
          />
          {}
          <div style={{
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground, #999999)',
            opacity: 0.7,
            flexShrink: 0,
          }}>
            Ctrl+P
          </div>
        </div>

        {}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <div
                key={item.type === 'command' ? `cmd-${item.command?.name}` : `map-${item.mapData?.mapId}`}
                onClick={() => handleSelectItem(item)}
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  backgroundColor: index === selectedIndex
                    ? 'var(--vscode-quickInputList-focusBackground, #094771)'
                    : 'transparent',
                  color: 'var(--vscode-quickInput-foreground, #cccccc)',
                  transition: 'background-color 0.1s',
                  fontFamily: 'var(--vscode-font-family, "Segoe UI", Tahoma, sans-serif)',
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '2px',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minWidth: 0,
                    flex: 1,
                  }}>
                    {item.type === 'map' && (
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--vscode-symbolIcon-fileForeground, #719cd6)',
                        flexShrink: 0,
                      }}>
                        📄
                      </span>
                    )}
                    <span style={{
                      fontSize: '15px',
                      fontWeight: '500',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}>
                      {item.displayName}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    color: item.type === 'map'
                      ? '#ffffff'
                      : 'var(--vscode-descriptionForeground, #999999)',
                    backgroundColor: item.type === 'map'
                      ? 'var(--vscode-symbolIcon-fileForeground, #719cd6)'
                      : 'var(--vscode-badge-background, #4d4d4d)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: item.type === 'map' ? '500' : 'normal',
                    flexShrink: 0,
                    marginLeft: '8px',
                  }}>
                    {item.category}
                  </span>
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'var(--vscode-descriptionForeground, #999999)',
                  lineHeight: '1.3',
                }}>
                  {item.description}
                </div>
                {}
                {item.type === 'command' && item.command?.aliases && item.command.aliases.length > 0 && (
                  <div style={{
                    fontSize: '10px',
                    color: 'var(--vscode-descriptionForeground, #888888)',
                    marginTop: '2px',
                  }}>
                    {item.command.aliases.join(', ')}
                  </div>
                )}
                {}
                {item.type === 'map' && item.mapData?.folderPath && item.mapData.folderPath !== '（未分類）' && (
                  <div style={{
                    fontSize: '10px',
                    color: 'var(--vscode-descriptionForeground, #888888)',
                    marginTop: '2px',
                  }}>
                    Path: {item.mapData.folderPath}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--vscode-descriptionForeground, #999999)',
              fontSize: '15px',
              fontFamily: 'var(--vscode-font-family, "Segoe UI", Tahoma, sans-serif)',
            }}>
              No commands found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
