import React, { memo } from 'react';
import Connection from '../Connection';
import { calculateNodeSize, getToggleButtonPosition, getBranchColor, getNodeLeftX, getNodeRightX, resolveNodeTextWrapConfig } from '@mindmap/utils';
import { useMindMapStore } from '../../store';
import type { MindMapNode, MindMapData } from '@shared/types';

interface ConnectionData {
  from: MindMapNode | { x: number; y: number };
  to: MindMapNode | { x: number; y: number };
  hasToggleButton: boolean;
  nodeId?: string;
  isCollapsed?: boolean;
  isToggleConnection?: boolean;
  color?: string;
  isFromRoot?: boolean;
}

interface CanvasConnectionsProps {
  allNodes: MindMapNode[];
  data?: MindMapData| null;
  onToggleCollapse: (nodeId: string) => void;
}

const CanvasConnections: React.FC<CanvasConnectionsProps> = ({
  allNodes,
  data,
  onToggleCollapse
}) => {
  const { settings, normalizedData } = useMindMapStore();
  const wrapConfig = resolveNodeTextWrapConfig(settings, settings.fontSize);
  const connections: ConnectionData[] = [];

  
  const findParentNode = (nodeId: string): MindMapNode | null => {
    for (const node of allNodes) {
      if (node.children) {
        for (const child of node.children) {
          if (child.id === nodeId) {
            return node;
          }
        }
      }
    }
    return null;
  };

  
  const findRootNodeForNode = (nodeId: string): MindMapNode | null => {
    let currentNode = allNodes.find(n => n.id === nodeId);
    if (!currentNode) return null;

    
    while (true) {
      const parent = findParentNode(currentNode.id);
      if (!parent) {
        
        return currentNode;
      }
      currentNode = parent;
    }
  };

  const processRootNodeConnections = (node: MindMapNode, connections: ConnectionData[]): void => {
    const nodeSize = calculateNodeSize(node, undefined, false, settings.fontSize, wrapConfig);
    const togglePosition = getToggleButtonPosition(node, node, nodeSize, settings.fontSize, wrapConfig);
    const toggleX = togglePosition.x;
    const toggleY = togglePosition.y;

    const nodeRightEdge = getNodeRightX(node, nodeSize.width);
    connections.push({
      from: { x: nodeRightEdge, y: node.y },
      to: { x: toggleX, y: toggleY },
      hasToggleButton: false,
      color: node.color || '#666'
    });

    connections.push({
      from: { x: toggleX, y: toggleY },
      to: { x: toggleX, y: toggleY },
      hasToggleButton: true,
      nodeId: node.id,
      isCollapsed: false
    });

    node.children.forEach((child: MindMapNode) => {
      const color = normalizedData ? getBranchColor(child.id, normalizedData, settings.edgeColorSet) : (child.color || '#666');
      const childSize = calculateNodeSize(child, undefined, false, settings.fontSize, wrapConfig);
      const childLeftX = getNodeLeftX(child, childSize.width);

      connections.push({
        from: { x: toggleX, y: toggleY },
        to: { x: childLeftX, y: child.y },
        hasToggleButton: false,
        color: color,
        isFromRoot: true
      });
    });
  };

  const processNonRootNodeConnections = (node: MindMapNode, connections: ConnectionData[]): void => {
    const nodeSize = calculateNodeSize(node, undefined, false, settings.fontSize, wrapConfig);
    const rootNodeForNode = findRootNodeForNode(node.id);
    const togglePosition = getToggleButtonPosition(node, rootNodeForNode || data?.rootNodes?.[0] || node, nodeSize, settings.fontSize, wrapConfig);
    const toggleX = togglePosition.x;
    const toggleY = togglePosition.y;

    const parentColor = normalizedData ? getBranchColor(node.id, normalizedData, settings.edgeColorSet) : (node.color || '#666');
    const parentRightEdge = getNodeRightX(node, nodeSize.width);
    connections.push({
      from: { x: parentRightEdge, y: node.y },
      to: { x: toggleX, y: toggleY },
      hasToggleButton: false,
      color: parentColor
    });

    connections.push({
      from: { x: toggleX, y: toggleY },
      to: { x: toggleX, y: toggleY },
      hasToggleButton: true,
      nodeId: node.id,
      isCollapsed: false
    });

    node.children.forEach((child: MindMapNode) => {
      const childColor = normalizedData ? getBranchColor(child.id, normalizedData, settings.edgeColorSet) : (child.color || '#666');
      const childSize = calculateNodeSize(child, undefined, false, settings.fontSize, wrapConfig);
      const childLeftX = getNodeLeftX(child, childSize.width);

      connections.push({
        from: { x: toggleX, y: toggleY },
        to: { x: childLeftX, y: child.y },
        hasToggleButton: false,
        color: childColor
      });
    });
  };

  const processCollapsedNode = (node: MindMapNode, connections: ConnectionData[]): void => {
    const nodeSize = calculateNodeSize(node, undefined, false, settings.fontSize, wrapConfig);
    const rootNodeForNode = findRootNodeForNode(node.id);
    const togglePosition = getToggleButtonPosition(node, rootNodeForNode || data?.rootNodes?.[0] || node, nodeSize, settings.fontSize, wrapConfig);
    const toggleX = togglePosition.x;
    const toggleY = togglePosition.y;

    const collapsedColor = normalizedData ? getBranchColor(node.id, normalizedData, settings.edgeColorSet) : (node.color || '#666');
    const parentRightEdge = getNodeRightX(node, nodeSize.width);
    connections.push({
      from: { x: parentRightEdge, y: node.y },
      to: { x: toggleX, y: toggleY },
      hasToggleButton: false,
      color: collapsedColor
    });

    connections.push({
      from: { x: toggleX, y: toggleY },
      to: { x: toggleX, y: toggleY },
      hasToggleButton: true,
      nodeId: node.id,
      isCollapsed: true
    });
  };

  allNodes.forEach(node => {
    if (!node.children || node.children.length === 0) return;

    const isRootNode = findParentNode(node.id) === null;

    if (!node.collapsed) {
      if (isRootNode) {
        processRootNodeConnections(node, connections);
      } else {
        processNonRootNodeConnections(node, connections);
      }
    } else {
      processCollapsedNode(node, connections);
    }
  });

  return (
    <>
      <g className="connection-lines">
        {connections.filter(conn => !conn.hasToggleButton).map((conn, index) => (
          <Connection
            key={`${'id' in conn.from ? conn.from.id : 'toggle'}-${'id' in conn.to ? conn.to.id : 'toggle'}-${index}`}
            from={conn.from}
            to={conn.to}
            hasToggleButton={false}
            onToggleCollapse={onToggleCollapse}
            nodeId={conn.nodeId || ''}
            color={conn.color}
            isFromRoot={conn.isFromRoot}
          />
        ))}
      </g>

      <g className="toggle-buttons">
        {connections.filter(conn => conn.hasToggleButton).map((conn, index) => (
          <Connection
            key={`toggle-${conn.nodeId}-${index}`}
            from={conn.from}
            to={conn.to}
            hasToggleButton={true}
            onToggleCollapse={onToggleCollapse}
            nodeId={conn.nodeId || ''}
            isCollapsed={conn.isCollapsed}
          />
        ))}
      </g>
    </>
  );
};

export default memo(CanvasConnections);
