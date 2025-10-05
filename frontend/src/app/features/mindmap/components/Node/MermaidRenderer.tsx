import React, { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { generateId } from '@shared/utils';
import { mermaidSVGCache } from '../../utils/mermaidCache';
import { useMindMapStore } from '../../store';

type MermaidRendererProps = {
  code: string;
  onLoadedDimensions?: (w: number, h: number) => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

// Lightweight SVG renderer for Mermaid code blocks inside a node slot
const MermaidRenderer: React.FC<MermaidRendererProps> = ({
  code,
  onLoadedDimensions,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string>('');

  // Get UI state to monitor cache clear events
  const { ui } = useMindMapStore();

  // Initialize mermaid once
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    } catch {
      // ignore re-initialize errors
    }
  }, []);

  const cleanedCode = useMemo(() => {
    // Trim and normalize code fence content if it includes backticks
    const fenceMatch = code.match(/```mermaid\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) return fenceMatch[1].trim();
    return code.trim();
  }, [code]);

  // Clear cache when code changes to force re-render
  useEffect(() => {
    // Clear SVG state to show re-rendering
    setSvg('');
    // Note: We don't need to delete from cache here as the cache key
    // will be different for different content
  }, [cleanedCode]);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        // Check cache first
        const cached = mermaidSVGCache.get(cleanedCode);
        if (cached && !cancelled) {
          setSvg(cached.svg);
          onLoadedDimensions?.(cached.dimensions.width, cached.dimensions.height);
          return;
        }

        // Generate new SVG if not cached
        const id = generateId('mermaid');
        const { svg } = await mermaid.render(id, cleanedCode);
        if (cancelled) return;

        // Parse to DOM to normalize attributes robustly
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const el = doc.documentElement;

        // Capture intrinsic size from viewBox or width/height
        let vbW = 0; let vbH = 0;
        const vb = el.getAttribute('viewBox');
        if (vb) {
          const parts = vb.split(/[ ,]+/).map(Number);
          if (parts.length === 4) { vbW = parts[2]; vbH = parts[3]; }
        } else {
          const wAttr = el.getAttribute('width');
          const hAttr = el.getAttribute('height');
          const w = wAttr ? parseFloat(wAttr) : 0;
          const h = hAttr ? parseFloat(hAttr) : 0;
          if (w > 0 && h > 0) {
            el.setAttribute('viewBox', `0 0 ${w} ${h}`);
            vbW = w; vbH = h;
          }
        }

        // Force scaling to container
        el.removeAttribute('width');
        el.removeAttribute('height');
        el.setAttribute('width', '100%');
        el.setAttribute('height', '100%');
        el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        el.setAttribute('style', 'width:100%;height:100%;display:block');

        const serializer = new XMLSerializer();
        const adjusted = serializer.serializeToString(el);

        // Cache the result
        if (vbW > 0 && vbH > 0) {
          mermaidSVGCache.set(cleanedCode, adjusted, { width: vbW, height: vbH });
        }

        setSvg(adjusted);
        if (vbW > 0 && vbH > 0) {
          onLoadedDimensions?.(vbW, vbH);
        }
      } catch (e) {
        // On failure, clear SVG
        setSvg('');
      }
    };

    render();
    return () => { cancelled = true; };
  }, [cleanedCode, onLoadedDimensions, ui.lastMermaidCacheCleared]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 6,
        overflow: 'hidden',
        border: 'none',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        backgroundColor: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
        cursor: 'pointer'
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label="Mermaid diagram"
    >
      {/* eslint-disable-next-line react/no-danger */}
      <div
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};

export default MermaidRenderer;
