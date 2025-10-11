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
      
    }
  }, []);

  const cleanedCode = useMemo(() => {
    const lower = code.toLowerCase();
    const fenceStart = lower.indexOf('```mermaid');
    if (fenceStart >= 0) {
      // find end of the first line after ```mermaid
      const lineEnd = code.indexOf('\n', fenceStart);
      const contentStart = lineEnd >= 0 ? lineEnd + 1 : fenceStart + '```mermaid'.length;
      const fenceEnd = code.indexOf('```', contentStart);
      const raw = fenceEnd >= 0 ? code.slice(contentStart, fenceEnd) : code.slice(contentStart);
      return raw.trim();
    }
    return code.trim();
  }, [code]);

  
  useEffect(() => {
    
    setSvg('');
    // Note: We don't need to delete from cache here as the cache key
    
  }, [cleanedCode]);

  useEffect(() => {
    let cancelled = false;

    const extractDimensions = (element: Element): { width: number; height: number } => {
      const vb = element.getAttribute('viewBox');
      if (vb) {
        const parts = vb.split(/[ ,]+/).map(Number);
        if (parts.length === 4) {
          return { width: parts[2], height: parts[3] };
        }
      }

      const wAttr = element.getAttribute('width');
      const hAttr = element.getAttribute('height');
      const w = wAttr ? parseFloat(wAttr) : 0;
      const h = hAttr ? parseFloat(hAttr) : 0;

      if (w > 0 && h > 0) {
        element.setAttribute('viewBox', `0 0 ${w} ${h}`);
        return { width: w, height: h };
      }

      return { width: 0, height: 0 };
    };

    const normalizeSVGElement = (element: Element): void => {
      element.removeAttribute('width');
      element.removeAttribute('height');
      element.setAttribute('width', '100%');
      element.setAttribute('height', '100%');
      element.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      element.setAttribute('style', 'width:100%;height:100%;display:block');
    };

    const handleCachedSVG = (cached: { svg: string; dimensions: { width: number; height: number } }): boolean => {
      if (!cancelled) {
        setSvg(cached.svg);
        onLoadedDimensions?.(cached.dimensions.width, cached.dimensions.height);
        return true;
      }
      return false;
    };

    const render = async () => {
      try {
        const cached = mermaidSVGCache.get(cleanedCode);
        if (cached && handleCachedSVG(cached)) return;

        const id = generateId('mermaid');
        const { svg } = await mermaid.render(id, cleanedCode);
        if (cancelled) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const el = doc.documentElement;

        const { width, height } = extractDimensions(el);
        normalizeSVGElement(el);

        const serializer = new XMLSerializer();
        const adjusted = serializer.serializeToString(el);

        if (width > 0 && height > 0) {
          mermaidSVGCache.set(cleanedCode, adjusted, { width, height });
        }

        setSvg(adjusted);
        if (width > 0 && height > 0) {
          onLoadedDimensions?.(width, height);
        }
      } catch (e) {
        console.warn('Mermaid render failed', e);
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
      { }
      <div
        style={{ width: '100%', height: '100%' }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};

export default MermaidRenderer;
