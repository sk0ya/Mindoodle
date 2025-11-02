import type { StateCreator } from 'zustand';
import type { MindMapData, MindMapNode } from '@shared/types';
import { logger, LRUCache } from '@shared/utils';
import { memoryService } from '@/app/core/services';
import { normalizeTreeData, denormalizeTreeData } from '@core/data/normalizedStore';
import { mindMapEvents } from '@core/streams';
import { autoSelectLayout } from '../../utils/autoLayout';
import { findNodeInRoots } from '../../utils/nodeOperations';
import { calculateNodeSize, getNodeTopY, getNodeBottomY, resolveNodeTextWrapConfig } from '../../utils/nodeUtils';
import { mermaidSVGCache } from '../../utils/mermaidCache';
import type { MindMapStore } from './types';


let autoLayoutTimeoutId: NodeJS.Timeout | null = null;
const AUTOLAYOUT_DEBOUNCE_MS = 50;


const nodeSizeCache = new LRUCache<string, { width: number; height: number }>(500, 300000); 
const boundsCache = new LRUCache<string, { minY: number; maxY: number }>(300, 300000); 
const nodeCountCache = new LRUCache<string, number>(200, 600000); 


if (typeof window !== 'undefined') {
  memoryService.createManagedInterval(() => {
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


    if (process.env.NODE_ENV === 'development') {
      const windowWithGc = window as Window & { gc?: () => void };
      if (windowWithGc.gc) {
        windowWithGc.gc();
        logger.debug('🗑️ Manual GC triggered');
      }
    }
  }, 120000, 'DataSlice cache cleanup'); 
}

export interface DataSlice {
  data: MindMapData | null;
  normalizedData: import('@core/data/normalizedStore').NormalizedData | null;
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editText: string;
  editingMode: 'select-all' | 'cursor-at-end' | 'cursor-at-start' | null;
  lastSelectionBeforeInsert?: string | null;

  setData: (data: MindMapData) => void;
  setRootNodes: (rootNodes: MindMapNode[], options?: { emit?: boolean; source?: string; reason?: string }) => void;
  updateMapMetadata?: (updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => void;
  updateNormalizedData: () => void;
  syncToMindMapData: () => void;
  applyAutoLayout: () => void;
  clearMermaidRelatedCaches: () => void;
}

export const createDataSlice: StateCreator<
  MindMapStore,
  [["zustand/immer", never]],
  [],
  DataSlice
> = (set, get) => ({
  
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

    // Clear Mermaid caches when loading a new map to prevent stale diagram rendering
    get().clearMermaidRelatedCaches();
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

    // Clear Mermaid caches when root nodes are replaced to prevent stale diagram rendering
    get().clearMermaidRelatedCaches();

    const shouldEmit = options?.emit !== false;
    if (shouldEmit) {
      try { mindMapEvents.emit({ type: 'model.changed', source: options?.source || 'unknown' }); } catch {}
    }
  },

  
  updateMapMetadata: (updates: Partial<Pick<MindMapData, 'title' | 'category'>>) => {
    set((state) => {
      if (!state.data) return;
      state.data = {
        ...state.data,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    });
    
  },

  
  updateNormalizedData: () => {
    set((state) => {
      if (state.data) {
        state.normalizedData = normalizeTreeData(state.data.rootNodes);
      }
    });
  },

  
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

    
    try {
      mindMapEvents.emit({ type: 'model.changed', source: 'syncToMindMapData' });
    } catch {  }
  },

  applyAutoLayout: (immediate = false) => {
    const executeAutoLayout = () => {
      const state = get();
      const rootNodes = state.data?.rootNodes || [];
      const selectedId = state.selectedNodeId;
      const currentPan = state.ui?.pan || { x: 0, y: 0 };

      logger.debug(immediate ? '⚡ Immediate autoLayout execution started' : '🔄 Debounced autoLayout execution started');

      if (rootNodes.length === 0) {
        logger.warn('⚠️ Auto layout: No root nodes found');
        return;
      }

      if (typeof autoSelectLayout !== 'function') {
        logger.error('❌ Auto layout: autoSelectLayout function not found');
        return;
      }

      try {
        logger.debug('🎯 Applying auto layout to root nodes:', {
          rootNodesCount: rootNodes.length,
          firstNodeId: rootNodes[0]?.id
        });

        const wrapConfig = resolveNodeTextWrapConfig(state.settings, state.settings.fontSize);

        const getNodeSize = (node: MindMapNode): { width: number; height: number } => {
          const nodeWithKind = node as MindMapNode & { kind?: string; tableData?: unknown };
          const nodeKind = nodeWithKind.kind || 'text';
          const textKey = nodeKind === 'table' ? JSON.stringify(nodeWithKind.tableData || {}) : node.text;
          const cacheKey = `${node.id}_${textKey}_${state.settings.fontSize}_${nodeKind}`;
          const cached = nodeSizeCache.get(cacheKey);
          if (cached) {
            return cached;
          }
          const size = calculateNodeSize(node, undefined, false, state.settings.fontSize, wrapConfig);
          nodeSizeCache.set(cacheKey, size);
          return size;
        };

        const getSubtreeBounds = (node: MindMapNode): { minY: number; maxY: number } => {
          const cacheKey = `${node.id}_${node.y || 0}_${node.collapsed || false}`;
          const cached = boundsCache.get(cacheKey);
          if (cached) {
            return cached;
          }

          const nodeSize = getNodeSize(node);
          const nodeWithKind = node as MindMapNode & { kind?: string };
          const outerMarginY = nodeWithKind.kind === 'table' ? 8 : 0;
          const nodeTop = getNodeTopY(node, nodeSize.height) - outerMarginY;
          const nodeBottom = getNodeBottomY(node, nodeSize.height) + outerMarginY;

          let minY = nodeTop;
          let maxY = nodeBottom;

          if (node.children && node.children.length > 0 && !node.collapsed) {
            for (const child of node.children) {
              const bounds = getSubtreeBounds(child);
              minY = Math.min(minY, bounds.minY);
              maxY = Math.max(maxY, bounds.maxY);
            }
          }

          const result = { minY, maxY };
          boundsCache.set(cacheKey, result);
          return result;
        };

        const getNodeCount = (node: MindMapNode): number => {
          const cacheKey = `${node.id}_${node.collapsed || false}`;
          const cached = nodeCountCache.get(cacheKey);
          if (cached !== undefined) {
            return cached;
          }

          let count = 1;
          if (!node.collapsed && node.children && node.children.length > 0) {
            let sum = 0;
            for (const child of node.children) sum += getNodeCount(child);
            count = 1 + sum;
          }

          nodeCountCache.set(cacheKey, count);
          return count;
        };

      const layoutWrapConfig = resolveNodeTextWrapConfig(state.settings, state.settings.fontSize);

      
      const layoutedRootNodes: MindMapNode[] = [];
      let previousSubtreeBottom = 0;

      
      for (let index = 0; index < rootNodes.length; index++) {
        const rootNode = rootNodes[index];
        const settingsWithSpacing = state.settings as typeof state.settings & { nodeSpacing?: number };
        const layoutedNode = autoSelectLayout(rootNode, {
          globalFontSize: state.settings.fontSize,
          nodeSpacing: settingsWithSpacing.nodeSpacing || 8,
          sidebarCollapsed: state.ui.sidebarCollapsed,
          activeView: state.ui.activeView,
          wrapConfig: layoutWrapConfig
        });

        if (!layoutedNode) continue;

        if (index > 0) {

          const previousRoot = layoutedRootNodes[index - 1];
          const previousNodeCount = getNodeCount(previousRoot);
          const currentNodeCount = getNodeCount(layoutedNode);


          const baseSpacing = 8;
          const complexityFactor = Math.min(Math.max(previousNodeCount, currentNodeCount) * 0.5, 16);
          const adaptiveSpacing = baseSpacing + complexityFactor;


          const invalidateAllNodeCaches = (node: MindMapNode) => {
            const nodeWithKind = node as MindMapNode & { kind?: string; tableData?: unknown };
            const nodeKind = nodeWithKind.kind || 'text';
            const textKey = nodeKind === 'table' ? JSON.stringify(nodeWithKind.tableData || {}) : node.text;


            const sizeKey = `${node.id}_${textKey}_${state.settings.fontSize}_${nodeKind}`;
            nodeSizeCache.delete(sizeKey);


            const countKeyCollapsed = `${node.id}_true`;
            const countKeyExpanded = `${node.id}_false`;
            nodeCountCache.delete(countKeyCollapsed);
            nodeCountCache.delete(countKeyExpanded);


            // Delete ALL bounds caches for this node (all Y positions, all collapsed states)
            // Since LRUCache doesn't expose keys(), we use a different approach:
            // Clear the entire bounds cache when invalidating to ensure no stale entries
            // This is acceptable because bounds will be recalculated on demand
            boundsCache.clear();


            if (node.children && !node.collapsed) {
              for (const child of node.children) invalidateAllNodeCaches(child);
            }
          };


          invalidateAllNodeCaches(layoutedNode);


          const currentSubtreeBounds = getSubtreeBounds(layoutedNode);
          const currentSubtreeTop = currentSubtreeBounds.minY;


          const targetTopY = previousSubtreeBottom + adaptiveSpacing;
          const offsetY = targetTopY - currentSubtreeTop;


          const applyOffsetToTree = (node: MindMapNode) => {
            node.y = (node.y || 0) + offsetY;
            if (node.children) {
              for (const child of node.children) applyOffsetToTree(child);
            }
          };
          applyOffsetToTree(layoutedNode);


          invalidateAllNodeCaches(layoutedNode);


          const finalBounds = getSubtreeBounds(layoutedNode);
          previousSubtreeBottom = finalBounds.maxY;
        } else {

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

      // Compensate pan to keep parent node at same screen position after layout
      let compensatedPan: { x: number; y: number } | null = null;
      const lastBeforeInsert = (state as typeof state & { lastSelectionBeforeInsert?: string | null }).lastSelectionBeforeInsert;

      if (lastBeforeInsert && selectedId) {
        // This is the first layout after insertion - compensate once
        // Track the PARENT node to keep it visually stable
        const before = findNodeInRoots(rootNodes, lastBeforeInsert);
        const after = findNodeInRoots(layoutedRootNodes, lastBeforeInsert);

        if (before && after) {
          const dx = (after.x || 0) - (before.x || 0);
          const dy = (after.y || 0) - (before.y || 0);

          // Compensate viewport pan to keep parent at same screen position
          compensatedPan = {
            x: currentPan.x + dx,
            y: currentPan.y + dy
          };
        }
      }

      set((draft) => {
        if (draft.data) {
          draft.data = {
            ...draft.data,
            rootNodes: layoutedRootNodes
          };


          try {
            draft.normalizedData = normalizeTreeData(layoutedRootNodes);
          } catch (normalizeError) {
            logger.error('❌ Auto layout: Failed to normalize data:', normalizeError);
          }
        }

        // Apply one-time pan compensation if calculated
        if (compensatedPan) {
          draft.ui.pan = compensatedPan;
        }

        // Clear the insert anchor after this layout frame
        // This ensures compensation only happens once
        if ('lastSelectionBeforeInsert' in draft) {
          draft.lastSelectionBeforeInsert = null;
        }
      });

      
      try {
        mindMapEvents.emit({ type: 'layout.applied' });
      } catch {  }

        logger.debug('🎉 Auto layout applied successfully');
      } catch (error) {
        logger.error('❌ Auto layout failed:', error);
        logger.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
        logger.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      }
    };

    if (immediate) {
      if (autoLayoutTimeoutId) {
        clearTimeout(autoLayoutTimeoutId);
        autoLayoutTimeoutId = null;
      }
      executeAutoLayout();
    } else {
      if (autoLayoutTimeoutId) {
        clearTimeout(autoLayoutTimeoutId);
      }
      autoLayoutTimeoutId = setTimeout(executeAutoLayout, AUTOLAYOUT_DEBOUNCE_MS);
    }
  },

  clearMermaidRelatedCaches: () => {
    
    if (typeof mermaidSVGCache?.clear === 'function') {
      mermaidSVGCache.clear();
    }

    
    
    nodeSizeCache.clear();

    
    boundsCache.clear();
    nodeCountCache.clear();

    
    set((draft) => {
      draft.ui.lastMermaidCacheCleared = Date.now();
    });

    logger.debug('🧹 Mermaid related caches cleared completely');
  },
});
