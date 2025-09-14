import type { MindMapNode } from '@shared/types';

export function pasteNodeTree(
  source: MindMapNode,
  parentId: string,
  addChild: (parentId: string, text: string) => string | undefined,
  updateNode: (id: string, updates: Partial<MindMapNode>) => void
): string | undefined {
  const newId = addChild(parentId, source.text);
  if (!newId) return undefined;
  updateNode(newId, {
    fontSize: source.fontSize,
    fontWeight: source.fontWeight,
    color: source.color,
    collapsed: false,
    attachments: source.attachments || [],
    note: source.note,
  });
  source.children?.forEach((child) => pasteNodeTree(child, newId, addChild, updateNode));
  return newId;
}

