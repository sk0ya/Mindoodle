

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { vectorStore } from '@core/services/VectorStore';
import { ForceDirectedLayout, type Node2D } from '../../utils/forceDirectedLayout';
import { embeddingService } from '@core/services/EmbeddingService';
import { nodeToMarkdown } from '@markdown/index';
import type { MindMapNode, MapIdentifier } from '@shared/types';
import { combineModalStyles } from '../shared/modalStyles';
import { useModalBehavior } from '../shared/useModalBehavior';
import { logger } from '@shared/utils';
// storageAdapter no longer passed; use getMapMarkdown when needed
// Note: Do not rely on global command registry here; directly dispatch events for robustness

type MapListItem = {
  mapIdentifier: MapIdentifier;
  rootNodes?: MindMapNode[];
};

interface KnowledgeGraphModal2DProps {
  isOpen: boolean;
  onClose: () => void;
  mapIdentifier?: MapIdentifier | null;
  getMapMarkdown?: (id: MapIdentifier) => Promise<string | null>;
  getWorkspaceMapIdentifiers?: (workspaceId?: string | null) => Promise<Array<MapIdentifier>>;
}

export const KnowledgeGraphModal2D: React.FC<KnowledgeGraphModal2DProps> = ({
  isOpen,
  onClose,
  mapIdentifier,
  getMapMarkdown,
  getWorkspaceMapIdentifiers,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node2D[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vectorizationProgress, setVectorizationProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const hasRunInitialVectorization = useRef(false);
  const [effectiveWorkspaceId, setEffectiveWorkspaceId] = useState<string | null>(null);

  const { handleBackdropClick } = useModalBehavior(isOpen, onClose);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  // Deterministic position generator based on string hash (no Math.random)
  const deterministicPosition = useCallback((key: string, max: number): number => {
    let h = 5381;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) + h) ^ key.charCodeAt(i);
    }
    const u = (h >>> 0) / 0xffffffff; // 0..1
    return Math.floor(u * max);
  }, []);

  const buildVectorKey = useCallback((workspaceId: string | null | undefined, mapId: string) => {
    // Use namespaced key only when workspaceId is known; otherwise fall back to plain mapId.md (legacy)
    return workspaceId ? `${workspaceId}::${mapId}.md` : `${mapId}.md`;
  }, []);

  const parseVectorKey = useCallback((key: string): { workspaceId: string | null; mapId: string } => {
    const plain = key.endsWith('.md') ? key.slice(0, -3) : key;
    const idx = plain.indexOf('::');
    if (idx >= 0) {
      return { workspaceId: plain.slice(0, idx), mapId: plain.slice(idx + 2) };
    }
    return { workspaceId: null, mapId: plain };
  }, []);


  const runInitialVectorization = useCallback(async () => {
    try {
      const existingVectors = await vectorStore.getAllVectors();
      const windowWithMaps = window as Window & { mindoodleAllMaps?: MapListItem[] };
      let mapsList: MapListItem[] = (windowWithMaps.mindoodleAllMaps || []).slice();
      const ws = mapIdentifier?.workspaceId || null;
      if (mapIdentifier && !mapsList.find((m) => m?.mapIdentifier?.mapId === mapIdentifier.mapId && m?.mapIdentifier?.workspaceId === mapIdentifier.workspaceId)) {
        mapsList.push({ mapIdentifier });
      }
      const containsWsCount = mapsList.filter((m) => m?.mapIdentifier?.workspaceId === ws).length;
      if ((containsWsCount === 0 || ws === 'cloud') && typeof getWorkspaceMapIdentifiers === 'function') {
        try {
          const ids = await getWorkspaceMapIdentifiers(ws);
          if (Array.isArray(ids) && ids.length > 0) {
            mapsList = ids.map(id => ({ mapIdentifier: id }));
            if (mapIdentifier && !mapsList.find((m) => m?.mapIdentifier?.mapId === mapIdentifier.mapId && m?.mapIdentifier?.workspaceId === mapIdentifier.workspaceId)) {
              mapsList.push({ mapIdentifier });
            }
          }
        } catch {}
      }

      const uniqueWs = Array.from(new Set(mapsList.map((m) => m?.mapIdentifier?.workspaceId).filter(Boolean)));
      const filterWsId = mapIdentifier?.workspaceId ?? (uniqueWs.length === 1 ? uniqueWs[0] : null);
      const scopedMaps = filterWsId ? mapsList.filter((m) => m?.mapIdentifier?.workspaceId === filterWsId) : mapsList;

      // Vectorize any map that lacks a vector, regardless of rootNodes presence
      const mapsToVectorize = scopedMaps.filter((mapData) => {
        const plainKey = `${mapData?.mapIdentifier?.mapId}.md`;
        const namespacedKey = buildVectorKey(mapData?.mapIdentifier?.workspaceId, mapData?.mapIdentifier?.mapId || '');
        return !!namespacedKey && !existingVectors.has(plainKey) && !existingVectors.has(namespacedKey);
      });

      if (mapsToVectorize.length === 0) return;

      setVectorizationProgress({ current: 0, total: mapsToVectorize.length });

      for (let i = 0; i < mapsToVectorize.length; i++) {
        const mapData = mapsToVectorize[i];
        const filePath = buildVectorKey(mapData.mapIdentifier.workspaceId, mapData.mapIdentifier.mapId);

        // Prefer in-memory rootNodes; otherwise fetch markdown via adapter (network OK in cloud)
        let markdown = '';
        if (Array.isArray(mapData.rootNodes) && mapData.rootNodes.length > 0) {
          markdown = mapData.rootNodes.map((node) => nodeToMarkdown(node)).join('\n');
        } else if (typeof getMapMarkdown === 'function') {
          try {
            const text = await getMapMarkdown(mapData.mapIdentifier);
            markdown = text || '';
          } catch (e) {
            logger.warn('Failed to fetch markdown for', filePath, e);
          }
        }

        if (markdown) {
          try {
            const vector = await embeddingService.embed(filePath, markdown);
            await vectorStore.saveVector(filePath, vector);
          } catch (e) {
            logger.warn('Vectorization failed for', filePath, e);
          }
        }

        setVectorizationProgress({ current: i + 1, total: mapsToVectorize.length });
      }

      setVectorizationProgress(null);
    } catch (err) {
      logger.error('Initial vectorization failed:', err);
      setError(err instanceof Error ? err.message : 'Vectorization failed');
      setVectorizationProgress(null);
    }
  }, [mapIdentifier, getMapMarkdown, getWorkspaceMapIdentifiers, buildVectorKey]);


  const loadAndLayout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load all vectors and optionally filter by current workspace
      const vectors = await vectorStore.getAllVectors();

      // Filter vectors to current workspace only using provided maps (avoid additional fetching)
      try {
        const windowWithMaps = window as Window & { mindoodleAllMaps?: MapListItem[] };
        let mapsList: MapListItem[] = (windowWithMaps.mindoodleAllMaps || []).slice();
        const ws = mapIdentifier?.workspaceId || null;
        const containsWsCountInit = mapsList.filter((m) => m?.mapIdentifier?.workspaceId === ws).length;
        if ((containsWsCountInit === 0 || ws === 'cloud') && typeof getWorkspaceMapIdentifiers === 'function') {
          try {
            const ids = await getWorkspaceMapIdentifiers(ws);
            if (Array.isArray(ids) && ids.length > 0) {
              mapsList = ids.map(id => ({ mapIdentifier: id }));
            }
          } catch {}
        }
        // Ensure current map is present as a candidate
        if (mapIdentifier && !mapsList.find((m) => m?.mapIdentifier?.mapId === mapIdentifier.mapId && m?.mapIdentifier?.workspaceId === mapIdentifier.workspaceId)) {
          mapsList.push({ mapIdentifier });
        }
        const uniqueWs = Array.from(new Set(mapsList.map((m) => m?.mapIdentifier?.workspaceId).filter(Boolean)));
        const filterWsId = mapIdentifier?.workspaceId ?? (uniqueWs.length === 1 ? uniqueWs[0] : null);
        setEffectiveWorkspaceId(filterWsId || null);

        if (filterWsId) {
          const allowedPlain = new Set(
            mapsList
              .filter((m) => m?.mapIdentifier?.workspaceId === filterWsId)
              .map((m) => `${m.mapIdentifier.mapId}.md`)
          );
          const allowedNamespaced = new Set(
            mapsList
              .filter((m) => m?.mapIdentifier?.workspaceId === filterWsId)
              .map((m) => buildVectorKey(m?.mapIdentifier?.workspaceId, m?.mapIdentifier?.mapId))
          );

          for (const key of Array.from(vectors.keys())) {
            if (!allowedPlain.has(key) && !allowedNamespaced.has(key)) {
              vectors.delete(key);
            }
          }
        }
      } catch (e) {
        logger.warn('KnowledgeGraph: Failed to filter vectors by workspace (maps list)', e);
      }

      if (vectors.size === 0) {
        // If maps are available, try on-demand vectorization, then retry
        try {
          const windowWithMaps = window as Window & { mindoodleAllMaps?: MapListItem[] };
          let mapsList: MapListItem[] = (windowWithMaps.mindoodleAllMaps || []).slice();
          const ws = mapIdentifier?.workspaceId || null;
          const containsWsCount = mapsList.filter((m) => m?.mapIdentifier?.workspaceId === ws).length;
          if ((containsWsCount === 0 || ws === 'cloud') && typeof getWorkspaceMapIdentifiers === 'function') {
            try {
              const ids = await getWorkspaceMapIdentifiers(ws);
              if (Array.isArray(ids) && ids.length > 0) {
                mapsList = ids.map(id => ({ mapIdentifier: id }));
              }
            } catch {}
          }
          if (mapIdentifier && !mapsList.find((m) => m?.mapIdentifier?.mapId === mapIdentifier.mapId && m?.mapIdentifier?.workspaceId === mapIdentifier.workspaceId)) {
            mapsList.push({ mapIdentifier });
          }
          if (Array.isArray(mapsList) && mapsList.length > 0) {
            await runInitialVectorization();
            // Re-fetch vectors and re-apply filter
            const refreshed = await vectorStore.getAllVectors();
            const uniqueWs = Array.from(new Set(mapsList.map((m) => m?.mapIdentifier?.workspaceId).filter(Boolean)));
            const filterWsId = mapIdentifier?.workspaceId ?? (uniqueWs.length === 1 ? uniqueWs[0] : null);
            if (filterWsId) {
              const allowedPlain = new Set(
                mapsList
                  .filter((m) => m?.mapIdentifier?.workspaceId === filterWsId)
                  .map((m) => `${m.mapIdentifier.mapId}.md`)
              );
              const allowedNamespaced = new Set(
                mapsList
                  .filter((m) => m?.mapIdentifier?.workspaceId === filterWsId)
                  .map((m) => buildVectorKey(m?.mapIdentifier?.workspaceId, m?.mapIdentifier?.mapId))
              );
              for (const key of Array.from(refreshed.keys())) {
                if (!allowedPlain.has(key) && !allowedNamespaced.has(key)) {
                  refreshed.delete(key);
                }
              }
            }
            if (refreshed.size > 0) {
              // Replace vectors map with refreshed
              // Note: subsequent steps below rely on 'vectors'
              (vectors as Map<string, Float32Array> & { clear?: () => void; set?: (k: string, v: Float32Array) => void }).clear?.();
              for (const [k, v] of refreshed.entries()) (vectors as Map<string, Float32Array> & { set?: (k: string, v: Float32Array) => void }).set?.(k, v);
            }
          }
        } catch {}

        if (vectors.size === 0) {
          setError('No vectors found. Please enable knowledge graph in settings and wait for files to be vectorized.');
          setIsLoading(false);
          return;
        }
      }

      const nodeData = Array.from(vectors.entries()).map(([id, vector]) => ({ id, vector }));

      // Try to reuse cached layout (keyed by workspace + file list)
      const fileKeys = nodeData.map(n => n.id).sort((a, b) => a.localeCompare(b));
      const wsForCache = (mapIdentifier?.workspaceId ?? effectiveWorkspaceId) || '';
      const cacheKey = `mindoodle_kg_layout_v1:${wsForCache}:${fileKeys.join('|')}`;

      let appliedFromCache = false;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { positions: Record<string, { x: number; y: number }>; ts: number };
          if (parsed && parsed.positions) {
            const nodesFromCache: Node2D[] = nodeData.map(d => {
              const pos = parsed.positions[d.id];
              return {
                id: d.id,
                vector: d.vector,
                x: pos?.x ?? deterministicPosition(d.id, CANVAS_WIDTH),
                y: pos?.y ?? deterministicPosition(d.id + ':y', CANVAS_HEIGHT),
                vx: 0,
                vy: 0,
              };
            });
            setNodes(nodesFromCache);
            appliedFromCache = true;
          }
        }
      } catch {}

      if (!appliedFromCache) {
        const layout = new ForceDirectedLayout({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
        layout.setNodes(nodeData);
        const laidOut = layout.getNodes();
        setNodes(laidOut);

        // Save to cache for the next open
        try {
          const positions: Record<string, { x: number; y: number }> = {};
          for (const n of laidOut) positions[n.id] = { x: n.x, y: n.y };
          localStorage.setItem(cacheKey, JSON.stringify({ positions, ts: Date.now() }));
        } catch {}
      }

      setIsLoading(false);
    } catch (err) {
      logger.error('Failed to load and layout:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, [mapIdentifier, effectiveWorkspaceId, getWorkspaceMapIdentifiers, buildVectorKey, deterministicPosition, runInitialVectorization]);

  
  useEffect(() => {
    if (isOpen) {
      if (!hasRunInitialVectorization.current) {
        hasRunInitialVectorization.current = true;
        runInitialVectorization().then(() => {
          loadAndLayout();
        });
      } else {
        loadAndLayout();
      }
    }
  }, [isOpen, runInitialVectorization, loadAndLayout]);

  
  useEffect(() => {
    const currentMapId = mapIdentifier?.mapId;
    if (isOpen && currentMapId && nodes.length > 0) {
      // Try to select current map's node by matching mapId, regardless of namespacing
      const candidate = nodes.find(n => parseVectorKey(n.id).mapId === currentMapId);
      if (candidate) {
        setSelectedNode(candidate.id);
      } else if (nodes.length > 0) {
        setSelectedNode(nodes[0].id);
      }
    }
  }, [isOpen, mapIdentifier, nodes, parseVectorKey]);

  
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    
    for (const node of nodes) {
      const parsed = parseVectorKey(node.id);
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode === node.id;
      const fileName = parsed.mapId.split('/').pop() || parsed.mapId;
      const isCurrent = (mapIdentifier?.mapId && parsed.mapId === mapIdentifier.mapId) || false;

      // ノード円
      ctx.beginPath();
      let nodeRadius = 6;
      if (isHovered) {
        nodeRadius = 12;
      } else if (isSelected || isCurrent) {
        nodeRadius = 10;
      }
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);

      // ノード描画
      if (isHovered) {
        ctx.fillStyle = '#3b82f6';
      } else if (isSelected) {
        ctx.fillStyle = '#8b5cf6'; 
      } else {
        ctx.fillStyle = '#6b7280';
      }
      ctx.fill();

      
      if (isHovered || isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      
      ctx.font = (isHovered || isSelected || isCurrent) ? 'bold 13px sans-serif' : '11px sans-serif';
      const textWidth = ctx.measureText(fileName).width;
      const padding = 4;
      const textHeight = (isHovered || isSelected || isCurrent) ? 18 : 14;

      
      let labelX = node.x;
      let labelY = node.y + nodeRadius + 4; 
      let textAlign: CanvasTextAlign = 'center';
      let textBaseline: CanvasTextBaseline = 'top';

      
      if (labelY + textHeight > canvas.height - 5) {
        labelY = node.y - nodeRadius - 4;
        textBaseline = 'bottom';
      }

      
      const halfWidth = textWidth / 2;
      if (labelX - halfWidth < 5) {
        
        labelX = node.x + nodeRadius + 4;
        textAlign = 'left';
      } else if (labelX + halfWidth > canvas.width - 5) {
        
        labelX = node.x - nodeRadius - 4;
        textAlign = 'right';
      }

      
      if (isHovered) {
        const labelBottom = textBaseline === 'top' ? labelY + textHeight : labelY;
        const labelTop = textBaseline === 'top' ? labelY : labelY - textHeight;

        for (const otherNode of nodes) {
          if (otherNode.id === node.id) continue;

          const distance = Math.sqrt(
            Math.pow(otherNode.x - labelX, 2) +
            Math.pow(otherNode.y - (labelTop + labelBottom) / 2, 2)
          );

          
          if (distance < 30) {
            labelX = node.x + nodeRadius + 8;
            labelY = node.y;
            textAlign = 'left';
            textBaseline = 'middle';

            
            if (labelX + textWidth > canvas.width - 5) {
              labelX = node.x - nodeRadius - 8;
              textAlign = 'right';
            }
            break;
          }
        }
      }

      ctx.textAlign = textAlign;
      ctx.textBaseline = textBaseline;


      if (isHovered && !isCurrent) {
        let bgX;
        if (textAlign === 'left') {
          bgX = labelX - padding;
        } else if (textAlign === 'right') {
          bgX = labelX - textWidth - padding;
        } else {
          bgX = labelX - textWidth / 2 - padding;
        }

        let bgY;
        if (textBaseline === 'top') {
          bgY = labelY - padding;
        } else if (textBaseline === 'bottom') {
          bgY = labelY - textHeight - padding;
        } else {
          bgY = labelY - textHeight / 2 - padding;
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(bgX, bgY, textWidth + padding * 2, textHeight + padding);
      }

      
      if (isCurrent) {
        ctx.fillStyle = '#22c55e'; 
      } else if (isHovered) {
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = '#d1d5db';
      }
      ctx.fillText(fileName, labelX, labelY);
    }
  }, [nodes, hoveredNode, selectedNode, mapIdentifier, parseVectorKey]);

  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    
    const hovered = nodes.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 10;
    });

    setHoveredNode(hovered?.id || null);
  }, [nodes]);

  
  const openMap = useCallback(async (nodeId: string) => {
    try {
      
      const parsed = parseVectorKey(nodeId);
      const mapId = parsed.mapId;
      const ws = (parsed.workspaceId ?? effectiveWorkspaceId ?? mapIdentifier?.workspaceId ?? '');
      // 直接イベントを発火して map 切替（グローバルレジストリ未初期化でも動作）
      window.dispatchEvent(new CustomEvent('mindoodle:selectMapById', {
        detail: { mapId, workspaceId: ws }
      }));

      
      onClose();
    } catch (error) {
      logger.error('Failed to open map:', error);
    }
  }, [onClose, effectiveWorkspaceId, mapIdentifier, parseVectorKey]);

  
  const handleClick = useCallback(() => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
    }
  }, [hoveredNode]);

  
  const handleDoubleClick = useCallback(async () => {
    if (!hoveredNode) return;
    await openMap(hoveredNode);
  }, [hoveredNode, openMap]);

  
  const moveSelection = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!selectedNode || nodes.length === 0) return;

    const currentNode = nodes.find(n => n.id === selectedNode);
    if (!currentNode) return;

    
    let closestNode: Node2D | null = null;
    let minDistance = Infinity;

    for (const node of nodes) {
      if (node.id === selectedNode) continue;

      const dx = node.x - currentNode.x;
      const dy = node.y - currentNode.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      
      let isInDirection = false;
      switch (direction) {
        case 'up':
          isInDirection = dy < -20; 
          break;
        case 'down':
          isInDirection = dy > 20; 
          break;
        case 'left':
          isInDirection = dx < -20; 
          break;
        case 'right':
          isInDirection = dx > 20; 
          break;
      }

      if (isInDirection && distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    }

    if (closestNode) {
      setSelectedNode(closestNode.id);
    }
  }, [selectedNode, nodes]);

  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    // Close on Escape
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      try { (e as KeyboardEvent & { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.(); } catch {}
      onClose();
      return;
    }


    if (e.key === 'Enter' && selectedNode) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      openMap(selectedNode);
      return;
    }


    if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      moveSelection('up');
    } else if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      moveSelection('down');
    } else if (e.key === 'ArrowLeft' || e.key === 'h') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      moveSelection('left');
    } else if (e.key === 'ArrowRight' || e.key === 'l') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      moveSelection('right');
    }
  }, [isOpen, selectedNode, openMap, moveSelection, onClose]);

  
  useEffect(() => {
    if (!isOpen) return;

    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content knowledge-graph-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Knowledge Graph</h2>
          <button
            onClick={onClose}
            className="modal-close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {vectorizationProgress && (
          <div className="knowledge-graph-modal-loading">
            <div>Vectorizing maps...</div>
            <div className="knowledge-graph-progress">
              {vectorizationProgress.current} / {vectorizationProgress.total}
            </div>
          </div>
        )}

        {isLoading && !vectorizationProgress && (
          <div className="knowledge-graph-modal-loading">
            <div>Loading and calculating layout...</div>
          </div>
        )}

        {error && (
          <div className="knowledge-graph-modal-error">
            <div>{error}</div>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="knowledge-graph-canvas"
              onMouseMove={handleMouseMove}
              onClick={handleClick}
              onDoubleClick={handleDoubleClick}
            />

            <div className="knowledge-graph-modal-info">
              {nodes.length} files visualized. Use arrow keys or hjkl to navigate. Press Enter or double-click to open.
            </div>
          </>
        )}

        <div className="modal-footer knowledge-graph-modal-footer">
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>

      <style>{`
        ${combineModalStyles()}

        .knowledge-graph-modal-content {
          padding: 24px;
        }

        .knowledge-graph-modal-loading,
        .knowledge-graph-modal-error {
          width: ${CANVAS_WIDTH}px;
          height: ${CANVAS_HEIGHT}px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }

        .knowledge-graph-modal-error {
          color: #ff6b6b;
          text-align: center;
          padding: 0 40px;
        }

        .knowledge-graph-progress {
          margin-top: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-color);
        }

        .knowledge-graph-canvas {
          border: 1px solid var(--border-color);
          border-radius: 4px;
          cursor: pointer;
          background-color: var(--bg-secondary);
        }

        .knowledge-graph-modal-info {
          margin-top: 12px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .knowledge-graph-modal-footer {
          justify-content: flex-end;
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
};
