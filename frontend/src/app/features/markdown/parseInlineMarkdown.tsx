import React from 'react';

/**
 * Inline markdown formatting patterns
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - ~~strikethrough~~
 */

export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}

/**
 * Parse inline markdown formatting (bold, italic, strikethrough)
 * Supports:
 * - **text** or __text__ for bold
 * - *text* or _text_ for italic
 * - ~~text~~ for strikethrough
 * - Nested/overlapping formats like **~~text~~** or ~~**text**~~
 */
export function parseInlineMarkdown(text: string): InlineSegment[] {
  if (!text) return [{ text: '' }];

  const segments: InlineSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Try to match bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      const innerText = boldMatch[2];
      // Recursively parse inner content for nested formatting
      const innerSegments = parseInlineMarkdown(innerText);
      innerSegments.forEach(seg => {
        segments.push({ ...seg, bold: true });
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Try to match strikethrough (~~text~~)
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      const innerText = strikeMatch[1];
      // Recursively parse inner content for nested formatting
      const innerSegments = parseInlineMarkdown(innerText);
      innerSegments.forEach(seg => {
        segments.push({ ...seg, strikethrough: true });
      });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Try to match italic (*text* or _text_)
    const italicMatch = remaining.match(/^(\*|_)(.+?)\1/);
    if (italicMatch) {
      const innerText = italicMatch[2];
      // Recursively parse inner content for nested formatting
      const innerSegments = parseInlineMarkdown(innerText);
      innerSegments.forEach(seg => {
        segments.push({ ...seg, italic: true });
      });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // No markdown found, consume plain text until next markdown character
    const plainMatch = remaining.match(/^[^*_~]+/);
    if (plainMatch) {
      segments.push({ text: plainMatch[0] });
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }

    // Single character that didn't match (probably a stray markdown character)
    segments.push({ text: remaining[0] });
    remaining = remaining.slice(1);
  }

  return segments.length > 0 ? segments : [{ text }];
}

/**
 * Render inline markdown segments as SVG tspans
 */
export function renderInlineMarkdownSVG(
  text: string,
  baseStyle?: React.CSSProperties
): React.ReactNode {
  const segments = parseInlineMarkdown(text);

  return segments.map((segment, index) => {
    const props: React.SVGProps<SVGTSpanElement> = {};

    // Apply base style properties
    if (baseStyle?.fill) props.fill = baseStyle.fill;
    if (baseStyle?.textDecoration) props.textDecoration = baseStyle.textDecoration as any;

    // Apply formatting
    if (segment.bold) {
      props.fontWeight = 'bold';
    }
    if (segment.italic) {
      props.fontStyle = 'italic';
    }
    if (segment.strikethrough) {
      props.textDecoration = 'line-through';
    }

    return (
      <tspan key={index} {...props}>
        {segment.text}
      </tspan>
    );
  });
}

/**
 * Detect all formatting layers in order from outermost to innermost
 * Returns array of format types in order
 * Handles cases like ***text*** (bold + italic)
 */
function detectFormattingLayers(text: string): Array<'bold' | 'italic' | 'strikethrough'> {
  const layers: Array<'bold' | 'italic' | 'strikethrough'> = [];
  let current = text;

  while (true) {
    let matched = false;

    // Check for *** (bold + italic combination)
    if (current.startsWith('***') && current.endsWith('***') && current.length > 6) {
      // Count consecutive asterisks at start and end
      let startCount = 0;
      let endCount = 0;
      for (let i = 0; i < current.length && current[i] === '*'; i++) startCount++;
      for (let i = current.length - 1; i >= 0 && current[i] === '*'; i--) endCount++;

      if (startCount >= 3 && endCount >= 3) {
        // Extract as bold (2) + italic (1)
        layers.push('bold');
        layers.push('italic');
        current = current.slice(3, -3);
        matched = true;
      }
    }

    if (!matched && current.startsWith('**') && current.endsWith('**') && current.length > 4) {
      layers.push('bold');
      current = current.slice(2, -2);
      matched = true;
    }

    if (!matched && current.startsWith('~~') && current.endsWith('~~') && current.length > 4) {
      layers.push('strikethrough');
      current = current.slice(2, -2);
      matched = true;
    }

    if (!matched && current.startsWith('*') && current.endsWith('*') && current.length > 2) {
      layers.push('italic');
      current = current.slice(1, -1);
      matched = true;
    }

    if (!matched) {
      break;
    }
  }

  return layers;
}

/**
 * Rebuild text with specified formatting layers
 */
function rebuildWithLayers(coreText: string, layers: Array<'bold' | 'italic' | 'strikethrough'>): string {
  const markers = {
    bold: '**',
    italic: '*',
    strikethrough: '~~'
  };

  let result = coreText;
  // Apply layers from innermost to outermost (reverse order)
  for (let i = layers.length - 1; i >= 0; i--) {
    const marker = markers[layers[i]];
    result = `${marker}${result}${marker}`;
  }
  return result;
}

/**
 * Toggle formatting for selected text or entire text
 * Handles nested formatting correctly (e.g., **~~text~~** → *~~text~~* when toggling bold)
 */
export function toggleInlineMarkdown(
  text: string,
  format: 'bold' | 'italic' | 'strikethrough',
  selectionStart?: number,
  selectionEnd?: number
): { newText: string; newCursorPos?: number } {
  // If no selection, toggle for entire text
  if (selectionStart === undefined || selectionEnd === undefined || selectionStart === selectionEnd) {
    const layers = detectFormattingLayers(text);
    const hasFormat = layers.includes(format);

    if (hasFormat) {
      // Remove this format from layers
      const newLayers = layers.filter(l => l !== format);
      // Get core text by stripping all layers
      let coreText = text;
      layers.forEach(layer => {
        const markers = { bold: '**', italic: '*', strikethrough: '~~' };
        const marker = markers[layer];
        if (coreText.startsWith(marker) && coreText.endsWith(marker)) {
          coreText = coreText.slice(marker.length, -marker.length);
        }
      });
      const newText = rebuildWithLayers(coreText, newLayers);
      return { newText, newCursorPos: 0 };
    } else {
      // Add this format as outermost layer
      const newLayers = [format, ...layers];
      // Get core text
      let coreText = text;
      layers.forEach(layer => {
        const markers = { bold: '**', italic: '*', strikethrough: '~~' };
        const marker = markers[layer];
        if (coreText.startsWith(marker) && coreText.endsWith(marker)) {
          coreText = coreText.slice(marker.length, -marker.length);
        }
      });
      const newText = rebuildWithLayers(coreText, newLayers);
      return { newText, newCursorPos: newText.length };
    }
  }

  // Toggle formatting for selected text
  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd);
  const after = text.slice(selectionEnd);

  const layers = detectFormattingLayers(selected);
  const hasFormat = layers.includes(format);

  if (hasFormat) {
    // Remove this format
    const newLayers = layers.filter(l => l !== format);
    let coreText = selected;
    layers.forEach(layer => {
      const markers = { bold: '**', italic: '*', strikethrough: '~~' };
      const marker = markers[layer];
      if (coreText.startsWith(marker) && coreText.endsWith(marker)) {
        coreText = coreText.slice(marker.length, -marker.length);
      }
    });
    const formatted = rebuildWithLayers(coreText, newLayers);
    return {
      newText: before + formatted + after,
      newCursorPos: selectionStart + formatted.length
    };
  } else {
    // Add this format as outermost layer
    const newLayers = [format, ...layers];
    let coreText = selected;
    layers.forEach(layer => {
      const markers = { bold: '**', italic: '*', strikethrough: '~~' };
      const marker = markers[layer];
      if (coreText.startsWith(marker) && coreText.endsWith(marker)) {
        coreText = coreText.slice(marker.length, -marker.length);
      }
    });
    const formatted = rebuildWithLayers(coreText, newLayers);
    return {
      newText: before + formatted + after,
      newCursorPos: selectionStart + formatted.length
    };
  }
}

/**
 * Strip all inline markdown formatting
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold**
    .replace(/__(.*?)__/g, '$1')      // __bold__
    .replace(/\*(.*?)\*/g, '$1')      // *italic*
    .replace(/_(.*?)_/g, '$1')        // _italic_
    .replace(/~~(.*?)~~/g, '$1');     // ~~strikethrough~~
}
