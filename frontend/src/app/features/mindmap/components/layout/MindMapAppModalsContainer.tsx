import React from 'react';
import MindMapModals from '../modals/MindMapModals';
import MindMapOverlays from './overlay/MindMapOverlays';
import { JumpyLabels } from "../../../vim";
import VimStatusBar from "../VimStatusBar";
const CommandPalette = React.lazy(() => import('@shared/components/CommandPalette'));
const AuthModal = React.lazy(() => import('@shared/components').then(m => ({ default: m.AuthModal })));
import MindMapLinkOverlays from './overlay/MindMapLinkOverlays';
import MindMapContextMenuOverlay from './overlay/MindMapContextMenuOverlay';
import ImageModal from '../modals/ImageModal';
const TableEditorModal = React.lazy(() => import('../../../markdown/components/TableEditorModal'));
// Lazy-load heavy knowledge-graph and embedding integration to avoid pulling ML runtime on boot
const KnowledgeGraphModal2D = React.lazy(() => import('../modals/KnowledgeGraphModal2D').then(m => ({ default: m.KnowledgeGraphModal2D })));
const EmbeddingIntegration = React.lazy(() => import('@core/services/EmbeddingIntegration').then(m => ({ default: m.EmbeddingIntegration })));
import { useMindMapStore } from '../../store';
import type { MindMapNode, NodeLink, MapIdentifier, MindMapData } from '@shared/types';
import type { VimContextType } from '../../../vim/context/vimContext';
import type { CloudStorageAdapter } from '@core/storage/adapters/CloudStorageAdapter';

interface MindMapAppModalsContainerProps {
  // Modals state
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (show: boolean) => void;
  showLinkModal: boolean;
  linkModalNodeId: string | null;
  editingLink: NodeLink | null;
  showLinkActionMenu: boolean;
  linkActionMenuData: any;
  showImageModal: boolean;
  currentImageUrl: string | null;
  currentImageAlt: string;
  showTableEditor: boolean;
  editingTableNodeId: string | null;
  isAuthModalOpen: boolean;
  authCloudAdapter: any;
  showKnowledgeGraph: boolean;

  // Command palette
  commandPaletteIsOpen: boolean;
  commandPaletteClose: () => void;

  // Data
  data: any;
  allMindMaps: MindMapData[];
  ui: any;
  selectedNodeId: string | null;
  explorerTree: any;
  vim: VimContextType;
  commands: any;

  // Handlers
  onCloseKeyboardHelper: () => void;
  onCloseLinkModal: () => void;
  onSaveLink: (linkData: Partial<NodeLink>) => Promise<void>;
  onDeleteLink: (linkId: string) => Promise<void>;
  onLoadMapData: any;
  onCloseLinkActionMenu: () => void;
  onNavigate: (link: NodeLink) => Promise<void>;
  onCloseContextMenu: () => void;
  onDeleteNode: (nodeId: string) => void;
  onAddLink: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => void;
  onPasteNode: (parentId: string) => Promise<void>;
  onEditTable: (nodeId: string) => void;
  onConvertToMap: (nodeId: string) => Promise<void>;
  onMarkdownNodeType: (nodeId: string, newType: 'heading' | 'unordered-list' | 'ordered-list') => void;
  onCloseImageModal: () => void;
  onShowImageModal: (file: any) => void;
  onExecuteCommand: (command: string) => Promise<void>;
  onSelectMap: (mapId: MapIdentifier) => Promise<unknown>;
  onCloseTableEditor: () => void;
  onTableEditorSave: (markdown: string) => void;
  onAuthModalClose: () => void;
  onAuthModalSuccess: (authenticatedAdapter: CloudStorageAdapter) => void;
  onCloseKnowledgeGraph: () => void;

  // Node operations
  nodeOperations: {
    findNode: (nodeId: string) => MindMapNode | null;
    onDeleteNode: (nodeId: string) => void;
    onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
    onCopyNode: (node: MindMapNode) => void;
    onPasteNode: (parentId: string) => Promise<void>;
    onAddChild: (parentId: string, text?: string) => string | undefined;
  };

  // Storage & Mind Map
  storageAdapter: any;
  mindMap: any;
}

export const MindMapAppModalsContainer: React.FC<MindMapAppModalsContainerProps> = ({
  showKeyboardHelper,
  setShowKeyboardHelper,
  showLinkModal,
  linkModalNodeId,
  editingLink,
  showLinkActionMenu,
  linkActionMenuData,
  showImageModal,
  currentImageUrl,
  currentImageAlt,
  showTableEditor,
  editingTableNodeId,
  isAuthModalOpen,
  authCloudAdapter,
  showKnowledgeGraph,
  commandPaletteIsOpen,
  commandPaletteClose,
  data,
  allMindMaps,
  ui,
  selectedNodeId,
  explorerTree,
  vim,
  commands,
  onCloseLinkModal,
  onSaveLink,
  onDeleteLink,
  onLoadMapData,
  onCloseLinkActionMenu,
  onNavigate,
  onCloseContextMenu,
  onDeleteNode,
  onAddLink,
  onCopyNode,
  onPasteNode,
  onEditTable,
  onConvertToMap,
  onMarkdownNodeType,
  onCloseImageModal,
  onShowImageModal,
  onExecuteCommand,
  onSelectMap,
  onCloseTableEditor,
  onTableEditorSave,
  onAuthModalClose,
  onAuthModalSuccess,
  onCloseKnowledgeGraph,
  nodeOperations,
  storageAdapter,
  mindMap,
}) => {
  const enableKnowledgeGraph = useMindMapStore().settings?.knowledgeGraph?.enabled ?? false;
  const findNode = React.useCallback((nodeId: string) => {
    if (!data?.rootNodes) return null;
    const findInNodes = (nodes: MindMapNode[]): MindMapNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) return node;
        if (node.children) {
          const found = findInNodes(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findInNodes(data.rootNodes);
  }, [data?.rootNodes]);

  return (
    <>
      <MindMapModals
        ui={ui}
        selectedNodeId={selectedNodeId}
        nodeOperations={nodeOperations}
        uiOperations={{
          onCloseContextMenu,
          onCloseImageModal,
          onCloseFileActionMenu: onCloseContextMenu,
          onShowImageModal
        }}
      />

      <MindMapOverlays
        showKeyboardHelper={showKeyboardHelper}
        setShowKeyboardHelper={setShowKeyboardHelper}
      />

      <JumpyLabels vim={vim} />
      <VimStatusBar vim={vim} />

      <MindMapLinkOverlays
        allMaps={allMindMaps.map((map) => ({
          mapIdentifier: map.mapIdentifier,
          title: map.title,
        }))}
        currentMapData={data}
        showLinkModal={showLinkModal}
        linkModalNodeId={linkModalNodeId}
        editingLink={editingLink}
        onCloseLinkModal={onCloseLinkModal}
        onSaveLink={onSaveLink}
        onDeleteLink={onDeleteLink}
        onLoadMapData={onLoadMapData}
        loadExplorerTree={async () => explorerTree}
        showLinkActionMenu={showLinkActionMenu}
        linkActionMenuData={linkActionMenuData}
        onCloseLinkActionMenu={onCloseLinkActionMenu}
        onNavigate={onNavigate}
      />

      <MindMapContextMenuOverlay
        dataRoot={data?.rootNodes?.[0] || null}
        dataRoots={data?.rootNodes || []}
        onDelete={onDeleteNode}
        onAddLink={onAddLink}
        onCopyNode={onCopyNode}
        onPasteNode={onPasteNode}
        onEditTable={onEditTable}
        onConvertToMap={onConvertToMap}
        commandRegistry={commands.registry}
        commandContext={commands.context}
        onMarkdownNodeType={onMarkdownNodeType}
        onAIGenerate={undefined}
        onClose={onCloseContextMenu}
      />

      <ImageModal
        isOpen={showImageModal}
        imageUrl={currentImageUrl}
        altText={currentImageAlt}
        onClose={onCloseImageModal}
      />

      {commandPaletteIsOpen && (
        <React.Suspense fallback={null}>
          <CommandPalette
            isOpen={commandPaletteIsOpen}
            onClose={commandPaletteClose}
            onExecuteCommand={onExecuteCommand}
            onSelectMap={onSelectMap}
            storageAdapter={storageAdapter}
          />
        </React.Suspense>
      )}

      {isAuthModalOpen && authCloudAdapter && (
        <React.Suspense fallback={null}>
          <AuthModal
            isOpen={isAuthModalOpen}
            cloudAdapter={authCloudAdapter}
            onClose={onAuthModalClose}
            onSuccess={onAuthModalSuccess}
          />
        </React.Suspense>
      )}

      {showTableEditor && (
        <React.Suspense fallback={null}>
          <TableEditorModal
            isOpen={showTableEditor}
            onClose={onCloseTableEditor}
            onSave={onTableEditorSave}
            initialMarkdown={
              editingTableNodeId
                ? (findNode(editingTableNodeId)?.text || '')
                : ''
            }
          />
        </React.Suspense>
      )}

      {showKnowledgeGraph && (
        <React.Suspense fallback={null}>
          <KnowledgeGraphModal2D
            isOpen={showKnowledgeGraph}
            onClose={onCloseKnowledgeGraph}
            mapIdentifier={data?.mapIdentifier || null}
            getMapMarkdown={mindMap.getMapMarkdown}
            getWorkspaceMapIdentifiers={mindMap?.getWorkspaceMapIdentifiers}
          />
        </React.Suspense>
      )}

      {enableKnowledgeGraph && (
        <React.Suspense fallback={null}>
          <EmbeddingIntegration />
        </React.Suspense>
      )}
    </>
  );
};
