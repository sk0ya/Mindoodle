import React, { memo } from 'react';
import { Link } from 'lucide-react';
import { useMindMapStore } from '../../store';
import { calculateIconLayout, wrapNodeText, resolveNodeTextWrapConfig, getMarkerPrefixTokens, TEXT_ICON_SPACING, type WrappedToken } from '@mindmap/utils';
import { extractAllMarkdownLinksDetailed } from '../../../markdown';
import type { MindMapNode, NodeLink } from '@shared/types';
import { isMarkdownLink, isUrl, parseMarkdownLink } from './linkUtils';

interface NodeTextViewProps {
  node: MindMapNode;
  nodeWidth: number;
  isSelected?: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  onToggleLinkList?: (nodeId: string) => void;
  onLinkNavigate?: (link: NodeLink) => void;
  onStartEdit?: (nodeId: string) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onRightClick?: (e: React.MouseEvent) => void;
}

const NodeTextView: React.FC<NodeTextViewProps> = ({
  node,
  nodeWidth,
  isSelected = false,
  onSelectNode,
  onToggleLinkList,
  onLinkNavigate,
  onStartEdit,
  onMouseDown,
  onDragOver,
  onDrop,
  onRightClick,
}) => {
  const { ui, settings } = useMindMapStore();

  const defaultVisible = settings.showVisualContentByDefault !== false;
  const explicitHidden = (node as unknown as { contentHidden?: boolean }).contentHidden;
  const contentHidden = explicitHidden === true || (explicitHidden === undefined && !defaultVisible);
  const noteStr: string = (node as MindMapNode & { note?: string })?.note || '';
  const noteHasImages = !!noteStr && ( /!\[[^\]]*\]\(([^)]+)\)/.test(noteStr) || /<img[^>]*\ssrc=["'][^"'\s>]+["'][^>]*>/i.test(noteStr) );
  const noteHasMermaid = !!noteStr && /```mermaid[\s\S]*?```/i.test(noteStr);
  const hasImage = (noteHasImages || noteHasMermaid) && !contentHidden;

  const getActualImageHeight = () => {
    if (!hasImage) return 0;
    if (node.customImageWidth && node.customImageHeight) return node.customImageHeight;
    if (noteStr && noteHasImages) {
      const tagMatch = /<img[^>]*>/i.exec(noteStr);
      if (tagMatch) {
        const hMatch = /\sheight=["']?(\d+)(?:px)?["']?/i.exec(tagMatch[0]);
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

  const displayText = (() => {
    if (isNodeTextMarkdownLink) {
      const linkInfo = parseMarkdownLink(node.text);
      return linkInfo ? linkInfo.label : node.text;
    }
    return node.text;
  })();

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
    if (!isAnyLink) onStartEdit?.(node.id);
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
          onLinkNavigate?.({ id: `text:${anchor}`, targetNodeId: `text:${anchor}` });
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
          const idStr = anchor ? `map|${resolved}#${anchor}` : `map|${resolved}`;
          const linkObj: NodeLink = { id: idStr, targetMapId: resolved };
          if (anchor) linkObj.targetNodeId = `text:${anchor}`;
          onLinkNavigate?.(linkObj);
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
    if (!isSelected) onSelectNode?.(node.id);
    onStartEdit?.(node.id);
  };

  const markerStyle: React.SVGProps<SVGTSpanElement> = { fill: '#888', fontWeight: '500' };
  const linkFill = settings.theme === 'dark' ? '#60a5fa' : '#2563eb';
  const baseLinkStyle: React.SVGProps<SVGTSpanElement> = isAnyLink ? { fill: linkFill, textDecoration: 'underline' } : {};
  const baseTextStyle: React.SVGProps<SVGTSpanElement> = (() => {
    const style: React.SVGProps<SVGTSpanElement> = {};
    if (node.markdownMeta?.type === 'heading') style.fontWeight = '600';
    else if (node.markdownMeta?.type === 'unordered-list' || node.markdownMeta?.type === 'ordered-list') style.fontWeight = '400';
    return { ...style, ...baseLinkStyle };
  })();

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderTokenContent = (token: WrappedToken, lineIndex: number, tokenIndex: number): React.ReactNode[] => {
    const baseProps: React.SVGProps<SVGTSpanElement> = { ...(token.isMarker ? markerStyle : baseTextStyle) };
    if (token.bold) baseProps.fontWeight = 'bold';
    if (token.italic) baseProps.fontStyle = 'italic';
    if (token.strikethrough) baseProps.textDecoration = baseProps.textDecoration ? `${baseProps.textDecoration} line-through` : 'line-through';
    const keyBase = `token-${lineIndex}-${tokenIndex}`;
    if (token.isMarker) {
      return [
        <tspan key={keyBase} {...baseProps} onDoubleClick={(event) => { event.stopPropagation(); onStartEdit?.(node.id); }}>
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
          <tspan key={`${keyBase}-seg-${segmentIndex}`} {...segmentProps} onDoubleClick={handleTextDoubleClick}>
            {segment}
          </tspan>
        );
      });
  };

  // Align each line's left edge to the longest line for centered layout
  const measureText = (() => {
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    return (text: string) => {
      if (!canvas) { canvas = document.createElement('canvas'); ctx = canvas.getContext('2d'); }
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
        style={{ pointerEvents: 'auto', userSelect: 'none' }}
        onMouseDown={(e) => { e.stopPropagation(); onMouseDown?.(e); }}
        onClick={handleTextClick}
        onContextMenu={(e) => { e.stopPropagation(); onRightClick?.(e); }}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <title>{node.text}</title>
        {lines.map((line, lineIndex) => (
          <tspan key={`line-${lineIndex}`} x={(() => { const lw = getLineWidth(line); return textX - (maxLineWidth - lw) / 2; })()} dy={lineIndex === 0 ? firstLineDy : lineHeight}>
            {line.tokens.reduce<React.ReactNode[]>((acc, token, tokenIndex) => acc.concat(renderTokenContent(token, lineIndex, tokenIndex)), [])}
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
              style={{ filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onToggleLinkList?.(node.id); if (!isSelected) onSelectNode?.(node.id); }}
            />
            <foreignObject x={node.x + linkIconPosition.x + 2} y={textY + linkIconPosition.y + 2} width="10" height="10" style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                <Link size={9} />
              </div>
            </foreignObject>
            <text x={node.x + linkIconPosition.x + 20} y={textY + linkIconPosition.y + 10} textAnchor="end" fill="#333" fontSize="10px" fontWeight="600" style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {allLinks.length}
            </text>
          </g>
        );
      })()}
    </>
  );
};

export default memo(NodeTextView);
