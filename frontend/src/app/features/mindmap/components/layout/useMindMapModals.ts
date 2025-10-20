import { useState, useCallback } from 'react';
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

  // Link modal handlers
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

  // Image modal handlers
  const handleShowImageModal = useCallback((imageUrl: string, altText?: string) => {
    setCurrentImageUrl(imageUrl);
    setCurrentImageAlt(altText || '');
    setShowImageModal(true);
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setShowImageModal(false);
    setCurrentImageUrl(null);
    setCurrentImageAlt('');
  }, []);

  // Table editor handlers
  const handleEditTable = useCallback((nodeId: string) => {
    setEditingTableNodeId(nodeId);
    setShowTableEditor(true);
  }, []);

  const handleCloseTableEditor = useCallback(() => {
    setShowTableEditor(false);
    setEditingTableNodeId(null);
  }, []);

  // Auth modal handlers
  const handleAuthModalClose = useCallback(() => {
    setIsAuthModalOpen(false);
    setAuthCloudAdapter(null);
    setAuthOnSuccess(() => null);
  }, []);

  const handleAuthModalSuccess = useCallback((authenticatedAdapter: CloudStorageAdapter) => {
    if (authOnSuccess) {
      authOnSuccess(authenticatedAdapter);
    }
    handleAuthModalClose();
  }, [authOnSuccess, handleAuthModalClose]);

  return {
    ...state,
    // Link modal
    openLinkModal,
    closeLinkModal,
    openLinkActionMenu,
    closeLinkActionMenu,
    // Image modal
    showImageModal,
    currentImageUrl,
    currentImageAlt,
    handleShowImageModal,
    handleCloseImageModal,
    // Table editor
    showTableEditor,
    editingTableNodeId,
    handleEditTable,
    handleCloseTableEditor,
    // Auth modal
    isAuthModalOpen,
    authCloudAdapter,
    setAuthCloudAdapter,
    setAuthOnSuccess,
    setIsAuthModalOpen,
    handleAuthModalClose,
    handleAuthModalSuccess,
  };
}

