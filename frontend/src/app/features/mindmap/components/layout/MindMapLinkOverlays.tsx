import React from 'react';
import NodeLinkModal from '../modals/NodeLinkModal';
import LinkActionMenu from '../modals/LinkActionMenu';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import type { MindMapNode, NodeLink, MapIdentifier } from '@shared/types';

type Props = {
  // data
  dataRoot: MindMapNode;
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
  onSaveFileLink: (filePath: string, label: string) => void;

  // action menu state
  showLinkActionMenu: boolean;
  linkActionMenuData: { link: NodeLink; position: { x: number; y: number } } | null;
  onCloseLinkActionMenu: () => void;
  onNavigate: (link: NodeLink) => void | Promise<void>;
  onEditLink: (link: NodeLink, nodeId: string) => void;
  onDeleteLinkFromMenu: (linkId: string) => void | Promise<void>;
};

const MindMapLinkOverlays: React.FC<Props> = ({
  dataRoot,
  allMaps,
  currentMapData,
  showLinkModal,
  linkModalNodeId,
  editingLink,
  onCloseLinkModal,
  onSaveLink,
  onDeleteLink,
  onLoadMapData,
  onSaveFileLink,
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
          node={findNodeById(dataRoot, linkModalNodeId)!}
          link={editingLink}
          onSave={onSaveLink}
          onDelete={onDeleteLink}
          availableMaps={allMaps}
          currentMapData={currentMapData}
          onLoadMapData={onLoadMapData}
          loadExplorerTree={async () => null}
          onSaveFileLink={onSaveFileLink}
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

