
import { CLOUD_AUTH_EXPIRED_EVENT, type CloudStorageAdapter } from '@core/storage/adapters/CloudStorageAdapter';
import { WorkspaceService } from '@shared/services';
import { logger } from '@shared/utils';

interface MindMapMethods {
  createFolder?: (path: string, workspaceId?: string) => Promise<void>;
  createAndSelectMap?: (title: string, workspaceId: string, category?: string) => Promise<string | void>;
}

interface WindowWithMindoodle extends Window {
  mindoodleCreateFolder?: (path: string) => Promise<void>;
  mindoodleCreateAndSelectMap?: (title: string, workspaceId: string, category?: string) => Promise<void>;
}

export class MindMapController {


    attachExplorerGlobals(mindMap: MindMapMethods): void {
    try {
      (window as WindowWithMindoodle).mindoodleCreateFolder = async (path: string) => {
        if (typeof mindMap.createFolder === 'function') {
          const p = path.startsWith('/') ? path.slice(1) : path;
          if (p.startsWith('ws_') || p.startsWith('cloud') || p.startsWith('group')) {
            const slash = p.indexOf('/');
            const workspaceId = slash >= 0 ? p.slice(0, slash) : p;
            const relativePath = slash >= 0 ? p.slice(slash + 1) : '';
            await mindMap.createFolder(relativePath, workspaceId);
          } else {
            await mindMap.createFolder(path);
          }
        }
      };

      (window as WindowWithMindoodle).mindoodleCreateAndSelectMap = async (title: string, workspaceId: string, category?: string) => {
        if (typeof mindMap.createAndSelectMap === 'function') {
          await mindMap.createAndSelectMap(title, workspaceId, category);
        }
      };
    } catch (e) {
      logger.warn('attachExplorerGlobals failed', e);
    }
  }

    attachAuthModalBridge(handlers: {
    setAuthCloudAdapter: (a: CloudStorageAdapter | null) => void;
    setAuthOnSuccess: (fn: ((a: CloudStorageAdapter) => void) | null) => void;
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
        logger.warn('mindoodle:showAuthModal handler error', e);
      }
    };
    window.addEventListener('mindoodle:showAuthModal', listener as EventListener);

    // A cloud/group session ended on the server's say-so: its workspace is
    // already gone (WorkspaceService.handleSessionEnded), so offer the login
    // straight away. The modal tells the user why (AuthModal reads the
    // adapter's session-end reason). Sessions that ended before this bridge
    // was attached — the startup check runs in the background — are queued in
    // WorkspaceService and picked up here too.
    const openReLogin = () => {
      try {
        const [ended] = WorkspaceService.getInstance().takeEndedSessions();
        if (!ended) return;
        const { adapter, workspaceId } = ended;
        const onSuccess = (signedIn: CloudStorageAdapter) => {
          const workspaceService = WorkspaceService.getInstance();
          if (workspaceId === 'group') {
            workspaceService.addGroupWorkspace(signedIn);
          } else {
            workspaceService.addCloudWorkspace(signedIn);
          }
        };
        handlers.setAuthCloudAdapter(adapter);
        // A state setter: wrap so React stores the callback instead of calling it.
        handlers.setAuthOnSuccess(() => onSuccess);
        handlers.setIsAuthModalOpen(true);
      } catch (e) {
        logger.warn(`${CLOUD_AUTH_EXPIRED_EVENT} handler error`, e);
      }
    };
    openReLogin();
    window.addEventListener(CLOUD_AUTH_EXPIRED_EVENT, openReLogin);

    return () => {
      window.removeEventListener('mindoodle:showAuthModal', listener as EventListener);
      window.removeEventListener(CLOUD_AUTH_EXPIRED_EVENT, openReLogin);
    };
  }
}
