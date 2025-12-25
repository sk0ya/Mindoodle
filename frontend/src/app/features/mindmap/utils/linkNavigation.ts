import type { MindMapNode, MapIdentifier, NodeLink } from '@shared/types';
import { logger } from '@shared/utils';

const slugify = (text: string) => (text || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

function findNodeByTextLoose(root: MindMapNode, targetText: string): MindMapNode | null {
  if (!root || !targetText) return null;
  const targetSlug = slugify(targetText);
  const stack: MindMapNode[] = [root];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (node.text === targetText) return node;
    if (slugify(node.text) === targetSlug) return node;
    if (node.children?.length) stack.push(...node.children);
  }
  return null;
}

function findNodeByTextInMultipleRoots(roots: MindMapNode[], targetText: string): MindMapNode | null {
  if (!roots || !targetText) return null;
  for (const root of roots) {
    const found = findNodeByTextLoose(root, targetText);
    if (found) return found;
  }
  return null;
}

interface Ctx {
  currentMapId: string | null | undefined;
  dataRoot: MindMapNode | null | undefined;
  selectMapById: (id: MapIdentifier) => Promise<boolean> | boolean;
  currentWorkspaceId: string | null | undefined;
  selectNode: (id: string) => void;
  notify: (type: 'success'|'error'|'info'|'warning', message: string) => void;
  getCurrentRootNode: () => MindMapNode | null | undefined;
  getAllRootNodes?: () => MindMapNode[] | null | undefined;
  resolveAnchorToNode?: (root: MindMapNode, anchor: string) => MindMapNode | null;
}



export async function navigateLink(link: NodeLink, ctx: Ctx) {
  const { currentMapId, dataRoot, selectMapById, selectNode, notify, getCurrentRootNode } = ctx;
  try {
    if (link.targetMapId && link.targetMapId !== currentMapId) {
      const wsid = ctx.currentWorkspaceId as string;
      const ok = await selectMapById({ mapId: link.targetMapId, workspaceId: wsid });
      if (!ok) { notify('error', `マップ "${link.targetMapId}" が見つかりません`); return; }
      notify('success', `マップ "${link.targetMapId}" に移動しました`);
      if (link.targetNodeId) {
        
        const allRoots = ctx.getAllRootNodes?.() || [];
        const singleRoot = getCurrentRootNode();
        let roots: MindMapNode[] = [];
        if (allRoots.length > 0) {
          roots = allRoots;
        } else if (singleRoot) {
          roots = [singleRoot];
        }

        if (roots.length === 0) { return; }

        const tn = link.targetNodeId;
        if (tn.startsWith('text:')) {
          const targetText = tn.slice(5);
          const node = findNodeByTextInMultipleRoots(roots, targetText);
          if (node) {
            selectNode(node.id);
            // Auto-scroll handled by useAutoScrollToSelectedNode hook
          }
        } else {
          selectNode(tn);
          // Auto-scroll handled by useAutoScrollToSelectedNode hook
        }
      }
      return;
    }

    if (link.targetNodeId) {
      const tn = link.targetNodeId;
      if (tn.startsWith('text:')) {
        const targetText = tn.slice(5);
        
        const allRoots = ctx.getAllRootNodes?.() || [];
        const singleRoot = dataRoot || getCurrentRootNode() || null;
        let roots: MindMapNode[] = [];
        if (allRoots.length > 0) {
          roots = allRoots;
        } else if (singleRoot) {
          roots = [singleRoot];
        }
        if (roots.length > 0) {
          const node = findNodeByTextInMultipleRoots(roots, targetText);
          if (node) {
            selectNode(node.id);
            // Auto-scroll handled by useAutoScrollToSelectedNode hook
            notify('success', `ノード "${node.text}" に移動しました`);
            return;
          }
        }
        notify('error', `ノード "${targetText}" が見つかりません`);
        return;
      } else {
        selectNode(tn);
        // Auto-scroll handled by useAutoScrollToSelectedNode hook
        notify('success', `ノードに移動しました`);
        return;
      }
    }

    notify('info', 'リンク先が指定されていません');
  } catch (error) {
    logger.warn('linkNavigation: navigateLink failed', error);
    notify('error', 'リンクの処理に失敗しました');
  }
}
