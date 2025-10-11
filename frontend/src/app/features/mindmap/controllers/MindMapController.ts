


export class MindMapController {
  

    attachExplorerGlobals(mindMap: any): void {
    try {
      (window as any).mindoodleCreateFolder = async (path: string) => {
        if (typeof (mindMap).createFolder === 'function') {
          const p = path.startsWith('/') ? path.slice(1) : path;
          if (p.startsWith('ws_') || p.startsWith('cloud')) {
            const slash = p.indexOf('/');
            const workspaceId = slash >= 0 ? p.slice(0, slash) : p;
            const relativePath = slash >= 0 ? p.slice(slash + 1) : '';
            await (mindMap).createFolder(relativePath, workspaceId);
          } else {
            await (mindMap).createFolder(path);
          }
        }
      };

      (window as any).mindoodleCreateAndSelectMap = async (title: string, workspaceId: string, category?: string) => {
        if (typeof (mindMap).createAndSelectMap === 'function') {
          await (mindMap).createAndSelectMap(title, workspaceId, category);
        }
      };
    } catch (e) {
      console.warn('attachExplorerGlobals failed', e);
    }
  }

    attachAuthModalBridge(handlers: {
    setAuthCloudAdapter: (a: any) => void;
    setAuthOnSuccess: (fn: ((a: any) => void) | null) => void;
    setIsAuthModalOpen: (open: boolean) => void;
  }): () => void {
    const listener = (event: Event) => {
      try {
        const detail = (event as CustomEvent).detail || {};
        const { cloudAdapter, onSuccess } = detail;
        handlers.setAuthCloudAdapter(cloudAdapter);
        
        handlers.setAuthOnSuccess(() => onSuccess || null);
        handlers.setIsAuthModalOpen(true);
      } catch (e) {
        console.warn('mindoodle:showAuthModal handler error', e);
      }
    };
    window.addEventListener('mindoodle:showAuthModal', listener as EventListener);
    return () => window.removeEventListener('mindoodle:showAuthModal', listener as EventListener);
  }
}
