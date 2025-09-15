import React from 'react';
import NodeNotesPanel from '../panels/NodeNotesPanel';
import { findNodeById } from '../../../../shared/utils/nodeTreeUtils';
import type { MindMapNode, MapIdentifier, MindMapData } from '@shared/types';

type Props = {
  dataRoot: MindMapData | null;
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
  // Search for the selected node in all root nodes
  const selectedNode = React.useMemo(() => {
    if (!dataRoot || !selectedNodeId) return null;

    const rootNodes = dataRoot.rootNodes || [];

    // Search through all root nodes, not just the first one
    for (const rootNode of rootNodes) {
      const found = findNodeById(rootNode, selectedNodeId);
      if (found) {
        return found;
      }
    }


    return null;
  }, [dataRoot, selectedNodeId]);
  // Clean onUpdateNode wrapper
  const wrappedOnUpdateNode = React.useCallback((id: string, updates: Partial<MindMapNode>) => {
    onUpdateNode(id, updates);
  }, [onUpdateNode]);

  return (
    <NodeNotesPanel
      selectedNode={selectedNode}
      onUpdateNode={wrappedOnUpdateNode}
      onClose={onClose}
      currentMapIdentifier={currentMapIdentifier || null}
      getMapMarkdown={getMapMarkdown}
      saveMapMarkdown={saveMapMarkdown}
      setAutoSaveEnabled={setAutoSaveEnabled}
    />
  );
};

export default NodeNotesPanelContainer;
