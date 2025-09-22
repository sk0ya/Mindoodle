import type { MindMapNode } from '@shared/types';

export async function pasteFromClipboard(
  parentId: string,
  uiClipboard: MindMapNode | null | undefined,
  addChildNode: (parentId: string, text: string) => string | undefined,
  updateNode: (id: string, updates: Partial<MindMapNode>) => void,
  selectNode: (id: string) => void,
  notify: (type: 'success'|'error'|'info'|'warning', message: string) => void
): Promise<void> {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const clipboardText = await navigator.clipboard.readText();
      const { isMindMeisterFormat, parseMindMeisterMarkdown } = await import('@shared/utils');
      if (clipboardText && isMindMeisterFormat(clipboardText)) {
        const parsedNode = parseMindMeisterMarkdown(clipboardText);
        if (parsedNode) {
          const { pasteNodeTree } = await import('./pasteTree');
          const newId = pasteNodeTree(parsedNode, parentId, addChildNode, updateNode);
          if (newId) { notify('success', `「${parsedNode.text}」をMindMeisterから貼り付けました`); selectNode(newId); }
          return;
        }
      }
    }
  } catch {}

  const source = uiClipboard;
  if (!source) { notify('warning', 'コピーされたノードがありません'); return; }
  const { pasteNodeTree } = await import('./pasteTree');
  const newId = pasteNodeTree(source, parentId, addChildNode, updateNode);
  if (newId) { notify('success', `「${source.text}」を貼り付けました`); selectNode(newId); }
}

