import React, { memo, useCallback, useMemo } from 'react';
import { Link, ExternalLink, Eye } from 'lucide-react';
import type { MindMapNode, NodeLink } from '@shared/types';
import { calculateLinkListHeight } from '@shared/utils';
import { extractAllMarkdownLinksDetailed, resolveHrefToMapTarget, resolveAnchorToNode } from '../../../markdown';
import { useNotification } from '@shared/hooks';

interface SelectedNodeLinkListProps {
  node: MindMapNode;
  isVisible: boolean;
  nodeWidth: number;
  nodeHeight: number;
  onLinkClick: (link: NodeLink) => void;
  onLinkDoubleClick?: (link: NodeLink) => void;
  onLinkContextMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onLinkNavigate?: (link: NodeLink) => void;
  onPreviewUrl?: (url: string) => void;
  
  availableMaps?: { id: string; title: string }[];
  // Type: Map data with optional root node(s) for link resolution
  currentMapData?: { id: string; rootNode?: MindMapNode; rootNodes?: MindMapNode[]; mapIdentifier?: Record<string, unknown> };
}

type InternalEntry = {
  kind: 'internal';
  index: number;
  label: string;
  anchorText: string;
  nodeId?: string;
};

type MapEntry = {
  kind: 'map';
  index: number;
  label: string;
  mapId: string;
  anchorText?: string;
  href: string;
};

type ExternalEntry = {
  kind: 'external';
  index: number;
  label: string;
  href: string;
};

type CombinedEntry = InternalEntry | MapEntry | ExternalEntry;

const SelectedNodeLinkList: React.FC<SelectedNodeLinkListProps> = ({
  node,
  isVisible,
  nodeWidth,
  nodeHeight,
  onLinkClick,
  onLinkDoubleClick,
  onLinkContextMenu,
  onLinkNavigate,
  onPreviewUrl,
  availableMaps = [],
  currentMapData
}) => {
  const { showNotification } = useNotification();

  const handleLinkClick = useCallback((e: React.MouseEvent, link: NodeLink) => {
    
    if (e.button === 2) {
      return;
    }
    e.stopPropagation();
    onLinkClick(link);
  }, [onLinkClick]);

  const handleLinkDoubleClick = useCallback((link: NodeLink) => {
    if (onLinkDoubleClick) {
      onLinkDoubleClick(link);
    } else if (onLinkNavigate) {
      
      onLinkNavigate(link);
    }
  }, [onLinkDoubleClick, onLinkNavigate]);

  const handleLinkContextMenu = useCallback((e: React.MouseEvent, link: NodeLink) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation(); 
    
    
    if (e.nativeEvent.stopPropagation) {
      e.nativeEvent.stopPropagation();
    }
    
    onLinkContextMenu(link, { x: e.clientX, y: e.clientY });
  }, [onLinkContextMenu]);

  

  

  
  
  const combined: CombinedEntry[] = useMemo(() => {
    const parsed = extractAllMarkdownLinksDetailed(node.note);
    // Type: Extract map ID from map identifier
    const currentId = (currentMapData?.mapIdentifier?.mapId as string) || '';
    const idsSet = new Set<string>((availableMaps || []).map(m => m.id));
    try {
      // Type: Global window extension for ordered maps list
      const windowWithMaps = window as unknown as { mindoodleOrderedMaps?: Array<{ mapId: string }> };
      const ordered = windowWithMaps.mindoodleOrderedMaps;
      if (Array.isArray(ordered)) {
        for (const it of ordered) { if (it?.mapId) idsSet.add(it.mapId); }
      }
    } catch {}
    const ids = Array.from(idsSet);

    // Type: Helper to find node by text in tree
    const findByText = (root: MindMapNode, text: string): MindMapNode | null => {
      if (!root || !text) return null;
      const normalizedTarget = text.trim();
      const stack: MindMapNode[] = [root];
      while (stack.length) {
        const n = stack.pop();
        if (!n) continue;
        const normalizedNode = (n.text || '').trim();
        if (normalizedNode === normalizedTarget) return n;
        if (n.children && n.children.length) stack.push(...n.children);
      }
      return null;
    };

    // Type: Search across multiple root nodes
    const findByTextInRoots = (roots: MindMapNode[], text: string): MindMapNode | null => {
      for (const root of roots) {
        const found = findByText(root, text);
        if (found) return found;
      }
      return null;
    };

    return parsed.map(p => {
      const href = p.href;
      // Internal anchor forms
      if (/^#/.test(href) || /^node:/i.test(href)) {
        const anchor = /^#/.test(href) ? href.slice(1) : href.replace(/^node:/i, '');
        let nodeId: string | undefined;

        // 複数ルートノード対応: rootNodes があればそれを使用、なければ rootNode をフォールバック
        const roots = currentMapData?.rootNodes || (currentMapData?.rootNode ? [currentMapData.rootNode] : []);

        if (roots.length > 0) {
          // 各ルートで resolveAnchorToNode を試行
          for (const root of roots) {
            const byAnchor = resolveAnchorToNode(root, anchor);
            if (byAnchor) {
              nodeId = byAnchor.id;
              break;
            }
          }

          // 見つからなければテキスト検索
          if (!nodeId) {
            const n = findByTextInRoots(roots, anchor);
            if (n) {
              nodeId = n.id;
            }
          }
        }
        return { kind: 'internal' as const, index: p.index, label: p.label, anchorText: anchor, nodeId };
      }

      
      const target = resolveHrefToMapTarget(href, currentId, ids);
      if (target) {
        return { kind: 'map' as const, index: p.index, label: p.label, mapId: target.mapId, anchorText: target.anchorText, href };
      }

      
      return { kind: 'external' as const, index: p.index, label: p.label, href };
    });
  }, [
    node.note,
    currentMapData?.mapIdentifier,
    currentMapData?.rootNode,
    currentMapData?.rootNodes,
    availableMaps
  ]);

  const hasMarkdownLinks = combined.length > 0;

  if (!isVisible || !hasMarkdownLinks) {
    return null;
  }

  
  const listY = node.y + nodeHeight / 2 + 8; 
  const listX = node.x - nodeWidth / 2; 
  const listWidth = Math.max(nodeWidth, 300); 
  
  
  const listHeight = calculateLinkListHeight({ itemCount: combined.length });

  return (
    <foreignObject
      x={listX}
      y={listY}
      width={listWidth}
      height={listHeight}
      style={{ 
        overflow: 'visible',
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #d0d7de',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          padding: '6px',
          maxHeight: '240px',
          overflowY: 'auto',
          fontSize: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 1000
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {combined.map((entry: CombinedEntry, idx: number) => {
            const key = `${entry.kind}-${idx}-${entry.index}`;

            const isPlainUrl = entry.kind === 'external' && entry.label === entry.href;
            let title: string;
            if (entry.kind === 'internal') {
              title = entry.label;
            } else if (entry.kind === 'map') {
              title = entry.label;
            } else if (entry.kind === 'external') {
              title = isPlainUrl ? '🔗 Webページ' : entry.label;
            } else {
              title = 'リンク';
            }

            let subtitle: string;
            if (entry.kind === 'internal') {
              subtitle = `#${entry.anchorText}`;
            } else if (entry.kind === 'map') {
              const anchor = entry.anchorText ? `#${entry.anchorText}` : '';
              subtitle = `${entry.mapId}${anchor}`;
            } else if (entry.kind === 'external') {
              subtitle = entry.href;
            } else {
              subtitle = '';
            }
            
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent'
                }}
                className="link-item"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#e1e4e8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                onClick={(e) => {
                  if (entry.kind === 'internal') {
                    const link: NodeLink = {
                      id: `internal-${entry.index}`,
                      targetNodeId: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`
                    };
                    handleLinkClick(e, link);
                  } else if (entry.kind === 'map') {
                    const link: NodeLink = {
                      id: `map-${entry.index}`,
                      targetMapId: entry.mapId,
                      targetNodeId: entry.anchorText ? `text:${entry.anchorText}` : undefined
                    };
                    handleLinkClick(e, link);
                  } else {
                    // noop on single click
                    e.stopPropagation();
                  }
                }}
                onDoubleClick={() => {
                  if (entry.kind === 'internal') {
                    const link: NodeLink = {
                      id: `internal-${entry.index}`,
                      targetNodeId: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`,
                    };
                    handleLinkDoubleClick(link);
                  } else if (entry.kind === 'map') {
                    const nodeLink: NodeLink = {
                      id: `map-${entry.index}`,
                      targetMapId: entry.mapId,
                      targetNodeId: entry.anchorText ? `text:${entry.anchorText}` : undefined,
                    };
                    if (onLinkNavigate) onLinkNavigate(nodeLink);
                  } else {
                    // Try resolve relative markdown href to a map; else open externally
                    const href = entry.href;
                    try {
                      const ids = (availableMaps || []).map(m => m.id);
                      // Fallback: try from global ordered maps if available
                      if (ids.length === 0) {
                        try {
                          const windowWithMaps = window as unknown as { mindoodleOrderedMaps?: Array<{ mapId: string }> };
                          const ordered = windowWithMaps.mindoodleOrderedMaps;
                          if (Array.isArray(ordered)) {
                            ordered.forEach(it => { if (it?.mapId) ids.push(it.mapId); });
                          }
                        } catch {}
                      }
                      const currentId2 = (currentMapData?.mapIdentifier?.mapId as string) || '';
                      const target = resolveHrefToMapTarget(href, currentId2, ids);
                      if (target && onLinkNavigate) {
                        const nodeLink: NodeLink = {
                          id: `external-${entry.index}`,
                          targetMapId: target.mapId,
                          targetNodeId: target.anchorText ? `text:${target.anchorText}` : undefined,
                        };
                        onLinkNavigate(nodeLink);
                        return;
                      }
                    } catch {}

                    // Not resolvable to any known map: open as external URL
                    if (/^https?:\/\//i.test(href)) {
                      window.open(href, '_blank', 'noopener,noreferrer');
                    } else {
                      showNotification('warning', '対応するマップが見つかりません');
                    }
                  }
                }}
                onContextMenu={(e) => {
                  if (entry.kind === 'internal') {
                    const link: NodeLink = {
                      id: `internal-${entry.index}`,
                      targetNodeId: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`,
                    };
                    handleLinkContextMenu(e, link);
                  } else if (entry.kind === 'map') {
                    const link: NodeLink = {
                      id: `map-${entry.index}`,
                      targetMapId: entry.mapId,
                      targetNodeId: entry.anchorText ? `text:${entry.anchorText}` : undefined,
                    };
                    handleLinkContextMenu(e, link);
                  } else {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                {/* リンクアイコン */}
                <span
                  style={{
                    marginRight: '6px',
                    flexShrink: 0,
                    color: entry.kind === 'external' ? '#7c3aed' : '#0969da',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {entry.kind === 'external' ? <ExternalLink size={12} /> : <Link size={12} />}
                </span>

                {}
                <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: '500',
                      color: '#0969da',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.1'
                    }}
                  >
                    {title}
                  </div>
                  
                  <div
                    style={{
                      fontSize: '9px',
                      color: '#656d76',
                      marginTop: '0px',
                      lineHeight: '1.1',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {subtitle}
                  </div>
                </div>

                {}
                <div
                  style={{
                    fontSize: '9px',
                    color: '#8c959f',
                    marginLeft: '6px',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  className="action-hint"
                >
                  {entry.kind !== 'external' ? '右クリック' : 'ダブルクリック'}
                </div>

                {}
                {entry.kind === 'external' && /^https?:\/\//i.test(entry.href) && onPreviewUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewUrl(entry.href);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      marginLeft: '4px',
                      backgroundColor: 'transparent',
                      border: '1px solid transparent',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#656d76',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                      e.currentTarget.style.borderColor = '#d0d7de';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                    title="プレビュー"
                  >
                    <Eye size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {}
      <style dangerouslySetInnerHTML={{
        __html: `
          .link-item:hover .action-hint {
            opacity: 1 !important;
          }
        `
      }} />
    </foreignObject>
  );
};

// Custom comparison function to prevent unnecessary re-renders
// Only re-render when important props actually change
const arePropsEqual = (prevProps: SelectedNodeLinkListProps, nextProps: SelectedNodeLinkListProps): boolean => {
  // Re-render if node identity or note content changes
  if (prevProps.node.id !== nextProps.node.id) return false;
  if (prevProps.node.note !== nextProps.node.note) return false;

  // Re-render if visibility changes
  if (prevProps.isVisible !== nextProps.isVisible) return false;

  // Re-render if map context changes (for link resolution)
  const prevMapId = prevProps.currentMapData?.mapIdentifier?.mapId;
  const nextMapId = nextProps.currentMapData?.mapIdentifier?.mapId;
  if (prevMapId !== nextMapId) return false;

  // Re-render if root nodes change (for internal link resolution)
  const prevRootsLength = prevProps.currentMapData?.rootNodes?.length || 0;
  const nextRootsLength = nextProps.currentMapData?.rootNodes?.length || 0;
  if (prevRootsLength !== nextRootsLength) return false;

  // Don't re-render for other props (callbacks, dimensions, availableMaps)
  // These change frequently but don't affect the rendered output
  return true;
};

export default memo(SelectedNodeLinkList, arePropsEqual);
