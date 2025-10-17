import React, { useRef, useEffect, useCallback, memo } from 'react';
import { Link } from 'lucide-react';
import { useMindMapStore } from '../../store';
import { calculateIconLayout, wrapNodeText, resolveNodeTextWrapConfig, getMarkerPrefixTokens, TEXT_ICON_SPACING, type WrappedToken } from '@mindmap/utils';
import { extractAllMarkdownLinksDetailed } from '../../../markdown';
import type { MindMapNode, NodeLink } from '@shared/types';

// Shared helpers (exported for reuse and to avoid duplicates)
export const isMarkdownLink = (text: string): boolean => {
  const markdownLinkPattern = /^\[([^\]]*)\]\(([^)]+)\)$/;
  return markdownLinkPattern.test(text);
};

export const isUrl = (text: string): boolean => {
  const urlPattern = /^https?:\/\/[^\s]+$/;
  return urlPattern.test(text);
};

export const parseMarkdownLink = (text: string) => {
  const re = /^\[([^\]]*)\]\(([^)]+)\)$/;
  const m = re.exec(text);
  if (m) {
    return { label: m[1], href: m[2] };
  }
  return null;
};

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
  onLinkNavigate?: (link: NodeLink) => void;
  onStartEdit?: (nodeId: string) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onRightClick?: (e: React.MouseEvent) => void;
  onEditHeightChange?: (height: number) => void;
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
  onDrop,
  onRightClick,
  onEditHeightChange
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { ui, settings, clearMermaidRelatedCaches } = useMindMapStore();

  // Note: avoid early return before hooks; render-time conditions are used instead
  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    
    if (!isSelected && onSelectNode) {
      onSelectNode(node.id);
    }

    
    if (onToggleLinkList) {
      onToggleLinkList(node.id);
    }
  }, [isSelected, onSelectNode, onToggleLinkList, node.id]);

  
  const clearMermaidCacheOnChange = useCallback((oldText: string, newText: string) => {
    const extractMermaidBlocks = (text: string): string[] => {
      const blocks: string[] = [];
      let pos = 0;
      const fence = '```';
      const marker = '```mermaid';
      while (pos < text.length) {
        const start = text.indexOf(marker, pos);
        if (start === -1) break;
        // content starts after the first newline following marker (if any)
        let contentStart = start + marker.length;
        while (contentStart < text.length && (text[contentStart] === ' ' || text[contentStart] === '\t')) contentStart++;
        if (text[contentStart] === '\r' && text[contentStart + 1] === '\n') contentStart += 2;
        else if (text[contentStart] === '\n' || text[contentStart] === '\r') contentStart += 1;

        const end = text.indexOf(fence, contentStart);
        if (end === -1) break;
        blocks.push(text.slice(contentStart, end).trim());
        pos = end + fence.length;
      }
      return blocks;
    };

    const oldMermaidBlocks = extractMermaidBlocks(oldText);
    const newMermaidBlocks = extractMermaidBlocks(newText);

    
    const hasChanges = oldMermaidBlocks.length !== newMermaidBlocks.length ||
      oldMermaidBlocks.some(oldBlock => !newMermaidBlocks.includes(oldBlock)) ||
      newMermaidBlocks.some(newBlock => !oldMermaidBlocks.includes(newBlock));

    if (hasChanges) {
      clearMermaidRelatedCaches();
    }
  }, [clearMermaidRelatedCaches]);


  const previousNoteRef = useRef<string>((node as MindMapNode & { note?: string })?.note || '');
  const nodeNote = (node as MindMapNode & { note?: string })?.note || '';

  useEffect(() => {
    const previousNote = previousNoteRef.current;

    if (nodeNote !== previousNote) {
      clearMermaidCacheOnChange(previousNote, nodeNote);
      previousNoteRef.current = nodeNote;
    }
  }, [nodeNote, clearMermaidCacheOnChange]);

  
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
            
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
          } else if (editingMode === 'cursor-at-start') {
            
            inputRef.current.setSelectionRange(0, 0);
          } else {
            
            inputRef.current.select();
          }
        }
      }, 10);
    }
  }, [isEditing, node.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    
    if (e.key === 'Escape') {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      
      clearMermaidCacheOnChange(node.text, editText);
      
      onFinishEdit(node.id, editText);
    }
    
  }, [node.id, node.text, editText, onFinishEdit, blurTimeoutRef, clearMermaidCacheOnChange]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    
    const currentValue = e.target ? e.target.value : editText;

    
    clearMermaidCacheOnChange(node.text, currentValue);

    
    onFinishEdit(node.id, currentValue);
  }, [node.id, node.text, editText, onFinishEdit, blurTimeoutRef, clearMermaidCacheOnChange]);


  const handleInputMouseEvents = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {

    e.stopPropagation();
  }, []);

  // 編集時の高さ計算を早期リターン前に実行（フック順序を保つため）
  const editHeightData = React.useMemo(() => {
    const noteStr2: string = (node as MindMapNode & { note?: string })?.note || '';
    const noteHasImages2 = !!noteStr2 && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr2) || /<img[^>]*\ssrc=["'][^"'>\s]+["'][^>]*>/i.test(noteStr2) );
    const noteHasMermaid2 = !!noteStr2 && /```mermaid[\s\S]*?```/i.test(noteStr2);
    const hasImage = noteHasImages2 || noteHasMermaid2;

    const getActualImageHeight = () => {
      if (!hasImage) return 0;
      if (node.customImageWidth && node.customImageHeight) {
        return node.customImageHeight;
      }
      if (noteStr2 && noteHasImages2) {
        const tagRe = /<img[^>]*>/i;
        const tagMatch = tagRe.exec(noteStr2);
        if (tagMatch) {
          const tag = tagMatch[0];
          const hRe = /\sheight=["']?(\d+)(?:px)?["']?/i;
          const hMatch = hRe.exec(tag);
          if (hMatch) {
            const h = parseInt(hMatch[1], 10);
            if (Number.isFinite(h) && h > 0) return h;
          }
        }
      }
      return 105;
    };

    const actualImageHeight = getActualImageHeight();
    const editWidth = Math.max(20, nodeWidth - 8);
    const fontSize = settings.fontSize || node.fontSize || 14;
    const wrapConfig = resolveNodeTextWrapConfig(settings, fontSize);
    const wrapEnabled = wrapConfig.enabled !== false;

    const textareaPadding = 20;
    const actualTextWidth = editWidth - textareaPadding;
    const wrapMaxWidth = wrapEnabled ? Math.min(actualTextWidth, wrapConfig.maxWidth) : actualTextWidth;

    const wrapResult = wrapNodeText(editText, {
      fontSize,
      fontFamily: settings.fontFamily || 'system-ui',
      fontWeight: node.fontWeight || 'normal',
      fontStyle: node.fontStyle || 'normal',
      maxWidth: wrapMaxWidth,
      prefixTokens: []
    });

    const lineHeight = wrapResult.lineHeight;
    const totalLines = Math.max(1, wrapResult.lines.length);
    const verticalPadding = 8;
    const borderWidth = 2;
    const textareaHeight = totalLines * lineHeight + verticalPadding + borderWidth;

    return {
      hasImage,
      actualImageHeight,
      editWidth,
      fontSize,
      lineHeight,
      textareaHeight,
      editX: nodeLeftX + 4
    };
  }, [node, nodeWidth, settings, editText, nodeLeftX]);

  // 編集時の高さを親コンポーネントに通知
  useEffect(() => {
    if (isEditing && onEditHeightChange) {
      onEditHeightChange(editHeightData.textareaHeight);
    }
  }, [isEditing, editHeightData.textareaHeight, onEditHeightChange]);


  if (!isEditing) {
    // Type guard: Do not render text for table nodes
    const isTableNode = 'kind' in node && (node as unknown as Record<string, unknown>).kind === 'table';
    if (isTableNode) {
      return null; // Table nodes display their content via NodeRenderer
    }

    const noteStr: string = (node as MindMapNode & { note?: string })?.note || '';
    const noteHasImages = !!noteStr && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr) || /<img[^>]*\ssrc=["'][^"'\s>]+["'][^>]*>/i.test(noteStr) );
    const noteHasMermaid = !!noteStr && /```mermaid[\s\S]*?```/i.test(noteStr);
    const hasImage = noteHasImages || noteHasMermaid;

    const getActualImageHeight = () => {
      if (!hasImage) return 0;
      if (node.customImageWidth && node.customImageHeight) {
        return node.customImageHeight;
      }
      if (noteStr && noteHasImages) {
        const tagRe = /<img[^>]*>/i;
        const tagMatch = tagRe.exec(noteStr);
        if (tagMatch) {
          const tag = tagMatch[0];
          const hRe = /\sheight=["']?(\d+)(?:px)?["']?/i;
          const hMatch = hRe.exec(tag);
          if (hMatch) {
            const h = parseInt(hMatch[1], 10);
            if (Number.isFinite(h) && h > 0) return h;
          }
        }
      }
      return 105;
    };

    const actualImageHeight = getActualImageHeight();
    const allLinks = extractAllMarkdownLinksDetailed(node.note);
    const hasLinks = allLinks.length > 0;

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
      prefixTokens: node.markdownMeta?.type === 'heading' ? [] : getMarkerPrefixTokens(node)
    });

    const lineHeight = wrapResult.lineHeight;
    const lines = wrapResult.lines;
    const totalLines = lines.length;
    const firstLineDy = totalLines === 1 ? 0 : -((totalLines - 1) * lineHeight) / 2;

    const handleTextClick = (e: React.MouseEvent) => {
      e.stopPropagation();
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
              onLinkNavigate({
                id: `text:${anchor}`,
                targetNodeId: `text:${anchor}`
              });
            }
            return;
          }
          if (!href.startsWith('http://') && !href.startsWith('https://')) {
            const currentData = useMindMapStore.getState().data as { mapIdentifier?: { mapId?: string } } | null;
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
              const idStr = anchor ? `map|${resolved}#${anchor}` : `map|${resolved}`;
              const linkObj: NodeLink = {
                id: idStr,
                targetMapId: resolved
              };
              if (anchor) linkObj.targetNodeId = `text:${anchor}`;
              onLinkNavigate(linkObj);
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

    const renderTokenContent = (token: WrappedToken, lineIndex: number, tokenIndex: number): React.ReactNode[] => {
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
        return [
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
        ];
      }

      const highlightQuery = ui.searchQuery;
      if (!highlightQuery || !token.text.toLowerCase().includes(highlightQuery.toLowerCase())) {
        return [
          <tspan key={keyBase} {...baseProps} onDoubleClick={handleTextDoubleClick}>
            {token.text}
          </tspan>
        ];
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

    // ===== ここから追加: 各行幅を計測して最長行の左端に合わせる =====
    const measureText = (() => {
      let canvas: HTMLCanvasElement | null = null;
      let ctx: CanvasRenderingContext2D | null = null;
      return (text: string) => {
        if (!canvas) {
          canvas = document.createElement('canvas');
          ctx = canvas.getContext('2d');
        }
        if (!ctx) return (text?.length || 0) * (Number(fontSize) || 14) * 0.6;
        ctx.font = `${fontStyleValue} ${fontWeightValue} ${fontSize}px ${fontFamily}`;
        return ctx.measureText(text ?? '').width;
      };
    })();

    const getLineWidth = (line: { width?: number; tokens: Array<{ width?: number; text?: string }> }) => {
      if (typeof line.width === 'number') return line.width;
      return line.tokens.reduce((w: number, t) => w + (typeof t.width === 'number' ? t.width : measureText(t.text || '')), 0);
    };

    const maxLineWidth = Math.max(...lines.map(getLineWidth));
    // ===== 追加ここまで =====

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
          onContextMenu={(e) => { e.stopPropagation(); onRightClick?.(e); }}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <title>{node.text}</title>
          {lines.map((line, lineIndex) => (
            <tspan
              key={`line-${lineIndex}`}
              
              x={(() => {
                const lw = getLineWidth(line);
                return textX - (maxLineWidth - lw) / 2; 
              })()}
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
                {allLinks.length}
              </text>
            </g>
          );
        })()}
      </>
    );
  }


  // テキストエリアを中央配置するためのY座標計算
  const baseY = editHeightData.hasImage ? node.y + editHeightData.actualImageHeight / 2 : node.y;
  const editY = baseY - editHeightData.textareaHeight / 2;

  return (
    <foreignObject
      x={editHeightData.editX}
      y={editY}
      width={editHeightData.editWidth}
      height={editHeightData.textareaHeight}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <textarea
        ref={inputRef}
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
          textAlign: 'left',
          fontSize: `${editHeightData.fontSize}px`,
          fontWeight: node.fontWeight || 'normal',
          fontStyle: node.fontStyle || 'normal',
          fontFamily: settings.fontFamily || 'system-ui',
          color: settings.theme === 'dark' ? 'var(--text-primary)' : 'black',
          outline: 'none',
          borderRadius: '4px',
          padding: '4px 10px',
          boxSizing: 'border-box',
          resize: 'none',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          lineHeight: `${editHeightData.lineHeight}px`
        }}
      />
    </foreignObject>
  );
};


export default memo(NodeEditor);
