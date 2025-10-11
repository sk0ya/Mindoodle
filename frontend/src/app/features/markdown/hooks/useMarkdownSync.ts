import { useCallback } from 'react';
import { MarkdownImporter } from '../markdownImporter';
import { mergeNodesPreservingLayout } from '../markdownNodeMerge';
import { type MindMapNode } from '@shared/types';
import { statusMessages } from '@shared/utils';

export const useMarkdownSync = () => {
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

      
      onNodesUpdate(updatedNodes);

      
      if (onMarkdownUpdate) {
        onMarkdownUpdate(updatedMarkdown);
      }

      return { success: true, updatedNodes, updatedMarkdown };
    } catch (error) {
      console.error('マークダウン同期エラー:', error);
      statusMessages.markdownSyncFailed();
      return { success: false, error };
    }
  }, []);

    const rebuildFromMarkdown = useCallback((
    markdownText: string,
    onNodesUpdate: (nodes: MindMapNode[]) => void,
    onError?: (error: string) => void,
    options?: {
      startX?: number;
      startY?: number;
      horizontalSpacing?: number;
      verticalSpacing?: number;
      currentNodes?: MindMapNode[]; 
      preservePositions?: boolean; 
    }
  ) => {
    try {
      const { rootNodes } = MarkdownImporter.parseMarkdownToNodes(markdownText, options);
      let finalNodes = rootNodes;

      
      if (options?.currentNodes && options?.preservePositions) {
        finalNodes = mergeNodesPreservingLayout(options.currentNodes, rootNodes, null);
      }

      onNodesUpdate(finalNodes);
      return { success: true, rootNodes: finalNodes };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('マークダウンパースエラー:', errorMessage);
      if (onError) {
        onError(errorMessage);
      }
      try {
        if (/構造要素が見つかりません|見出しが見つかりません/.test(errorMessage)) {
          statusMessages.customWarning(errorMessage);
        } else {
          statusMessages.markdownParsingFailed(errorMessage);
        }
      } catch {}
      return { success: false, error: errorMessage };
    }
  }, []);

    const mergeWithExistingNodes = useCallback((
    newNodes: MindMapNode[],
    existingNodes: MindMapNode[]
  ): MindMapNode[] => {
    
    const existingNodeMap = new Map<string, MindMapNode>();
    
    const mapNodes = (nodes: MindMapNode[]) => {
      nodes.forEach(node => {
        existingNodeMap.set(node.text, node);
        if (node.children) {
          mapNodes(node.children);
        }
      });
    };
    
    mapNodes(existingNodes);

    
    const mergeNodeData = (nodes: MindMapNode[]): MindMapNode[] => {
      return nodes.map(newNode => {
        const existingNode = existingNodeMap.get(newNode.text);
        
        if (existingNode) {
          // Type guard: Extract extended properties not in base MindMapNode type
          const newExt = newNode as unknown as { kind?: string; tableData?: unknown };
          const existingExt = existingNode as unknown as { kind?: string; tableData?: unknown };
          const kind = newExt.kind ?? existingExt.kind;
          const tableData = newExt.tableData ?? existingExt.tableData;

          const mergedNode: Record<string, unknown> = {
            ...newNode,
            id: existingNode.id,
            x: existingNode.x,
            y: existingNode.y,
            
            color: existingNode.color || newNode.color,
            fontSize: existingNode.fontSize || newNode.fontSize,
            fontWeight: existingNode.fontWeight || newNode.fontWeight,
            fontFamily: existingNode.fontFamily || newNode.fontFamily,
            fontStyle: existingNode.fontStyle || newNode.fontStyle,
            links: existingNode.links || newNode.links,
            collapsed: existingNode.collapsed || newNode.collapsed,
          };

          
          if (kind) mergedNode.kind = kind;
          if (tableData) mergedNode.tableData = tableData;
          
          if (mergedNode.kind === 'table') {
            delete mergedNode.markdownMeta;
            if (!mergedNode.text) mergedNode.text = '';
            // noteはImporterが分離しているため、既存noteを尊重（パース側が更新したい場合はnewNode.noteが入る）
            mergedNode.note = newNode.note ?? existingNode.note;
          } else {
            // 非表ノードはnoteは最新（new）を優先
            mergedNode.note = newNode.note ?? existingNode.note;
          }

          // 子ノードも再帰的にマージ
          if (newNode.children) {
            mergedNode.children = mergeNodeData(newNode.children);
          }

          // Type: Convert merged node object back to MindMapNode
          return mergedNode as unknown as MindMapNode;
        } else {
          // 新しいノードの場合はそのまま使用（子ノードも処理）
          const processedNode: Record<string, unknown> = { ...newNode };
          if (newNode.children) {
            processedNode.children = mergeNodeData(newNode.children);
          }
          // Type: Convert processed node object back to MindMapNode
          return processedNode as unknown as MindMapNode;
        }
      });
    };

    return mergeNodeData(newNodes);
  }, []);

  /**
   * ノード構造からマークダウンを生成
   */
  const generateMarkdownFromNodes = useCallback((nodes: MindMapNode[]): string => {
    try {
      return MarkdownImporter.convertNodesToMarkdown(nodes);
    } catch (error) {
      console.error('マークダウン生成エラー:', error);
      statusMessages.markdownGenerationFailed();
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
    markdownMeta: import('@shared/types').MarkdownNodeMeta,
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

    
    if (parentNode.markdownMeta || (parentNode.children && parentNode.children.length > 0)) {
      let newNodeMeta: import('@shared/types').MarkdownNodeMeta;

      
      const lastSibling = parentNode.children && parentNode.children.length > 0
        ? parentNode.children[parentNode.children.length - 1]
        : null;

      if (lastSibling && lastSibling.markdownMeta) {
        
        const siblingMeta = lastSibling.markdownMeta;
        
        const inheritableType = siblingMeta.type === 'preface' ? 'heading' : (siblingMeta.type || 'heading');
        newNodeMeta = {
          type: inheritableType,
          level: siblingMeta.level || 1,
          originalFormat: siblingMeta.originalFormat || '',
          indentLevel: siblingMeta.indentLevel || 0,
          lineNumber: -1
        };
      } else if (parentNode.markdownMeta) {
        // 兄弟ノードがない、または兄弟ノードにmarkdownMetaがない場合、親の情報から決定
        const parentMeta = parentNode.markdownMeta;

        if (parentMeta.type === 'heading') {
          const childLevel = (parentMeta.level || 1) + 1;

          
          if (childLevel >= 7) {
            newNodeMeta = {
              type: 'unordered-list',
              level: 1,
              originalFormat: '-',
              indentLevel: 0,
              lineNumber: -1
            };
          } else {
            
            newNodeMeta = {
              type: 'heading',
              level: childLevel,
              originalFormat: '#'.repeat(childLevel),
              indentLevel: 0,
              lineNumber: -1
            };
          }
        } else {
          
          
          const parentType = parentMeta.type === 'preface' ? 'heading' : (parentMeta.type || 'heading');
          newNodeMeta = {
            type: parentType,
            level: (parentMeta.level || 1) + 1,
            originalFormat: parentMeta.originalFormat || '',
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

    const changeNodeType = useCallback((
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'heading' | 'unordered-list' | 'ordered-list',
    onNodesUpdate: (nodes: MindMapNode[]) => void
  ) => {
    try {
      let updatedNodes = MarkdownImporter.changeNodeType(nodes, nodeId, newType);

      
      if (newType === 'ordered-list') {
        updatedNodes = MarkdownImporter.renumberOrderedLists(updatedNodes);
      }

      onNodesUpdate(updatedNodes);
      return updatedNodes;
    } catch (error) {
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const errorResult = {
        ...nodes,
        __conversionError: errorMessage
      } as MindMapNode[] & { __conversionError: string };
      return errorResult;
    }
  }, []);

    const changeListType = useCallback((
    nodes: MindMapNode[],
    nodeId: string,
    newType: 'unordered-list' | 'ordered-list',
    onNodesUpdate: (nodes: MindMapNode[]) => void
  ) => {
    let updatedNodes = MarkdownImporter.changeListType(nodes, nodeId, newType);

    
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
    changeListType,
    mergeWithExistingNodes
  };
};;
