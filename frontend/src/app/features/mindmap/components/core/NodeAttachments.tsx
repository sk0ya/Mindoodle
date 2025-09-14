import React, { useCallback, memo, useState, useEffect } from 'react';
import type { MindMapNode, FileAttachment } from '@shared/types';
import { useOptionalAuth } from '../../../../components/auth';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import { loadRootDirectoryHandle, readFileFromRoot } from '../../../../shared/utils/fsa';

interface NodeAttachmentsProps {
  node: MindMapNode;
  svgRef: React.RefObject<SVGSVGElement>;
  zoom: number;
  pan: { x: number; y: number };
  isSelected?: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  onShowImageModal: (file: FileAttachment) => void;
  onShowFileActionMenu: (file: FileAttachment, nodeId: string, position: { x: number; y: number }) => void;
  onUpdateNode?: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onAutoLayout?: () => void;
  nodeHeight: number;
}


// クラウド画像用のコンポーネント
const CloudImage: React.FC<{ 
  file: FileAttachment; 
  style: React.CSSProperties;
  onClick: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onImageInfo?: (info: { width: number; height: number }) => void;
}> = ({ file, style, onClick, onDoubleClick, onContextMenu, onImageInfo }) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // 認証情報を取得 (オプショナル)
  const auth = useOptionalAuth();


  const { data } = useMindMapStore();

  useEffect(() => {
    let cancelled = false;
    let blobUrl: string | null = null;

    const loadImage = async () => {
      if (!file.downloadUrl) {
        if (!cancelled) {
          setError('No download URL available');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError('');

      try {
        // R2ストレージからの画像取得処理
        if (file.downloadUrl.includes('/api/files/')) {
          // 認証ヘッダーを取得
          const headers: Record<string, string> = {};
          
          if (auth?.authAdapter?.getAuthHeaders) {
            const authHeaders = auth.authAdapter.getAuthHeaders();
            Object.assign(headers, authHeaders);
          }
          
          // ダウンロード用URLを構築（R2ストレージから直接取得）
          const downloadUrl = file.downloadUrl.includes('?type=download') 
            ? file.downloadUrl 
            : `${file.downloadUrl}?type=download`;
          
          // R2経由でダウンロードしてBlob URLを作成
          const response = await fetch(downloadUrl, {
            method: 'GET',
            headers,
            mode: 'cors'
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image from R2: ${response.status} ${response.statusText}`);
          }
          
          const blob = await response.blob();
          
          // 画像ファイルかチェック
          if (blob.size === 0) {
            throw new Error('Empty file received from R2 storage');
          }
          
          blobUrl = URL.createObjectURL(blob);
          
          if (!cancelled) {
            setImageUrl(blobUrl);
          }
        } else {
          // ローカルMarkdown相対パス対応 or 直接URL
          const url = file.downloadUrl;
          const isAbsolute = /^(https?:|data:|blob:)/i.test(url) || url.startsWith('/');
          if (!isAbsolute) {
            // Resolve relative to selected markdown root + current map category
            const root = await loadRootDirectoryHandle();
            const category = data?.category || '';
            if (root) {
              const fullPath = (category ? `${category}/${url}` : url).replace(/\/+/g, '/');
              const blob = await readFileFromRoot(root, fullPath);
              if (blob) {
                blobUrl = URL.createObjectURL(blob);
                if (!cancelled) setImageUrl(blobUrl);
              } else if (!cancelled) {
                // fallback: keep original (likely broken) URL to aid debugging
                setImageUrl(url);
              }
            } else if (!cancelled) {
              setImageUrl(url);
            }
          } else {
            if (!cancelled) {
              setImageUrl(url);
            }
          }
        }
        
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    loadImage();

    // クリーンアップ
    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [file.downloadUrl, file.id, auth?.authAdapter?.isAuthenticated, data?.category]);

  if (loading) {
    return (
      <div style={style}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: 'transparent' }}>
          読み込み中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={style}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: 'rgba(255, 238, 238, 0.8)', color: '#c00', fontSize: '12px', textAlign: 'center' }}>
          画像読み込み<br />エラー
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={file.name}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onError={() => {
        setError('Image load failed');
        setLoading(false);
      }}
      onLoad={(e) => {
        setError('');
        const img = e.currentTarget as HTMLImageElement;
        const w = img.naturalWidth || 0;
        const h = img.naturalHeight || 0;
        if (w > 0 && h > 0) {
          onImageInfo?.({ width: w, height: h });
        }
      }}
    />
  );
};


const NodeAttachments: React.FC<NodeAttachmentsProps> = ({
  node,
  svgRef,
  zoom,
  pan,
  isSelected = false,
  onSelectNode,
  onShowImageModal,
  onShowFileActionMenu,
  onUpdateNode,
  onAutoLayout,
  nodeHeight
}) => {  
  // 画像リサイズ状態管理
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [originalAspectRatio, setOriginalAspectRatio] = useState(1);

  // --- Images pipeline (note-embedded first, then attachments) ---
  const extractNoteImages = (note?: string): string[] => {
    if (!note) return [];
    const urls: string[] = [];
    // Combined regex that preserves source order for Markdown and HTML images
    const re = /!\[[^\]]*\]\(\s*([^\s)]+)(?:\s+[^)]*)?\)|<img[^>]*\ssrc=["']([^"'>\s]+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(note)) !== null) {
      const url = m[1] || m[2];
      if (url) urls.push(url);
    }
    return urls;
  };

  const noteImageUrls = extractNoteImages(node.note);
  const noteImageFiles: FileAttachment[] = noteImageUrls.map((u, i) => ({
    id: `noteimg-${node.id}-${i}`,
    name: (u.split('/').pop() || `image-${i}`),
    type: 'image/*',
    size: 0,
    isImage: true,
    createdAt: new Date().toISOString(),
    downloadUrl: u
  }));
  // 添付画像は今後廃止: ノート内の画像のみ扱う
  const imageFiles: FileAttachment[] = noteImageFiles;
  const usingNoteImages = noteImageFiles.length > 0;
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => { setImageIndex(0); }, [node.id]);
  const currentImage: FileAttachment | undefined = imageFiles[imageIndex];

  // ノート内のHTML画像タグからサイズ属性を取得
  const parseNoteImageSize = (note: string | undefined, url: string | undefined): { width: number; height: number } | null => {
    if (!note || !url) return null;
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const imgRe = new RegExp(`<img[^>]*\\ssrc=["']${esc(url)}["'][^>]*>`, 'i');
    const m = note.match(imgRe);
    if (!m) return null;
    const tag = m[0];
    const wMatch = tag.match(/\swidth=["']?(\d+)(?:px)?["']?/i);
    const hMatch = tag.match(/\sheight=["']?(\d+)(?:px)?["']?/i);
    if (!wMatch || !hMatch) return null;
    const w = parseInt(wMatch[1], 10);
    const h = parseInt(hMatch[1], 10);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { width: w, height: h };
    }
    return null;
  };

  // サイズ（カスタムがあれば優先、なければノート内のHTML画像サイズ属性を使用）
  const noteSize = currentImage ? parseNoteImageSize(node.note, currentImage.downloadUrl) : null;
  const imageDimensions = node.customImageWidth && node.customImageHeight
    ? { width: node.customImageWidth, height: node.customImageHeight }
    : noteSize || { width: 150, height: 105 };

  // 決定した画像サイズに基づき、一度だけ自動レイアウトを発火
  const lastLayoutKeyRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!onAutoLayout) return;
    const layoutKey = `${node.id}:${imageDimensions.width}x${imageDimensions.height}:${imageIndex}`;
    if (lastLayoutKeyRef.current === layoutKey) return;
    lastLayoutKeyRef.current = layoutKey;
    // レンダリング直後のフレームでレイアウト
    requestAnimationFrame(() => {
      onAutoLayout();
    });
  }, [onAutoLayout, node.id, imageDimensions.width, imageDimensions.height, imageIndex]);

  // 画像リサイズハンドラー
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    console.log('🎯 リサイズ開始:', { nodeId: node.id, isResizing });
    e.stopPropagation();
    e.preventDefault();
    
    if (!onUpdateNode) {
      console.log('❌ onUpdateNode が未定義');
      return;
    }
    
    if (!svgRef.current) {
      console.log('❌ svgRef が未定義');
      return;
    }
    
    const svgRect = svgRef.current.getBoundingClientRect();
    const currentDimensions = imageDimensions;
    
    console.log('📏 現在の画像サイズ:', currentDimensions);
    
    setIsResizing(true);
    setResizeStartPos({
      x: (e.clientX - svgRect.left) / zoom - pan.x,
      y: (e.clientY - svgRect.top) / zoom - pan.y
    });
    setResizeStartSize({
      width: currentDimensions.width,
      height: currentDimensions.height
    });
    setOriginalAspectRatio(currentDimensions.width / currentDimensions.height);
    
    console.log('✅ リサイズ開始完了');
  }, [node, onUpdateNode, svgRef, zoom, pan, isResizing]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !onUpdateNode || !svgRef.current) return;
    
    const svgRect = svgRef.current.getBoundingClientRect();
    const currentPos = {
      x: (e.clientX - svgRect.left) / zoom - pan.x,
      y: (e.clientY - svgRect.top) / zoom - pan.y
    };
    
    const deltaX = currentPos.x - resizeStartPos.x;
    const deltaY = currentPos.y - resizeStartPos.y;
    
    // 対角線方向の距離を計算
    const diagonal = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const direction = deltaX + deltaY > 0 ? 1 : -1;
    
    // 最小・最大サイズの制限
    const minWidth = 50;
    const maxWidth = 400;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStartSize.width + diagonal * direction));
    const newHeight = newWidth / originalAspectRatio;
    
    onUpdateNode(node.id, {
      customImageWidth: Math.round(newWidth),
      customImageHeight: Math.round(newHeight)
    });
  }, [isResizing, onUpdateNode, svgRef, zoom, pan, resizeStartPos, resizeStartSize, originalAspectRatio, node.id]);

  const updateNoteImageSize = (note: string | undefined, url: string, w: number, h: number): string | undefined => {
    if (!note || !url) return note;
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const width = Math.round(w);
    const height = Math.round(h);
    // 1) 既存の<img>タグがある場合は width/height を更新
    const imgTagRe = new RegExp(`<img([^>]*)\\ssrc=["']${esc(url)}["']([^>]*)>`, 'i');
    if (imgTagRe.test(note)) {
      return note.replace(imgTagRe, (_m, preAttrs: string, postAttrs: string) => {
        const attrs = `${preAttrs} ${postAttrs}`
          .replace(/\swidth=["']?\d+(?:px)?["']?/ig, '')
          .replace(/\sheight=["']?\d+(?:px)?["']?/ig, '')
          .trim();
        return `<img src="${url}" ${attrs ? attrs + ' ' : ''}width="${width}" height="${height}">`;
      });
    }
    // 2) Markdown画像ならHTMLに差し替え
    const mdRe = new RegExp(`!\\[([^\\]]*)\\]\\(\\s*${esc(url)}(?:\\s+[^)]*)?\\)`, '');
    if (mdRe.test(note)) {
      return note.replace(mdRe, (_m, alt: string) => `<img src="${url}" alt="${alt}" width="${width}" height="${height}">`);
    }
    // 3) 見つからない場合は末尾に追加
    return `${note}\n<img src="${url}" width="${width}" height="${height}">`;
  };

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      // ノート画像のサイズ指定を更新（ノート画像が表示されている場合）
      const usingNoteImages = noteImageFiles.length > 0;
      if (usingNoteImages && onUpdateNode && currentImage?.downloadUrl) {
        const newNote = updateNoteImageSize(node.note, currentImage.downloadUrl, imageDimensions.width, imageDimensions.height);
        if (newNote && newNote !== node.note) {
          onUpdateNode(node.id, { note: newNote, customImageWidth: imageDimensions.width, customImageHeight: imageDimensions.height });
        }
      }
      // リサイズ後に自動整列
      if (onAutoLayout) {
        requestAnimationFrame(() => {
          onAutoLayout();
        });
      }
    }
  }, [isResizing, onAutoLayout, onUpdateNode, node.id, node.note, currentImage?.downloadUrl, imageDimensions.width, imageDimensions.height, noteImageFiles.length]);

  // マウスイベントリスナーの管理
  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e: MouseEvent) => handleResizeMove(e);
      const handleMouseUp = () => handleResizeEnd();
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isResizing, handleResizeMove, handleResizeEnd]);
  const handleImageDoubleClick = useCallback((e: React.MouseEvent, file: FileAttachment & { isImage?: boolean }) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowImageModal && file.isImage) {
      onShowImageModal(file);
    }
  }, [onShowImageModal]);

  // 画像クリック時の処理（ノード選択 or メニュー表示）
  const handleImageClick = useCallback((e: React.MouseEvent, file: FileAttachment) => {
    e.stopPropagation();
    e.preventDefault();
    
    // ノードが選択されていない場合は選択する
    if (!isSelected && onSelectNode) {
      onSelectNode(node.id);
      return;
    }
    
    // 既に選択されている場合はファイルアクションメニューを表示
    if (onShowFileActionMenu) {
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;
      
      onShowFileActionMenu(file, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [isSelected, onSelectNode, onShowFileActionMenu, node.id]);

  const handleFileActionMenu = useCallback((e: React.MouseEvent | { stopPropagation: () => void; preventDefault: () => void; clientX: number; clientY: number }, file: FileAttachment) => {
    e.stopPropagation();
    e.preventDefault();
    if (onShowFileActionMenu) {
      // SVGイベントの場合は座標を適切に取得
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;
      
      onShowFileActionMenu(file, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [onShowFileActionMenu, node.id]);

  // duplicate block removed (computed earlier)

  // 画像位置計算を統一（ノード上部に配置、4pxマージン）
  const imageY = node.y - nodeHeight / 2 + 4;
  const imageX = node.x - imageDimensions.width / 2;

  // 画像がない場合は何も描画しない
  if (!currentImage) {
    return <></>;
  }

  // 表示中の画像に合わせてノードの画像サイズを更新
  const handleImageLoadDimensions = useCallback((w: number, h: number) => {
    if (!onUpdateNode) return;
    if (w <= 0 || h <= 0) return;
    // 表示中の画像に合わせて毎回ノードの表示サイズを更新（ノート/添付どちらも）
    const minWidth = 50;
    const maxWidth = 400;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, w));
    const ratio = w > 0 ? h / w : 1;
    const newHeight = Math.max(Math.round(newWidth * ratio), Math.round(minWidth * ratio));
    if (node.customImageWidth !== Math.round(newWidth) || node.customImageHeight !== newHeight) {
      onUpdateNode(node.id, { customImageWidth: Math.round(newWidth), customImageHeight: newHeight });
    }
  }, [node.id, node.customImageWidth, node.customImageHeight, onUpdateNode]);

  // ノート画像の場合、現在の画像のサイズ指定があれば先に反映（ロード完了前にレイアウトを安定させる）
  useEffect(() => {
    if (!onUpdateNode) return;
    if (!usingNoteImages || !currentImage?.downloadUrl) return;
    const sz = parseNoteImageSize(node.note, currentImage.downloadUrl);
    if (sz) {
      const minWidth = 50;
      const maxWidth = 400;
      const w = Math.max(minWidth, Math.min(maxWidth, sz.width));
      const h = Math.round(w * (sz.height / Math.max(1, sz.width)));
      if (node.customImageWidth !== w || node.customImageHeight !== h) {
        onUpdateNode(node.id, { customImageWidth: w, customImageHeight: h });
      }
    }
  }, [usingNoteImages, currentImage?.downloadUrl, node.note, node.id, node.customImageWidth, node.customImageHeight, onUpdateNode]);

  return (
    <>
      {/* ノートまたは添付の画像を表示（切替可能） */}
      <g key={currentImage.id}>
          <foreignObject 
            x={imageX} 
            y={imageY} 
            width={imageDimensions.width} 
            height={imageDimensions.height}
          >
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '6px',
              overflow: 'hidden',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)', // スムーズなサイズ変更アニメーション
              cursor: 'pointer'
            }}
            onClick={(e) => handleImageClick(e as any, currentImage)}
            onDoubleClick={(e) => handleImageDoubleClick(e as any, currentImage)}
            onContextMenu={(e) => handleFileActionMenu(e as any, currentImage)}
            >
              {(() => {
                const url = currentImage.downloadUrl || '';
                const isR2 = !!url && url.includes('/api/files/');
                const isRelative = !!url && !/^(https?:|data:|blob:|\/)/i.test(url);
                return (isR2 || isRelative);
              })() ? (
                <CloudImage
                  file={currentImage}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                    display: 'block',
                    margin: '0 auto'
                  }}
                  onClick={(e) => handleImageClick(e, currentImage)}
                  onDoubleClick={(e) => handleImageDoubleClick(e, currentImage)}
                  onContextMenu={(e) => handleFileActionMenu(e, currentImage)}
                  onImageInfo={({ width, height }) => handleImageLoadDimensions(width, height)}
                />
              ) : (
                <img 
                  src={currentImage.downloadUrl || currentImage.dataURL || currentImage.data} 
                  alt={currentImage.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                    display: 'block',
                    margin: '0 auto'
                  }}
                  onClick={(e) => handleImageClick(e, currentImage)}
                  onDoubleClick={(e) => handleImageDoubleClick(e, currentImage)}
                  onContextMenu={(e) => handleFileActionMenu(e, currentImage)}
                  onError={() => {}}
                  onLoad={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    const w = img.naturalWidth || 0;
                    const h = img.naturalHeight || 0;
                    if (w > 0 && h > 0) {
                      handleImageLoadDimensions(w, h);
                    }
                  }}
                />
              )}

              {/* 画像切替コントロール */}
              {imageFiles.length > 1 && (
                <div style={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', gap: 6 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setImageIndex((prev) => (prev - 1 + imageFiles.length) % imageFiles.length); }}
                    style={{
                      background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12
                    }}
                    title="前の画像"
                  >
                    ‹
                  </button>
                  <div style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>
                    {imageIndex + 1} / {imageFiles.length}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setImageIndex((prev) => (prev + 1) % imageFiles.length); }}
                    style={{
                      background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12
                    }}
                    title="次の画像"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </foreignObject>
          
          {/* 画像選択時の枠線とリサイズハンドル */}
          {isSelected && (
            <g>
              {/* 枠線 */}
              <rect
                x={imageX - 2}
                y={imageY - 2}
                width={imageDimensions.width + 4}
                height={imageDimensions.height + 4}
                fill="none"
                stroke="#bfdbfe"
                strokeWidth="1"
                strokeDasharray="5,3"
                rx="6"
                ry="6"
                style={{
                  pointerEvents: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
                }}
              />
              
              {/* リサイズハンドル（右下） */}
              <g>
                {/* ハンドル背景 */}
                <rect
                  x={imageX + imageDimensions.width - 4}
                  y={imageY + imageDimensions.height - 4}
                  width="8"
                  height="8"
                  fill="white"
                  stroke="#bfdbfe"
                  strokeWidth="1"
                  rx="1"
                  ry="1"
                  style={{
                    cursor: isResizing ? 'nw-resize' : 'se-resize',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseDown={handleResizeStart}
                />
                {/* リサイズハンドルのアイコン（斜め線） */}
                <g stroke="#6b7280" strokeWidth="1" style={{ pointerEvents: 'none' }}>
                  <line
                    x1={imageX + imageDimensions.width - 2}
                    y1={imageY + imageDimensions.height - 2}
                    x2={imageX + imageDimensions.width + 2}
                    y2={imageY + imageDimensions.height - 6}
                  />
                  <line
                    x1={imageX + imageDimensions.width - 1}
                    y1={imageY + imageDimensions.height - 3}
                    x2={imageX + imageDimensions.width + 1}
                    y2={imageY + imageDimensions.height - 5}
                  />
                  <line
                    x1={imageX + imageDimensions.width}
                    y1={imageY + imageDimensions.height - 4}
                    x2={imageX + imageDimensions.width}
                    y2={imageY + imageDimensions.height - 4}
                  />
                </g>
              </g>
            </g>
          )}
        </g>
    </>
  );
};

export default memo(NodeAttachments);
