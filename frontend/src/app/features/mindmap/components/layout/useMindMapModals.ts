import { useState } from 'react';
import { useModalState } from '@shared/hooks';
import type { NodeLink } from '@shared/types';
import { CloudStorageAdapter } from '@core/storage/adapters';

export function useMindMapModals() {
  const state = useModalState();

  // Image modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [currentImageAlt, setCurrentImageAlt] = useState('');

  // Table editor modal state
  const [showTableEditor, setShowTableEditor] = useState(false);
  const [editingTableNodeId, setEditingTableNodeId] = useState<string | null>(null);

  // Auth modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authCloudAdapter, setAuthCloudAdapter] = useState<CloudStorageAdapter | null>(null);
  const [authOnSuccess, setAuthOnSuccess] = useState<((adapter: CloudStorageAdapter) => void) | null>(null);

  return {
    ...state,
    // Link modal - direct functions from state
    openLinkModal: (nodeId: string, editingLink?: NodeLink | null) => {
      state.setLinkModalNodeId(nodeId);
      if (editingLink) state.setEditingLink(editingLink);
      state.setShowLinkModal(true);
    },
    closeLinkModal: () => {
      state.setShowLinkModal(false);
      state.setEditingLink(null);
      state.setLinkModalNodeId(null);
    },
    openLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => {
      state.setLinkActionMenuData({ link, position });
      state.setShowLinkActionMenu(true);
    },
    closeLinkActionMenu: () => {
      state.setShowLinkActionMenu(false);
      state.setLinkActionMenuData(null);
    },
    // Image modal
    showImageModal,
    currentImageUrl,
    currentImageAlt,
    handleShowImageModal: (imageUrl: string, altText?: string) => {
      setCurrentImageUrl(imageUrl);
      setCurrentImageAlt(altText || '');
      setShowImageModal(true);
    },
    handleCloseImageModal: () => {
      setShowImageModal(false);
      setCurrentImageUrl(null);
      setCurrentImageAlt('');
    },
    // Table editor
    showTableEditor,
    editingTableNodeId,
    handleEditTable: (nodeId: string) => {
      setEditingTableNodeId(nodeId);
      setShowTableEditor(true);
    },
    handleCloseTableEditor: () => {
      setShowTableEditor(false);
      setEditingTableNodeId(null);
    },
    // Auth modal
    isAuthModalOpen,
    authCloudAdapter,
    setAuthCloudAdapter,
    setAuthOnSuccess,
    setIsAuthModalOpen,
    handleAuthModalClose: () => {
      setIsAuthModalOpen(false);
      setAuthCloudAdapter(null);
      setAuthOnSuccess(() => null);
    },
    handleAuthModalSuccess: (authenticatedAdapter: CloudStorageAdapter) => {
      if (authOnSuccess) authOnSuccess(authenticatedAdapter);
      setIsAuthModalOpen(false);
      setAuthCloudAdapter(null);
      setAuthOnSuccess(() => null);
    },
  };
}
