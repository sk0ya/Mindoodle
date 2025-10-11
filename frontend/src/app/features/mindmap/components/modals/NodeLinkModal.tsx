import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import { type NodeLink, type MindMapNode, type MindMapData, type MapIdentifier, DEFAULT_WORKSPACE_ID } from '@shared/types';
import type { ExplorerItem } from '@core/types';
import { computeAnchorForNode } from '../../../markdown';
import { useLoadingState } from '@/app/shared/hooks';

interface MapOption {
  mapIdentifier: { mapId: string; workspaceId: string };
  title: string; 
}

interface NodeOption {
  id: string;
  text: string;
  anchorText: string;
  displayText: string; 
  mapId?: string;
}

interface NodeLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  link?: NodeLink | null; 
  onSave: (link: Partial<NodeLink>) => void;
  onDelete?: (linkId: string) => void;
  availableMaps?: MapOption[];
  currentMapData?: MindMapData;
  onLoadMapData?: (mapIdentifier: MapIdentifier) => Promise<MindMapData | null>;
  loadExplorerTree?: () => Promise<ExplorerItem | null>;
  currentNodeId?: string | null;
}

const NodeLinkModal: React.FC<NodeLinkModalProps> = ({
  isOpen,
  onClose,
  link,
  onSave,
  onDelete,
  availableMaps: _availableMaps = [],
  currentMapData,
  onLoadMapData,
  loadExplorerTree,
  currentNodeId,
}) => {
  const [selectedMapId, setSelectedMapId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [loadedMapData, setLoadedMapData] = useState<MindMapData | null>(null);
  const { startLoading: startLoadingMapData, stopLoading: stopLoadingMapData } = useLoadingState();
  // Explorer state for markdown selection
  const [explorerTree, setExplorerTree] = useState<ExplorerItem | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [selectedExplorerPath, setSelectedExplorerPath] = useState<string>('');
  const explorerRef = useRef<HTMLDivElement | null>(null);
  const headingsRef = useRef<HTMLDivElement | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  
  // ノード一覧を生成するヘルパー関数
  const flattenNodes = useCallback((rootNode: MindMapNode, mapId?: string): NodeOption[] => {
    const result: NodeOption[] = [];
    
    const traverse = (node: MindMapNode) => {
      const anchor = computeAnchorForNode(rootNode, node.id) || (node.text || '');
      result.push({
        id: node.id,
        text: node.text,
        anchorText: anchor,
        displayText: anchor, // 一覧はアンカー表記（重複時に -1 などが付与）
        mapId
      });
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    
    traverse(rootNode);
    return result;
  }, []);
  
  // 選択されたマップのノード一覧
  const availableNodes = useCallback(() => {
    if (!selectedMapId) {
      // マップが選択されていない場合は空の配列を返す
      return [];
    }
    
    if (selectedMapId === currentMapData?.mapIdentifier.mapId) {
      // 現在のマップが選択された場合
      const nodes: any[] = [];
      if (currentMapData?.rootNodes) {
        currentMapData.rootNodes.forEach(rootNode => {
          nodes.push(...flattenNodes(rootNode, selectedMapId));
        });
      }
      return nodes;
    }
    
    // 他のマップが選択された場合
    if (loadedMapData && loadedMapData.mapIdentifier.mapId === selectedMapId) {
      const nodes: any[] = [];
      if (loadedMapData.rootNodes) {
        loadedMapData.rootNodes.forEach(rootNode => {
          nodes.push(...flattenNodes(rootNode, selectedMapId));
        });
      }
      return nodes;
    }
    
    return [];
  }, [selectedMapId, currentMapData, loadedMapData, flattenNodes]);

  // フォルダ内のファイルも含むマップ一覧を検索して表示（idベースで見えるようにする）
  // const filteredMaps = useCallback(() => {
  //   const q = mapQuery.trim().toLowerCase();
  //   if (!q) return availableMaps;
  //   return availableMaps.filter(m =>
  //     m.mapIdentifier.mapId.toLowerCase().includes(q) || (m.title || '').toLowerCase().includes(q)
  //   );
  // }, [availableMaps, mapQuery]);

  // 編集時は既存データを読み込み
  useEffect(() => {
    if (link) {
      setSelectedMapId(link.targetMapId || '');
      setSelectedNodeId(link.targetNodeId || '');
    } else {
      // 新規作成時はフィールドをクリア
      // デフォルトは現在のマップ/ノードを選択状態に
      setSelectedMapId(currentMapData?.mapIdentifier.mapId || '');
      setSelectedNodeId(currentNodeId || '');
    }
  }, [link, isOpen, currentMapData?.mapIdentifier.mapId, currentNodeId]);

  // Explorer tree load for markdown mode
  useEffect(() => {
    if (!isOpen || !loadExplorerTree) return;
    let cancelled = false;
    const run = async () => {
      const tree = await loadExplorerTree();
      if (cancelled) return;
      setExplorerTree(tree);
    };
    run();
    return () => { cancelled = true; };
  }, [isOpen, loadExplorerTree]);

  const currentWorkspaceId = currentMapData?.mapIdentifier.workspaceId || null;
  const workspaceTree = useMemo(() => {
    if (!explorerTree) return null;
    if (!currentWorkspaceId) return explorerTree; // fallback
    const children = explorerTree.children || [];
    const wsNode = children.find(c => c.path === `/${currentWorkspaceId}` || c.path === currentWorkspaceId);
    return wsNode || null;
  }, [explorerTree, currentWorkspaceId]);

  // Helper: derive mapId/workspace from explorer path
  const toMapIdFromPath = useCallback((p: string): { mapId: string | null; workspaceId: string | null } => {
    if (!p) return { mapId: null, workspaceId: null };
    const isWs = /^\/ws_[^/]+\//.test(p);
    const wsId = isWs ? (p.split('/')[1] || null) : (currentWorkspaceId || null);
    const mapId = p.replace(/^\/ws_[^/]+\//, '').replace(/\.md$/i, '') || null;
    return { mapId, workspaceId: wsId };
  }, [currentWorkspaceId]);

  // Auto-select current map path when opening and expand its ancestor folders
  useEffect(() => {
    if (!workspaceTree) return;
    if (!currentMapData?.mapIdentifier.mapId) return;
    // find markdown file whose mapId matches
    const targetMapId = currentMapData.mapIdentifier.mapId;
    let foundPath: string | null = null;
    const walk = (item: ExplorerItem) => {
      if (foundPath) return;
      if (item.type === 'file' && item.isMarkdown && item.path) {
        const { mapId } = toMapIdFromPath(item.path);
        if (mapId === targetMapId) {
          foundPath = item.path;
          return;
        }
      }
      (item.children || []).forEach(walk);
    };
    walk(workspaceTree);
    const fp: string = String(foundPath || '');
    if (fp) {
      setSelectedExplorerPath(fp);
      const parts = fp.split('/').filter(Boolean);
      const ancestors: string[] = [];
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur += '/' + parts[i];
        ancestors.push(cur);
      }
      setExpandedPaths(prev => {
        const next = { ...prev };
        ancestors.forEach(p => next[p] = true);
        return next;
      });
    }
  }, [workspaceTree, currentMapData?.mapIdentifier.mapId, toMapIdFromPath]);
  

  // マップが変更された時の読み込み（同一マップなら見出し選択は維持する）
  useEffect(() => {
    const currentId = currentMapData?.mapIdentifier.mapId;
    const isDifferentMap = selectedMapId && selectedMapId !== currentId;

    if (!selectedMapId) {
      // 何も選択されていない場合のみ選択解除
      setSelectedNodeId('');
      setLoadedMapData(null);
      stopLoadingMapData();
      return;
    }

    if (isDifferentMap && onLoadMapData) {
      // 他のマップが選択された場合のみノード選択をリセットし、読み込み
      setSelectedNodeId('');
      startLoadingMapData();
      onLoadMapData({ mapId: selectedMapId, workspaceId: currentMapData?.mapIdentifier.workspaceId || DEFAULT_WORKSPACE_ID })
        .then(mapData => {
          setLoadedMapData(mapData);
        })
        .catch(error => {
          console.error('マップデータの読み込みに失敗:', error);
          setLoadedMapData(null);
        })
        .finally(() => {
          stopLoadingMapData();
        });
    } else {
      // 同一マップ選択時はノード選択を維持し、外部ロードはしない
      setLoadedMapData(null);
      stopLoadingMapData();
    }
  }, [selectedMapId, currentMapData?.mapIdentifier.mapId, onLoadMapData]);

  const handleSave = useCallback(() => {
    // Markdown (map) link
    if (selectedMapId) {
      // アンカー情報を計算
      let targetAnchor: string | undefined = undefined;
      if (selectedNodeId) {
        const nodes = availableNodes();
        const selectedNode = nodes.find(n => n.id === selectedNodeId);
        if (selectedNode) {
          targetAnchor = selectedNode.anchorText;
        }
      }
      const linkData: Partial<NodeLink> = {
        ...(link?.id && { id: link.id }),
        targetMapId: selectedMapId,
        targetNodeId: selectedNodeId || undefined,
        targetAnchor,
        createdAt: link?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      onSave(linkData);
      onClose();
      return;
    }

    // Non-Markdown file link (use url)
    if (selectedFilePath) {
      const linkData: Partial<NodeLink> = {
        ...(link?.id && { id: link.id }),
        url: selectedFilePath,
        createdAt: link?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      onSave(linkData);
      onClose();
    }
  }, [selectedMapId, selectedNodeId, selectedFilePath, link, onSave, onClose, availableNodes]);

  const handleDelete = useCallback(() => {
    if (link?.id && onDelete) {
      if (confirm('このリンクを削除しますか？')) {
        onDelete(link.id);
        onClose();
      }
    }
  }, [link, onDelete, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleSave, onClose]);

  if (!isOpen) return null;

  const isSelfLink = useMemo(() => {
    const currMapId = currentMapData?.mapIdentifier.mapId;
    const currNodeId = currentNodeId || '';
    return !!currMapId && selectedMapId === currMapId && (!!currNodeId && selectedNodeId === currNodeId);
  }, [currentMapData?.mapIdentifier.mapId, currentNodeId, selectedMapId, selectedNodeId]);

  const renderExplorer = useCallback((item: ExplorerItem) => {
    const isFolder = item.type === 'folder';
    const isExpanded = !!expandedPaths[item.path];
    const hasChildren = (item.children || []).length > 0;
    const toggle = () => {
      setExpandedPaths(prev => ({ ...prev, [item.path]: !prev[item.path] }));
    };
    const onSelect = () => {
      setSelectedExplorerPath(item.path);
      if (item.type === 'file') {
        if (item.isMarkdown) {
          const { mapId } = toMapIdFromPath(item.path);
          setSelectedMapId(mapId || '');
          // keep current node as default selection when switching to current map
          if (mapId === currentMapData?.mapIdentifier.mapId) {
            setSelectedNodeId(currentNodeId || '');
          } else {
            setSelectedNodeId('');
          }
          setSelectedFilePath('');
        } else {
          // 非Markdownファイルはurlリンク対象
          setSelectedMapId('');
          setSelectedNodeId('');
          setSelectedFilePath(item.path || '');
        }
      }
    };
    return (
      <div key={item.path} data-path={item.path} className={`explorer-item ${selectedExplorerPath === item.path ? 'selected' : ''}`}>
        <div className="explorer-row" onClick={isFolder ? toggle : onSelect}>
          {isFolder && (
            <span className="twisty">{isExpanded ? '▾' : '▸'}</span>
          )}
          {!isFolder && <span className="file-dot">•</span>}
          <span className="name">{item.name}</span>
          {!isFolder && item.isMarkdown && <span className="tag">md</span>}
        </div>
        {isFolder && isExpanded && hasChildren && (
          <div className="explorer-children">
            {(item.children || []).map(ch => renderExplorer(ch))}
          </div>
        )}
      </div>
    );
  }, [expandedPaths, selectedExplorerPath, toMapIdFromPath, currentMapData?.mapIdentifier.mapId, currentNodeId]);

  // Scroll selected explorer item into view
  useEffect(() => {
    const container = explorerRef.current;
    if (!container || !selectedExplorerPath) return;
    const el = container.querySelector(`.explorer-item[data-path="${selectedExplorerPath}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, selectedExplorerPath]);

  
  useEffect(() => {
    if (!isOpen) return;
    if (!selectedMapId) return;
    const nodes = availableNodes();
    if (!nodes || nodes.length === 0) return;
    if (!selectedNodeId) {
      const hasCurrent = currentNodeId && nodes.some(n => n.id === currentNodeId);
      setSelectedNodeId(hasCurrent ? (currentNodeId) : nodes[0].id);
    }
  }, [isOpen, selectedMapId, availableNodes, currentNodeId, selectedNodeId]);

  
  useEffect(() => {
    const container = headingsRef.current;
    if (!container || !selectedNodeId) return;
    const el = container.querySelector(`.heading-item[data-node-id="${selectedNodeId}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, selectedMapId, selectedNodeId]);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2>{link ? 'リンクの編集' : 'リンクの追加'}</h2>
        </div>

        <div className="modal-body">
          {
            <div className="split-container">
              <div className="left-panel">
                <div className="panel-title">ワークスペース</div>
                <div className="explorer" ref={explorerRef}>
                  {workspaceTree ? renderExplorer(workspaceTree) : (
                    <div className="placeholder">エクスプローラーを読み込み中...</div>
                  )}
                </div>
              </div>
              <div className="right-panel">
                {selectedMapId ? (
                  <>
                    <div className="panel-title">見出し</div>
                    <div className="headings" ref={headingsRef}>
                      {availableNodes().map((node) => (
                        <div
                          key={node.id}
                          data-node-id={node.id}
                          className={`heading-item ${selectedNodeId === node.id ? 'active' : ''}`}
                          onClick={() => setSelectedNodeId(node.id)}
                        >
                          {node.displayText}
                        </div>
                      ))}
                      {availableNodes().length === 0 && (
                        <div className="placeholder">見出しが見つかりません</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="placeholder">マークダウン以外は見出しを表示しません（そのまま作成できます）</div>
                )}
              </div>
            </div>
          }

        </div>

        <div className="modal-footer">
          <div className="footer-left">
            {link && onDelete && (
              <button
                className="btn btn-danger"
                onClick={handleDelete}
              >
                削除
              </button>
            )}
          </div>
          <div className="footer-right">
            <button
              className="btn btn-secondary"
              onClick={onClose}
            >
              キャンセル
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={(selectedMapId ? isSelfLink : false) || (!selectedMapId && !selectedFilePath)}
            >
              {link ? '更新' : '作成'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
          box-sizing: border-box;
        }

        .modal-content {
          background: var(--bg-primary);
          color: var(--text-primary);
          border-radius: 10px;
          box-shadow: 0 16px 32px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 860px;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          border: 1px solid var(--border-color);
        }

        .modal-header {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        /* Xボタンは削除 */

        .modal-body {
          padding: 12px 16px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .split-container { display: flex; gap: 8px; height: 400px; }
        .left-panel { flex: 1; min-width: 240px; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; background: var(--bg-primary); }
        .right-panel { flex: 1; min-width: 280px; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; background: var(--bg-primary); }
        .panel-title { padding: 6px 8px; font-size: 12px; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
        .explorer { padding: 4px 6px; overflow: auto; flex: 1; }
        .explorer-item { margin-left: 4px; }
        .explorer-row { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 4px; cursor: pointer; }
        .explorer-item.selected > .explorer-row { background: var(--hover-color); }
        .explorer-row:hover { background: var(--hover-color); }
        .twisty { width: 14px; display: inline-block; color: var(--text-secondary); }
        .file-dot { width: 14px; display: inline-block; color: var(--text-secondary); }
        .name { flex: 1; font-size: 13px; color: var(--text-primary); }
        .tag { font-size: 10px; color: var(--accent-color); background: transparent; border: 1px solid var(--accent-color); padding: 0 4px; border-radius: 3px; }
        .explorer-children { margin-left: 12px; }
        .headings { padding: 4px 6px; overflow: auto; flex: 1; }
        .heading-item { padding: 4px 6px; cursor: pointer; border-bottom: 1px solid var(--border-color); font-size: 13px; color: var(--text-primary); }
        .heading-item:hover { background: var(--hover-color); }
        .heading-item.active { background: var(--hover-color); border-left: 3px solid var(--accent-color); }
        .placeholder { padding: 10px; color: var(--text-secondary); font-size: 13px; }

        .form-group label {
          display: block;
          font-weight: 500;
          color: var(--text-primary);
          margin-bottom: 6px;
          font-size: 14px;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: var(--accent-color);
          box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.2);
        }

        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-group select {
          appearance: none;
          background-image: url('data:image/svg+xml;charset=US-ASCII,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 5"><path fill="%23666" d="m0 0 2 2 2-2z"/></svg>');
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 12px;
          padding-right: 36px;
        }

        .form-group select:disabled {
          background-color: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .field-help {
          display: block;
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
          line-height: 1.4;
        }

        .current-node-info {
          background: var(--bg-secondary);
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-top: 16px;
        }

        .current-node-info p {
          margin: 0 0 4px 0;
          font-size: 13px;
          color: var(--text-primary);
        }

        .current-node-info p:last-child {
          margin-bottom: 0;
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px 20px;
          border-top: 1px solid var(--border-color);
        }

        .footer-left,
        .footer-right {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 8px 16px;
          border: 1px solid;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          outline: none;
        }

        .btn:focus {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .btn-primary {
          background: var(--accent-color);
          border-color: var(--accent-color);
          color: #ffffff;
        }

        .btn-primary:hover:not(:disabled) {
          filter: brightness(1.05);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          border-color: var(--border-color);
          color: var(--text-primary);
        }

        .btn-secondary:hover {
          background: var(--hover-color);
        }

        .btn-danger {
          background: #ef4444;
          border-color: #ef4444;
          color: #ffffff;
        }

        .btn-danger:hover {
          background: #dc2626;
          border-color: #dc2626;
        }
      `}</style>
    </div>
  );
};

export default NodeLinkModal;
