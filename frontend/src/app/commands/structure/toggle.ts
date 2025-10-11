
import type { Command, CommandContext, CommandResult } from '../system/types';
import type { MindMapNode } from '@shared/types';
import { useMindMapStore } from '@mindmap/store';
import { MarkdownImporter } from '../../features/markdown/markdownImporter';
import { statusMessages } from '@shared/utils';

export const toggleCommand: Command = {
  name: 'toggle',
  aliases: ['za', 'toggle-collapse', 'fold'],
  description: 'Toggle the collapse state of node children',
  category: 'structure',
  examples: [
    'toggle',
    'za',
    'toggle node-123',
    'fold --expand'
  ],
  args: [
    {
      name: 'nodeId',
      type: 'node-id',
      required: false,
      description: 'Node ID to toggle (uses selected node if not specified)'
    },
    {
      name: 'expand',
      type: 'boolean',
      required: false,
      description: 'Force expand (true) or collapse (false). If not specified, toggles current state'
    }
  ],

  execute(context: CommandContext, args: Record<string, string | number | boolean>): CommandResult {
    const nodeId = (typeof args['nodeId'] === 'string' ? args['nodeId'] : undefined) || context.selectedNodeId;
    const forceState = typeof args['expand'] === 'boolean' ? args['expand'] : undefined;

    if (!nodeId) {
      const errorMessage = 'ノードが選択されておらず、ノードIDも指定されていません';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    
    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      const errorMessage = `ノード ${nodeId} が見つかりません`;
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    
    if (!node.children || node.children.length === 0) {
      const errorMessage = `ノード「${node.text}」にはトグルできる子ノードがありません`;
      statusMessages.customWarning(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    
    let newCollapsedState: boolean;
    if (forceState !== undefined) {
      newCollapsedState = !forceState; 
    } else {
      newCollapsedState = !node.collapsed; 
    }

    try {
      context.handlers.updateNode(nodeId, { collapsed: newCollapsedState });

      const action = newCollapsedState ? 'collapsed' : 'expanded';
      return {
        success: true,
        message: `${action} node "${node.text}" (${node.children.length} children)`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ノード状態の切り替えに失敗しました';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
};

export const expandCommand: Command = {
  name: 'expand',
  aliases: ['zo', 'open-fold'],
  description: 'Expand the selected node to show its children',
  category: 'structure',
  examples: ['expand', 'zo'],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      const errorMessage = 'ノードが選択されていません';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      const errorMessage = `ノード ${nodeId} が見つかりません`;
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    if (!node.children || node.children.length === 0) {
      const errorMessage = `ノード「${node.text}」には展開できる子ノードがありません`;
      statusMessages.customWarning(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    if (!node.collapsed) {
      return {
        success: true,
        message: `Node "${node.text}" is already expanded`
      };
    }

    try {
      context.handlers.updateNode(nodeId, { collapsed: false });
      return {
        success: true,
        message: `Expanded node "${node.text}" (${node.children.length} children)`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ノードの展開に失敗しました';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
};

export const collapseCommand: Command = {
  name: 'collapse',
  aliases: ['zc', 'close-fold'],
  description: 'Collapse the selected node to hide its children',
  category: 'structure',
  examples: ['collapse', 'zc'],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      const errorMessage = 'ノードが選択されていません';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      const errorMessage = `ノード ${nodeId} が見つかりません`;
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    if (!node.children || node.children.length === 0) {
      const errorMessage = `ノード「${node.text}」には折りたたみできる子ノードがありません`;
      statusMessages.customWarning(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    if (node.collapsed) {
      return {
        success: true,
        message: `Node "${node.text}" is already collapsed`
      };
    }

    try {
      context.handlers.updateNode(nodeId, { collapsed: true });
      return {
        success: true,
        message: `Collapsed node "${node.text}" (${node.children.length} children)`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'ノードの折りたたみに失敗しました';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
};

export const expandAllCommand: Command = {
  name: 'expand-all',
  aliases: ['zR', 'open-all-folds'],
  description: 'Expand all nodes in the mindmap',
  category: 'structure',
  examples: ['expand-all', 'zR'],

  execute(context: CommandContext): CommandResult {
    try {

      const state = useMindMapStore.getState();
      const rootNodes: MindMapNode[] = state?.data?.rootNodes || [];

      if (rootNodes.length === 0) {
        const errorMessage = '現在のマインドマップにノードが見つかりません';
        statusMessages.customError(errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }

      let expandedCount = 0;


      function expandAllNodes(nodes: MindMapNode[]): void {
        for (const node of nodes) {
          if (node.children && node.children.length > 0 && node.collapsed) {
            context.handlers.updateNode(node.id, { collapsed: false });
            expandedCount++;
          }
          if (node.children) {
            expandAllNodes(node.children);
          }
        }
      }

      expandAllNodes(rootNodes);

      return {
        success: true,
        message: `Expanded all nodes (${expandedCount} nodes were collapsed)`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'すべてのノードの展開に失敗しました';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
};

export const collapseAllCommand: Command = {
  name: 'collapse-all',
  aliases: ['zM', 'close-all-folds'],
  description: 'Collapse all nodes in the mindmap',
  category: 'structure',
  examples: ['collapse-all', 'zM'],

  execute(context: CommandContext): CommandResult {
    try {

      const state = useMindMapStore.getState();
      const rootNodes: MindMapNode[] = state?.data?.rootNodes || [];

      if (rootNodes.length === 0) {
        const errorMessage = '現在のマインドマップにノードが見つかりません';
        statusMessages.customError(errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }

      let collapsedCount = 0;


      function collapseAllNodes(nodes: MindMapNode[]): void {
        for (const node of nodes) {
          if (node.children && node.children.length > 0 && !node.collapsed) {
            context.handlers.updateNode(node.id, { collapsed: true });
            collapsedCount++;
          }
          if (node.children) {
            collapseAllNodes(node.children);
          }
        }
      }

      collapseAllNodes(rootNodes);

      return {
        success: true,
        message: `Collapsed all nodes (${collapsedCount} nodes were expanded)`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'すべてのノードの折りたたみに失敗しました';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
};

export const toggleCheckboxCommand: Command = {
  name: 'toggle-checkbox',
  aliases: ['x', 'checkbox-toggle'],
  description: 'Toggle checkbox state of a list node, or convert to checkbox list',
  category: 'structure',
  examples: ['toggle-checkbox', 'x'],

  execute(context: CommandContext): CommandResult {
    const nodeId = context.selectedNodeId;

    if (!nodeId) {
      const errorMessage = 'ノードが選択されていません';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    const node = context.handlers.findNodeById(nodeId);
    if (!node) {
      const errorMessage = `ノード ${nodeId} が見つかりません`;
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }

    try {

      const store = useMindMapStore.getState();


      if (node.markdownMeta?.isCheckbox) {
        
        
        const normalizedNode = store.normalizedData?.nodes[nodeId];
        const currentChecked = normalizedNode?.markdownMeta?.isChecked ?? node.markdownMeta.isChecked ?? false;
        const newChecked = !currentChecked;

        if (store.toggleNodeCheckbox) {
          store.toggleNodeCheckbox(nodeId, newChecked);
          return {
            success: true,
            message: `Checkbox ${newChecked ? 'checked' : 'unchecked'} for "${node.text}"`
          };
        }
      } else {
        
        const data = store.data;
        if (!data || !data.rootNodes) {
          const errorMessage = 'マップデータが利用できません';
          statusMessages.customError(errorMessage);
          return {
            success: false,
            error: errorMessage
          };
        }

        
        if (node.markdownMeta?.type === 'heading') {
          
          const safetyCheck = MarkdownImporter.canSafelyConvertToList(data.rootNodes, nodeId);

          if (!safetyCheck.canConvert) {
            const errorMessage = safetyCheck.reason || '見出しノードから変換できません';
            statusMessages.customError(errorMessage);
            return {
              success: false,
              error: errorMessage
            };
          }
        }

        const updateNodeInTree = (nodes: MindMapNode[]): MindMapNode[] => {
          return nodes.map((n: MindMapNode) => {
            if (n.id === nodeId) {
              let newMarkdownMeta;
              
              if (node.markdownMeta?.type === 'unordered-list' || node.markdownMeta?.type === 'ordered-list') {
                
                newMarkdownMeta = {
                  ...node.markdownMeta,
                  isCheckbox: true,
                  isChecked: false
                };
              } else {
                
                
                newMarkdownMeta = {
                  type: 'unordered-list' as const,
                  level: 1,
                  originalFormat: '-',
                  indentLevel: 0,
                  lineNumber: node.markdownMeta?.lineNumber ?? 0,
                  isCheckbox: true,
                  isChecked: false
                };
              }

              return {
                ...n,
                markdownMeta: newMarkdownMeta
              };
            }

            if (n.children && n.children.length > 0) {
              return {
                ...n,
                children: updateNodeInTree(n.children)
              };
            }

            return n;
          });
        };

        
        const updatedRootNodes = updateNodeInTree(data.rootNodes);
        
        
        
        store.setRootNodes(updatedRootNodes, { emit: true, source: 'toggle-checkbox-convert' });

        let sourceType: string;
        const nodeType = node.markdownMeta?.type;
        if (nodeType === 'heading') {
          sourceType = '見出し';
        } else if (nodeType === 'unordered-list' || nodeType === 'ordered-list') {
          sourceType = 'リスト';
        } else {
          sourceType = '通常';
        }

        return {
          success: true,
          message: `${sourceType}ノード「${node.text}」をチェックボックスリストに変換しました (unchecked)`
        };
      }

      const errorMessage = 'チェックボックスのトグルに失敗しました';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'チェックボックスのトグルでエラーが発生しました';
      statusMessages.customError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }
};
