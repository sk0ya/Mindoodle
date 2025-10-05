import React, { memo, useMemo } from 'react';
import { calculateNodeSize, getNodeLeftX, getNodeRightX, resolveNodeTextWrapConfig } from '@mindmap/utils';
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
};

// Create subtle curved path for visual elegance
function createSmoothPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Gentle quadratic curve for natural flow
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const offset = Math.min(Math.abs(dx) * 0.15, 30);

  // Control point slightly offset perpendicular to the line
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

  // Build a synthetic root to resolve anchors across multiple root nodes
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
    for (const src of allNodes) {
      const links: NodeLink[] = (src.links || []);
      if (!links || links.length === 0) continue;
      const srcSize = calculateNodeSize(src, undefined, false, settings.fontSize, wrapConfig);

      for (const link of links) {
        // Only visualize links targeting nodes within the same map
        if (!link.targetNodeId) continue;
        const isSameMap = !link.targetMapId || (currentMapId && link.targetMapId === currentMapId);
        if (!isSameMap) continue;

        const dst = nodeById[link.targetNodeId];
        if (!dst) continue; // target not visible/exists

        const dstSize = calculateNodeSize(dst, undefined, false, settings.fontSize, wrapConfig);

        // Calculate edge connection points on node boundaries
        const goingRight = dst.x >= src.x;
        const srcEdgeX = goingRight ? getNodeRightX(src, srcSize.width) : getNodeLeftX(src, srcSize.width);
        const dstEdgeX = goingRight ? getNodeLeftX(dst, dstSize.width) : getNodeRightX(dst, dstSize.width);

        // Calculate Y position on node edge based on relative positions
        const dy = dst.y - src.y;

        // Use node height to find edge intersection point
        const srcHalfHeight = srcSize.height / 2;
        const dstHalfHeight = dstSize.height / 2;

        const from = {
          x: srcEdgeX,
          y: src.y + Math.min(Math.max(dy * 0.3, -srcHalfHeight), srcHalfHeight),
        };
        const to = {
          x: dstEdgeX,
          y: dst.y - Math.min(Math.max(dy * 0.3, -dstHalfHeight), dstHalfHeight),
        };

        result.push({
          d: createSmoothPath(from, to),
          key: `${src.id}->${dst.id}:${link.id}`,
        });
      }
    }
    // Also derive links from markdown note content (internal anchors only)
    for (const src of allNodes) {
      const mdLinks = extractInternalMarkdownLinksDetailed((src as any).note, syntheticRoot);
      if (!mdLinks || mdLinks.length === 0) continue;
      const srcSize = calculateNodeSize(src, undefined, false, settings.fontSize, wrapConfig);
      for (const m of mdLinks) {
        if (!m.nodeId) continue;
        const dst = nodeById[m.nodeId];
        if (!dst) continue;
        const dstSize = calculateNodeSize(dst, undefined, false, settings.fontSize, wrapConfig);

        // Calculate edge connection points (same logic as above)
        const goingRight = dst.x >= src.x;
        const srcEdgeX = goingRight ? getNodeRightX(src, srcSize.width) : getNodeLeftX(src, srcSize.width);
        const dstEdgeX = goingRight ? getNodeLeftX(dst, dstSize.width) : getNodeRightX(dst, dstSize.width);

        const dy = dst.y - src.y;
        const srcHalfHeight = srcSize.height / 2;
        const dstHalfHeight = dstSize.height / 2;

        const from = {
          x: srcEdgeX,
          y: src.y + Math.min(Math.max(dy * 0.3, -srcHalfHeight), srcHalfHeight),
        };
        const to = {
          x: dstEdgeX,
          y: dst.y - Math.min(Math.max(dy * 0.3, -dstHalfHeight), dstHalfHeight),
        };
        result.push({ d: createSmoothPath(from, to), key: `${src.id}->${dst.id}:md:${m.id}` });
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
        {/* Crisp arrow marker */}
        <marker id="inmap-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <path d="M 0 0 L 10 4 L 0 8 L 2 4 z" fill={strokeColor} />
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
          markerEnd="url(#inmap-arrow)"
        />
      ))}
    </g>
  );
};

export default memo(InMapLinkConnections);
