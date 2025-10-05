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
  // Initialize mermaid once
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
    } catch {
      // ignore re-initialize errors
    }
  }, []);

  // Extract mermaid code blocks from markdown
  const extractMermaidBlocks = useCallback((text: string): string[] => {
    const mermaidRegex = /```mermaid\s*([\s\S]*?)\s*```/gi;
    const blocks: string[] = [];
    let match;
    while ((match = mermaidRegex.exec(text)) !== null) {
      blocks.push(match[1].trim());
    }
    return blocks;
  }, []);

  // Process mermaid diagrams in HTML
  const processMermaidInHtml = useCallback(async (html: string): Promise<string> => {
    // Find all mermaid code blocks in the HTML
    const mermaidRegex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;
    let processedHtml = html;
    let match;
    const promises: Promise<string>[] = [];
    const replacements: { original: string; replacement: string }[] = [];

    while ((match = mermaidRegex.exec(html)) !== null) {
      const fullMatch = match[0];
      const mermaidCode = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

      const promise = (async () => {
        try {
          // Check cache first
          const cached = mermaidSVGCache.get(mermaidCode);
          if (cached) {
            return cached.svg;
          }

          // Generate new SVG
          const id = generateId('mermaid');
          const { svg } = await mermaid.render(id, mermaidCode);

          // Parse and normalize SVG
          const parser = new DOMParser();
          const doc = parser.parseFromString(svg, 'image/svg+xml');
          const el = doc.documentElement;

          // Set responsive attributes
          el.removeAttribute('width');
          el.removeAttribute('height');
          el.setAttribute('width', '100%');
          el.setAttribute('height', 'auto');
          el.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          el.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 12px 0;');

          const serializer = new XMLSerializer();
          const adjustedSvg = serializer.serializeToString(el);

          // Cache the result
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

    // Wait for all mermaid diagrams to be processed
    await Promise.all(promises);

    // Apply all replacements
    for (const { original, replacement } of replacements) {
      processedHtml = processedHtml.replace(original, replacement);
    }

    return processedHtml;
  }, []);

  // Convert markdown to HTML (memoized for performance)
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
        // Fallback to original HTML if processing fails
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
