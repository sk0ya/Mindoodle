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
 * Check if text has a specific formatting marker at the outermost level
 */
function hasOutermostMarker(text: string, marker: string): boolean {
  return text.startsWith(marker) && text.endsWith(marker) && text.length > marker.length * 2;
}

/**
 * Remove outermost occurrence of a marker from text
 */
function removeOutermostMarker(text: string, marker: string): string {
  if (hasOutermostMarker(text, marker)) {
    return text.slice(marker.length, -marker.length);
  }
  return text;
}

/**
 * Toggle formatting for selected text or entire text
 * Handles nested formatting correctly (e.g., **~~text~~** → ~~text~~ when toggling bold)
 */
export function toggleInlineMarkdown(
  text: string,
  format: 'bold' | 'italic' | 'strikethrough',
  selectionStart?: number,
  selectionEnd?: number
): { newText: string; newCursorPos?: number } {
  const markers = {
    bold: '**',
    italic: '*',
    strikethrough: '~~'
  };

  const marker = markers[format];

  // If no selection, toggle for entire text
  if (selectionStart === undefined || selectionEnd === undefined || selectionStart === selectionEnd) {
    // Check if text has this formatting at the outermost level
    if (hasOutermostMarker(text, marker)) {
      // Remove outermost formatting layer
      const newText = removeOutermostMarker(text, marker);
      return {
        newText,
        newCursorPos: 0
      };
    } else {
      // Add formatting at the outermost level
      return {
        newText: `${marker}${text}${marker}`,
        newCursorPos: marker.length + text.length
      };
    }
  }

  // Toggle formatting for selected text
  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd);
  const after = text.slice(selectionEnd);

  // Check if selection has this formatting at the outermost level
  if (hasOutermostMarker(selected, marker)) {
    // Remove outermost formatting layer
    const unformatted = removeOutermostMarker(selected, marker);
    return {
      newText: before + unformatted + after,
      newCursorPos: selectionStart + unformatted.length
    };
  } else {
    // Add formatting at the outermost level
    const formatted = `${marker}${selected}${marker}`;
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
