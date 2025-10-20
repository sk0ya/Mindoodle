import type { FileAttachment } from '@shared/types';
import type { DisplayEntry } from './displayEntryExtractor';
import { isRelativeLocalPath } from './pathUtils';

/**
 * File attachment with additional metadata
 */
export interface FileAttachmentWithMetadata extends FileAttachment {
  isRelativeLocal?: boolean;
}

/**
 * Convert display entries to file attachments
 *
 * Transforms image display entries into FileAttachment objects
 * for use in the file attachment system.
 *
 * @param entries - Display entries to convert
 * @param nodeId - Node ID for generating unique attachment IDs
 * @returns Array of file attachments
 */
export const displayEntriesToFileAttachments = (
  entries: DisplayEntry[],
  nodeId: string
): FileAttachmentWithMetadata[] => {
  const imageEntries = entries.filter(
    (e): e is Extract<DisplayEntry, { kind: 'image' }> => e.kind === 'image'
  );

  return imageEntries.map((entry, index) => {
    const filename = extractFilename(entry.url, index);
    const isRelativeLocal = isRelativeLocalPath(entry.url);

    return {
      id: generateAttachmentId(nodeId, index),
      name: filename,
      type: 'image/*',
      size: 0,
      isImage: true,
      createdAt: new Date().toISOString(),
      downloadUrl: entry.url,
      isRelativeLocal
    };
  });
};

/**
 * Generate unique attachment ID
 */
const generateAttachmentId = (nodeId: string, index: number): string => {
  return `noteimg-${nodeId}-${index}`;
};

/**
 * Extract filename from URL or generate fallback
 */
const extractFilename = (url: string, index: number): string => {
  const lastSegment = url.split('/').pop();
  return lastSegment || `image-${index}`;
};
