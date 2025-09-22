import { useEffect, useRef } from 'react';
import type { MindMapData } from '@shared/types';

interface AutoSaveOptions {
  debounceMs?: number;
  enabled?: boolean;
}

/**
 * 自動保存機能を提供するhook
 */
export const useAutoSave = (
  data: MindMapData | null,
  options: AutoSaveOptions = {},
  settings?: { autoSave?: boolean; autoSaveInterval?: number }
) => {
  const { debounceMs = settings?.autoSaveInterval || 300, enabled = settings?.autoSave ?? options.enabled ?? true } = options;

  const lastSaveTimeRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMapIdRef = useRef<string>('');
  const isInitialLoadRef = useRef<boolean>(true);

  useEffect(() => {
    if (!enabled || !data) return;

    const currentUpdatedAt = data.updatedAt || '';
    const currentMapId = data.mapIdentifier.mapId || '';

    // マップが切り替わった場合は保存しない
    if (currentMapId !== lastMapIdRef.current) {
      lastMapIdRef.current = currentMapId;
      lastSaveTimeRef.current = currentUpdatedAt;
      isInitialLoadRef.current = true; // 新しいマップの初回読み込みをマーク
      return;
    }

    // 初回読み込み時は保存しない（絶対に保存処理を走らせない）
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      lastSaveTimeRef.current = currentUpdatedAt;
      return;
    }

    // updatedAtが変更されていない場合は保存しない
    if (currentUpdatedAt === lastSaveTimeRef.current || !currentUpdatedAt) {
      return;
    }

    // 既存のタイマーをクリア
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [data?.updatedAt, data?.mapIdentifier.mapId, enabled, debounceMs]); // dataを依存配列から除外
};
