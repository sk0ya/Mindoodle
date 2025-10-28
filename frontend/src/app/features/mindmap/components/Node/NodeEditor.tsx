import React, { memo } from 'react';
import type { MindMapNode, NodeLink } from '@shared/types';
import NodeTextEditor from './NodeTextEditor';
import NodeTextView from './NodeTextView';
// Re-export for backward compatibility
export { isMarkdownLink, isUrl, parseMarkdownLink } from './linkUtils';

interface NodeEditorProps {
  node: MindMapNode;
  nodeLeftX: number;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  nodeWidth: number;
  blurTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  isSelected?: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  onToggleLinkList?: (nodeId: string) => void;
  onLinkNavigate?: (link: NodeLink) => void;
  onStartEdit?: (nodeId: string) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onRightClick?: (e: React.MouseEvent) => void;
  onEditHeightChange?: (height: number) => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  nodeLeftX,
  isEditing,
  editText,
  setEditText,
  onFinishEdit,
  nodeWidth,
  blurTimeoutRef,
  isSelected = false,
  onSelectNode,
  onToggleLinkList,
  onLinkNavigate,
  onStartEdit,
  onMouseDown,
  onDragOver,
  onDrop,
  onRightClick,
  onEditHeightChange
}) => {
  // Guard: table nodes are rendered elsewhere
  const isTableNode = 'kind' in node && (node as unknown as Record<string, unknown>).kind === 'table';
  if (isTableNode) return null;

  if (!isEditing) {
    return (
      <NodeTextView
        node={node}
        nodeWidth={nodeWidth}
        isSelected={isSelected}
        onSelectNode={onSelectNode}
        onToggleLinkList={onToggleLinkList}
        onLinkNavigate={onLinkNavigate}
        onStartEdit={onStartEdit}
        onMouseDown={onMouseDown}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onRightClick={onRightClick}
      />
    );
  }

  return (
    <NodeTextEditor
      node={node}
      nodeLeftX={nodeLeftX}
      editText={editText}
      setEditText={setEditText}
      onFinishEdit={onFinishEdit}
      nodeWidth={nodeWidth}
      blurTimeoutRef={blurTimeoutRef}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onEditHeightChange={onEditHeightChange}
    />
  );
};


export default memo(NodeEditor);
