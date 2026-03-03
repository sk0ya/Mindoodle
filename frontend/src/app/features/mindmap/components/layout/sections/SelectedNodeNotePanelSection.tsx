import React from 'react';
// Lazy-load the Node Note panel (uses MarkdownEditor with codemirror)
const SelectedNodeNotePanel = React.lazy(() => import('../../panels/SelectedNodeNotePanel'));
import { findNodeInRoots } from '@mindmap/utils';
import type { MindMapData, MindMapNode } from '@shared/types';

interface Props {
  selectedNodeId: string | null;
  data: MindMapData | null;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onClose: () => void;
  subscribeNoteChanges: (nodeId: string, cb: (text: string) => void) => () => void;
}

const SelectedNodeNotePanelSection: React.FC<Props> = ({
  selectedNodeId,
  data,
  updateNode,
  onClose,
  subscribeNoteChanges,
}) => {
  // Pass updateNode directly to SelectedNodeNotePanel
  // It will use nodeId internally to prevent stale closure bugs
  const node = selectedNodeId ? findNodeInRoots(data?.rootNodes || [], selectedNodeId) : null;
  return (
    <React.Suspense fallback={
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="text-sm" style={{ padding: 8 }}>Loading note editor…</div>
      </div>
    }>
      <SelectedNodeNotePanel
        nodeId={selectedNodeId}
        nodeTitle={node?.text || ''}
        note={node?.note || ''}
        updateNode={updateNode}
        onClose={onClose}
        subscribeNoteChanges={selectedNodeId ? (cb) => subscribeNoteChanges(selectedNodeId, cb) : undefined}
      />
    </React.Suspense>
  );
};

export default SelectedNodeNotePanelSection;
