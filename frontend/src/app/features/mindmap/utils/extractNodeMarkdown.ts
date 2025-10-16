import type { MindMapNode } from '@shared/types';

/**
 * Extract markdown lines for a node and its descendants from the full markdown content
 *
 * This function extracts the markdown text for a node by:
 * 1. Getting the node's start line (provided as nodeLineNumber)
 * 2. Finding the last child's line number (the deepest descendant)
 * 3. Extracting all lines from start to the last child's line (inclusive)
 *
 * @param markdownContent - The full markdown content
 * @param nodeLineNumber - The 1-based line number where the node starts (from nodeIdToLineRef)
 * @param node - The node to extract markdown for
 * @param nodeIdToLineMap - Map of nodeId to line number for finding all descendant line numbers
 * @returns The extracted markdown text for this node and its children
 */
export function extractNodeMarkdownFromStream(
  markdownContent: string,
  nodeLineNumber: number,
  node: MindMapNode,
  nodeIdToLineMap?: Record<string, number>
): string {
  if (!markdownContent) return '';
  if (!nodeIdToLineMap) return '';

  const lines = markdownContent.split('\n');

  // Node's start line (1-based)
  const startLine = nodeLineNumber;

  if (startLine < 1 || startLine > lines.length) return '';

  // Find the last child's end line (the deepest descendant in the tree)
  const findLastChildLine = (n: MindMapNode): number => {
    let maxLine = nodeIdToLineMap[n.id] ?? startLine;

    if (n.children?.length) {
      // Recursively find the maximum line number among all children
      for (const child of n.children) {
        const childMaxLine = findLastChildLine(child);
        if (childMaxLine > maxLine) {
          maxLine = childMaxLine;
        }
      }
    }

    return maxLine;
  };

  const lastChildLine = findLastChildLine(node);

  // Extract lines from node's start line to last child's end line (inclusive)
  // Convert to 0-based indices for array slicing
  const startIndex = startLine - 1;
  const endIndex = lastChildLine; // slice is exclusive of end, so lastChildLine becomes the exclusive upper bound

  const extractedLines = lines.slice(startIndex, endIndex);

  return extractedLines.join('\n');
}
