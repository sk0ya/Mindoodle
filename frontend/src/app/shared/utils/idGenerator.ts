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
  const random = (() => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(9);
      crypto.getRandomValues(arr);
      return Array.from(arr, v => (v % 36).toString(36)).join('');
    }
    // Fallback (should rarely be used)
    return Math.random().toString(36).slice(2, 11);
  })();
  return `${prefix}_${timestamp}_${random}`;
}

export const generateNodeId = () => generateId('node');
export const generateLinkId = () => generateId('link');
export const generateNotificationId = () => generateId('notification');
export const generateFileId = () => generateId('file');
export const generateErrorId = () => generateId('error');
export const generateWorkspaceId = () => generateId('workspace');
export const generateUrlId = () => generateId('url');


export function generateFileIdWithName(_filename: string): string {
  const timestamp = Date.now();
  const random = (() => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(10);
      crypto.getRandomValues(arr);
      return Array.from(arr, v => (v % 36).toString(36)).join('');
    }
    return Math.random().toString(36).slice(2);
  })();
  return `file_${timestamp}_${random}`;
}


export function generateTimestampedFilename(base: string, ext: string = ''): string {
  return `${base}-${Date.now()}${ext}`;
}
