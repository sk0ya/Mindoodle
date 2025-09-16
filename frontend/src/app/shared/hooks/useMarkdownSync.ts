import { useCallback } from 'react';
import { MarkdownImporter } from '../utils/markdownImporter';
import { type MindMapNode } from '../types/dataTypes';

/**
 * マークダウンとノード構造の同期を管理するフック
 */
export const useMarkdownSync = () => {
  /**
   * ノードのテキストを更新し、対応するマークダウンも更新
   */
  const updateNodeWithMarkdownSync = useCallback((
    nodes: MindMapNode[],
    nodeId: string,
    newText: string,
    onNodesUpdate: (nodes: MindMapNode[]) => void,
    onMarkdownUpdate?: (markdown: string) => void
  ) => {
    try {
      const { updatedNodes, updatedMarkdown } = MarkdownImporter.updateNodeInMarkdown(
        nodes,
        nodeId,
        newText
      );

      // ノード構造を更新
      onNodesUpdate(updatedNodes);

      // マークダウンも更新（必要に応じて）
      if (onMarkdownUpdate) {
        onMarkdownUpdate(updatedMarkdown);
      }

      return { success: true, updatedNodes, updatedMarkdown };
    } catch (error) {
      console.error('マークダウン同期エラー:', error);
      return { success: false, error };
    }
  }, []);

  /**
   * マークダウンからノード構造を再構築
   */
  const rebuildFromMarkdown = useCallback((
    markdownText: string,
    onNodesUpdate: (nodes: MindMapNode[]) => void,
    onError?: (error: string) => void,
    options?: {
      startX?: number;
      startY?: number;
      horizontalSpacing?: number;
      verticalSpacing?: number;
      applyMarkdownStyling?: boolean;
    }
  ) => {
    try {
      const { rootNodes } = MarkdownImporter.parseMarkdownToNodes(markdownText, options);
      let finalNodes = rootNodes;

      // マークダウン由来のスタイリングを適用
      if (options?.applyMarkdownStyling !== false) {
        finalNodes = MarkdownImporter.applyMarkdownStyling(finalNodes);
      }

      onNodesUpdate(finalNodes);
      return { success: true, rootNodes: finalNodes };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('マークダウンパースエラー:', errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * ノード構造からマークダウンを生成
   */
  const generateMarkdownFromNodes = useCallback((nodes: MindMapNode[]): string => {
    try {
      return MarkdownImporter.convertNodesToMarkdown(nodes);
    } catch (error) {
      console.error('マークダウン生成エラー:', error);
      return '';
    }
  }, []);

  /**
   * ノードがマークダウン由来かどうかを確認
   */
  const isMarkdownCompatible = useCallback((node: MindMapNode): boolean => {
    const structureInfo = MarkdownImporter.getNodeStructureInfo(node);
    return structureInfo.canConvertToMarkdown;
  }, []);

  /**
   * 順序ありリストの番号を再計算
   */
  const renumberOrderedLists = useCallback((
    nodes: MindMapNode[],
    onNodesUpdate: (nodes: MindMapNode[]) => void
  ) => {
    const renumberedNodes = MarkdownImporter.renumberOrderedLists(nodes);
    onNodesUpdate(renumberedNodes);
    return renumberedNodes;
  }, []);

  /**
   * ノードにマークダウンメタデータを設定
   */
  const setNodeMarkdownMeta = useCallback((
    nodes: MindMapNode[],
    nodeId: string,
    markdownMeta: import('../../../shared/types/core').MarkdownNodeMeta,
    onNodesUpdate: (nodes: MindMapNode[]) => void
  ) => {
    const updateNodeMeta = (nodeList: MindMapNode[]): MindMapNode[] => {
      return nodeList.map(node => {
        if (node.id === nodeId) {
          return { ...node, markdownMeta };
        }
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: updateNodeMeta(node.children)
          };
        }
        return node;
      });
    };

    const updatedNodes = updateNodeMeta(nodes);
    onNodesUpdate(updatedNodes);
    return updatedNodes;
  }, []);

  /**
   * 新しいノードに適切なマークダウンメタデータを追加
   */
  const addChildNodeWithMarkdownMeta = useCallback((
    nodes: MindMapNode[],
    parentId: string,
    newNodeText: string,
    onNodesUpdate: (nodes: MindMapNode[]) => void,
    createNewNode: (text: string) => MindMapNode
  ) => {
    const findParentNode = (nodeList: MindMapNode[]): MindMapNode | null => {
      for (const node of nodeList) {
        if (node.id === parentId) return node;
        if (node.children) {
          const found = findParentNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const parentNode = findParentNode(nodes);
    if (!parentNode) return nodes;

    const newNode = createNewNode(newNodeText);

    // 兄弟ノードと親ノードのマークダウンメタデータに基づいて子ノードのメタデータを設定
    if (parentNode.markdownMeta || (parentNode.children && parentNode.children.length > 0)) {
      let newNodeMeta: import('../../../shared/types/core').MarkdownNodeMeta;

      // まず兄弟ノードの最後のノードのmeta情報を確認
      const lastSibling = parentNode.children && parentNode.children.length > 0
        ? parentNode.children[parentNode.children.length - 1]
        : null;

      if (lastSibling && lastSibling.markdownMeta) {
        // 兄弟ノードがmarkdownMetaを持っている場合、同じタイプを継承
        const siblingMeta = lastSibling.markdownMeta;
        newNodeMeta = {
          type: siblingMeta.type,
          level: siblingMeta.level,
          originalFormat: siblingMeta.originalFormat,
          indentLevel: siblingMeta.indentLevel,
          lineNumber: -1
        };
      } else if (parentNode.markdownMeta) {
        // 兄弟ノードがない、または兄弟ノードにmarkdownMetaがない場合、親の情報から決定
        const parentMeta = parentNode.markdownMeta;

        if (parentMeta.type === 'heading') {
          const childLevel = parentMeta.level + 1;

          // レベル7以上になる場合はリストに変更
          if (childLevel >= 7) {
            newNodeMeta = {
              type: 'unordered-list',
              level: 1,
              originalFormat: '-',
              indentLevel: 0,
              lineNumber: -1
            };
          } else {
            // 見出しの子は見出し（レベル+1）
            newNodeMeta = {
              type: 'heading',
              level: childLevel,
              originalFormat: '#'.repeat(childLevel),
              indentLevel: 0,
              lineNumber: -1
            };
          }
        } else {
          // リストの子は同じタイプで一段深いインデント
          newNodeMeta = {
            type: parentMeta.type,
            level: parentMeta.level + 1,
            originalFormat: parentMeta.originalFormat,
            indentLevel: (parentMeta.indentLevel || 0) + 2, // 2スペース追加
            lineNumber: -1
          };
        }
      } else {
        // 親にもmarkdownMetaがない場合、markdownMetaを設定しない
        // 通常のマインドマップノードとして動作
        return nodes;
      }

      newNode.markdownMeta = newNodeMeta;
    }
    // 親がマークダウンノードでない場合は、新規ノードにもメタデータを設定しない
    // （通常のマインドマップとして動作）

    const addChildToNode = (nodeList: MindMapNode[]): MindMapNode[] => {
      return nodeList.map(node => {
        if (node.id === parentId) {
          return {
            ...node,
            children: [...(node.children || []), newNode]
          };
        }
        if (node.children && node.children.length > 0) {
          return {
            ...node,
            children: addChildToNode(node.children)
          };
        }
        return node;
      });
    };

    const updatedNodes = addChildToNode(nodes);
    onNodesUpdate(updatedNodes);
    return updatedNodes;
  }, []);

  /**
   * ノードのインデントを変更
   */
  const changeNodeIndent = useCallback((
    nodes: MindMapNode[],
    nodeId: string,
    direction: 'increase' | 'decrease',
    onNodesUpdate: (nodes: MindMapNode[]) => void
  ) => {
    const updatedNodes = MarkdownImporter.changeNodeIndent(nodes, nodeId, direction);
    onNodesUpdate(updatedNodes);
    return updatedNodes;
  }, []);

  /**
   * ノードタイプを変更（見出し ↔ リスト）
   */
  const changeNodeType = useCallback((
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'heading' | 'unordered-list' | 'ordered-list',
    onNodesUpdate: (nodes: MindMapNode[]) => void
  ) => {
    try {
      let updatedNodes = MarkdownImporter.changeNodeType(nodes, nodeId, newType);

      // 順序ありリストに変更した場合は番号を再計算
      if (newType === 'ordered-list') {
        updatedNodes = MarkdownImporter.renumberOrderedLists(updatedNodes);
      }

      onNodesUpdate(updatedNodes);
      return updatedNodes;
    } catch (error) {
      // エラーをキャッチして上位に伝える
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // エラーフラグ付きのオブジェクトを返す
      const errorResult = {
        ...nodes,
        __conversionError: errorMessage
      } as MindMapNode[] & { __conversionError: string };
      return errorResult;
    }
  }, []);

  /**
   * リストタイプを変更
   */
  const changeListType = useCallback((
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'unordered-list' | 'ordered-list',
    onNodesUpdate: (nodes: MindMapNode[]) => void
  ) => {
    let updatedNodes = MarkdownImporter.changeListType(nodes, nodeId, newType);

    // 順序ありリストに変更した場合は番号を再計算
    if (newType === 'ordered-list') {
      updatedNodes = MarkdownImporter.renumberOrderedLists(updatedNodes);
    }

    onNodesUpdate(updatedNodes);
    return updatedNodes;
  }, []);

  return {
    updateNodeWithMarkdownSync,
    rebuildFromMarkdown,
    generateMarkdownFromNodes,
    isMarkdownCompatible,
    renumberOrderedLists,
    setNodeMarkdownMeta,
    addChildNodeWithMarkdownMeta,
    changeNodeIndent,
    changeNodeType,
    changeListType
  };
};