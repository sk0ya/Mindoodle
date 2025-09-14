import React, { memo, useCallback, useMemo } from 'react';
import { Link, ExternalLink } from 'lucide-react';
import type { MindMapNode, NodeLink } from '@shared/types';
import { calculateLinkListHeight } from '../../../../shared/utils/listHeightUtils';
import { extractInternalMarkdownLinksDetailed, extractExternalLinksFromMarkdown, resolveHrefToMapTarget } from '../../../../shared/utils/markdownLinkUtils';

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

  // リンク情報を取得するヘルパー関数
  const getLinkDisplayInfo = useCallback((link: NodeLink) => {
    if (!link.targetMapId) {
      // 現在のマップ内のリンク
      return {
        mapTitle: '現在のマップ',
        nodeText: link.targetNodeId ? getNodeText(currentMapData?.rootNode, link.targetNodeId) : 'ルートノード'
      };
    } else {
      // 他のマップへのリンク
      const targetMap = availableMaps.find(map => map.id === link.targetMapId);
      const mapTitle = targetMap?.title || 'マップが見つかりません';
      
      // 他のマップのノードテキストも取得できるようになった
      let nodeText = 'ルートノード';
      if (link.targetNodeId) {
        // 現在は他のマップのノードテキスト取得は制限されているので、汎用的な表示
        nodeText = 'リンク先ノード';
      }
      
      return {
        mapTitle,
        nodeText
      };
    }
  }, [availableMaps, currentMapData]);

  // ノードテキストを取得するヘルパー関数
  const getNodeText = (rootNode: any, nodeId: string): string => {
    if (!rootNode) return 'ノードが見つかりません';
    
    const findNode = (node: any): string | null => {
      if (node.id === nodeId) return node.text;
      if (node.children) {
        for (const child of node.children) {
          const result = findNode(child);
          if (result) return result;
        }
      }
      return null;
    };
    
    return findNode(rootNode) || 'ノードが見つかりません';
  };

  // Derive links from markdown note; fallback to legacy node.links
  const internalDetailed = useMemo(() => extractInternalMarkdownLinksDetailed(node.note, currentMapData?.rootNode), [node.note, currentMapData?.rootNode]);
  const externalLinks = useMemo(() => extractExternalLinksFromMarkdown(node.note), [node.note]);
  const resolvedMapLinks = useMemo(() => {
    const currentId = currentMapData?.id || '';
    const ids = (availableMaps || []).map(m => m.id);
    return externalLinks
      .map(ext => {
        const target = resolveHrefToMapTarget(ext.href, currentId, ids);
        if (!target) return null;
        return {
          id: `maplink|${target.mapId}|${target.anchorText || ''}`,
          label: ext.label,
          href: ext.href,
          mapId: target.mapId,
          anchorText: target.anchorText
        };
      })
      .filter(Boolean) as Array<{ id: string; label: string; href: string; mapId: string; anchorText?: string }>
  }, [externalLinks, currentMapData?.id, availableMaps]);

  const unresolvedExternal = useMemo(() => {
    const mapped = new Set(resolvedMapLinks.map(l => l.id));
    return externalLinks.filter(ext => {
      // crude check: if ext resolves to a map it will be in resolvedMapLinks; otherwise keep
      const target = resolveHrefToMapTarget(ext.href, currentMapData?.id || '', (availableMaps || []).map(m => m.id));
      return !target;
    });
  }, [externalLinks, resolvedMapLinks, currentMapData?.id, availableMaps]);

  const hasMarkdownLinks = (internalDetailed.length + resolvedMapLinks.length + unresolvedExternal.length) > 0;
  const links: NodeLink[] = hasMarkdownLinks ? [] : (node.links || []);

  if (!isVisible || (!hasMarkdownLinks && links.length === 0)) {
    return null;
  }

  // リストの位置計算（ノードのすぐ下に表示）
  const listY = node.y + nodeHeight / 2 + 8; // ノードのすぐ下に表示
  const listX = node.x - nodeWidth / 2; // ノードの左端に合わせる
  const listWidth = Math.max(nodeWidth, 300); // 最小幅300px
  
  // 動的高さ計算（共通ユーティリティを使用）
  const listHeight = calculateLinkListHeight({ itemCount: hasMarkdownLinks ? (internalDetailed.length + resolvedMapLinks.length + unresolvedExternal.length) : links.length });

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
          {(hasMarkdownLinks ? [
            ...internalDetailed.map(l => ({ kind: 'internal' as const, item: l })),
            ...resolvedMapLinks.map(m => ({ kind: 'map' as const, item: m })),
            ...unresolvedExternal.map(e => ({ kind: 'external' as const, item: e }))
          ] : links.map(l => ({ kind: 'legacy' as const, item: l }))).map((entry, idx) => {
            const key = entry.kind === 'internal' ? entry.item.id
              : entry.kind === 'map' ? entry.item.id
              : entry.kind === 'external' ? `${entry.item.id}-${idx}`
              : entry.item.id;
            const title = entry.kind === 'internal' ? entry.item.label
              : entry.kind === 'map' ? entry.item.label
              : entry.kind === 'external' ? entry.item.label
              : 'リンク';
            const subtitle = entry.kind === 'internal' ? `#${entry.item.anchorText}`
              : entry.kind === 'map' ? `${entry.item.mapId}${entry.item.anchorText ? `#${entry.item.anchorText}` : ''}`
              : entry.kind === 'external' ? entry.item.href
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
                      id: entry.item.nodeId ? entry.item.nodeId : `text:${entry.item.anchorText}`,
                      targetNodeId: entry.item.nodeId ? entry.item.nodeId : `text:${entry.item.anchorText}`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    handleLinkClick(e, link);
                  } else if (entry.kind === 'map') {
                    const link: NodeLink = {
                      id: entry.item.id,
                      targetMapId: entry.item.mapId,
                      targetNodeId: entry.item.anchorText ? `text:${entry.item.anchorText}` : undefined,
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
                      id: entry.item.nodeId ? entry.item.nodeId : `text:${entry.item.anchorText}`,
                      targetNodeId: entry.item.nodeId ? entry.item.nodeId : `text:${entry.item.anchorText}`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    handleLinkDoubleClick(link);
                  } else if (entry.kind === 'map') {
                    const nodeLink: NodeLink = {
                      id: entry.item.id,
                      targetMapId: entry.item.mapId,
                      targetNodeId: entry.item.anchorText ? `text:${entry.item.anchorText}` : undefined,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    if (onLinkNavigate) onLinkNavigate(nodeLink);
                  } else {
                    // Resolve relative href to known map and jump if possible; otherwise open in new tab
                    const href = entry.item.href;
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
                      id: entry.item.nodeId ? entry.item.nodeId : `text:${entry.item.anchorText}`,
                      targetNodeId: entry.item.nodeId ? entry.item.nodeId : `text:${entry.item.anchorText}`,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    handleLinkContextMenu(e, link);
                  } else if (entry.kind === 'map') {
                    const link: NodeLink = {
                      id: entry.item.id,
                      targetMapId: entry.item.mapId,
                      targetNodeId: entry.item.anchorText ? `text:${entry.item.anchorText}` : undefined,
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
