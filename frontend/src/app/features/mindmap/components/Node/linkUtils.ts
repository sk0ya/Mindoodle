/**
 * Link utility functions for node rendering and editing
 */

/**
 * Check if text matches Markdown link format: [label](href)
 */
export const isMarkdownLink = (text: string): boolean => {
  const markdownLinkPattern = /^\[([^\]]*)\]\(([^)]+)\)$/;
  return markdownLinkPattern.test(text);
};

/**
 * Check if text is a plain URL (http/https)
 */
export const isUrl = (text: string): boolean => {
  const urlPattern = /^https?:\/\/[^\s]+$/;
  return urlPattern.test(text);
};

/**
 * Parse Markdown link format into label and href
 * Returns null if text is not a valid Markdown link
 */
export const parseMarkdownLink = (text: string): { label: string; href: string } | null => {
  const re = /^\[([^\]]*)\]\(([^)]+)\)$/;
  const m = re.exec(text);
  if (m) {
    return { label: m[1], href: m[2] };
  }
  return null;
};
