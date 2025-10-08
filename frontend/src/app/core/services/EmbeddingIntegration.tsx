/**
 * EmbeddingIntegration - ストア変更監視とベクトル化の統合
 *
 * Zustand storeのmarkdownContentを監視し、自動ベクトル化を実行します。
 */

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

    // マークダウンコンテンツが変更されたかチェック
    if (markdownContent && markdownContent !== previousContentRef.current) {
      previousContentRef.current = markdownContent;

      // 現在のマップのファイルパスを取得
      if (mapId) {
        const filePath = `${mapId}.md`;

        // ベクトル更新をスケジュール（2秒のデバウンス）
        embeddingOrchestrator.scheduleVectorUpdate(filePath, markdownContent);
      }
    }
  }, [settings.knowledgeGraph.enabled, data]);

  return null; // このコンポーネントは何もレンダリングしない
};
