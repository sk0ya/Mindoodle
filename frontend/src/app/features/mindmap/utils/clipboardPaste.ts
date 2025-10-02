import type { MindMapNode } from '@shared/types';

/**
 * Convert node to markdown (same format as copyNode in useShortcutHandlers)
 */
function nodeToMarkdown(node: MindMapNode, level = 0): string {
  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  let md = `${prefix}${node.text}\n`;
  if (node.note !== null) md += `${node.note}\n`;
  if (node.children?.length) {
    node.children.forEach(child => {
      md += nodeToMarkdown(child, level + 1);
    });
  }
  return md;
}

/**
 * Check if system clipboard matches internal clipboard node
 */
function systemClipboardMatchesNode(clipboardText: string, node: MindMapNode): boolean {
  const expectedMarkdown = nodeToMarkdown(node);
  // Normalize line endings (convert \r\n to \n)
  const normalizedClipboard = clipboardText.replace(/\r\n/g, '\n').trim();
  const normalizedExpected = expectedMarkdown.trim();
  return normalizedClipboard === normalizedExpected;
}

export async function pasteFromClipboard(
  parentId: string,
  uiClipboard: MindMapNode | null | undefined,
  addChildNode: (parentId: string, text: string) => string | undefined,
  updateNode: (id: string, updates: Partial<MindMapNode>) => void,
  selectNode: (id: string) => void,
  notify: (type: 'success'|'error'|'info'|'warning', message: string) => void
): Promise<void> {
  // Check system clipboard first
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const clipboardText = await navigator.clipboard.readText();

      // If system clipboard matches our internal clipboard node,
      // prioritize internal clipboard to preserve node structure (colors, fonts, etc.)
      if (clipboardText && uiClipboard && systemClipboardMatchesNode(clipboardText, uiClipboard)) {
        const { pasteNodeTree } = await import('./pasteTree');
        const newId = pasteNodeTree(uiClipboard, parentId, addChildNode, updateNode);
        if (newId) {
          notify('success', `「${uiClipboard.text}」を貼り付けました`);
          selectNode(newId);
        }
        return;
      }

      // Check for MindMeister format
      const { isMindMeisterFormat, parseMindMeisterMarkdown } = await import('../../markdown');
      if (clipboardText && isMindMeisterFormat(clipboardText)) {
        const parsedNode = parseMindMeisterMarkdown(clipboardText);
        if (parsedNode) {
          const { pasteNodeTree } = await import('./pasteTree');
          const newId = pasteNodeTree(parsedNode, parentId, addChildNode, updateNode);
          if (newId) { notify('success', `「${parsedNode.text}」をMindMeisterから貼り付けました`); selectNode(newId); }
          return;
        }
      }

      // If we have plain text from system clipboard, create child nodes
      if (clipboardText && clipboardText.trim()) {
        const lines = clipboardText.split('\n')
          .map(line => {
            // Remove markdown heading prefix (e.g., "# text" -> "text")
            const trimmed = line.trim();
            const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
            return headingMatch ? headingMatch[1] : trimmed;
          })
          .filter(line => line.length > 0);

        if (lines.length > 0) {
          let lastCreatedId: string | undefined;

          // Create a child node for each line
          for (const line of lines) {
            const newId = addChildNode(parentId, line);
            if (newId) {
              lastCreatedId = newId;
            }
          }

          // Select the last created node and notify
          if (lastCreatedId) {
            selectNode(lastCreatedId);
            const message = lines.length === 1
              ? `テキスト「${lines[0]}」を貼り付けました`
              : `${lines.length}行のテキストを貼り付けました`;
            notify('success', message);
          }
          return;
        }
      }
    }
  } catch (error) {
    // Clipboard access might be denied or fail, try internal clipboard
  }

  // Fallback to internal clipboard (node copy/paste)
  const source = uiClipboard;
  if (!source) {
    notify('warning', 'クリップボードにデータがありません');
    return;
  }
  const { pasteNodeTree } = await import('./pasteTree');
  const newId = pasteNodeTree(source, parentId, addChildNode, updateNode);
  if (newId) { notify('success', `「${source.text}」を貼り付けました`); selectNode(newId); }
}

