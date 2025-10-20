import type { MindMapNode } from '@shared/types';
import { generateObjectHash } from '@shared/utils';
import { getLastCopiedHash } from '../services/NodeClipboardService';

function nodeToMarkdown(node: MindMapNode, level = 0): string {
  const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
  let md = `${prefix}${node.text}\n`;
  if (node.note != null) md += `${node.note}\n`;
  if (node.children?.length) {
    node.children.forEach(child => {
      md += nodeToMarkdown(child, level + 1);
    });
  }
  return md;
}

async function systemClipboardMatchesNode(node: MindMapNode): Promise<boolean> {
  try {
    // Check if web-side clipboard hash matches the node
    const lastHash = getLastCopiedHash();
    if (lastHash) {
      const nodeHash = generateObjectHash(node);
      if (lastHash === nodeHash) {
        return true;
      }
    }

    // Fallback: compare clipboard text content
    if (navigator.clipboard && navigator.clipboard.readText) {
      const clipboardText = await navigator.clipboard.readText();
      const expectedMarkdown = nodeToMarkdown(node);
      const normalizedClipboard = clipboardText.replace(/\r\n/g, '\n').trim();
      const normalizedExpected = expectedMarkdown.trim();
      return normalizedClipboard === normalizedExpected;
    }
  } catch (error) {
    console.warn('Failed to read clipboard, falling back to text comparison', error);
  }

  return false;
}

export async function pasteFromClipboard(
  parentId: string,
  uiClipboard: MindMapNode | null | undefined,
  addChildNode: (parentId: string, text: string) => string | undefined,
  updateNode: (id: string, updates: Partial<MindMapNode>) => void,
  selectNode: (id: string) => void,
  notify: (type: 'success'|'error'|'info'|'warning', message: string) => void
): Promise<void> {

  try {
    // Check if system clipboard matches UI clipboard using hash
    if (uiClipboard && await systemClipboardMatchesNode(uiClipboard)) {
      const { pasteNodeTree } = await import('./pasteTree');
      const newId = pasteNodeTree(uiClipboard, parentId, addChildNode, updateNode);
      if (newId) {
        notify('success', `「${uiClipboard.text}」を貼り付けました`);
        selectNode(newId);
      }
      return;
    }

    // Continue with text-based clipboard processing
    if (navigator.clipboard && navigator.clipboard.readText) {
      const clipboardText = await navigator.clipboard.readText();


      const { isMindMeisterFormat, parseMindMeisterMarkdown } = await import('../../markdown/mindMeisterParser');
      if (clipboardText && isMindMeisterFormat(clipboardText)) {
        const parsedNode = parseMindMeisterMarkdown(clipboardText);
        if (parsedNode) {
          const { pasteNodeTree } = await import('./pasteTree');
          const newId = pasteNodeTree(parsedNode, parentId, addChildNode, updateNode);
          if (newId) { notify('success', `「${parsedNode.text}」をMindMeisterから貼り付けました`); selectNode(newId); }
          return;
        }
      }

      
      if (clipboardText && clipboardText.trim()) {
        const lines = clipboardText.split('\n')
          .map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
              let i = 0;
              while (i < trimmed.length && i < 6 && trimmed.charAt(i) === '#') i++;
              if (i > 0 && trimmed.charAt(i) === ' ') {
                return trimmed.slice(i + 1);
              }
            }
            return trimmed;
          })
          .filter(line => line.length > 0);

        if (lines.length > 0) {
          let lastCreatedId: string | undefined;

          
          for (const line of lines) {
            const newId = addChildNode(parentId, line);
            if (newId) {
              lastCreatedId = newId;
            }
          }

          
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
    console.warn('Failed to read clipboard or paste content', error);
    notify('error', 'クリップボードの読み取りに失敗しました');
  }

  
  const source = uiClipboard;
  if (!source) {
    notify('warning', 'クリップボードにデータがありません');
    return;
  }
  const { pasteNodeTree } = await import('./pasteTree');
  const newId = pasteNodeTree(source, parentId, addChildNode, updateNode);
  if (newId) { notify('success', `「${source.text}」を貼り付けました`); selectNode(newId); }
}
