import React, { useRef, useEffect, useCallback, memo } from 'react';
import { Link } from 'lucide-react';
import { useMindMapStore } from '../../store';
import { calculateIconLayout, wrapNodeText, resolveNodeTextWrapConfig, getMarkerPrefixTokens, TEXT_ICON_SPACING } from '@mindmap/utils';
import type { WrappedToken } from '@mindmap/utils';
import { extractInternalNodeLinksFromMarkdown, extractExternalLinksFromMarkdown } from '../../../markdown';
import type { MindMapNode } from '@shared/types';

interface NodeEditorProps {
  node: MindMapNode;
  nodeLeftX: number;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  nodeWidth: number;
  blurTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  isSelected?: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  onToggleLinkList?: (nodeId: string) => void;
  onLinkNavigate?: (link: any) => void;
  onStartEdit?: (nodeId: string) => void;
  onMouseDown?: (e: React.MouseEvent) => void; // allow drag start from text
  onDragOver?: (e: React.DragEvent) => void; // drag over text area
  onDrop?: (e: React.DragEvent) => void; // drop on text area
}

const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  nodeLeftX,
  isEditing,
  editText,
  setEditText,
  onFinishEdit,
  nodeWidth,
  blurTimeoutRef,
  isSelected = false,
  onSelectNode,
  onToggleLinkList,
  onLinkNavigate,
  onStartEdit,
  onMouseDown,
  onDragOver,
  onDrop
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ui, settings, data, clearMermaidRelatedCaches } = useMindMapStore();

  // Table nodes render their own content; no text editor overlay
  if (node.kind === 'table') {
    return null;
  }

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

  // Extract mermaid code blocks and clear cache for changed blocks
  const clearMermaidCacheOnChange = useCallback((oldText: string, newText: string) => {
    const extractMermaidBlocks = (text: string): string[] => {
      const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/gi;
      const blocks: string[] = [];
      let match;
      while ((match = mermaidRegex.exec(text)) !== null) {
        blocks.push(match[1].trim());
      }
      return blocks;
    };

    const oldMermaidBlocks = extractMermaidBlocks(oldText);
    const newMermaidBlocks = extractMermaidBlocks(newText);

    // If any mermaid blocks have changed, clear all mermaid-related caches for comprehensive update
    const hasChanges = oldMermaidBlocks.length !== newMermaidBlocks.length ||
      oldMermaidBlocks.some(oldBlock => !newMermaidBlocks.includes(oldBlock)) ||
      newMermaidBlocks.some(newBlock => !oldMermaidBlocks.includes(newBlock));

    if (hasChanges) {
      clearMermaidRelatedCaches();
    }
  }, [clearMermaidRelatedCaches]);

  // Monitor note changes and clear mermaid cache when needed
  const previousNoteRef = useRef<string>((node as any)?.note || '');
  useEffect(() => {
    const currentNote = (node as any)?.note || '';
    const previousNote = previousNoteRef.current;

    if (currentNote !== previousNote) {
      clearMermaidCacheOnChange(previousNote, currentNote);
      previousNoteRef.current = currentNote;
    }
  }, [(node as any)?.note]);

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
      // Clear mermaid cache if text has changed
      clearMermaidCacheOnChange(node.text, editText);
      // Use the latest input value, not stale node.text
      onFinishEdit(node.id, editText);
    }
    // Tab/EnterはuseKeyboardShortcutsで統一処理
  }, [node.id, node.text, editText, onFinishEdit, blurTimeoutRef, clearMermaidCacheOnChange]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // 既存のタイマーをクリア
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    // 最新の入力値を取得
    const currentValue = e.target ? e.target.value : editText;

    // Clear mermaid cache if text has changed
    clearMermaidCacheOnChange(node.text, currentValue);

    // 編集完了処理を実行（余計なフォーカス判定は行わない）
    onFinishEdit(node.id, currentValue);
  }, [node.id, node.text, editText, onFinishEdit, blurTimeoutRef, clearMermaidCacheOnChange]);

  // inputフィールドのマウスダウン・クリックイベント処理
  const handleInputMouseEvents = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    // イベントの上位への伝播を停止（Nodeのクリックイベントを防ぐ）
    e.stopPropagation();
  }, []);


  if (!isEditing) {
    const noteStr: string = (node as any)?.note || '';
    const noteHasImages = !!noteStr && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr) || /<img[^>]*\ssrc=["'][^"'\s>]+["'][^>]*>/i.test(noteStr) );
    const noteHasMermaid = !!noteStr && /```mermaid[\s\S]*?```/i.test(noteStr);
    const hasImage = noteHasImages || noteHasMermaid;

    const getActualImageHeight = () => {
      if (!hasImage) return 0;
      if (node.customImageWidth && node.customImageHeight) {
        return node.customImageHeight;
      }
      if (noteStr && noteHasImages) {
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
    const internalLinks = extractInternalNodeLinksFromMarkdown(node.note, data?.rootNodes?.[0]) || [];
    const externalLinks = extractExternalLinksFromMarkdown(node.note) || [];
    const hasLinks = (internalLinks.length + externalLinks.length) > 0;

    const iconLayout = calculateIconLayout(node, nodeWidth);
    const linkIconPosition = iconLayout.linkIcon;
    const iconBlockWidth = hasLinks && iconLayout.totalWidth > 0
      ? iconLayout.totalWidth + TEXT_ICON_SPACING + 2
      : 0;

    const isCheckboxNode = node.markdownMeta?.isCheckbox;
    const checkboxSize = 16;
    const checkboxMargin = 8;
    const checkboxOffset = isCheckboxNode ? (checkboxSize + checkboxMargin) / 2 : 0;
    const textY = hasImage ? node.y + actualImageHeight / 2 + 2 : node.y;
    const textX = node.x - iconBlockWidth / 2 + checkboxOffset;

    const isNodeTextMarkdownLink = isMarkdownLink(node.text);
    const isNodeTextUrl = isUrl(node.text);
    const isAnyLink = isNodeTextMarkdownLink || isNodeTextUrl;

    const getDisplayText = () => {
      if (isNodeTextMarkdownLink) {
        const linkInfo = parseMarkdownLink(node.text);
        return linkInfo ? linkInfo.label : node.text;
      }
      return node.text;
    };

    const displayText = getDisplayText();
    const fontSize = settings.fontSize || node.fontSize || 14;
    const fontFamily = settings.fontFamily || 'system-ui';
    const fontWeightValue = node.fontWeight || 'normal';
    const fontStyleValue = node.fontStyle || 'normal';
    const wrapConfig = resolveNodeTextWrapConfig(settings, fontSize);
    const wrapEnabled = wrapConfig.enabled !== false;
    const wrapMaxWidth = wrapEnabled ? Math.max(40, wrapConfig.maxWidth) : Number.MAX_SAFE_INTEGER;

    const wrapResult = wrapNodeText(displayText, {
      fontSize,
      fontFamily,
      fontWeight: fontWeightValue,
      fontStyle: fontStyleValue,
      maxWidth: wrapMaxWidth,
      prefixTokens: getMarkerPrefixTokens(node)
    });

    const lineHeight = wrapResult.lineHeight;
    const lines = wrapResult.lines;
    const totalLines = lines.length;
    const firstLineDy = totalLines === 1 ? 0 : -((totalLines - 1) * lineHeight) / 2;

    const handleTextClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isEditing) return;
      if (!isSelected) {
        onSelectNode?.(node.id);
        return;
      }
      if (!isAnyLink) {
        onStartEdit?.(node.id);
      }
    };

    const handleTextDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isAnyLink) {
        if (isNodeTextMarkdownLink) {
          const info = parseMarkdownLink(node.text);
          if (!info) return;
          const href = info.href;
          if (/^#/.test(href) || /^node:/i.test(href)) {
            const anchor = /^#/.test(href) ? href.slice(1) : href.replace(/^node:/i, '');
            if (onLinkNavigate) {
              onLinkNavigate({ id: `text:${anchor}`, targetNodeId: `text:${anchor}` });
            }
            return;
          }
          if (!href.startsWith('http://') && !href.startsWith('https://')) {
            const currentData: any = useMindMapStore.getState().data;
            const currentMapId: string = currentData?.mapIdentifier?.mapId || '';
            const [mapPath, anchor] = href.includes('#') ? href.split('#') : [href, ''];
            const clean = mapPath.replace(/\/$/, '');
            let resolved = clean;
            if (clean.startsWith('../')) {
              resolved = clean.substring(3);
            } else if (clean.startsWith('./')) {
              const dir = currentMapId.includes('/') ? currentMapId.substring(0, currentMapId.lastIndexOf('/')) : '';
              const rel = clean.substring(2);
              resolved = dir ? `${dir}/${rel}` : rel;
            }
            resolved = resolved.replace(/\.md$/i, '');
            if (onLinkNavigate) {
              onLinkNavigate({
                id: `map|${resolved}${anchor ? `#${anchor}` : ''}`,
                targetMapId: resolved,
                ...(anchor ? { targetNodeId: `text:${anchor}` } : {})
              });
            }
            return;
          }
          window.open(href, '_blank', 'noopener,noreferrer');
          return;
        }
        if (isNodeTextUrl) {
          window.open(node.text, '_blank', 'noopener,noreferrer');
          return;
        }
      }
      if (!isSelected) {
        onSelectNode?.(node.id);
      }
      onStartEdit?.(node.id);
    };

    const markerStyle: React.SVGProps<SVGTSpanElement> = { fill: '#888', fontWeight: '500' };
    const linkFill = settings.theme === 'dark' ? '#60a5fa' : '#2563eb';
    const baseLinkStyle: React.SVGProps<SVGTSpanElement> = isAnyLink ? { fill: linkFill, textDecoration: 'underline' } : {};
    const baseTextStyle: React.SVGProps<SVGTSpanElement> = (() => {
      const style: React.SVGProps<SVGTSpanElement> = {};
      if (node.markdownMeta?.type === 'heading') {
        style.fontWeight = '600';
      } else if (node.markdownMeta?.type === 'unordered-list' || node.markdownMeta?.type === 'ordered-list') {
        style.fontWeight = '400';
      }
      return { ...style, ...baseLinkStyle };
    })();

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const renderTokenContent = (token: WrappedToken, lineIndex: number, tokenIndex: number) => {
      const baseProps: React.SVGProps<SVGTSpanElement> = {
        ...(token.isMarker ? markerStyle : baseTextStyle)
      };

      if (token.bold) {
        baseProps.fontWeight = 'bold';
      }
      if (token.italic) {
        baseProps.fontStyle = 'italic';
      }
      if (token.strikethrough) {
        baseProps.textDecoration = baseProps.textDecoration ? `${baseProps.textDecoration} line-through` : 'line-through';
      }

      const keyBase = `token-${lineIndex}-${tokenIndex}`;

      if (token.isMarker) {
        return (
          <tspan
            key={keyBase}
            {...baseProps}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onStartEdit?.(node.id);
            }}
          >
            {token.text}
          </tspan>
        );
      }

      const highlightQuery = ui.searchQuery;
      if (!highlightQuery || !token.text.toLowerCase().includes(highlightQuery.toLowerCase())) {
        return (
          <tspan key={keyBase} {...baseProps} onDoubleClick={handleTextDoubleClick}>
            {token.text}
          </tspan>
        );
      }

      const escapedQuery = escapeRegExp(highlightQuery);
      const regex = new RegExp(`(${escapedQuery})`, 'gi');
      const segments = token.text.split(regex);

      return segments
        .filter(segment => segment.length > 0)
        .map((segment, segmentIndex) => {
          const isMatch = segmentIndex % 2 === 1;
          const segmentProps: React.SVGProps<SVGTSpanElement> = { ...baseProps };
          if (isMatch) {
            segmentProps.fill = '#ff9800';
            segmentProps.fontWeight = 'bold';
          }
          return (
            <tspan
              key={`${keyBase}-seg-${segmentIndex}`}
              {...segmentProps}
              onDoubleClick={handleTextDoubleClick}
            >
              {segment}
            </tspan>
          );
        });
    };

    return (
      <>
        <text
          x={textX}
          y={textY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={settings.theme === 'dark' ? 'var(--text-primary)' : 'black'}
          fontSize={fontSize}
          fontWeight={fontWeightValue}
          fontStyle={fontStyleValue}
          fontFamily={fontFamily}
          xmlSpace="preserve"
          style={{
            pointerEvents: 'auto',
            userSelect: 'none'
          }}
          onMouseDown={(e) => { e.stopPropagation(); onMouseDown?.(e); }}
          onClick={handleTextClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <title>{node.text}</title>
          {lines.map((line, lineIndex) => (
            <tspan
              key={`line-${lineIndex}`}
              x={textX}
              dy={lineIndex === 0 ? firstLineDy : lineHeight}
            >
              {line.tokens.reduce<React.ReactNode[]>((acc, token, tokenIndex) => {
                const rendered = renderTokenContent(token, lineIndex, tokenIndex);
                return acc.concat(rendered);
              }, [])}
            </tspan>
          ))}
        </text>

        {(() => {
          if (!hasLinks || !linkIconPosition) return null;

          return (
            <g>
              <rect
                x={node.x + linkIconPosition.x}
                y={textY + linkIconPosition.y}
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
              <foreignObject
                x={node.x + linkIconPosition.x + 2}
                y={textY + linkIconPosition.y + 2}
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
              <text
                x={node.x + linkIconPosition.x + 20}
                y={textY + linkIconPosition.y + 10}
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
          );
        })()}
      </>
    );
  }

  // 編集時も画像がある場合はテキストを下部に配置
  const noteStr2: string = (node as any)?.note || '';
  const noteHasImages2 = !!noteStr2 && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr2) || /<img[^>]*\ssrc=["'][^"'>\s]+["'][^>]*>/i.test(noteStr2) );
  const noteHasMermaid2 = !!noteStr2 && /```mermaid[\s\S]*?```/i.test(noteStr2);
  const hasImage = noteHasImages2 || noteHasMermaid2;

  const getActualImageHeight = () => {
    if (!hasImage) return 0;
    if (node.customImageWidth && node.customImageHeight) {
      return node.customImageHeight;
    }
    if (noteStr2 && noteHasImages2) {
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

  // 編集時は画像・リンクの有無に関係なく、常にノード中央に配置
  const rawEditWidth = Math.max(20, nodeWidth - 8);
  const rawEditX = nodeLeftX + 4;
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
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="text"
        className="node-input"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        onClick={handleInputMouseEvents}
        onMouseDown={handleInputMouseEvents}
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
