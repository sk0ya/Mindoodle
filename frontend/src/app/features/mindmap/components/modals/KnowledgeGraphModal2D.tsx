

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { vectorStore } from '@core/services/VectorStore';
import { ForceDirectedLayout, type Node2D } from '../../utils/forceDirectedLayout';
import { embeddingService } from '@core/services/EmbeddingService';
import { nodeToMarkdown } from '@markdown/index';
import type { StorageAdapter } from '@core/types';
import { getCommandRegistry } from '@commands/system/registry';

interface KnowledgeGraphModal2DProps {
  isOpen: boolean;
  onClose: () => void;
  storageAdapter?: StorageAdapter | null;
  currentMapId?: string;
}

export const KnowledgeGraphModal2D: React.FC<KnowledgeGraphModal2DProps> = ({
  isOpen,
  onClose,
  storageAdapter,
  currentMapId,
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

  
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  
  const loadAndLayout = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      
      const vectors = await vectorStore.getAllVectors();

      if (vectors.size === 0) {
        setError('No vectors found. Please enable knowledge graph in settings and wait for files to be vectorized.');
        setIsLoading(false);
        return;
      }

      const nodeData = Array.from(vectors.entries()).map(([id, vector]) => ({
        id,
        vector,
      }));

      
      const layout = new ForceDirectedLayout({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      });

      layout.setNodes(nodeData);
      
      setNodes(layout.getNodes());
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load and layout:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsLoading(false);
    }
  }, []);

  
  const runInitialVectorization = useCallback(async () => {
    if (!storageAdapter) {
      console.warn('No storage adapter available for bulk vectorization');
      return;
    }

    try {
      
      const existingVectors = await vectorStore.getAllVectors();

      
      const allMaps = await storageAdapter.loadAllMaps();

      
      const mapsToVectorize = allMaps.filter(mapData => {
        const filePath = `${mapData.mapIdentifier.mapId}.md`;
        return !existingVectors.has(filePath);
      });

      
      if (mapsToVectorize.length === 0) {
        return;
      }

      setVectorizationProgress({ current: 0, total: mapsToVectorize.length });

      
      for (let i = 0; i < mapsToVectorize.length; i++) {
        const mapData = mapsToVectorize[i];

        if (mapData && mapData.rootNodes) {
          const markdown = mapData.rootNodes.map(node => nodeToMarkdown(node)).join('\n');
          const filePath = `${mapData.mapIdentifier.mapId}.md`;

          try {
            
            const vector = await embeddingService.embed(filePath, markdown);
            await vectorStore.saveVector(filePath, vector);
          } catch (error) {
            console.error(`Failed to vectorize ${filePath}:`, error);
            
          }
        }

        setVectorizationProgress({ current: i + 1, total: mapsToVectorize.length });
      }

      setVectorizationProgress(null);
    } catch (err) {
      console.error('Initial vectorization failed:', err);
      setError(err instanceof Error ? err.message : 'Vectorization failed');
      setVectorizationProgress(null);
    }
  }, [storageAdapter]);

  
  useEffect(() => {
    if (isOpen && storageAdapter) {
      
      if (!hasRunInitialVectorization.current) {
        hasRunInitialVectorization.current = true;
        runInitialVectorization().then(() => {
          loadAndLayout();
        });
      } else {
        loadAndLayout();
      }
    } else if (isOpen) {
      
      loadAndLayout();
    }
  }, [isOpen, loadAndLayout, runInitialVectorization, storageAdapter]);

  
  useEffect(() => {
    if (isOpen && currentMapId && nodes.length > 0) {
      const currentNodeId = `${currentMapId}.md`;
      const nodeExists = nodes.some(n => n.id === currentNodeId);
      if (nodeExists) {
        setSelectedNode(currentNodeId);
      } else if (nodes.length > 0) {
        
        setSelectedNode(nodes[0].id);
      }
    }
  }, [isOpen, currentMapId, nodes]);

  
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    
    for (const node of nodes) {
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode === node.id;
      const fileName = node.id.split('/').pop()?.replace('.md', '') || node.id;
      const mapId = node.id.replace('.md', '');
      const isCurrent = currentMapId && mapId === currentMapId;

      // ノード円
      ctx.beginPath();
      const nodeRadius = isHovered ? 12 : (isSelected || isCurrent) ? 10 : 6;
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
        const bgX = textAlign === 'left' ? labelX - padding :
                    textAlign === 'right' ? labelX - textWidth - padding :
                    labelX - textWidth / 2 - padding;
        const bgY = textBaseline === 'top' ? labelY - padding :
                    textBaseline === 'bottom' ? labelY - textHeight - padding :
                    labelY - textHeight / 2 - padding;

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
  }, [nodes, hoveredNode, selectedNode, currentMapId]);

  
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
      
      const mapId = nodeId.replace('.md', '');

      // コマンドレジストリを使ってマップを切り替え
      const registry = getCommandRegistry();
      // ダミーコンテキスト（switch-mapコマンドは_contextを使用しない）
      const context = {
        selectedNodeId: null,
        editingNodeId: null,
        handlers: {} as any,
      };
      await registry.execute('switch-map', context, { mapId });

      
      onClose();
    } catch (error) {
      console.error('Failed to open map:', error);
    }
  }, [onClose]);

  
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
  }, [isOpen, selectedNode, openMap, moveSelection]);

  
  useEffect(() => {
    if (!isOpen) return;

    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="knowledge-graph-modal-overlay" onClick={onClose}>
      <div className="knowledge-graph-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="knowledge-graph-modal-header">
          <h2 className="knowledge-graph-modal-title">Knowledge Graph</h2>
          <button
            onClick={onClose}
            className="knowledge-graph-modal-close"
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

        <div className="knowledge-graph-modal-footer">
          <button onClick={onClose} className="knowledge-graph-modal-button">
            Close
          </button>
        </div>
      </div>

      <style>{`
        .knowledge-graph-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          backdrop-filter: blur(2px);
        }

        .knowledge-graph-modal-content {
          background-color: var(--bg-primary);
          border-radius: 8px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          max-width: 90vw;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        .knowledge-graph-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .knowledge-graph-modal-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .knowledge-graph-modal-close {
          background: none;
          border: none;
          font-size: 24px;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px 8px;
          line-height: 1;
          transition: color 0.2s;
        }

        .knowledge-graph-modal-close:hover {
          color: var(--text-primary);
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
          display: flex;
          justify-content: flex-end;
          margin-top: 16px;
        }

        .knowledge-graph-modal-button {
          padding: 8px 16px;
          background-color: var(--accent-color);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: opacity 0.2s;
        }

        .knowledge-graph-modal-button:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
};
