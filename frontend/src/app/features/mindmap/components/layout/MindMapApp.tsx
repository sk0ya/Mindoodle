import React, { useState } from 'react';
import { useMindMap } from '@mindmap/hooks';
import { useMindMapStore } from '../../store';
import MindMapProviders from './MindMapProviders';
import { MindMapController } from '@mindmap/controllers/MindMapController';
import './MindMapApp.css';
import { VimProvider } from '../../../vim/context/vimContext';
import type { StorageConfig } from '@core/types';
import MindMapAppContent from './MindMapAppContent';

interface MindMapAppProps {
  storageMode?: 'local';
  resetKey?: number;
}

// Wrapper component that handles mindMap creation and VimProvider setup
const MindMapAppWrapper: React.FC<MindMapAppProps> = (props) => {
  const { resetKey = 0 } = props;
  const [internalResetKey, setInternalResetKey] = useState(resetKey);
  const store = useMindMapStore();

  // Sync external resetKey with internal resetKey
  React.useEffect(() => {
    setInternalResetKey(resetKey);
  }, [resetKey]);

  // Create storage configuration based on selected mode
  const storageConfig: StorageConfig = React.useMemo(() => {
    return {
      mode: store.settings.storageMode,
      cloudApiEndpoint: store.settings.cloudApiEndpoint,
    } as StorageConfig;
  }, [store.settings.storageMode, store.settings.cloudApiEndpoint]);

  // Create mindMap instance first
  const mindMap = useMindMap(storageConfig, Math.max(resetKey, internalResetKey));

  // Make Explorer's createFolder and createAndSelectMap available globally for Vim
  React.useEffect(() => {
    try {
      const controller = new MindMapController();
      controller.attachExplorerGlobals(mindMap);
    } catch {}
  }, [mindMap]);

  return (
    <VimProvider mindMap={mindMap}>
      <MindMapAppContent mindMap={mindMap} />
    </VimProvider>
  );
};

const MindMapApp: React.FC<MindMapAppProps> = (props) => {
  return (
    <MindMapProviders>
      <MindMapAppWrapper {...props} />
    </MindMapProviders>
  );
};

export default MindMapApp;

