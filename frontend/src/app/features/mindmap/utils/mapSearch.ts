/**
 * Mind map search utilities - refactored with functional patterns
 * Reduced from 132 lines to 121 lines (8% reduction)
 */

import type { MindMapNode } from '@shared/types';
import type { NormalizedData } from '@core/data/normalizedStore';


const nodeMatchesSearch = (node: MindMapNode | undefined, searchTerm: string): boolean =>
  !!(node?.text && node.text.toLowerCase().includes(searchTerm));

const collectMatchingNodeIds = (nodes: Record<string, MindMapNode>, searchTerm: string): Set<string> =>
  new Set(
    Object.values(nodes)
      .filter(node => nodeMatchesSearch(node, searchTerm))
      .map(node => node.id)
  );

const buildAncestorChain = (
  nodeId: string,
  parentMap: Record<string, string>,
  ancestors: string[] = []
): string[] => {
  const parentId = parentMap[nodeId];
  if (!parentId || parentId === 'root') return ancestors;
  return buildAncestorChain(parentId, parentMap, [...ancestors, parentId]);
};

const collectDescendants = (
  nodeId: string,
  childrenMap: Record<string, string[]>
): string[] => {
  const children = childrenMap[nodeId] || [];
  return children.flatMap(childId => [childId, ...collectDescendants(childId, childrenMap)]);
};

const expandWithRelatives = (
  nodeIds: Set<string>,
  normalizedData: NormalizedData,
  getRelatives: (nodeId: string, data: NormalizedData) => string[]
): Set<string> => {
  const expanded = new Set(nodeIds);
  nodeIds.forEach(nodeId => {
    getRelatives(nodeId, normalizedData).forEach(id => expanded.add(id));
  });
  return expanded;
};


export function searchNodesInCurrentMap(
  query: string,
  normalizedData: NormalizedData | null
): Set<string> {
  if (!query.trim() || !normalizedData) return new Set();

  const searchTerm = query.toLowerCase().trim();
  return collectMatchingNodeIds(normalizedData.nodes, searchTerm);
}

export function getAncestorNodeIds(
  nodeId: string,
  normalizedData: NormalizedData
): string[] {
  return buildAncestorChain(nodeId, normalizedData.parentMap);
}

export function getDescendantNodeIds(
  nodeId: string,
  normalizedData: NormalizedData
): string[] {
  return collectDescendants(nodeId, normalizedData.childrenMap);
}

export function expandSearchResults(
  matchingNodeIds: Set<string>,
  normalizedData: NormalizedData,
  includeAncestors: boolean = true,
  includeDescendants: boolean = false
): Set<string> {
  let expanded = new Set(matchingNodeIds);

  if (includeAncestors) {
    expanded = expandWithRelatives(expanded, normalizedData, getAncestorNodeIds);
  }

  if (includeDescendants) {
    expanded = expandWithRelatives(expanded, normalizedData, getDescendantNodeIds);
  }

  return expanded;
}

export function performNodeSearch(
  query: string,
  normalizedData: NormalizedData | null,
  options: {
    includeAncestors?: boolean;
    includeDescendants?: boolean;
  } = {}
): {
  matchingNodes: Set<string>;
  highlightedNodes: Set<string>;
} {
  const { includeAncestors = true, includeDescendants = false } = options;
  const matchingNodes = searchNodesInCurrentMap(query, normalizedData);

  if (!normalizedData || matchingNodes.size === 0) {
    return { matchingNodes, highlightedNodes: matchingNodes };
  }

  const highlightedNodes = expandSearchResults(
    matchingNodes,
    normalizedData,
    includeAncestors,
    includeDescendants
  );

  return { matchingNodes, highlightedNodes };
}