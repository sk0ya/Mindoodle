export type IdType = 'node' | 'map' | 'link' | 'notification' | 'upload' | 'file' | 'error' | 'workspace' | 'url';

const ID_PREFIXES: Record<IdType, string> = {
  node: 'node',
  map: 'map',
  link: 'link',
  notification: 'notif',
  upload: 'upload',
  file: 'file',
  error: 'err',
  workspace: 'ws',
  url: 'url'
};

export function generateId(type: IdType = 'node'): string {
  const prefix = ID_PREFIXES[type];
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

export const generateNodeId = () => generateId('node');
export const generateMapId = () => generateId('map');
export const generateLinkId = () => generateId('link');
export const generateNotificationId = () => generateId('notification');
export const generateUploadId = () => generateId('upload');
export const generateFileId = () => generateId('file');
export const generateErrorId = () => generateId('error');
export const generateWorkspaceId = () => generateId('workspace');
export const generateUrlId = () => generateId('url');

/**
 * Generate upload key with node ID and filename
 */
export function generateUploadKey(nodeId: string, filename: string): string {
  return `${nodeId}_${filename}_${Date.now()}`;
}

/**
 * Generate file ID with filename context
 */
export function generateFileIdWithName(_filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2);
  return `file_${timestamp}_${random}`;
}

/**
 * Generate timestamped filename
 */
export function generateTimestampedFilename(base: string, ext: string = ''): string {
  return `${base}-${Date.now()}${ext}`;
}