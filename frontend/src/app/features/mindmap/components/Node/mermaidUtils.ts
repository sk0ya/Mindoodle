/**
 * Mermaid diagram utility functions
 */

/**
 * Extract Mermaid code blocks from text
 * Finds all ```mermaid blocks and extracts their content
 *
 * @param text - Text containing potential Mermaid blocks
 * @returns Array of Mermaid block contents (trimmed)
 */
export const extractMermaidBlocks = (text: string): string[] => {
  const blocks: string[] = [];
  let pos = 0;
  const fence = '```';
  const marker = '```mermaid';

  while (pos < text.length) {
    const start = text.indexOf(marker, pos);
    if (start === -1) break;

    // content starts after the first newline following marker (if any)
    let contentStart = start + marker.length;
    while (contentStart < text.length && (text[contentStart] === ' ' || text[contentStart] === '\t')) {
      contentStart++;
    }
    if (text[contentStart] === '\r' && text[contentStart + 1] === '\n') {
      contentStart += 2;
    } else if (text[contentStart] === '\n' || text[contentStart] === '\r') {
      contentStart += 1;
    }

    const end = text.indexOf(fence, contentStart);
    if (end === -1) break;

    blocks.push(text.slice(contentStart, end).trim());
    pos = end + fence.length;
  }

  return blocks;
};

/**
 * Check if Mermaid blocks have changed between old and new text
 * Compares block count and content
 *
 * @param oldText - Previous text content
 * @param newText - New text content
 * @returns True if Mermaid blocks have changed
 */
export const hasMermaidBlocksChanged = (oldText: string, newText: string): boolean => {
  const oldMermaidBlocks = extractMermaidBlocks(oldText);
  const newMermaidBlocks = extractMermaidBlocks(newText);

  return (
    oldMermaidBlocks.length !== newMermaidBlocks.length ||
    oldMermaidBlocks.some(oldBlock => !newMermaidBlocks.includes(oldBlock)) ||
    newMermaidBlocks.some(newBlock => !oldMermaidBlocks.includes(newBlock))
  );
};
