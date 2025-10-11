

import type { Command, CommandContext, CommandResult } from '../system/types';
import type { MapIdentifier } from '@shared/types';


export const newMindmapCommand: Command = {
  name: 'new',
  aliases: ['new-mindmap', 'create'],
  description: 'Create a new mindmap',
  category: 'utility',
  examples: ['new', 'new-mindmap', 'create'],
  args: [
    {
      name: 'title',
      type: 'string',
      required: false,
      default: 'New Mindmap',
      description: 'Title for the new mindmap'
    }
  ],

  execute(_context: CommandContext, args: Record<string, unknown>): CommandResult {
    const title = (args as Record<string, string>)['title'];

    try {
      
      return {
        success: true,
        message: `Create new mindmap "${title}" - New mindmap API needs implementation`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create new mindmap'
      };
    }
  }
};


export const clearMindmapCommand: Command = {
  name: 'clear',
  aliases: ['reset', 'clear-all'],
  description: 'Clear the current mindmap',
  category: 'utility',
  examples: ['clear', 'reset', 'clear-all'],
  args: [
    {
      name: 'confirm',
      type: 'boolean',
      required: false,
      default: false,
      description: 'Skip confirmation prompt'
    }
  ],

  execute(_context: CommandContext, args: Record<string, unknown>): CommandResult {
    const skipConfirm = (args as Record<string, boolean>)['confirm'];

    if (!skipConfirm) {
      return {
        success: false,
        error: 'This operation will clear all nodes. Use --confirm to proceed'
      };
    }

    
    return {
      success: true,
      message: 'Clear mindmap - Clear API needs implementation'
    };
  }
};


export const statsCommand: Command = {
  name: 'stats',
  aliases: ['statistics', 'info'],
  description: 'Show mindmap statistics',
  category: 'utility',
  examples: ['stats', 'statistics', 'info'],

  execute(_context: CommandContext): CommandResult {
    
    return {
      success: true,
      message: 'Show mindmap statistics - Stats API needs implementation'
    };
  }
};


export const autoLayoutCommand: Command = {
  name: 'auto-layout',
  aliases: ['layout', 'arrange'],
  description: 'Auto-arrange nodes with optimal layout',
  category: 'structure',
  examples: ['auto-layout', 'layout', 'arrange'],
  args: [
    {
      name: 'algorithm',
      type: 'string',
      required: false,
      default: 'default',
      description: 'Layout algorithm: default, radial, tree, organic'
    }
  ],

  execute(_context: CommandContext, args: Record<string, unknown>): CommandResult {
    const algorithm = (args as Record<string, string>)['algorithm'];

    
    return {
      success: true,
      message: `Apply ${algorithm} layout - Auto-layout API needs implementation`
    };
  }
};


export const themeCommand: Command = {
  name: 'theme',
  aliases: ['set-theme'],
  description: 'Change mindmap theme',
  category: 'utility',
  examples: ['theme dark', 'theme light', 'set-theme blue'],
  args: [
    {
      name: 'themeName',
      type: 'string',
      required: true,
      description: 'Theme name: light, dark, blue, green, etc.'
    }
  ],

  execute(_context: CommandContext, args: Record<string, unknown>): CommandResult {
    const themeName = (args as Record<string, string>)['themeName'];

    
    return {
      success: true,
      message: `Set theme to "${themeName}" - Theme API needs implementation`
    };
  }
};


function findWorkspaceForMap(mapId: string): string | undefined {
  try {
    const maps = (window as Window & { mindoodleAllMaps?: Array<{ mapIdentifier: { mapId: string; workspaceId: string } }> }).mindoodleAllMaps;
    const found = Array.isArray(maps) ? maps.find(m => m?.mapIdentifier?.mapId === mapId) : undefined;
    return found?.mapIdentifier?.workspaceId;
  } catch {
    return undefined;
  }
}

function switchToMapById(mapId: string, workspaceId?: string): CommandResult {
  const ws = workspaceId || findWorkspaceForMap(mapId) || '';
  const payload: MapIdentifier = { mapId, workspaceId: ws };
  const ev = new CustomEvent('mindoodle:selectMapById', { detail: payload });
  window.dispatchEvent(ev);
  return { success: true, message: `Switching to map ${mapId}` };
}

function switchMapByDirection(direction: string): CommandResult {
  const extWindow = window as Window & { mindoodleCurrentMapId?: string; mindoodleCurrentWorkspaceId?: string };
  const currentId: string | null = extWindow.mindoodleCurrentMapId || null;
  const detail = { mapId: currentId || '', workspaceId: extWindow.mindoodleCurrentWorkspaceId, source: 'keyboard', direction };
  const ev = new CustomEvent('mindoodle:selectMapById', { detail });
  window.dispatchEvent(ev);
  return { success: true, message: `Switching ${direction}` };
}

export const switchMapCommand: Command = {
  name: 'switch-map',
  aliases: ['map-next', 'map-prev', 'switchmap'],
  description: 'Switch current map by id or direction',
  category: 'application',
  examples: [
    'switch-map --direction next',
    'switch-map --direction prev',
    'switch-map --mapId foo/bar --workspaceId ws_abc123'
  ],
  args: [
    { name: 'direction', type: 'string', required: false, description: "'next' or 'prev'" },
    { name: 'mapId', type: 'string', required: false, description: 'Target map id' },
    { name: 'workspaceId', type: 'string', required: false, description: 'Target workspace id' }
  ],
  guard: (_ctx: CommandContext, args: Record<string, unknown>) => {
    const typedArgs = args as Record<string, string | undefined>;
    const direction = typedArgs['direction'];
    const mapId = typedArgs['mapId'];

    return direction === 'next' || direction === 'prev' || typeof mapId === 'string';
  },
  async execute(_context: CommandContext, args: Record<string, unknown>): Promise<CommandResult> {
    try {
      const typedArgs = args as Record<string, string | undefined>;
      const direction = typedArgs['direction'];
      const mapId = typedArgs['mapId'];
      const workspaceId = typedArgs['workspaceId'];

      if (mapId) {
        return switchToMapById(mapId, workspaceId);
      }

      if (direction) {
        return switchMapByDirection(direction);
      }

      return { success: false, error: 'Specify --direction next|prev or --mapId <id>' };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to switch map' };
    }
  }
};
