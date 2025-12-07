import type { MindMapNode, MindMapData } from '../types';
import type { StorageAdapter } from '../../core/types/storage.types';
import { logger } from './logger';

export interface SearchResult {
  nodeId: string;
  text: string;
  note: string;
  mapId: string | null;
  mapTitle: string | null;
  matchType: 'text' | 'note';
  workspaceId: string;
}

export interface FileBasedSearchResult {
  filePath: string;
  fileName: string;
  mapId: string;
  workspaceId: string;
  lineNumber: number;
  lineContent: string;
  matchedText: string;
  matchType: 'text' | 'note';
}

const matchesQuery = (text: string | undefined, query: string): boolean =>
  text?.toLowerCase().includes(query.toLowerCase().trim()) ?? false;

// removed unused walkNodes generator

export function searchNodesRecursively(
  node: MindMapNode,
  query: string,
  mapData: MindMapData,
  results: SearchResult[] = []
): SearchResult[] {
  const searchTerm = query.toLowerCase().trim();
  const textMatch = matchesQuery(node.text, searchTerm);
  const noteMatch = matchesQuery(node.note, searchTerm);

  if (textMatch || noteMatch) {
    results.push({
      nodeId: node.id,
      text: node.text,
      note: node.note || '',
      mapId: mapData.mapIdentifier.mapId,
      mapTitle: mapData.title,
      matchType: textMatch ? 'text' : 'note',
      workspaceId: mapData.mapIdentifier.workspaceId
    });
  }

  node.children?.forEach(child => searchNodesRecursively(child, query, mapData, results));
  return results;
}

export const searchNodes = (query: string, mapData: MindMapData | null): SearchResult[] =>
  !query.trim() || !mapData
    ? []
    : (mapData.rootNodes || []).flatMap(node => searchNodesRecursively(node, query, mapData));

export const searchMultipleMaps = (query: string, maps: MindMapData[]): SearchResult[] =>
  !query.trim() || !maps.length
    ? []
    : maps.flatMap(map => (map.rootNodes || []).flatMap(node => searchNodesRecursively(node, query, map)));

export async function searchFilesForContent(
  query: string,
  storageAdapter: StorageAdapter,
  workspaces?: Array<{ id: string; name: string }>
): Promise<FileBasedSearchResult[]> {
  if (!query.trim() || !storageAdapter) return [];

  const results: FileBasedSearchResult[] = [];
  const searchTerm = query.toLowerCase();

  try {
    const maps = await storageAdapter.loadAllMaps();

    for (const map of maps) {
      const { mapId, workspaceId } = map.mapIdentifier;
      const workspaceName = workspaces?.find(w => w.id === workspaceId)?.name || workspaceId || 'デフォルト';
      const mapName = map.title || mapId;
      const filePath = `${workspaceName}/${mapName}`;

      if (typeof storageAdapter.getMapMarkdown === 'function') {
        try {
          const markdown = await storageAdapter.getMapMarkdown(map.mapIdentifier);
          if (markdown) {
            markdown.split('\n').forEach((line, index) => {
              if (line.toLowerCase().includes(searchTerm)) {
                results.push({
                  filePath,
                  fileName: mapName,
                  mapId,
                  workspaceId: workspaceId || '',
                  lineNumber: index + 1,
                  lineContent: line.trim(),
                  matchedText: query,
                  matchType: 'text'
                });
              }
            });
          }
        } catch (error) {
          logger.warn(`Failed to get markdown for ${mapId}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('File-based search error:', error);
  }

  return results;
}

export function findNodeByLineNumber(
  map: MindMapData,
  targetLineNumber: number
): { node: MindMapNode; depth: number } | null {
  const findInNodes = (nodes: MindMapNode[], depth = 0): { node: MindMapNode; depth: number } | null => {
    for (const node of nodes) {
      if (node.markdownMeta?.lineNumber !== undefined && node.markdownMeta.lineNumber + 1 === targetLineNumber) {
        return { node, depth };
      }
      if (node.children) {
        const result = findInNodes(node.children, depth + 1);
        if (result) return result;
      }
    }
    return null;
  };

  return findInNodes(map.rootNodes || []);
}

export function getMatchPosition(text: string, query: string): {
  beforeMatch: string;
  match: string;
  afterMatch: string;
} | null {
  if (!query.trim()) return null;

  const searchTerm = query.toLowerCase();
  const startIndex = text.toLowerCase().indexOf(searchTerm);

  return startIndex === -1
    ? null
    : {
        beforeMatch: text.slice(0, startIndex),
        match: text.slice(startIndex, startIndex + searchTerm.length),
        afterMatch: text.slice(startIndex + searchTerm.length)
      };
}
