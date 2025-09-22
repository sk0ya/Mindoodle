import React, { memo, useCallback, useMemo } from 'react';
import { Link, ExternalLink } from 'lucide-react';
import type { MindMapNode, NodeLink } from '@shared/types';
import { calculateLinkListHeight } from '@shared/utils';
import { extractAllMarkdownLinksDetailed, resolveHrefToMapTarget, resolveAnchorToNode } from '@shared/utils';

interface SelectedNodeLinkListProps {
  node: MindMapNode;
  isVisible: boolean;
  nodeWidth: number;
  nodeHeight: number;
  onLinkClick: (link: NodeLink) => void;
  onLinkDoubleClick?: (link: NodeLink) => void;
  onLinkContextMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onLinkNavigate?: (link: NodeLink) => void;
  // リンク表示用の追加データ
  availableMaps?: { id: string; title: string }[];
  currentMapData?: { id: string; rootNode: any };
}

const SelectedNodeLinkList: React.FC<SelectedNodeLinkListProps> = ({
  node,
  isVisible,
  nodeWidth,
  nodeHeight,
  onLinkClick,
  onLinkDoubleClick,
  onLinkContextMenu,
  onLinkNavigate,
  availableMaps = [],
  currentMapData
}) => {
  const handleLinkClick = useCallback((e: React.MouseEvent, link: NodeLink) => {
    // 右クリックの場合は処理しない
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
      // ダブルクリックでナビゲーション
      onLinkNavigate(link);
    }
  }, [onLinkDoubleClick, onLinkNavigate]);

  const handleLinkContextMenu = useCallback((e: React.MouseEvent, link: NodeLink) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation(); // 他のイベントリスナーも停止
    
    // さらに確実にイベントを停止
    if (e.nativeEvent.stopPropagation) {
      e.nativeEvent.stopPropagation();
    }
    
    onLinkContextMenu(link, { x: e.clientX, y: e.clientY });
  }, [onLinkContextMenu]);

  // 旧ヘルパーは未使用のため削除

  // 旧ノードテキストヘルパーは未使用のため削除

  // Derive links from markdown note; fallback to legacy node.links
  // Build combined list preserving appearance order
  const combined = useMemo(() => {
    const parsed = extractAllMarkdownLinksDetailed(node.note);
    const currentId = currentMapData?.id || '';
    const ids = (availableMaps || []).map(m => m.id);

    const slugify = (t: string) => (t || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    const findByText = (root: any, text: string): MindMapNode | null => {
      if (!root || !text) return null;
      const targetSlug = slugify(text);
      const stack: MindMapNode[] = [root];
      while (stack.length) {
        const n = stack.pop()!;
        if (!n) continue;
        if (n.text === text) return n;
        if (slugify(n.text) === targetSlug) return n;
        if (n.children && n.children.length) stack.push(...n.children);
      }
      return null;
    };

    return parsed.map(p => {
      const href = p.href;
      // Internal anchor forms
      if (/^#/.test(href) || /^node:/i.test(href)) {
        const anchor = /^#/.test(href) ? href.slice(1) : href.replace(/^node:/i, '');
        let nodeId: string | undefined;
        if (currentMapData?.rootNode) {
          const byAnchor = resolveAnchorToNode(currentMapData.rootNode, anchor);
          if (byAnchor) nodeId = byAnchor.id;
          else {
            const n = findByText(currentMapData.rootNode, anchor);
            if (n) nodeId = n.id;
          }
        }
        return { kind: 'internal' as const, index: p.index, label: p.label, anchorText: anchor, nodeId };
      }

      // Map-resolvable relative link
      const target = resolveHrefToMapTarget(href, currentId, ids);
      if (target) {
        return { kind: 'map' as const, index: p.index, label: p.label, mapId: target.mapId, anchorText: target.anchorText, href };
      }

      // Unresolved external
      return { kind: 'external' as const, index: p.index, label: p.label, href };
    });
  }, [node.note, currentMapData?.id, currentMapData?.rootNode, availableMaps]);

  const hasMarkdownLinks = combined.length > 0;

  if (!isVisible || !hasMarkdownLinks) {
    return null;
  }

  // リストの位置計算（ノードのすぐ下に表示）
  const listY = node.y + nodeHeight / 2 + 8; // ノードのすぐ下に表示
  const listX = node.x - nodeWidth / 2; // ノードの左端に合わせる
  const listWidth = Math.max(nodeWidth, 300); // 最小幅300px
  
  // 動的高さ計算（共通ユーティリティを使用）
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

        {/* リンク一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {combined.map((entry: any, idx: number) => {
            const key = entry.kind === 'legacy' ? entry.item.id : `${entry.kind}-${idx}-${entry.index}`;
            const title = entry.kind === 'internal' ? entry.label
              : entry.kind === 'map' ? entry.label
              : entry.kind === 'external' ? entry.label
              : 'リンク';
            const subtitle = entry.kind === 'internal' ? `#${entry.anchorText}`
              : entry.kind === 'map' ? `${entry.mapId}${entry.anchorText ? `#${entry.anchorText}` : ''}`
              : entry.kind === 'external' ? entry.href
              : '';
            
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
                      id: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`,
                      targetNodeId: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    handleLinkClick(e, link);
                  } else if (entry.kind === 'map') {
                    const link: NodeLink = {
                      id: `map|${entry.mapId}|${entry.anchorText || ''}`,
                      targetMapId: entry.mapId,
                      targetNodeId: entry.anchorText ? `text:${entry.anchorText}` : undefined,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
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
                      id: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`,
                      targetNodeId: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    handleLinkDoubleClick(link);
                  } else if (entry.kind === 'map') {
                    const nodeLink: NodeLink = {
                      id: `map|${entry.mapId}|${entry.anchorText || ''}`,
                      targetMapId: entry.mapId,
                      targetNodeId: entry.anchorText ? `text:${entry.anchorText}` : undefined,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    if (onLinkNavigate) onLinkNavigate(nodeLink);
                  } else {
                    // Resolve relative href to known map and jump if possible; otherwise open in new tab
                    const href = entry.href;
                    try {
                      const base = window.location.origin;
                      const url = href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('file:')
                        ? href
                        : new URL(href, base).toString();
                      window.open(url, '_blank', 'noopener,noreferrer');
                    } catch {
                      window.open(href, '_blank', 'noopener,noreferrer');
                    }
                  }
                }}
                onContextMenu={(e) => {
                  if (entry.kind === 'internal') {
                    const link: NodeLink = {
                      id: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`,
                      targetNodeId: entry.nodeId ? entry.nodeId : `text:${entry.anchorText}`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    handleLinkContextMenu(e, link);
                  } else if (entry.kind === 'map') {
                    const link: NodeLink = {
                      id: `map|${entry.mapId}|${entry.anchorText || ''}`,
                      targetMapId: entry.mapId,
                      targetNodeId: entry.anchorText ? `text:${entry.anchorText}` : undefined,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
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

                {/* リンク情報 */}
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

                {/* アクションヒント */}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* ホバー時のアクションヒント表示用CSS */}
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

export default memo(SelectedNodeLinkList);
