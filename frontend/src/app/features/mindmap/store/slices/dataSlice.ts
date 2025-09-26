import type { StateCreator } from 'zustand';
import type { MindMapData, MindMapNode } from '@shared/types';
import { logger, LRUCache, memoryManager } from '@shared/utils';
import { normalizeTreeData, denormalizeTreeData } from '@core/data/normalizedStore';
import { mindMapEvents } from '@core/streams';
import { autoSelectLayout } from '../../utils/autoLayout';
import { calculateNodeSize } from '../../utils/nodeUtils';
import type { MindMapStore } from './types';
import type { DataState } from '@shared/types/nodeTypes';

// Debounce utility for autoLayout
let autoLayoutTimeoutId: NodeJS.Timeout | null = null;
const AUTOLAYOUT_DEBOUNCE_MS = 50;

// Global caches with memory limits to prevent memory leaks
const nodeSizeCache = new LRUCache<string, { width: number; height: number }>(500, 300000); // 500 items, 5min TTL
const boundsCache = new LRUCache<string, { minY: number; maxY: number }>(300, 300000); // 300 items, 5min TTL
const nodeCountCache = new LRUCache<string, number>(200, 600000); // 200 items, 10min TTL

// Periodic cache cleanup using managed timer
if (typeof window !== 'undefined') {
  memoryManager.createManagedInterval(() => {
    const before = {
      nodeSize: nodeSizeCache.size(),
      bounds: boundsCache.size(),
      nodeCount: nodeCountCache.size()
    };

    nodeSizeCache.cleanup();
    boundsCache.cleanup();
    nodeCountCache.cleanup();

    const after = {
      nodeSize: nodeSizeCache.size(),
      bounds: boundsCache.size(),
      nodeCount: nodeCountCache.size()
    };

    const cleaned = {
      nodeSize: before.nodeSize - after.nodeSize,
      bounds: before.bounds - after.bounds,
      nodeCount: before.nodeCount - after.nodeCount
    };

    logger.debug('🧹 Cache cleanup completed', { before, after, cleaned });

    // Force garbage collection in development (if available)
    if (process.env.NODE_ENV === 'development' && (window as any).gc) {
      (window as any).gc();
      logger.debug('🗑️ Manual GC triggered');
    }
  }, 120000, 'DataSlice cache cleanup'); // More frequent: every 2 minutes
}

export interface DataSlice extends DataState {
  setData: (data: MindMapData) => void;
  setRootNodes: (rootNodes: MindMapNode[], options?: { emit?: boolean; source?: string; reason?: string }) => void;
  updateMapMetadata?: (updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => void;
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
  applyAutoLayout: () => void;
}

export const createDataSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  DataSlice
> = (set, get) => ({
  // Initial state
  data: null,
  normalizedData: null,
  selectedNodeId: null,
  editingNodeId: null,
  editText: '',
  editingMode: null,

  // Set data and normalize (no history push here)
  setData: (data: MindMapData) => {
    set((state) => {
      state.data = data;
      // Only use rootNodes array
      state.normalizedData = normalizeTreeData(data.rootNodes);
      // Reset history to empty baseline (no undo available on open)
      state.history = [];
      state.historyIndex = -1;
    });
    console.debug('[data] setData (initial load)', { title: data?.title, roots: data?.rootNodes?.length });
  },

  // Replace the entire rootNodes without resetting history (for Markdown-driven structure updates)
  setRootNodes: (rootNodes: MindMapNode[], options?: { emit?: boolean; source?: string; reason?: string }) => {
    set((state) => {
      if (!state.data) return;
      state.data = {
        ...state.data,
        rootNodes,
        updatedAt: new Date().toISOString(),
      };
      state.normalizedData = normalizeTreeData(rootNodes);
    });
    const shouldEmit = options?.emit !== false;
    console.debug('[data] setRootNodes', { emit: shouldEmit, source: options?.source, reason: options?.reason, count: rootNodes?.length });
    if (shouldEmit) {
      try { mindMapEvents.emit({ type: 'model.changed', source: options?.source || 'unknown' }); } catch {}
    }
  },

  // Update high-level map metadata (title/category) without touching history
  updateMapMetadata: (updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => {
    set((state) => {
      if (!state.data) return;
      state.data = {
        ...state.data,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    });
    // Intentionally no history event; metadata is not part of node undo/redo
    try { console.debug('[data] updateMapMetadata', { updates }); } catch {}
  },

  // Update normalized data from current tree
  updateNormalizedData: () => {
    set((state) => {
      if (state.data) {
        state.normalizedData = normalizeTreeData(state.data.rootNodes);
      }
    });
  },

  // Sync normalized data back to tree structure (no history push here)
  syncToMindMapData: () => {
    set((state) => {
      if (state.normalizedData && state.data) {
        const newRootNodes = denormalizeTreeData(state.normalizedData);
        const newData = {
          ...state.data,
          rootNodes: newRootNodes,
          updatedAt: new Date().toISOString()
        };
        state.data = newData;
      }
    });

    // Emit a model changed event so subscribers can commit snapshots
    try {
      console.debug('[data] syncToMindMapData -> emit model.changed');
      mindMapEvents.emit({ type: 'model.changed', source: 'syncToMindMapData' });
    } catch { /* noop */ }
  },

  applyAutoLayout: () => {
    // Clear any existing timeout to debounce rapid successive calls
    if (autoLayoutTimeoutId) {
      clearTimeout(autoLayoutTimeoutId);
    }

    autoLayoutTimeoutId = setTimeout(() => {
      const state = get();
      const rootNodes = state.data?.rootNodes || [];

      logger.debug('🔄 Debounced autoLayout execution started');
    
    if (rootNodes.length === 0) {
      logger.warn('⚠️ Auto layout: No root nodes found');
      return;
    }
    
    // Validate autoSelectLayout function exists
    if (typeof autoSelectLayout !== 'function') {
      logger.error('❌ Auto layout: autoSelectLayout function not found');
      return;
    }
    
    try {
      logger.debug('🎯 Applying auto layout to root nodes:', {
        rootNodesCount: rootNodes.length,
        firstNodeId: rootNodes[0]?.id
      });
      
      // Memoized node size calculation using global cache
      const getNodeSize = (node: MindMapNode): { width: number; height: number } => {
        const cacheKey = `${node.id}_${node.text}_${state.settings.fontSize}`;
        const cached = nodeSizeCache.get(cacheKey);
        if (cached) {
          return cached;
        }
        const size = calculateNodeSize(node, undefined, false, state.settings.fontSize);
        nodeSizeCache.set(cacheKey, size);
        return size;
      };

      // Optimized subtree bounds calculation using global cache
      const getSubtreeBounds = (node: MindMapNode): { minY: number; maxY: number } => {
        // Create cache key based on node id and position (to invalidate on position changes)
        const cacheKey = `${node.id}_${node.y || 0}`;

        const cached = boundsCache.get(cacheKey);
        if (cached) {
          return cached;
        }

        const nodeY = node.y || 0;
        const nodeSize = getNodeSize(node);
        const outerMarginY = (node as any)?.kind === 'table' ? 8 : 0;
        const nodeTop = nodeY - nodeSize.height / 2 - outerMarginY;
        const nodeBottom = nodeY + nodeSize.height / 2 + outerMarginY;

        let minY = nodeTop;
        let maxY = nodeBottom;

        if (node.children && node.children.length > 0) {
          // Use parallel processing for children bounds calculation
          const childBounds = node.children.map(child => getSubtreeBounds(child));
          for (const bounds of childBounds) {
            minY = Math.min(minY, bounds.minY);
            maxY = Math.max(maxY, bounds.maxY);
          }
        }

        const result = { minY, maxY };
        boundsCache.set(cacheKey, result);
        return result;
      };

      // Memoized node count calculation using global cache
      const getNodeCount = (node: MindMapNode): number => {
        const cached = nodeCountCache.get(node.id);
        if (cached !== undefined) {
          return cached;
        }
        
        const count = !node.children || node.children.length === 0 
          ? 1 
          : 1 + node.children.reduce((sum, child) => sum + getNodeCount(child), 0);
        
        nodeCountCache.set(node.id, count);
        return count;
      };

      // Apply layout to each root node separately
      const layoutedRootNodes: MindMapNode[] = [];
      let previousSubtreeBottom = 0;

      // Process root nodes sequentially but cache results
      for (let index = 0; index < rootNodes.length; index++) {
        const rootNode = rootNodes[index];
        const layoutedNode = autoSelectLayout(rootNode, {
          globalFontSize: state.settings.fontSize,
          sidebarCollapsed: state.ui.sidebarCollapsed,
          activeView: state.ui.activeView
        });

        if (!layoutedNode) continue;

        if (index > 0) {
          // Calculate current subtree bounds
          const currentSubtreeBounds = getSubtreeBounds(layoutedNode);
          const currentSubtreeTop = currentSubtreeBounds.minY;

          // Calculate adaptive spacing with cached node counts
          const previousRoot = layoutedRootNodes[index - 1];
          const previousNodeCount = getNodeCount(previousRoot);
          const currentNodeCount = getNodeCount(layoutedNode);

          // Optimized spacing calculation
          const baseSpacing = 8;
          const complexityFactor = Math.min(Math.max(previousNodeCount, currentNodeCount) * 0.5, 16);
          const adaptiveSpacing = baseSpacing + complexityFactor;

          // Calculate and apply offset
          const targetTopY = previousSubtreeBottom + adaptiveSpacing;
          const offsetY = targetTopY - currentSubtreeTop;

          // Optimized offset application using iteration instead of recursion
          const nodesToProcess = [layoutedNode];
          while (nodesToProcess.length > 0) {
            const currentNode = nodesToProcess.pop()!;
            currentNode.y = (currentNode.y || 0) + offsetY;
            
            if (currentNode.children) {
              nodesToProcess.push(...currentNode.children);
            }
          }

          // Clear cache for modified nodes to force recalculation
          boundsCache.clear();
          
          // Calculate final bottom position
          const finalBounds = getSubtreeBounds(layoutedNode);
          previousSubtreeBottom = finalBounds.maxY;
        } else {
          // First root node
          const bounds = getSubtreeBounds(layoutedNode);
          previousSubtreeBottom = bounds.maxY;
        }

        layoutedRootNodes.push(layoutedNode);
      }
      
      if (layoutedRootNodes.some(node => !node)) {
        logger.error('❌ Auto layout: One or more layouted nodes are null or undefined');
        return;
      }
      
      logger.debug('✅ Auto layout result:', {
        layoutedNodesCount: layoutedRootNodes.length
      });
      
      // Optimized state update using requestAnimationFrame for smoother UI (no history push)
      requestAnimationFrame(() => {
        set((draft) => {
          if (draft.data) {
            draft.data = {
              ...draft.data,
              rootNodes: layoutedRootNodes
            };
            
            // Update normalized data
            try {
              draft.normalizedData = normalizeTreeData(layoutedRootNodes);
            } catch (normalizeError) {
              logger.error('❌ Auto layout: Failed to normalize data:', normalizeError);
            }
          }
        });

        // Emit layout event; history subscriber will capture snapshot
        try {
          mindMapEvents.emit({ type: 'layout.applied' });
        } catch { /* noop */ }
      });
      
      logger.debug('🎉 Auto layout applied successfully');
    } catch (error) {
      logger.error('❌ Auto layout failed:', error);
      logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    }
    }, AUTOLAYOUT_DEBOUNCE_MS);
  },
});
