import React, { useRef, useEffect, useCallback, memo } from 'react';
import { Link } from 'lucide-react';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import { calculateIconLayout } from '@shared/utils';
import { extractInternalNodeLinksFromMarkdown, extractExternalLinksFromMarkdown } from '@shared/utils';
import type { MindMapNode, NodeLink } from '@shared/types';

interface NodeEditorProps {
  node: MindMapNode;
  nodeLeftX: number;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  nodeWidth: number;
  imageHeight: number;
  blurTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  isSelected?: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  onToggleAttachmentList?: (nodeId: string) => void;
  onToggleLinkList?: (nodeId: string) => void;
  onLinkNavigate?: (link: NodeLink) => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  nodeLeftX,
  isEditing,
  editText,
  setEditText,
  onFinishEdit,
  nodeWidth,
  imageHeight: _imageHeight,
  blurTimeoutRef,
  isSelected = false,
  onSelectNode,
  onToggleAttachmentList: _onToggleAttachmentList,
  onToggleLinkList,
  onLinkNavigate: _onLinkNavigate
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings, data, ui } = useMindMapStore();

  // リンククリック時の処理
  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // ノードが選択されていない場合は選択してからリンク一覧を表示
    if (!isSelected && onSelectNode) {
      onSelectNode(node.id);
    }

    // リンク一覧をトグル（選択状態に関わらず）
    if (onToggleLinkList) {
      onToggleLinkList(node.id);
    }
  }, [isSelected, onSelectNode, onToggleLinkList, node.id]);

  // マークダウンリンクパターンを検出する関数
  const isMarkdownLink = (text: string): boolean => {
    const markdownLinkPattern = /^\[([^\]]*)\]\(([^)]+)\)$/;
    return markdownLinkPattern.test(text);
  };

  // URLパターンを検出する関数
  const isUrl = (text: string): boolean => {
    const urlPattern = /^https?:\/\/[^\s]+$/;
    return urlPattern.test(text);
  };

  // マークダウンリンクからリンク情報を抽出
  const parseMarkdownLink = (text: string) => {
    const match = text.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
    if (match) {
      return { label: match[1], href: match[2] };
    }
    return null;
  };


  // 編集モードになった時に確実にフォーカスを設定
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // 少し遅延してからフォーカス（DOM更新完了後）
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();

          // 編集モードに応じてカーソル位置を制御
          const editingMode = useMindMapStore.getState().editingMode;
          if (editingMode === 'cursor-at-end') {
            // カーソルを末尾に配置
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
          } else if (editingMode === 'cursor-at-start') {
            // カーソルを先頭に配置
            inputRef.current.setSelectionRange(0, 0);
          } else {
            // デフォルト: 全選択
            inputRef.current.select();
          }
        }
      }, 10);
    }
  }, [isEditing, node.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 編集中の入力フィールドでは、Escapeのみ処理（他はuseKeyboardShortcutsに委任）
    if (e.key === 'Escape') {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      // Use the latest input value, not stale node.text
      onFinishEdit(node.id, editText);
    }
    // Tab/EnterはuseKeyboardShortcutsで統一処理
  }, [node.id, node.text, onFinishEdit, blurTimeoutRef]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // 既存のタイマーをクリア
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    // 最新の入力値を取得
    const currentValue = e.target ? e.target.value : editText;

    // 編集完了処理を実行（余計なフォーカス判定は行わない）
    onFinishEdit(node.id, currentValue);
  }, [node.id, editText, onFinishEdit, blurTimeoutRef]);


  if (!isEditing) {
    // 画像がある場合はテキストをノードの下部に表示
    const noteStr: string = (node as any)?.note || '';
    const noteHasImages = !!noteStr && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr) || /<img[^>]*\ssrc=["'][^"'>\s]+["'][^>]*>/i.test(noteStr) );
    const hasImage = noteHasImages;

    // カスタム画像サイズを考慮し、なければノート内<img>のheight属性を参照
    const getActualImageHeight = () => {
      if (!hasImage) return 0;
      if (node.customImageWidth && node.customImageHeight) {
        return node.customImageHeight;
      }
      if (noteStr) {
        const tagMatch = noteStr.match(/<img[^>]*>/i);
        if (tagMatch) {
          const tag = tagMatch[0];
          const hMatch = tag.match(/\sheight=["']?(\d+)(?:px)?["']?/i);
          if (hMatch) {
            const h = parseInt(hMatch[1], 10);
            if (Number.isFinite(h) && h > 0) return h;
          }
        }
      }
      return 105;
    };

    const actualImageHeight = getActualImageHeight();
    const hasAttachments = false; // attachments removed
    // Derive links from note markdown (fallback to legacy node.links)
    const internalLinks = extractInternalNodeLinksFromMarkdown(node.note, data?.rootNodes?.[0]) || [];
    const externalLinks = extractExternalLinksFromMarkdown(node.note) || [];
    const hasAnyMarkdownLinks = (internalLinks.length + externalLinks.length) > 0;
    const hasLinks = hasAnyMarkdownLinks;
    const textY = hasImage ? node.y + actualImageHeight / 2 + 2 : node.y;

    // アイコンレイアウトを計算してテキスト位置を調整
    const iconLayout = calculateIconLayout(node, nodeWidth);
    // リンクアイコンの分だけテキストを少し左に寄せる（中央基準の見た目ずれ回避）
    const TEXT_ICON_SPACING = 6; // nodeUtilsと整合
    const RIGHT_MARGIN = 2;
    const iconBlockWidth = hasLinks && iconLayout.totalWidth > 0
      ? iconLayout.totalWidth + TEXT_ICON_SPACING + RIGHT_MARGIN
      : 0;
    const textX = node.x - iconBlockWidth / 2;

    // ノードテキストがリンク形式かどうかをチェック
    const isNodeTextMarkdownLink = isMarkdownLink(node.text);
    const isNodeTextUrl = isUrl(node.text);
    const isAnyLink = isNodeTextMarkdownLink || isNodeTextUrl;

    // マークダウンリンクの表示テキストを取得
    const getDisplayText = () => {
      if (isNodeTextMarkdownLink) {
        const linkInfo = parseMarkdownLink(node.text);
        return linkInfo ? linkInfo.label : node.text;
      }
      return node.text;
    };

    const displayText = getDisplayText();

    return (
      <>
        <text
          x={textX}
          y={textY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={settings.theme === 'dark' ? 'var(--text-primary)' : 'black'}
          fontSize={settings.fontSize || node.fontSize || '14px'}
          fontWeight={node.fontWeight || 'normal'}
          fontStyle={node.fontStyle || 'normal'}
          fontFamily={settings.fontFamily || 'system-ui'}
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          <title>{node.text}</title>
          {(() => {
            // マークダウンマーカーを表示
            const markdownMeta = node.markdownMeta;
            if (markdownMeta) {
              let marker = '';
              // typeに基づいてマーカーを決定
              if (markdownMeta.type === 'heading') {
                marker = '#';
              } else if (markdownMeta.type === 'unordered-list') {
                marker = '-';
              } else if (markdownMeta.type === 'ordered-list') {
                marker = '1.';
              }
              // 見出しレベルに応じたスタイリング
              let textStyle: any = {};
              const markerStyle = { fill: "#888", fontWeight: "500" };

              if (markdownMeta.type === 'heading') {
                textStyle = {
                  fontWeight: "600",
                  // リンクの場合のみアンダーライン追加
                  ...(isAnyLink ? {
                    fill: settings.theme === 'dark' ? '#60a5fa' : '#2563eb',
                    textDecoration: 'underline'
                  } : {})
                };
              } else if (markdownMeta.type === 'unordered-list' || markdownMeta.type === 'ordered-list') {
                textStyle = {
                  fontWeight: "400",
                  // リンクの場合のみアンダーライン追加
                  ...(isAnyLink ? {
                    fill: settings.theme === 'dark' ? '#60a5fa' : '#2563eb',
                    textDecoration: 'underline'
                  } : {})
                };
              }

              return (
                <>
                  <tspan {...markerStyle}>{marker}</tspan>
                  <tspan
                    dx="0.3em"
                    {...textStyle}
                  >
                    {displayText}
                  </tspan>
                </>
              );
            }
            // マークダウンマーカーがない場合
            return (
              <tspan
                {...(isAnyLink ? {
                  fill: settings.theme === 'dark' ? '#60a5fa' : '#2563eb',
                  textDecoration: 'underline'
                } : {})}
              >
                {displayText}
              </tspan>
            );
          })()}
        </text>


        {/* アイコン表示エリア（添付ファイルとリンク） */}
        {(() => {
          if (!hasAttachments && !hasLinks) return null;

          return (
            <g>
              {/* 添付ファイルアイコン */}
              {/* attachments removed */}

              {/* リンクアイコン */}
              {hasLinks && iconLayout.linkIcon && (
                <g>
                  {/* 背景バッジ */}
                  <rect
                    x={node.x + iconLayout.linkIcon.x}
                    y={textY + iconLayout.linkIcon.y}
                    width="22"
                    height="14"
                    fill="white"
                    stroke="#ddd"
                    strokeWidth="1"
                    rx="8"
                    ry="8"
                    style={{
                      filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))',
                      cursor: 'pointer'
                    }}
                    onClick={handleLinkClick}
                  />

                  {/* Lucide リンクアイコン */}
                  <foreignObject
                    x={node.x + iconLayout.linkIcon.x + 2}
                    y={textY + iconLayout.linkIcon.y + 2}
                    width="10"
                    height="10"
                    style={{
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                      <Link size={9} />
                    </div>
                  </foreignObject>

                  {/* リンク数 */}
                  <text
                    x={node.x + iconLayout.linkIcon.x + 20}
                    y={textY + iconLayout.linkIcon.y + 10}
                    textAnchor="end"
                    fill="#333"
                    fontSize="10px"
                    fontWeight="600"
                    style={{
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                  >
                    {internalLinks.length + externalLinks.length}
                  </text>
                </g>
              )}
            </g>
          );
        })()}
      </>
    );
  }

  // 編集時も画像がある場合はテキストを下部に配置
  const noteStr2: string = (node as any)?.note || '';
  const noteHasImages2 = !!noteStr2 && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr2) || /<img[^>]*\ssrc=["'][^"'>\s]+["'][^>]*>/i.test(noteStr2) );
  const hasImage = noteHasImages2;

  const getActualImageHeight = () => {
    if (!hasImage) return 0;
    if (node.customImageWidth && node.customImageHeight) {
      return node.customImageHeight;
    }
    if (noteStr2) {
      const tagMatch = noteStr2.match(/<img[^>]*>/i);
      if (tagMatch) {
        const tag = tagMatch[0];
        const hMatch = tag.match(/\sheight=["']?(\d+)(?:px)?["']?/i);
        if (hMatch) {
          const h = parseInt(hMatch[1], 10);
          if (Number.isFinite(h) && h > 0) return h;
        }
      }
    }
    return 105;
  };

  const actualImageHeight = getActualImageHeight();
  const editY = hasImage ? node.y + actualImageHeight / 2 - 10 : node.y - 10;

  // リンクアイコン分のレイアウト調整（非編集時と同等のオフセットを適用）
  const internalLinks2 = extractInternalNodeLinksFromMarkdown(node.note, data?.rootNodes?.[0]) || [];
  const externalLinks2 = extractExternalLinksFromMarkdown(node.note) || [];
  const hasAnyMarkdownLinks2 = (internalLinks2.length + externalLinks2.length) > 0;
  const iconLayout2 = calculateIconLayout(node, nodeWidth);
  const TEXT_ICON_SPACING2 = 6;
  const RIGHT_MARGIN2 = 2;
  const iconBlockWidth2 = hasAnyMarkdownLinks2 && iconLayout2.totalWidth > 0
    ? iconLayout2.totalWidth + TEXT_ICON_SPACING2 + RIGHT_MARGIN2
    : 0;
  // テキスト表示時は中央を左にずらしているため、編集ボックスも同様に左へオフセット
  const rawEditX = (nodeLeftX + 4) - iconBlockWidth2 / 2;
  const rawEditWidth = Math.max(20, (nodeWidth - 8) - iconBlockWidth2);
  // SVGグループにscale(zoom*1.5)がかかっているため、スケール後にピクセル境界へスナップ
  const scale = (ui?.zoom || 1) * 1.5;
  const alignToScale = (v: number) => (scale > 0 ? Math.round(v * scale) / scale : v);
  const editX = alignToScale(rawEditX);
  const editWidth = Math.max(20, alignToScale(rawEditWidth));

  return (
    <foreignObject
      x={editX}
      y={editY}
      width={editWidth}
      height="20"
    >
      <input
        ref={inputRef}
        type="text"
        className="node-input"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid #ccc',
          background: settings.theme === 'dark' ? 'var(--bg-primary)' : 'white',
          // 左端でのグリフの切れ防止のため左寄せ + 余白を少し広くする
          textAlign: 'left',
          fontSize: settings.fontSize || node.fontSize || '14px',
          fontWeight: node.fontWeight || 'normal',
          fontStyle: node.fontStyle || 'normal',
          fontFamily: settings.fontFamily || 'system-ui',
          color: settings.theme === 'dark' ? 'var(--text-primary)' : 'black',
          outline: 'none',
          borderRadius: '4px',
          padding: '0 10px',
          boxSizing: 'border-box'
        }}
      />
    </foreignObject>
  );
};

// リンク判定関数をexport
export const isMarkdownLink = (text: string): boolean => {
  const markdownLinkPattern = /^\[([^\]]*)\]\(([^)]+)\)$/;
  return markdownLinkPattern.test(text);
};

export const isUrl = (text: string): boolean => {
  const urlPattern = /^https?:\/\/[^\s]+$/;
  return urlPattern.test(text);
};

export const parseMarkdownLink = (text: string) => {
  const match = text.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
  if (match) {
    return { label: match[1], href: match[2] };
  }
  return null;
};

export default memo(NodeEditor);
