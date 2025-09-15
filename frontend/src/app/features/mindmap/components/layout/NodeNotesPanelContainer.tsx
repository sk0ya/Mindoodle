import React from 'react';
import NodeNotesPanel from '../panels/NodeNotesPanel';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import type { MindMapNode } from '@shared/types';

type Props = {
  dataRoot: MindMapNode | null;
  selectedNodeId: string | null;
  currentMapId: string | null;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onClose: () => void;
  getMapMarkdown?: (mapId: string) => Promise<string | null>;
  saveMapMarkdown?: (mapId: string, markdown: string) => Promise<void>;
  setAutoSaveEnabled?: (enabled: boolean) => void;
};

const NodeNotesPanelContainer: React.FC<Props> = ({
  dataRoot,
  selectedNodeId,
  currentMapId,
  onUpdateNode,
  onClose,
  getMapMarkdown,
  saveMapMarkdown,
  setAutoSaveEnabled,
}) => {
  const selectedNode = dataRoot && selectedNodeId ? findNodeById(dataRoot, selectedNodeId) : null;
  return (
    <NodeNotesPanel
      selectedNode={selectedNode}
      onUpdateNode={onUpdateNode}
      onClose={onClose}
      currentMapId={currentMapId}
      getMapMarkdown={getMapMarkdown}
      saveMapMarkdown={saveMapMarkdown}
      setAutoSaveEnabled={setAutoSaveEnabled}
    />
  );
};

export default NodeNotesPanelContainer;

