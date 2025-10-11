import { useModalState } from '@shared/hooks';
import type { NodeLink } from '@shared/types';

export function useMindMapModals() {
  const state = useModalState();

  const openLinkModal = (nodeId: string, editingLink?: NodeLink | null) => {
    state.setLinkModalNodeId(nodeId);
    if (editingLink) state.setEditingLink(editingLink);
    state.setShowLinkModal(true);
  };

  const closeLinkModal = () => {
    state.setShowLinkModal(false);
    state.setEditingLink(null);
    state.setLinkModalNodeId(null);
  };

  const openLinkActionMenu = (link: NodeLink, position: { x: number; y: number }) => {
    state.setLinkActionMenuData({ link, position });
    state.setShowLinkActionMenu(true);
  };

  const closeLinkActionMenu = () => {
    state.setShowLinkActionMenu(false);
    state.setLinkActionMenuData(null);
  };

  return { ...state, openLinkModal, closeLinkModal, openLinkActionMenu, closeLinkActionMenu };
}

