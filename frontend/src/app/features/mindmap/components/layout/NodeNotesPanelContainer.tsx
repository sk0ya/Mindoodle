import React from 'react';
import NodeNotesPanel from '../panels/NodeNotesPanel';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import type { MindMapNode, MapIdentifier } from '@shared/types';

type Props = {
  dataRoot: MindMapNode | null;
  selectedNodeId: string | null;
  currentMapIdentifier?: MapIdentifier | null;
  onUpdateNode: (id: string, updates: Partial<MindMapNode>) => void;
  onClose: () => void;
  getMapMarkdown?: (id: MapIdentifier) => Promise<string | null>;
  saveMapMarkdown?: (id: MapIdentifier, markdown: string) => Promise<void>;
  setAutoSaveEnabled?: (enabled: boolean) => void;
};

const NodeNotesPanelContainer: React.FC<Props> = ({
  dataRoot,
  selectedNodeId,
  currentMapIdentifier,
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
      currentMapIdentifier={currentMapIdentifier || null}
      getMapMarkdown={getMapMarkdown}
      saveMapMarkdown={saveMapMarkdown}
      setAutoSaveEnabled={setAutoSaveEnabled}
    />
  );
};

export default NodeNotesPanelContainer;
