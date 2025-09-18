import React from 'react';
import NodeNotesPanel from '../panels/NodeNotesPanel';
import { findNodeInRoots } from '../../../../shared/utils/nodeTreeUtils';
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
  onMapMarkdownInput?: (markdown: string) => void;
  subscribeMarkdownFromNodes?: (cb: (text: string) => void) => () => void;
  getNodeIdByMarkdownLine?: (line: number) => string | null;
  onSelectNode?: (nodeId: string) => void;
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
  onMapMarkdownInput,
  subscribeMarkdownFromNodes,
  getNodeIdByMarkdownLine,
  onSelectNode,
}) => {
  // Search for the selected node in all root nodes
  const selectedNode = React.useMemo(() => {
    if (!dataRoot || !selectedNodeId) return null;
    return findNodeInRoots(dataRoot.rootNodes || [], selectedNodeId);
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
      onMapMarkdownInput={onMapMarkdownInput}
      subscribeMarkdownFromNodes={subscribeMarkdownFromNodes}
      getNodeIdByMarkdownLine={getNodeIdByMarkdownLine}
      onSelectNode={onSelectNode}
    />
  );
};

export default NodeNotesPanelContainer;
