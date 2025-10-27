/**
 * Mindmap application commands - refactored with functional patterns
 * Reduced from 218 lines to 128 lines (41% reduction)
 */

import type { Command, CommandResult } from '../system/types';
import type { MapIdentifier } from '@shared/types';
import { utilityCommand, applicationCommand, failure, success } from '../utils/commandFunctional';


export const newMindmapCommand: Command = utilityCommand(
  'new',
  'Create a new mindmap',
  (_context, args) => success(`Create new mindmap "${args['title'] as string || 'New Mindmap'}" - New mindmap API needs implementation`),
  {
    aliases: ['new-mindmap', 'create'],
    examples: ['new', 'new-mindmap', 'create'],
    args: [{ name: 'title', type: 'string', required: false, default: 'New Mindmap', description: 'Title for the new mindmap' }]
  }
);

export const clearMindmapCommand: Command = utilityCommand(
  'clear',
  'Clear the current mindmap',
  (_context, args) => {
    if (!(args['confirm'] as boolean)) {
      return failure('This operation will clear all nodes. Use --confirm to proceed');
    }
    return success('Clear mindmap - Clear API needs implementation');
  },
  {
    aliases: ['reset', 'clear-all'],
    examples: ['clear', 'reset', 'clear-all'],
    args: [{ name: 'confirm', type: 'boolean', required: false, default: false, description: 'Skip confirmation prompt' }]
  }
);

export const statsCommand: Command = utilityCommand(
  'stats',
  'Show mindmap statistics',
  () => success('Show mindmap statistics - Stats API needs implementation'),
  { aliases: ['statistics', 'info'], examples: ['stats', 'statistics', 'info'] }
);

export const autoLayoutCommand: Command = {
  ...utilityCommand(
    'auto-layout',
    'Auto-arrange nodes with optimal layout',
    (_context, args) => success(`Apply ${args['algorithm'] as string || 'default'} layout - Auto-layout API needs implementation`),
    {
      aliases: ['layout', 'arrange'],
      examples: ['auto-layout', 'layout', 'arrange'],
      args: [{ name: 'algorithm', type: 'string', required: false, default: 'default', description: 'Layout algorithm: default, radial, tree, organic' }]
    }
  ),
  category: 'structure'
};

export const themeCommand: Command = utilityCommand(
  'theme',
  'Change mindmap theme',
  (_context, args) => success(`Set theme to "${args['themeName'] as string}" - Theme API needs implementation`),
  {
    aliases: ['set-theme'],
    examples: ['theme dark', 'theme light', 'set-theme blue'],
    args: [{ name: 'themeName', type: 'string', required: true, description: 'Theme name: light, dark, blue, green, etc.' }]
  }
);


const findWorkspaceForMap = (mapId: string): string | undefined => {
  try {
    const maps = (window as Window & { mindoodleAllMaps?: Array<{ mapIdentifier: { mapId: string; workspaceId: string } }> }).mindoodleAllMaps;
    const found = Array.isArray(maps) ? maps.find(m => m?.mapIdentifier?.mapId === mapId) : undefined;
    return found?.mapIdentifier?.workspaceId;
  } catch {
    return undefined;
  }
};

const switchToMapById = (mapId: string, workspaceId?: string): CommandResult => {
  const ws = workspaceId || findWorkspaceForMap(mapId) || '';
  const payload: MapIdentifier = { mapId, workspaceId: ws };
  window.dispatchEvent(new CustomEvent('mindoodle:selectMapById', { detail: payload }));
  return success(`Switching to map ${mapId}`);
};

const switchMapByDirection = (direction: string): CommandResult => {
  const extWindow = window as Window & { mindoodleCurrentMapId?: string; mindoodleCurrentWorkspaceId?: string };
  const detail = {
    mapId: extWindow.mindoodleCurrentMapId || '',
    workspaceId: extWindow.mindoodleCurrentWorkspaceId,
    source: 'keyboard',
    direction
  };
  window.dispatchEvent(new CustomEvent('mindoodle:selectMapById', { detail }));
  return success(`Switching ${direction}`);
};

export const switchMapCommand: Command = applicationCommand(
  'switch-map',
  'Switch current map by id or direction',
  async (_context, args) => {
    const direction = args['direction'] as string | undefined;
    const mapId = args['mapId'] as string | undefined;
    const workspaceId = args['workspaceId'] as string | undefined;

    if (mapId) return switchToMapById(mapId, workspaceId);
    if (direction) return switchMapByDirection(direction);
    return failure('Specify --direction next|prev or --mapId <id>');
  },
  {
    aliases: ['map-next', 'map-prev', 'switchmap'],
    examples: ['switch-map --direction next', 'switch-map --direction prev', 'switch-map --mapId foo/bar --workspaceId ws_abc123'],
    args: [
      { name: 'direction', type: 'string', required: false, description: "'next' or 'prev'" },
      { name: 'mapId', type: 'string', required: false, description: 'Target map id' },
      { name: 'workspaceId', type: 'string', required: false, description: 'Target workspace id' }
    ],
    guard: (_ctx, args) => {
      const direction = args['direction'] as string | undefined;
      const mapId = args['mapId'] as string | undefined;
      return direction === 'next' || direction === 'prev' || typeof mapId === 'string';
    }
  }
);
