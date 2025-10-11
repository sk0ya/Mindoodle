import { useCallback, useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import mermaid from 'mermaid';
import { mermaidSVGCache } from '../../mindmap/utils/mermaidCache';
import { logger, generateId } from '@shared/utils';

export interface UseMermaidProcessorResult {
  previewHtml: string;
  processedHtml: string;
  extractMermaidBlocks: (text: string) => string[];
}

export function useMermaidProcessor(value: string): UseMermaidProcessorResult {
  
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    } catch {
      
    }
  }, []);

  
  const extractMermaidBlocks = useCallback((text: string): string[] => {
    const blocks: string[] = [];
    if (!text) return blocks;
    const open = '```mermaid';
    const close = '```';
    let i = 0;
    const maxScan = Math.min(text.length, 500_000);
    while (i < maxScan) {
      const start = text.indexOf(open, i);
      if (start === -1) break;
      const codeStart = start + open.length;
      const end = text.indexOf(close, codeStart);
      if (end === -1) break;
      const content = text.slice(codeStart, end).trim();
      blocks.push(content);
      i = end + close.length;
    }
    return blocks;
  }, []);

  
  const processMermaidInHtml = useCallback(async (html: string): Promise<string> => {
    
    let processedHtml = html;
    const promises: Promise<string>[] = [];
    const replacements: { original: string; replacement: string }[] = [];

    const openTag = '<pre><code class="language-mermaid">';
    const closeTag = '</code></pre>';
    let scanIndex = 0;
    while (true) {
      const start = html.indexOf(openTag, scanIndex);
      if (start === -1) break;
      const codeStart = start + openTag.length;
      const end = html.indexOf(closeTag, codeStart);
      if (end === -1) break;
      const fullMatch = html.slice(start, end + closeTag.length);
      const raw = html.slice(codeStart, end);
      const mermaidCode = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
      scanIndex = end + closeTag.length;

      const promise = (async () => {
        try {
          
          const cached = mermaidSVGCache.get(mermaidCode);
          if (cached) {
            return cached.svg;
          }

          
          const id = generateId('mermaid');
          const { svg } = await mermaid.render(id, mermaidCode);

          
          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, 'image/svg+xml');
          const el = doc.documentElement;

          
          el.removeAttribute('width');
          el.removeAttribute('height');
          el.setAttribute('width', '100%');
          el.setAttribute('height', 'auto');
          el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          el.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 12px 0;');

          const serializer = new XMLSerializer();
          const adjustedSvg = serializer.serializeToString(el);

          
          const vb = el.getAttribute('viewBox');
          if (vb) {
            const parts = vb.split(/[ ,]+/).map(Number);
            if (parts.length === 4) {
              mermaidSVGCache.set(mermaidCode, adjustedSvg, { width: parts[2], height: parts[3] });
            }
          }

          return adjustedSvg;
        } catch (error) {
          logger.warn('Mermaid rendering error:', error);
          return `<div style="border: 1px solid #e74c3c; border-radius: 4px; padding: 12px; background: #fdf2f2; color: #c0392b;">
            <strong>Mermaid rendering error:</strong><br/>
            <code>${mermaidCode}</code>
          </div>`;
        }
      })();

      promises.push(promise.then(svg => {
        replacements.push({ original: fullMatch, replacement: svg });
        return svg;
      }));
    }

    
    await Promise.all(promises);

    
    for (const { original, replacement } of replacements) {
      processedHtml = processedHtml.replace(original, replacement);
    }

    return processedHtml;
  }, []);

  
  const previewHtml = useMemo((): string => {
    try {
      const result = marked.parse(value || '');
      return typeof result === 'string' ? result : '';
    } catch (error) {
      logger.warn('Markdown parsing error:', error);
      return '<p>マークダウンの解析でエラーが発生しました</p>';
    }
  }, [value]);

  // Process mermaid diagrams and get final HTML
  const [processedHtml, setProcessedHtml] = useState<string>('');

  useEffect(() => {
    const processHtml = async () => {
      try {
        const processed = await processMermaidInHtml(previewHtml);
        setProcessedHtml(processed);
      } catch (error) {
        logger.warn('Error processing mermaid in HTML:', error);
        
        setProcessedHtml(previewHtml);
      }
    };
    processHtml();
  }, [previewHtml, processMermaidInHtml]);

  return {
    previewHtml,
    processedHtml,
    extractMermaidBlocks,
  };
}
