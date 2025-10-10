import { useState } from 'react';
import type { NodeLink } from '@shared/types';
import { useModal } from './useModal';
import { useBooleanState } from './useBooleanState';

interface UseModalStateReturn {
  
  showExportModal: boolean;
  setShowExportModal: (show: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (show: boolean) => void;
  
  
  
  
  showLinkModal: boolean;
  setShowLinkModal: (show: boolean) => void;
  editingLink: NodeLink | null;
  setEditingLink: (link: NodeLink | null) => void;
  linkModalNodeId: string | null;
  setLinkModalNodeId: (nodeId: string | null) => void;
  
  
  showLinkActionMenu: boolean;
  setShowLinkActionMenu: (show: boolean) => void;
  linkActionMenuData: {
    link: NodeLink;
    position: { x: number; y: number };
  } | null;
  setLinkActionMenuData: (data: { link: NodeLink; position: { x: number; y: number }; } | null) => void;
  
}

export const useModalState = (): UseModalStateReturn => {
  
  const exportModal = useModal();
  const importModal = useModal();
  

  
  const [editingLink, setEditingLink] = useState<NodeLink | null>(null);
  const [linkModalNodeId, setLinkModalNodeId] = useState<string | null>(null);
  const linkActionMenu = useBooleanState();
  const [linkActionMenuData, setLinkActionMenuData] = useState<{
    link: NodeLink;
    position: { x: number; y: number };
  } | null>(null);
  
  return {
    
    showExportModal: exportModal.isOpen,
    setShowExportModal: (show: boolean) => show ? exportModal.open() : exportModal.close(),
    showImportModal: importModal.isOpen,
    setShowImportModal: (show: boolean) => show ? importModal.open() : importModal.close(),
    
    
    
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
  };
};
