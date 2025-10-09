import type { MindMapNode } from '@shared/types';
import type { NormalizedData } from '@core/data/normalizedStore';

/**
 * Search for nodes containing the query string
 */
export function searchNodesInCurrentMap(
  query: string,
  normalizedData: NormalizedData | null
): Set<string> {
  if (!query.trim() || !normalizedData) {
    return new Set();
  }

  const matchingNodeIds = new Set<string>();
  const searchTerm = query.toLowerCase().trim();

  // Search through all nodes in the normalized data
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

/**
 * Get all ancestor node IDs for a given node
 */
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

/**
 * Get all descendant node IDs for a given node
 */
export function getDescendantNodeIds(
  nodeId: string,
  normalizedData: NormalizedData
): string[] {
  const descendants: string[] = [];
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    const childIds = normalizedData.childrenMap[currentNodeId] || [];

    childIds.forEach(childId => {
      descendants.push(childId);
      queue.push(childId);
    });
  }

  return descendants;
}

/**
 * Expand search results to include related nodes (ancestors and descendants)
 * This helps ensure the search context is visible
 */
export function expandSearchResults(
  matchingNodeIds: Set<string>,
  normalizedData: NormalizedData,
  includeAncestors: boolean = true,
  includeDescendants: boolean = false
): Set<string> {
  const expandedIds = new Set(matchingNodeIds);

  matchingNodeIds.forEach(nodeId => {
    if (includeAncestors) {
      // Add ancestor nodes to show the path to matching nodes
      const ancestors = getAncestorNodeIds(nodeId, normalizedData);
      ancestors.forEach(ancestorId => expandedIds.add(ancestorId));
    }

    if (includeDescendants) {
      // Add descendant nodes if needed
      const descendants = getDescendantNodeIds(nodeId, normalizedData);
      descendants.forEach(descendantId => expandedIds.add(descendantId));
    }
  });

  return expandedIds;
}

/**
 * Main search function that finds and optionally expands search results
 */
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