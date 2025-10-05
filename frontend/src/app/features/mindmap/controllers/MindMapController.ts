// Thin controller placeholder to gradually migrate side-effects and wiring
// from view components into a single place.

export class MindMapController {
  // Future: constructor(deps: {...}) {}
  initialize(): void {
    // no-op for now
  }

  /**
   * Attach global explorer helpers for Vim and external integrations.
   * This preserves existing behavior while we gradually remove globals.
   */
  attachExplorerGlobals(mindMap: any): void {
    try {
      (window as any).mindoodleCreateFolder = async (path: string) => {
        if (typeof (mindMap as any).createFolder === 'function') {
          const wsMatch = path.match(/^\/?(ws_[^/]+|cloud)\/?(.*)$/);
          if (wsMatch) {
            const workspaceId = wsMatch[1];
            const relativePath = wsMatch[2] || '';
            await (mindMap as any).createFolder(relativePath, workspaceId);
          } else {
            await (mindMap as any).createFolder(path);
          }
        }
      };

      (window as any).mindoodleCreateAndSelectMap = async (title: string, workspaceId: string, category?: string) => {
        if (typeof (mindMap as any).createAndSelectMap === 'function') {
          await (mindMap as any).createAndSelectMap(title, workspaceId, category);
        }
      };
    } catch {
      // ignore globals failure
    }
  }
}
