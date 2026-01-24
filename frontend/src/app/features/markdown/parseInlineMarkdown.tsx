import React from 'react';

export interface InlineSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}

type InlineFormat = 'bold' | 'italic' | 'strikethrough';


export function parseInlineMarkdown(text: string): InlineSegment[] {
  if (!text) return [{ text: '' }];

  const segments: InlineSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Try to match bold (**text** or __text__)
    const boldRe = /^(\*\*|__)(.+?)\1/;
    const boldMatch = boldRe.exec(remaining);
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
    const strikeRe = /^~~(.+?)~~/;
    const strikeMatch = strikeRe.exec(remaining);
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
    const italicRe = /^([*_])(.+?)\1/;
    const italicMatch = italicRe.exec(remaining);
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
    const plainRe = /^[^*_~]+/;
    const plainMatch = plainRe.exec(remaining);
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


export function renderInlineMarkdownSVG(
  text: string,
  baseStyle?: React.CSSProperties
): React.ReactElement[] {
  const segments = parseInlineMarkdown(text);

  return segments.map((segment, index) => {
    const props: React.SVGProps<SVGTSpanElement> = {};



    if (baseStyle?.fill) props.fill = baseStyle.fill;
    if (baseStyle?.textDecoration) props.textDecoration = baseStyle.textDecoration as string;

    
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


function detectFormattingLayers(text: string): Array<InlineFormat> {
  const layers: Array<InlineFormat> = [];
  let current = text;

  while (true) {
    let matched = false;

    
    if (current.startsWith('***') && current.endsWith('***') && current.length > 6) {
      
      let startCount = 0;
      let endCount = 0;
      for (let i = 0; i < current.length && current[i] === '*'; i++) startCount++;
      for (let i = current.length - 1; i >= 0 && current[i] === '*'; i--) endCount++;

      if (startCount >= 3 && endCount >= 3) {
        
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


function rebuildWithLayers(coreText: string, layers: Array<InlineFormat>): string {
  const markers = {
    bold: '**',
    italic: '*',
    strikethrough: '~~'
  };

  let result = coreText;
  
  for (let i = layers.length - 1; i >= 0; i--) {
    const marker = markers[layers[i]];
    result = `${marker}${result}${marker}`;
  }
  return result;
}


function extractCoreText(text: string, layers: InlineFormat[]): string {
  let coreText = text;
  layers.forEach(layer => {
    const markers = { bold: '**', italic: '*', strikethrough: '~~' };
    const marker = markers[layer];
    if (coreText.startsWith(marker) && coreText.endsWith(marker)) {
      coreText = coreText.slice(marker.length, -marker.length);
    }
  });
  return coreText;
}

function applyFormattingToggle(
  text: string,
  layers: InlineFormat[],
  format: InlineFormat,
  hasFormat: boolean
): string {
  const newLayers = hasFormat ? layers.filter(l => l !== format) : [format, ...layers];
  const coreText = extractCoreText(text, layers);
  return rebuildWithLayers(coreText, newLayers);
}

export function toggleInlineMarkdown(
  text: string,
  format: InlineFormat,
  selectionStart?: number,
  selectionEnd?: number
): { newText: string; newCursorPos?: number } {

  if (selectionStart === undefined || selectionEnd === undefined || selectionStart === selectionEnd) {
    const layers = detectFormattingLayers(text);
    const hasFormat = layers.includes(format);
    const newText = applyFormattingToggle(text, layers, format, hasFormat);
    return { newText, newCursorPos: hasFormat ? 0 : newText.length };
  }


  const before = text.slice(0, selectionStart);
  const selected = text.slice(selectionStart, selectionEnd);
  const after = text.slice(selectionEnd);

  const layers = detectFormattingLayers(selected);
  const hasFormat = layers.includes(format);
  const formatted = applyFormattingToggle(selected, layers, format, hasFormat);

  return {
    newText: before + formatted + after,
    newCursorPos: selectionStart + formatted.length
  };
}


export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  
    .replace(/__(.*?)__/g, '$1')      
    .replace(/\*(.*?)\*/g, '$1')      
    .replace(/_(.*?)_/g, '$1')        
    .replace(/~~(.*?)~~/g, '$1');     
}
