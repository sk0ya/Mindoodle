import React, { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import type { NodeLink, MindMapNode, MindMapData, MapIdentifier } from '@shared/types';
import { DEFAULT_WORKSPACE_ID } from '@shared/types';
import type { ExplorerItem } from '../../../../core/storage/types';
import { computeAnchorForNode } from '../../../../shared/utils/markdownLinkUtils';

interface MapOption {
  mapIdentifier: { mapId: string; workspaceId: string };
  title: string; // baseName only
}

interface NodeOption {
  id: string;
  text: string;
  anchorText: string;
  displayText: string; // 表示用（重複時は -1, -2 を含む）
  mapId?: string;
}

interface NodeLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: MindMapNode;
  link?: NodeLink | null; // 編集時のみ
  onSave: (link: Partial<NodeLink>) => void;
  onDelete?: (linkId: string) => void;
  availableMaps?: MapOption[];
  currentMapData?: MindMapData;
  onLoadMapData?: (mapIdentifier: MapIdentifier) => Promise<MindMapData | null>;
  loadExplorerTree?: () => Promise<ExplorerItem | null>;
  onSaveFileLink?: (href: string, label: string) => void;
}

const NodeLinkModal: React.FC<NodeLinkModalProps> = ({
  isOpen,
  onClose,
  node,
  link,
  onSave,
  onDelete,
  availableMaps = [],
  currentMapData,
  onLoadMapData,
  loadExplorerTree,
  onSaveFileLink
}) => {
  const [mode, setMode] = useState<'markdown' | 'files'>('markdown');
  const [selectedMapId, setSelectedMapId] = useState('');
  const [mapQuery, setMapQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [loadedMapData, setLoadedMapData] = useState<MindMapData | null>(null);
  const [isLoadingMapData, setIsLoadingMapData] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileQuery, setFileQuery] = useState('');
  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  
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
  const filteredMaps = useCallback(() => {
    const q = mapQuery.trim().toLowerCase();
    if (!q) return availableMaps;
    return availableMaps.filter(m =>
      m.mapIdentifier.mapId.toLowerCase().includes(q) || (m.title || '').toLowerCase().includes(q)
    );
  }, [availableMaps, mapQuery]);

  // 編集時は既存データを読み込み
  useEffect(() => {
    if (link) {
      setSelectedMapId(link.targetMapId || '');
      setSelectedNodeId(link.targetNodeId || '');
    } else {
      // 新規作成時はフィールドをクリア
      setSelectedMapId('');
      setSelectedNodeId('');
    }
  }, [link, isOpen]);

  // ファイル一覧の読み込み（モード切替で遅延ロード）
  useEffect(() => {
    if (mode !== 'files' || !loadExplorerTree) return;
    let cancelled = false;
    const run = async () => {
      try {
        setIsLoadingFiles(true);
        const tree = await loadExplorerTree();
        if (cancelled || !tree) { setFileList([]); return; }
        const files: string[] = [];
        const walk = (item: ExplorerItem) => {
          if (item.type === 'file') {
            // マークダウン以外のみ
            if (!item.isMarkdown) files.push(item.path);
          } else if (item.children) {
            item.children.forEach(walk);
          }
        };
        walk(tree);
        setFileList(files.sort((a,b)=>a.localeCompare(b,'ja')));
      } finally {
        if (!cancelled) setIsLoadingFiles(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [mode, loadExplorerTree]);

  // マップが変更された時にノード選択をリセットし、データを読み込み
  useEffect(() => {
    setSelectedNodeId('');
    
    // 他のマップが選択された場合、そのデータを読み込む
    if (selectedMapId && selectedMapId !== currentMapData?.mapIdentifier.mapId && onLoadMapData) {
      setIsLoadingMapData(true);
      onLoadMapData({ mapId: selectedMapId, workspaceId: currentMapData?.mapIdentifier.workspaceId || DEFAULT_WORKSPACE_ID })
        .then(mapData => {
          setLoadedMapData(mapData);
        })
        .catch(error => {
          console.error('マップデータの読み込みに失敗:', error);
          setLoadedMapData(null);
        })
        .finally(() => {
          setIsLoadingMapData(false);
        });
    } else {
      // 現在のマップまたは未選択の場合はクリア
      setLoadedMapData(null);
      setIsLoadingMapData(false);
    }
  }, [selectedMapId, currentMapData?.mapIdentifier.mapId, onLoadMapData]);

  const handleSave = useCallback(() => {
    if (mode === 'markdown') {
      if (!selectedMapId) return; // 必須
      const linkData: Partial<NodeLink> = {
        ...(link?.id && { id: link.id }),
        targetMapId: selectedMapId,
        targetNodeId: selectedNodeId || undefined,
        createdAt: link?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      onSave(linkData);
      onClose();
      return;
    }
    // files mode
    if (!selectedFilePath || !onSaveFileLink) return;
    const label = selectedFilePath.split('/').pop() || selectedFilePath;
    onSaveFileLink(selectedFilePath, label);
    onClose();
  }, [mode, selectedMapId, selectedNodeId, link, onSave, onClose, selectedFilePath, onSaveFileLink]);

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
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="モーダルを閉じる"
          >
<X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="mode-toggle" role="tablist" aria-label="リンク対象の種類">
            <button
              type="button"
              className={`mode-tab ${mode==='markdown'?'active':''}`}
              onClick={() => setMode('markdown')}
            >
              Markdown（マップ）
            </button>
            <button
              type="button"
              className={`mode-tab ${mode==='files'?'active':''}`}
              onClick={() => setMode('files')}
            >
              ファイル
            </button>
          </div>

          {mode === 'markdown' && (
          <div className="form-group">
            <label htmlFor="target-map">リンク先のマップ</label>
            <input
              type="text"
              placeholder="検索（パス/タイトル）"
              value={mapQuery}
              onChange={(e) => setMapQuery(e.target.value)}
              style={{ marginBottom: '8px' }}
            />
            <select
              id="target-map"
              value={selectedMapId}
              onChange={(e) => setSelectedMapId(e.target.value)}
            >
              <option value="">-- マップを選択 --</option>
              {filteredMaps().map((map) => (
                <option key={map.mapIdentifier.mapId} value={map.mapIdentifier.mapId}>
                  {map.mapIdentifier.mapId}
                </option>
              ))}
            </select>
            <small className="field-help">
              パス（フォルダ/ファイル）で表示しています
            </small>
          </div>
          )}

          {mode === 'markdown' && (
          <div className="form-group">
            <label htmlFor="target-node">リンク先のノード</label>
            <select
              id="target-node"
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              disabled={isLoadingMapData || !selectedMapId}
            >
              <option value="">-- ノードを選択 --</option>
              {availableNodes().map((node) => (
                <option key={node.id} value={node.id}>
                  {node.displayText}
                </option>
              ))}
            </select>
            <small className="field-help">
              {!selectedMapId
                ? 'まずマップを選択してください'
                : isLoadingMapData
                ? 'マップデータを読み込み中...'
                : selectedMapId && selectedMapId !== currentMapData?.mapIdentifier.mapId && !loadedMapData
                ? 'マップデータの読み込みに失敗しました'
                : 'リンク先のノードを選択してください'
              }
            </small>
          </div>
          )}

          {mode === 'files' && (
            <>
              <div className="form-group">
                <label>ファイルを選択</label>
                <input
                  type="text"
                  placeholder="検索（パス/ファイル名）"
                  value={fileQuery}
                  onChange={(e) => setFileQuery(e.target.value)}
                  style={{ marginBottom: '8px' }}
                />
                <select
                  value={selectedFilePath}
                  onChange={(e) => setSelectedFilePath(e.target.value)}
                  disabled={isLoadingFiles}
                >
                  <option value="">-- ファイルを選択 --</option>
                  {fileList
                    .filter(p => p.toLowerCase().includes(fileQuery.trim().toLowerCase()))
                    .map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                <small className="field-help">
                  マークダウン以外のファイルのみ表示しています
                </small>
              </div>
            </>
          )}

          <div className="current-node-info">
            <p>
              <strong>現在のノード:</strong> {node.text}
            </p>
          </div>
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
              disabled={mode==='markdown' ? !selectedMapId : !selectedFilePath}
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
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .modal-close:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .modal-body {
          padding: 20px 24px;
        }

        .mode-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .mode-tab {
          padding: 6px 10px;
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 6px;
          cursor: pointer;
        }
        .mode-tab.active {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #fff;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
          font-size: 14px;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
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
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          margin-top: 16px;
        }

        .current-node-info p {
          margin: 0 0 4px 0;
          font-size: 13px;
          color: #374151;
        }

        .current-node-info p:last-child {
          margin-bottom: 0;
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px 20px;
          border-top: 1px solid #e5e7eb;
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
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
          border-color: #2563eb;
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          border-color: #d1d5db;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .btn-danger {
          background: #ef4444;
          border-color: #ef4444;
          color: white;
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
