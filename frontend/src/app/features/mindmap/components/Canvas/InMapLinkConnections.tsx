import React, { memo, useMemo } from 'react';
import { calculateNodeSize, resolveNodeTextWrapConfig } from '@mindmap/utils';
import type { MindMapData, MindMapNode, NodeLink } from '@shared/types';
import { useMindMapStore } from '../../store';
import { extractInternalMarkdownLinksDetailed } from '../../../markdown/markdownLinkUtils';

type InMapLinkConnectionsProps = {
  data?: MindMapData | null;
  allNodes: MindMapNode[];
};

type LinkPath = {
  d: string;
  key: string;
  isBidirectional?: boolean;
};

function getNodeBoundaryPoint(
  node: { x: number; y: number },
  nodeSize: { width: number; height: number },
  targetPoint: { x: number; y: number }
): { x: number; y: number } {
  const centerX = node.x;
  const centerY = node.y;
  const halfWidth = nodeSize.width / 2;
  const halfHeight = nodeSize.height / 2;

  
  const dx = targetPoint.x - centerX;
  const dy = targetPoint.y - centerY;

  
  if (dx === 0 && dy === 0) {
    return { x: centerX + halfWidth, y: centerY };
  }

  
  
  const absRatioX = dx === 0 ? Infinity : Math.abs(halfWidth / dx);
  const absRatioY = dy === 0 ? Infinity : Math.abs(halfHeight / dy);

  let intersectX: number;
  let intersectY: number;

  if (absRatioX < absRatioY) {
    
    intersectX = centerX + (dx > 0 ? halfWidth : -halfWidth);
    intersectY = centerY + dy * absRatioX;
  } else {
    
    intersectX = centerX + dx * absRatioY;
    intersectY = centerY + (dy > 0 ? halfHeight : -halfHeight);
  }

  return { x: intersectX, y: intersectY };
}


function createSmoothPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const offset = Math.min(Math.abs(dx) * 0.15, 30);

  
  const perpX = -dy / Math.sqrt(dx * dx + dy * dy) * offset;
  const perpY = dx / Math.sqrt(dx * dx + dy * dy) * offset;

  const cx = midX + perpX;
  const cy = midY + perpY;

  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

const InMapLinkConnections: React.FC<InMapLinkConnectionsProps> = ({ data, allNodes }) => {
  const { settings } = useMindMapStore();
  const wrapConfig = resolveNodeTextWrapConfig(settings, settings.fontSize);

  const nodeById = useMemo(() => {
    const m: Record<string, MindMapNode> = {};
    for (const n of allNodes) m[n.id] = n;
    return m;
  }, [allNodes]);

  const currentMapId = data?.mapIdentifier?.mapId;

  
  const syntheticRoot = useMemo(() => {
    const roots = data?.rootNodes || [];
    const root: MindMapNode = {
      id: '__synthetic_root__',
      text: '',
      x: 0,
      y: 0,
      fontSize: settings.fontSize,
      fontWeight: 'normal',
      children: roots,
    } as unknown as MindMapNode;
    return root;
  }, [data?.rootNodes, settings.fontSize]);

  const paths: LinkPath[] = useMemo(() => {
    const result: LinkPath[] = [];
    const processedPairs = new Set<string>();

    
    const getPairKey = (id1: string, id2: string) => {
      return id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
    };

    
    const hasReverseLink = (srcId: string, dstId: string): boolean => {
      const dstNode = nodeById[dstId];
      if (!dstNode) return false;

      const dstLinks = dstNode.links || [];
      return dstLinks.some(l => l.targetNodeId === srcId);
    };

    for (const src of allNodes) {
      const links: NodeLink[] = (src.links || []);
      if (!links || links.length === 0) continue;
      const srcSize = calculateNodeSize(src, undefined, false, settings.fontSize, wrapConfig);

      for (const link of links) {
        
        if (!link.targetNodeId) continue;
        const isSameMap = !link.targetMapId || (currentMapId && link.targetMapId === currentMapId);
        if (!isSameMap) continue;

        const dst = nodeById[link.targetNodeId];
        if (!dst) continue; 

        
        const pairKey = getPairKey(src.id, dst.id);
        if (processedPairs.has(pairKey)) continue;

        const dstSize = calculateNodeSize(dst, undefined, false, settings.fontSize, wrapConfig);

        
        const isBidirectional = hasReverseLink(src.id, dst.id);

        
        const from = getNodeBoundaryPoint(
          { x: src.x, y: src.y },
          srcSize,
          { x: dst.x, y: dst.y }
        );
        const to = getNodeBoundaryPoint(
          { x: dst.x, y: dst.y },
          dstSize,
          { x: src.x, y: src.y }
        );

        result.push({
          d: createSmoothPath(from, to),
          key: `${src.id}->${dst.id}:${link.id}`,
          isBidirectional,
        });

        
        if (isBidirectional) {
          processedPairs.add(pairKey);
        }
      }
    }
    
    for (const src of allNodes) {
      const mdLinks = extractInternalMarkdownLinksDetailed((src as unknown as Partial<Record<string, unknown>>).note as string | undefined, syntheticRoot);
      if (!mdLinks || mdLinks.length === 0) continue;
      const srcSize = calculateNodeSize(src, undefined, false, settings.fontSize, wrapConfig);
      for (const m of mdLinks) {
        if (!m.nodeId) continue;
        const dst = nodeById[m.nodeId];
        if (!dst) continue;

        
        const pairKey = getPairKey(src.id, dst.id);
        if (processedPairs.has(pairKey)) continue;

        const dstSize = calculateNodeSize(dst, undefined, false, settings.fontSize, wrapConfig);

        
        const hasMdReverseLink = extractInternalMarkdownLinksDetailed((dst as unknown as Partial<Record<string, unknown>>).note as string | undefined, syntheticRoot)
          .some(l => l.nodeId === src.id);
        const isBidirectional = hasMdReverseLink || hasReverseLink(src.id, dst.id);

        
        const from = getNodeBoundaryPoint(
          { x: src.x, y: src.y },
          srcSize,
          { x: dst.x, y: dst.y }
        );
        const to = getNodeBoundaryPoint(
          { x: dst.x, y: dst.y },
          dstSize,
          { x: src.x, y: src.y }
        );
        result.push({
          d: createSmoothPath(from, to),
          key: `${src.id}->${dst.id}:md:${m.id}`,
          isBidirectional
        });

        
        if (isBidirectional) {
          processedPairs.add(pairKey);
        }
      }
    }
    return result;
  }, [allNodes, nodeById, currentMapId, settings.fontSize, wrapConfig, syntheticRoot]);

  if (paths.length === 0) return null;

  const theme = settings.theme;
  const strokeColor = theme === 'dark' ? '#60a5fa' : '#3b82f6';

  return (
    <g className="inmap-link-connections" style={{ pointerEvents: 'none' }}>
      <defs>
        {}
        <marker id="inmap-arrow" markerWidth="6" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M 0 0 L 5 3.5 L 0 7 L 1 3.5 z" fill={strokeColor} opacity="0.6" />
        </marker>
        {}
        <marker id="inmap-arrow-start" markerWidth="6" markerHeight="7" refX="1" refY="3.5" orient="auto">
          <path d="M 5 0 L 0 3.5 L 5 7 L 4 3.5 z" fill={strokeColor} opacity="0.6" />
        </marker>
        {}
        <marker id="inmap-arrow-end" markerWidth="6" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M 0 0 L 5 3.5 L 0 7 L 1 3.5 z" fill={strokeColor} opacity="0.6" />
        </marker>
      </defs>

      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          stroke={strokeColor}
          strokeWidth={1.5}
          fill="none"
          opacity={0.55}
          strokeLinecap="round"
          markerStart={p.isBidirectional ? "url(#inmap-arrow-start)" : undefined}
          markerEnd={p.isBidirectional ? "url(#inmap-arrow-end)" : "url(#inmap-arrow)"}
        />
      ))}
    </g>
  );
};

export default memo(InMapLinkConnections);
