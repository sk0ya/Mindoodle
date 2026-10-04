/**
 * Pure helpers behind the map list / explorer refresh.
 *
 * A refresh runs every few seconds. Most of the time nothing has changed, and
 * handing React a brand-new array (or tree) anyway re-renders the sidebar and
 * everything that depends on the list. These helpers let the refresh keep the
 * previous objects whenever the content is the same.
 */

import type { MindMapData } from '@shared/types';
import type { ExplorerItem, MapSummary } from '@core/types';

const mapKey = (map: { mapIdentifier: { workspaceId: string; mapId: string } }): string =>
  `${map.mapIdentifier.workspaceId}\u0000${map.mapIdentifier.mapId}`;

const DEFAULT_SETTINGS: MindMapData['settings'] = {
  autoSave: true,
  autoLayout: true,
  showGrid: false,
  animationEnabled: true
};

/**
 * Build list entries from a remote listing. A summary has no document, so its
 * entry has no nodes; consumers that need the tree read the document (see
 * `hasLoadedTree`). An unchanged entry is reused as is, which also keeps a tree
 * that was attached to it earlier.
 */
export function mergeSummariesIntoMapList(previous: MindMapData[], summaries: MapSummary[]): MindMapData[] {
  const previousByKey = new Map(previous.map((map) => [mapKey(map), map]));

  return summaries.map((summary) => {
    const existing = previousByKey.get(mapKey(summary));
    if (
      existing &&
      existing.updatedAt === summary.updatedAt &&
      existing.title === summary.title &&
      existing.category === summary.category
    ) {
      return existing;
    }

    const entry: MindMapData = {
      title: summary.title,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      mapIdentifier: { ...summary.mapIdentifier },
      rootNodes: [],
      settings: { ...DEFAULT_SETTINGS }
    };
    if (summary.category !== undefined) entry.category = summary.category;
    return entry;
  });
}

/**
 * Whether a list entry carries a parsed tree that can stand in for reading
 * the document. Entries built from a remote listing do not.
 */
export function hasLoadedTree(map: MindMapData | null | undefined): boolean {
  return !!map && Array.isArray(map.rootNodes) && map.rootNodes.length > 0;
}

/** Same maps, same order, same versions: nothing a list consumer could see has changed. */
export function sameMapList(a: MindMapData[], b: MindMapData[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (
      mapKey(x) !== mapKey(y) ||
      x.updatedAt !== y.updatedAt ||
      x.title !== y.title ||
      x.category !== y.category
    ) {
      return false;
    }
  }
  return true;
}

export function sameExplorerTree(a: ExplorerItem | null, b: ExplorerItem | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type || a.name !== b.name || a.path !== b.path || a.isMarkdown !== b.isMarkdown) return false;

  const ac = a.children ?? [];
  const bc = b.children ?? [];
  if (ac.length !== bc.length) return false;
  for (let i = 0; i < ac.length; i++) {
    if (!sameExplorerTree(ac[i], bc[i])) return false;
  }
  return true;
}

export function sameWorkspaceList<T extends { id: string; name: string; type?: string; adapter?: unknown }>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((ws, i) => ws.id === b[i].id && ws.name === b[i].name && ws.type === b[i].type && ws.adapter === b[i].adapter);
}
