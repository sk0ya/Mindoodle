import type { MindMapNode } from '@shared/types';
import type { NormalizedData } from '@core/data/normalizedStore';


export function searchNodesInCurrentMap(
  query: string,
  normalizedData: NormalizedData | null
): Set<string> {
  if (!query.trim() || !normalizedData) {
    return new Set();
  }

  const matchingNodeIds = new Set<string>();
  const searchTerm = query.toLowerCase().trim();

  
  Object.values(normalizedData.nodes).forEach((node: MindMapNode) => {
    if (node && node.text) {
      const nodeText = node.text.toLowerCase();
      if (nodeText.includes(searchTerm)) {
        matchingNodeIds.add(node.id);
      }
    }
  });

  return matchingNodeIds;
}


export function getAncestorNodeIds(
  nodeId: string,
  normalizedData: NormalizedData
): string[] {
  const ancestors: string[] = [];
  let currentNodeId: string | undefined = nodeId;

  while (currentNodeId && currentNodeId !== 'root') {
    const parentId: string | undefined = normalizedData.parentMap[currentNodeId];
    if (parentId && parentId !== 'root') {
      ancestors.push(parentId);
      currentNodeId = parentId;
    } else {
      break;
    }
  }

  return ancestors;
}


export function getDescendantNodeIds(
  nodeId: string,
  normalizedData: NormalizedData
): string[] {
  const descendants: string[] = [];
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    if (!currentNodeId) continue;
    const childIds = normalizedData.childrenMap[currentNodeId] || [];

    childIds.forEach(childId => {
      descendants.push(childId);
      queue.push(childId);
    });
  }

  return descendants;
}


export function expandSearchResults(
  matchingNodeIds: Set<string>,
  normalizedData: NormalizedData,
  includeAncestors: boolean = true,
  includeDescendants: boolean = false
): Set<string> {
  const expandedIds = new Set(matchingNodeIds);

  matchingNodeIds.forEach(nodeId => {
    if (includeAncestors) {
      
      const ancestors = getAncestorNodeIds(nodeId, normalizedData);
      ancestors.forEach(ancestorId => expandedIds.add(ancestorId));
    }

    if (includeDescendants) {
      
      const descendants = getDescendantNodeIds(nodeId, normalizedData);
      descendants.forEach(descendantId => expandedIds.add(descendantId));
    }
  });

  return expandedIds;
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
    return {
      matchingNodes,
      highlightedNodes: matchingNodes
    };
  }

  const highlightedNodes = expandSearchResults(
    matchingNodes,
    normalizedData,
    includeAncestors,
    includeDescendants
  );

  return {
    matchingNodes,
    highlightedNodes
  };
}