


export class MindMapController {
  

    attachExplorerGlobals(mindMap: any): void {
    try {
      (window as any).mindoodleCreateFolder = async (path: string) => {
        if (typeof (mindMap).createFolder === 'function') {
          const wsMatch = path.match(/^\/?(ws_[^/]+|cloud)\/?(.*)$/);
          if (wsMatch) {
            const workspaceId = wsMatch[1];
            const relativePath = wsMatch[2] || '';
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
    } catch {
      
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
      } catch {  }
    };
    window.addEventListener('mindoodle:showAuthModal', listener as EventListener);
    return () => window.removeEventListener('mindoodle:showAuthModal', listener as EventListener);
  }
}
