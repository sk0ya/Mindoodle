import React from 'react';
import SelectedNodeNotePanel from '../../panels/SelectedNodeNotePanel';
import { findNodeInRoots } from '@mindmap/utils';
import type { MindMapData, MindMapNode } from '@shared/types';

interface Props {
  selectedNodeId: string | null;
  data: MindMapData | null;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onClose: () => void;
  subscribeNoteChanges: (cb: (text: string) => void) => () => void;
}

const SelectedNodeNotePanelSection: React.FC<Props> = ({
  selectedNodeId,
  data,
  updateNode,
  onClose,
  subscribeNoteChanges,
}) => {
  if (!selectedNodeId) return null;
  const node = findNodeInRoots(data?.rootNodes || [], selectedNodeId);
  return (
    <SelectedNodeNotePanel
      nodeId={selectedNodeId}
      nodeTitle={node?.text || ''}
      note={node?.note || ''}
      onChange={(val) => updateNode(selectedNodeId, { note: val })}
      onClose={onClose}
      subscribeNoteChanges={subscribeNoteChanges}
    />
  );
};

export default SelectedNodeNotePanelSection;

