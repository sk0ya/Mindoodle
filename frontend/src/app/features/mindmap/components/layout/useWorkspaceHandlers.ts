import React from 'react';
import type { NodeLink, MindMapData, MindMapNode } from '@shared/types';

interface Options {
  selectNode: (nodeId: string | null) => void;
  startEditing: (nodeId: string) => void;
  finishEditing: (nodeId: string, text: string) => void;
  addNode: (parentId: string) => void;
  addSiblingNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  toggleNodeCollapse: (nodeId: string) => void;
  handleShowLinkActionMenu: (...args: any[]) => void;
  handleAddLink: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  applyAutoLayout: () => void;
  allMindMaps: MindMapData[];
  data: MindMapData | null;
  handleLinkNavigate2: (link: NodeLink) => void;
}

export const useWorkspaceHandlers = (opts: Options) => {
  const {
    selectNode,
    startEditing,
    finishEditing,
    addNode,
    addSiblingNode,
    deleteNode,
    toggleNodeCollapse,
    handleShowLinkActionMenu,
    handleAddLink,
    updateNode,
    applyAutoLayout,
    allMindMaps,
    data,
    handleLinkNavigate2,
  } = opts;

  const onSelectNode = React.useCallback((nodeId: string | null) => {
    selectNode(nodeId);
  }, [selectNode]);

  const onStartEdit = React.useCallback((nodeId: string) => {
    startEditing(nodeId);
  }, [startEditing]);

  const onFinishEdit = React.useCallback((nodeId: string, text: string) => {
    finishEditing(nodeId, text);
  }, [finishEditing]);

  const onAddChild = React.useCallback((parentId: string) => {
    addNode(parentId);
  }, [addNode]);

  const onAddSibling = React.useCallback((nodeId: string) => {
    addSiblingNode(nodeId);
  }, [addSiblingNode]);

  const onDeleteNode = React.useCallback((nodeId: string) => {
    deleteNode(nodeId);
  }, [deleteNode]);

  const onToggleCollapse = React.useCallback((nodeId: string) => {
    toggleNodeCollapse(nodeId);
  }, [toggleNodeCollapse]);

  const onShowLinkActionMenu = React.useCallback((...args: any[]) => {
    handleShowLinkActionMenu(...args);
  }, [handleShowLinkActionMenu]);

  const onAddLink = React.useCallback((nodeId: string) => {
    handleAddLink(nodeId);
  }, [handleAddLink]);

  const onUpdateNode = React.useCallback((nodeId: string, updates: Partial<MindMapNode>) => {
    updateNode(nodeId, updates);
  }, [updateNode]);

  const onAutoLayout = React.useCallback(() => {
    applyAutoLayout();
  }, [applyAutoLayout]);

  const onLinkNavigate = React.useCallback((link: NodeLink) => {
    handleLinkNavigate2(link);
  }, [handleLinkNavigate2]);

  const availableMaps = React.useMemo(() => (
    allMindMaps.map((map) => ({ id: map.mapIdentifier.mapId, title: map.title }))
  ), [allMindMaps]);

  const currentMapData = data;

  return {
    onSelectNode,
    onStartEdit,
    onFinishEdit,
    onAddChild,
    onAddSibling,
    onDeleteNode,
    onToggleCollapse,
    onShowLinkActionMenu,
    onAddLink,
    onUpdateNode,
    onAutoLayout,
    onLinkNavigate,
    availableMaps,
    currentMapData,
  };
};

