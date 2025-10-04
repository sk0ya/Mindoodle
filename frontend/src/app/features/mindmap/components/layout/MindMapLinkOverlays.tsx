import React from 'react';
import NodeLinkModal from '../modals/NodeLinkModal';
import LinkActionMenu from '../modals/LinkActionMenu';
import type { NodeLink, MapIdentifier } from '@shared/types';
import type { ExplorerItem } from '@core/types';

type Props = {
  // data
  allMaps: Array<{ mapIdentifier: { mapId: string; workspaceId: string }; title: string }>;
  currentMapData: any;

  // modal state
  showLinkModal: boolean;
  linkModalNodeId: string | null;
  editingLink: NodeLink | null;
  onCloseLinkModal: () => void;
  onSaveLink: (linkData: Partial<NodeLink>) => Promise<void> | void;
  onDeleteLink: (linkId: string) => Promise<void> | void;
  onLoadMapData: (mapIdentifier: MapIdentifier) => Promise<any>;
  // explorer tree provider
  loadExplorerTree?: () => Promise<ExplorerItem | null>;

  // action menu state
  showLinkActionMenu: boolean;
  linkActionMenuData: { link: NodeLink; position: { x: number; y: number } } | null;
  onCloseLinkActionMenu: () => void;
  onNavigate: (link: NodeLink) => void | Promise<void>;
  onEditLink: (link: NodeLink, nodeId: string) => void;
  onDeleteLinkFromMenu: (linkId: string) => void | Promise<void>;
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
  onEditLink,
  onDeleteLinkFromMenu,
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
          currentMapData={currentMapData}
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
          onEdit={(link) => {
            if (linkModalNodeId) onEditLink(link, linkModalNodeId);
            onCloseLinkActionMenu();
          }}
          onDelete={(linkId) => {
            onDeleteLinkFromMenu(linkId);
            onCloseLinkActionMenu();
          }}
          availableMaps={allMaps}
          currentMapData={currentMapData}
        />
      )}
    </>
  );
};

export default MindMapLinkOverlays;
