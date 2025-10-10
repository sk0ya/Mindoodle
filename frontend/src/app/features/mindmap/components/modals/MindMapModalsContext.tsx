

import React, { createContext, useContext, ReactNode } from 'react';
import type { MindMapNode} from '../../../../shared';


export interface MindMapUIState {
  showContextMenu: boolean;
  showImageModal: boolean;
  showFileActionMenu: boolean;
  contextMenuPosition: { x: number; y: number };
  fileMenuPosition: { x: number; y: number };
  clipboard: MindMapNode | null;
}


export interface NodeOperations {
  findNode: (nodeId: string) => MindMapNode | null;
  onDeleteNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onCopyNode: (node: MindMapNode) => void;
  onPasteNode: (parentId: string) => void;
  onAddChild: (parentId: string, text?: string) => string | undefined; 
}


export interface UIOperations {
  onCloseContextMenu: () => void;
  onCloseImageModal: () => void;
  onCloseFileActionMenu: () => void;
  onShowImageModal: (imageUrl: string, altText?: string) => void;
}


export interface MindMapModalsContextValue {
  ui: MindMapUIState;
  selectedNodeId: string | null;
  nodeOperations: NodeOperations;
  uiOperations: UIOperations;
}


const MindMapModalsContext = createContext<MindMapModalsContextValue | null>(null);


export interface MindMapModalsProviderProps {
  children: ReactNode;
  ui: MindMapUIState;
  selectedNodeId: string | null;
  nodeOperations: NodeOperations;
  uiOperations: UIOperations;
}


export const MindMapModalsProvider: React.FC<MindMapModalsProviderProps> = ({
  children,
  ui,
  selectedNodeId,
  nodeOperations,
  uiOperations
}) => {
  const contextValue: MindMapModalsContextValue = {
    ui,
    selectedNodeId,
    nodeOperations,
    uiOperations
  };

  return (
    <MindMapModalsContext.Provider value={contextValue}>
      {children}
    </MindMapModalsContext.Provider>
  );
};


export const useMindMapModals = (): MindMapModalsContextValue => {
  const context = useContext(MindMapModalsContext);
  if (!context) {
    throw new Error('useMindMapModals must be used within a MindMapModalsProvider');
  }
  return context;
};


export const useNodeOperations = (): NodeOperations => {
  const { nodeOperations } = useMindMapModals();
  return nodeOperations;
};

export const useUIOperations = (): UIOperations => {
  const { uiOperations } = useMindMapModals();
  return uiOperations;
};

export const useMindMapUI = (): MindMapUIState => {
  const { ui } = useMindMapModals();
  return ui;
};

export const useSelectedNode = (): MindMapNode | null => {
  const { selectedNodeId, nodeOperations } = useMindMapModals();
  return selectedNodeId ? nodeOperations.findNode(selectedNodeId) : null;
};