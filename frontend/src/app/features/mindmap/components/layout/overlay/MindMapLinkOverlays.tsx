
import React from 'react';
import NodeLinkModal from '../../modals/NodeLinkModal';
import LinkActionMenu from '../../modals/LinkActionMenu';
import type { NodeLink, MapIdentifier, MindMapData } from '@shared/types';
import type { ExplorerItem } from '@core/types';

type Props = {

  allMaps: Array<{ mapIdentifier: { mapId: string; workspaceId: string }; title: string }>;
  currentMapData: MindMapData | null;


  showLinkModal: boolean;
  linkModalNodeId: string | null;
  editingLink: NodeLink | null;
  onCloseLinkModal: () => void;
  onSaveLink: (linkData: Partial<NodeLink>) => Promise<void> | void;
  onDeleteLink: (linkId: string) => Promise<void> | void;
  onLoadMapData: (mapIdentifier: MapIdentifier) => Promise<MindMapData | null>;
  
  loadExplorerTree?: () => Promise<ExplorerItem | null>;

  
  showLinkActionMenu: boolean;
  linkActionMenuData: { link: NodeLink; position: { x: number; y: number } } | null;
  onCloseLinkActionMenu: () => void;
  onNavigate: (link: NodeLink) => void | Promise<void>;
};

const MindMapLinkOverlays: React.FC<Props> = ({
  allMaps,
  currentMapData,
  showLinkModal,
  linkModalNodeId,
  editingLink,
  onCloseLinkModal,
  onSaveLink,
  onDeleteLink,
  onLoadMapData,
  loadExplorerTree,
  showLinkActionMenu,
  linkActionMenuData,
  onCloseLinkActionMenu,
  onNavigate,
}) => {
  return (
    <>
      {showLinkModal && linkModalNodeId && (
        <NodeLinkModal
          isOpen={showLinkModal}
          onClose={onCloseLinkModal}
          link={editingLink}
          onSave={onSaveLink}
          onDelete={onDeleteLink}
          availableMaps={allMaps}
          currentMapData={currentMapData ?? undefined}
          onLoadMapData={onLoadMapData}
          loadExplorerTree={loadExplorerTree}
          currentNodeId={linkModalNodeId}
        />
      )}

      {showLinkActionMenu && linkActionMenuData && (
        <LinkActionMenu
          isOpen={showLinkActionMenu}
          position={linkActionMenuData.position}
          link={linkActionMenuData.link}
          onClose={onCloseLinkActionMenu}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
};

export default MindMapLinkOverlays;
