import type { MindMapNode, MapIdentifier } from '@shared/types';

const slugify = (text: string) => (text || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');

function findNodeByTextLoose(root: MindMapNode, targetText: string): MindMapNode | null {
  if (!root || !targetText) return null;
  const targetSlug = slugify(targetText);
  const stack: MindMapNode[] = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (!node) continue;
    if (node.text === targetText) return node;
    if (slugify(node.text) === targetSlug) return node;
    if (node.children?.length) stack.push(...node.children);
  }
  return null;
}

interface Ctx {
  currentMapId: string | null | undefined;
  dataRoot: MindMapNode | null | undefined;
  selectMapById: (id: MapIdentifier) => Promise<boolean> | boolean;
  currentWorkspaceId: string | null | undefined;
  selectNode: (id: string) => void;
  centerNodeInView: (id: string, animate?: boolean) => void;
  notify: (type: 'success'|'error'|'info'|'warning', message: string) => void;
  getCurrentRootNode: () => MindMapNode | null | undefined;
  resolveAnchorToNode?: (root: MindMapNode, anchor: string) => MindMapNode | null;
}

export interface NodeLink { targetMapId?: string; targetNodeId?: string; }

export async function navigateLink(link: NodeLink, ctx: Ctx) {
  const { currentMapId, dataRoot, selectMapById, selectNode, centerNodeInView, notify, getCurrentRootNode } = ctx;
  try {
    if (link.targetMapId && link.targetMapId !== currentMapId) {
      const wsid = ctx.currentWorkspaceId as string;
      const ok = await selectMapById({ mapId: link.targetMapId, workspaceId: wsid });
      if (!ok) { notify('error', `マップ "${link.targetMapId}" が見つかりません`); return; }
      notify('success', `マップ "${link.targetMapId}" に移動しました`);
      if (link.targetNodeId) {
        setTimeout(() => {
          const root = getCurrentRootNode();
          if (!root) return;
          const tn = link.targetNodeId!;
          if (tn.startsWith('text:')) {
            const targetText = tn.slice(5);
            const node = findNodeByTextLoose(root, targetText);
            if (node) { selectNode(node.id); setTimeout(() => centerNodeInView(node.id), 100); }
          } else {
            selectNode(tn); setTimeout(() => centerNodeInView(tn), 100);
          }
        }, 500);
      }
      return;
    }

    if (link.targetNodeId && dataRoot) {
      const tn = link.targetNodeId;
      if (tn.startsWith('text:')) {
        const targetText = tn.slice(5);
        const node = findNodeByTextLoose(dataRoot, targetText);
        if (node) {
          selectNode(node.id); setTimeout(() => centerNodeInView(node.id), 50);
          notify('success', `ノード "${node.text}" に移動しました`);
        } else {
          notify('error', `ノード "${targetText}" が見つかりません`);
        }
      } else {
        selectNode(tn); setTimeout(() => centerNodeInView(tn), 50);
        notify('success', `ノードに移動しました`);
      }
      return;
    }

    notify('info', 'リンク先が指定されていません');
  } catch (error) {
    notify('error', 'リンクの処理に失敗しました');
  }
}
