import React, { useRef, useEffect, useCallback, memo } from 'react';
import { Link } from 'lucide-react';
import { useMindMapStore } from '../../store';
import { calculateIconLayout, wrapNodeText, resolveNodeTextWrapConfig, getMarkerPrefixTokens, TEXT_ICON_SPACING } from '@mindmap/utils';
import type { WrappedToken } from '@mindmap/utils';
import { extractAllMarkdownLinksDetailed } from '../../../markdown';
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
  onMouseDown?: (e: React.MouseEvent) => void; 
  onDragOver?: (e: React.DragEvent) => void; 
  onDrop?: (e: React.DragEvent) => void; 
  onRightClick?: (e: React.MouseEvent) => void; 
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
  onRightClick
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ui, settings, clearMermaidRelatedCaches } = useMindMapStore();

  
  if (node.kind === 'table') {
    return null;
  }

  
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

  
  const isMarkdownLink = (text: string): boolean => {
    const markdownLinkPattern = /^\[([^\]]*)\]\(([^)]+)\)$/;
    return markdownLinkPattern.test(text);
  };

  
  const isUrl = (text: string): boolean => {
    const urlPattern = /^https?:\/\/[^\s]+$/;
    return urlPattern.test(text);
  };

  
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

    
    const hasChanges = oldMermaidBlocks.length !== newMermaidBlocks.length ||
      oldMermaidBlocks.some(oldBlock => !newMermaidBlocks.includes(oldBlock)) ||
      newMermaidBlocks.some(newBlock => !oldMermaidBlocks.includes(newBlock));

    if (hasChanges) {
      clearMermaidRelatedCaches();
    }
  }, [clearMermaidRelatedCaches]);

  
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    
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

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }

    
    const currentValue = e.target ? e.target.value : editText;

    
    clearMermaidCacheOnChange(node.text, currentValue);

    
    onFinishEdit(node.id, currentValue);
  }, [node.id, node.text, editText, onFinishEdit, blurTimeoutRef, clearMermaidCacheOnChange]);

  
  const handleInputMouseEvents = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    
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

    const getLineWidth = (line: any) => {
      if (typeof line.width === 'number') return line.width;
      return line.tokens.reduce((w: number, t: any) => w + (typeof t.width === 'number' ? t.width : measureText(t.text || '')), 0);
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
