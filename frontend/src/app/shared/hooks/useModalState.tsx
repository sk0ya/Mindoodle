import { useState } from 'react';
import type { NodeLink } from '@shared/types';
import { useModal } from './useModal';
import { useBooleanState } from './useBooleanState';

interface UseModalStateReturn {
  // Export/Import modals
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;
  
  // Login modal (削除済み)
  
  // Link modal states
  showLinkModal: boolean;
  setShowLinkModal: (show: boolean) => void;
  editingLink: NodeLink | null;
  setEditingLink: (link: NodeLink | null) => void;
  linkModalNodeId: string | null;
  setLinkModalNodeId: (nodeId: string | null) => void;
  
  // Link action menu states
  showLinkActionMenu: boolean;
  setShowLinkActionMenu: (show: boolean) => void;
  linkActionMenuData: {
    link: NodeLink;
    position: { x: number; y: number };
  } | null;
  setLinkActionMenuData: (data: { link: NodeLink; position: { x: number; y: number }; } | null) => void;
  
  // Context menu state
  contextMenu: {
    visible: boolean;
    position: { x: number; y: number };
    nodeId: string | null;
  };
  setContextMenu: (menu: {
    visible: boolean;
    position: { x: number; y: number };
    nodeId: string | null;
  }) => void;
}

export const useModalState = (): UseModalStateReturn => {
  // Using new useModal hook for simple modals
  const exportModal = useModal();
  const importModal = useModal();
  // loginModalは削除されました

  // Link-related states (keeping complex state as-is for now)
  const [editingLink, setEditingLink] = useState<NodeLink | null>(null);
  const [linkModalNodeId, setLinkModalNodeId] = useState<string | null>(null);
  const linkActionMenu = useBooleanState();
  const [linkActionMenuData, setLinkActionMenuData] = useState<{
    link: NodeLink;
    position: { x: number; y: number };
  } | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    nodeId: string | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    nodeId: null
  });

  return {
    // Simple modals using new hook pattern
    showExportModal: exportModal.isOpen,
    setShowExportModal: (show: boolean) => show ? exportModal.open() : exportModal.close(),
    showImportModal: importModal.isOpen,
    setShowImportModal: (show: boolean) => show ? importModal.open() : importModal.close(),
    // showLoginModal削除済み
    
    // Complex modals (keeping existing pattern)
    showLinkModal: editingLink !== null || linkModalNodeId !== null,
    setShowLinkModal: (show: boolean) => {
      if (!show) {
        setEditingLink(null);
        setLinkModalNodeId(null);
      }
    },
    editingLink,
    setEditingLink,
    linkModalNodeId,
    setLinkModalNodeId,
    showLinkActionMenu: linkActionMenu.value,
    setShowLinkActionMenu: linkActionMenu.setValue,
    linkActionMenuData,
    setLinkActionMenuData,
    contextMenu,
    setContextMenu
  };
};