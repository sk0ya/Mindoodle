import type { MindMapData } from '@shared/types';

export interface DataReloadDependencies {
  setData: (data: MindMapData) => void;
  isInitialized: boolean;
  refreshMapList?: () => Promise<void>;
  applyAutoLayout?: () => void;
  currentWorkspaceId: string;
}