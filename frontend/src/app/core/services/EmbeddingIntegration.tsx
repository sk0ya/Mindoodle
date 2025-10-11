

import { useEffect, useRef } from 'react';
import { embeddingOrchestrator } from './EmbeddingOrchestrator';
import { useMindMapStore } from '@mindmap/store';
import { nodeToMarkdown } from '@markdown/index';

export const EmbeddingIntegration: React.FC = () => {
  const store = useMindMapStore();
  const { settings, data } = store;
  const previousContentRef = useRef<string>('');

  useEffect(() => {
    // ナレッジグラフが無効なら何もしない
    if (!settings.knowledgeGraph.enabled || !data) {
      return;
    }

    // rootNodesからマークダウンを生成
    const markdownContent = data.rootNodes.map(node => nodeToMarkdown(node)).join('\n');
    const mapId = data.mapIdentifier?.mapId;
    const workspaceId = data.mapIdentifier?.workspaceId;

    
    if (markdownContent && markdownContent !== previousContentRef.current) {
      previousContentRef.current = markdownContent;

      
      if (mapId) {
        const filePath = `${workspaceId}::${mapId}.md`;
        
        
        embeddingOrchestrator.scheduleVectorUpdate(filePath, markdownContent);
      }
    }
  }, [settings.knowledgeGraph.enabled, data]);

  return null; 
};
