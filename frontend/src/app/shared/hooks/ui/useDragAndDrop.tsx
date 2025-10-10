import { useState, useCallback } from 'react';
import type { MapIdentifier } from '@shared/types';
import { logger } from '../../utils/logger';
import type { MindMapData } from '@shared/types';

interface UseDragAndDropOptions {
  mindMaps: MindMapData[];
  onChangeCategory: (id: MapIdentifier, category: string) => void;
  onChangeCategoryBulk?: (mapUpdates: Array<{id: string, category: string}>) => Promise<void>;
  setEmptyFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  setCollapsedCategories: React.Dispatch<React.SetStateAction<Set<string>>>;
}

interface UseDragAndDropReturn {
  draggedMap: MindMapData | null;
  draggedFolder: string | null;
  dragOverCategory: string | null;
  handleDragStart: (e: React.DragEvent, map: MindMapData) => void;
  handleDragOver: (e: React.DragEvent, category: string) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, category: string) => void;
  handleFolderDragStart: (e: React.DragEvent, folderPath: string) => void;
  handleFolderDrop: (e: React.DragEvent, targetFolderPath: string) => Promise<void>;
  handleRootDrop: (e: React.DragEvent) => Promise<void>;
  clearDragState: () => void;
}

export const useDragAndDrop = ({
  mindMaps,
  onChangeCategory,
  onChangeCategoryBulk,
  setEmptyFolders,
  setCollapsedCategories
}: UseDragAndDropOptions): UseDragAndDropReturn => {
  const [draggedMap, setDraggedMap] = useState<MindMapData | null>(null);
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  const clearDragState = useCallback(() => {
    setDraggedMap(null);
    setDraggedFolder(null);
    setDragOverCategory(null);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, map: MindMapData) => {
    setDraggedMap(map);
    setDraggedFolder(null); 
    
    e.dataTransfer.effectAllowed = 'copyLink';
    e.dataTransfer.setData('text/map-id', map.mapIdentifier.mapId);
    e.dataTransfer.setData('text/map-title', map.title || '');
    logger.debug('Map drag started:', map.title, 'category:', map.category);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, category: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverCategory(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, category: string) => {
    e.preventDefault();
    logger.debug('Drop event triggered', { category, draggedMap: draggedMap?.title, draggedFolder });
    
    
    if (draggedMap && draggedMap.category !== category) {
      logger.debug('Moving map from', draggedMap.category, 'to', category);
      onChangeCategory({ mapId: draggedMap.mapIdentifier.mapId, workspaceId: draggedMap.mapIdentifier.workspaceId }, category);
    }
    
    clearDragState();
  }, [draggedMap, draggedFolder, onChangeCategory, clearDragState]);

  const handleFolderDragStart = useCallback((e: React.DragEvent, folderPath: string) => {
    setDraggedFolder(folderPath);
    setDraggedMap(null); 
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/folder-path', folderPath);
    logger.debug('Folder drag started:', folderPath);
  }, []);

  const handleFolderDrop = useCallback(async (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    logger.debug('Folder drop event triggered', { targetFolderPath, draggedFolder, draggedMap: draggedMap?.title });

    
    if (draggedMap && draggedMap.category !== targetFolderPath) {
      logger.debug('Moving map from', draggedMap.category, 'to folder', targetFolderPath);
      onChangeCategory({ mapId: draggedMap.mapIdentifier.mapId, workspaceId: draggedMap.mapIdentifier.workspaceId }, targetFolderPath);
      clearDragState();
      return;
    }

    
    if (!draggedFolder || draggedFolder === targetFolderPath) {
      clearDragState();
      return;
    }

    
    if (targetFolderPath.startsWith(draggedFolder + '/')) {
      alert('フォルダを自分の子フォルダに移動することはできません。');
      clearDragState();
      return;
    }

    
    const draggedFolderName = draggedFolder.split('/').pop();
    const newFolderPath = targetFolderPath + '/' + draggedFolderName;

    logger.info('Moving folder from', draggedFolder, 'to', newFolderPath);

    
    const mapsToUpdate = mindMaps.filter(map => 
      map.category === draggedFolder || (map.category && map.category.startsWith(draggedFolder + '/'))
    );

    logger.debug('Maps to update:', mapsToUpdate.length, 'maps');
    logger.debug('Drag operation:', { draggedFolder, newFolderPath });

    
    if (onChangeCategoryBulk && mapsToUpdate.length > 0) {
      const mapUpdates = mapsToUpdate.map(map => ({
        id: map.mapIdentifier.mapId,
        category: map.category?.replace(draggedFolder, newFolderPath) || newFolderPath
      })).filter(update => update.category !== undefined);
      
      logger.info('Bulk updating', mapUpdates.length, 'maps');
      await onChangeCategoryBulk(mapUpdates);
    } else {
      
      logger.warn('Bulk update not available, using individual updates');
      mapsToUpdate.forEach(map => {
        const updatedCategory = map.category?.replace(draggedFolder, newFolderPath);
        if (updatedCategory) {
          logger.debug(`Updating map "${map.title}" from "${map.category}" to "${updatedCategory}"`);
          onChangeCategory({ mapId: map.mapIdentifier.mapId, workspaceId: map.mapIdentifier.workspaceId }, updatedCategory);
        }
      });
    }

    
    setEmptyFolders(prev => {
      const newSet = new Set<string>();
      Array.from(prev).forEach(folder => {
        if (folder === draggedFolder) {
          newSet.add(newFolderPath);
        } else if (folder.startsWith(draggedFolder + '/')) {
          newSet.add(folder.replace(draggedFolder, newFolderPath));
        } else {
          newSet.add(folder);
        }
      });
      return newSet;
    });

    
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      newSet.delete(targetFolderPath);
      newSet.delete(newFolderPath);
      return newSet;
    });

    clearDragState();
  }, [draggedMap, draggedFolder, mindMaps, onChangeCategory, onChangeCategoryBulk, clearDragState, setEmptyFolders, setCollapsedCategories]);

  const handleRootDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    logger.debug('Root drop event triggered', { draggedFolder, draggedMap: draggedMap?.title });

    
    if (draggedMap && draggedMap.category !== '') {
      logger.debug('Moving map to root level');
      onChangeCategory({ mapId: draggedMap.mapIdentifier.mapId, workspaceId: draggedMap.mapIdentifier.workspaceId }, '');
      clearDragState();
      return;
    }

    // フォルダをルートレベルに移動
    if (draggedFolder) {
      const draggedFolderName = draggedFolder.split('/').pop();
      if (!draggedFolderName) return;

      // 既にルートレベルの場合は何もしない
      if (!draggedFolder.includes('/')) {
        clearDragState();
        return;
      }

      logger.info('Moving folder to root level:', draggedFolderName);

      // そのフォルダ内のすべてのマップとサブフォルダのカテゴリを更新
      const mapsToUpdate = mindMaps.filter(map => 
        map.category === draggedFolder || (map.category && map.category.startsWith(draggedFolder + '/'))
      );

      logger.debug('Root drop - Maps to update:', mapsToUpdate.length, 'maps');
      logger.debug('Root drop operation:', { draggedFolder, draggedFolderName });

      
      if (onChangeCategoryBulk && mapsToUpdate.length > 0) {
        const mapUpdates = mapsToUpdate.map(map => ({
          id: map.mapIdentifier.mapId,
          category: map.category?.replace(draggedFolder, draggedFolderName) || draggedFolderName
        })).filter(update => update.category !== undefined);
        
        logger.info('Root drop - Bulk updating', mapUpdates.length, 'maps');
        await onChangeCategoryBulk(mapUpdates);
      } else {
        
        logger.warn('Root drop - Bulk update not available, using individual updates');
        mapsToUpdate.forEach(map => {
          const updatedCategory = map.category?.replace(draggedFolder, draggedFolderName);
          if (updatedCategory) {
            logger.debug(`Root drop - Updating map "${map.title}" from "${map.category}" to "${updatedCategory}"`);
            onChangeCategory({ mapId: map.mapIdentifier.mapId, workspaceId: map.mapIdentifier.workspaceId }, updatedCategory);
          }
        });
      }

      
      setEmptyFolders(prev => {
        const newSet = new Set<string>();
        Array.from(prev).forEach(folder => {
          if (folder === draggedFolder) {
            newSet.add(draggedFolderName);
          } else if (folder.startsWith(draggedFolder + '/')) {
            newSet.add(folder.replace(draggedFolder, draggedFolderName));
          } else {
            newSet.add(folder);
          }
        });
        return newSet;
      });

      
      setCollapsedCategories(prev => {
        const newSet = new Set(prev);
        newSet.delete(draggedFolderName);
        return newSet;
      });
    }

    clearDragState();
  }, [draggedMap, draggedFolder, mindMaps, onChangeCategory, onChangeCategoryBulk, clearDragState, setEmptyFolders, setCollapsedCategories]);

  return {
    draggedMap,
    draggedFolder,
    dragOverCategory,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFolderDragStart,
    handleFolderDrop,
    handleRootDrop,
    clearDragState
  };
};
