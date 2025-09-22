import React, { memo, useEffect } from 'react';
import CanvasConnections from './CanvasConnections';
import CanvasDragGuide from './CanvasDragGuide';
import { Node } from '../Node';
import SelectedNodeLinkList from '../Shared/SelectedNodeLinkList';
import { calculateNodeSize } from '../../utils';
import { useMindMapStore } from '../../store';
import type { MindMapData, MindMapNode, NodeLink } from '@shared/types';

interface DragState {
  isDragging: boolean;
  draggedNodeId: string | null;
  dropTargetId: string | null;
  dropPosition: 'child' | 'before' | 'after' | null;
  dropAction: 'move-parent' | 'reorder-sibling' | null;
  dragOffset: { x: number; y: number };
}

interface CanvasRendererProps {
  svgRef: React.RefObject<SVGSVGElement>;
  data: MindMapData;
  allNodes: MindMapNode[];
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  setEditText: (text: string) => void;
  zoom: number;
  pan: { x: number; y: number };
  cursor: string;
  dragState: DragState;

  // Event handlers
  onWheel: (e: React.WheelEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onStartEdit: (nodeId: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRightClick?: (e: React.MouseEvent, nodeId: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onShowLinkActionMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
  
  // Link display data
  availableMaps?: { id: string; title: string }[];
  currentMapData?: { id: string; rootNode: any };
  
  // Link navigation
  onLinkNavigate?: (link: NodeLink) => void;

  // Drag handlers
  onDragStart: (nodeId: string) => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: (nodeId: string, x: number, y: number) => void;
  
  // Icon toggle handlers
  onToggleLinkList?: (nodeId: string) => void;
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
}

const CanvasRenderer: React.FC<CanvasRendererProps> = ({
  svgRef,
  data,
  allNodes,
  selectedNodeId,
  editingNodeId,
  editText,
  setEditText,
  zoom,
  pan,
  cursor,
  dragState,
  onWheel,
  onMouseDown,
  onMouseUp,
  onContextMenu,
  onNodeSelect,
  onStartEdit,
  onFinishEdit,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onRightClick,
  onToggleCollapse,
  onShowLinkActionMenu,
  onUpdateNode,
  onAutoLayout,
  availableMaps,
  currentMapData,
  onLinkNavigate,
  onDragStart,
  onDragMove,
  onDragEnd,
  onToggleLinkList,
  onLoadRelativeImage
}) => {
  const { settings } = useMindMapStore();


  // SVGのwheelイベントを非passiveで設定
  useEffect(() => {
    const svgElement = svgRef.current;
    if (svgElement) {
      const handleWheelCapture = (e: WheelEvent) => {
        // React SyntheticEventに変換
        const syntheticEvent = {
          preventDefault: () => e.preventDefault(),
          stopPropagation: () => e.stopPropagation(),
          deltaY: e.deltaY,
          clientX: e.clientX,
          clientY: e.clientY,
          nativeEvent: e,
          isDefaultPrevented: () => e.defaultPrevented,
          isPropagationStopped: () => false,
          persist: () => {}
        } as React.WheelEvent;
        onWheel(syntheticEvent);
      };

      svgElement.addEventListener('wheel', handleWheelCapture, { passive: false });
      return () => {
        svgElement.removeEventListener('wheel', handleWheelCapture);
      };
    }
    return undefined;
  }, [onWheel]);
  return (
    <div className="mindmap-canvas-container">
      <svg
        ref={svgRef}
        tabIndex={0}
        width="100%"
        height="100%"
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        style={{
          background: 'var(--bg-primary)',
          cursor,
          border: `2px solid var(--border-color)`,
          borderRadius: '12px',
          userSelect: 'none',
          // Avoid animating transforms during pan to prevent jank
          transition: 'border-color 0.2s ease'
        }}
      >
        <g transform={`scale(${zoom * 1.5}) translate(${pan?.x || 0}, ${pan?.y || 0})`}>
          {/* ドラッグ中のドロップガイドライン */}
          <CanvasDragGuide
            dragState={dragState}
            allNodes={allNodes}
          />

          <CanvasConnections
            allNodes={allNodes}
            data={data}
            onToggleCollapse={onToggleCollapse}
          />

          <g className="nodes">
            {allNodes.map(node => (
              <Node
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isEditing={editingNodeId === node.id}
                isDragTarget={dragState.dropTargetId === node.id}
                onSelect={onNodeSelect}
                onStartEdit={onStartEdit}
                onFinishEdit={onFinishEdit}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onAddChild={onAddChild}
                onAddSibling={onAddSibling}
                onDelete={onDeleteNode}
                onRightClick={onRightClick}
                editText={editText}
                setEditText={setEditText}
                onShowLinkActionMenu={onShowLinkActionMenu}
                onUpdateNode={onUpdateNode}
                onAutoLayout={onAutoLayout}
                zoom={zoom}
                pan={pan}
                svgRef={svgRef}
                globalFontSize={settings.fontSize}
                onToggleLinkList={onToggleLinkList}
                onLoadRelativeImage={onLoadRelativeImage}
                onLinkNavigate={onLinkNavigate}
              />
            ))}
          </g>

          {/* アイコンクリック時の一覧表示（添付一覧は廃止） */}
          {(() => {
            const { showLinkListForNode } = useMindMapStore().ui;
            
            // リンク一覧の表示
            if (showLinkListForNode) {
              const targetNode = allNodes.find(node => node.id === showLinkListForNode);
              if (targetNode) {
                const nodeSize = calculateNodeSize(targetNode, editText, editingNodeId === targetNode.id, settings.fontSize);
                return (
                  <SelectedNodeLinkList
                    key={`link-list-${showLinkListForNode}`}
                    node={targetNode}
                    isVisible={true}
                    nodeWidth={nodeSize.width}
                    nodeHeight={nodeSize.height}
                    onLinkClick={() => {
                      // リンククリック時は何もしない（メニュー表示を無効化）
                    }}
                    onLinkContextMenu={(link, position) => {
                      onShowLinkActionMenu(link, position);
                    }}
                    onLinkNavigate={onLinkNavigate}
                    availableMaps={availableMaps}
                    currentMapData={currentMapData}
                  />
                );
              }
            }
            
            return null;
          })()}

        </g>
      </svg>


      <style>{`
        .mindmap-canvas-container {
          position: relative;
          height: 100%;
          width: 100%;
        }

        .mindmap-canvas-container > svg {
          display: block;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          width: 100%;
          height: 100%;
        }


        .connections path {
          stroke: black;
        }

        .drop-guide line {
          animation: dragPulse 1.5s ease-in-out infinite;
        }

        .drop-guide circle {
          animation: dropZonePulse 2s ease-in-out infinite;
        }

        @keyframes dragPulse {
          0%, 100% { stroke-opacity: 0.8; }
          50% { stroke-opacity: 0.4; }
        }

        @keyframes dropZonePulse {
          0%, 100% { 
            stroke-opacity: 0.5; 
            r: 60;
          }
          50% { 
            stroke-opacity: 0.8; 
            r: 65;
          }
        }

        @media (max-width: 768px) {
        }
      `}</style>
    </div>
  );
};

export default memo(CanvasRenderer);
