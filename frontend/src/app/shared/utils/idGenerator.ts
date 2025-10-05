export type IdType =
  | 'node'
  | 'map'
  | 'link'
  | 'notification'
  | 'file'
  | 'error'
  | 'workspace'
  | 'url'
  | 'listener'
  | 'mermaid';

const ID_PREFIXES: Record<IdType, string> = {
  node: 'node',
  map: 'map',
  link: 'link',
  notification: 'notif',
  file: 'file',
  error: 'err',
  workspace: 'ws',
  url: 'url',
  listener: 'listener',
  mermaid: 'mmd'
};

export function generateId(type: IdType = 'node'): string {
  const prefix = ID_PREFIXES[type];
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

export const generateNodeId = () => generateId('node');
export const generateLinkId = () => generateId('link');
export const generateNotificationId = () => generateId('notification');
export const generateFileId = () => generateId('file');
export const generateErrorId = () => generateId('error');
export const generateWorkspaceId = () => generateId('workspace');
export const generateUrlId = () => generateId('url');

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
