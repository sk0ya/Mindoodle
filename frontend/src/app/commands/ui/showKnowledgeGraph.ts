/**
 * Show Knowledge Graph Command
 * Display workspace-wide knowledge graph in 3D
 */

import type { Command, CommandContext, CommandResult } from '../system/types';

export const showKnowledgeGraphCommand: Command = {
  name: 'show-knowledge-graph',
  aliases: ['knowledge-graph', 'kg', 'graph'],
  description: 'Show workspace knowledge graph in 3D',
  category: 'ui',
  examples: ['show-knowledge-graph', 'knowledge-graph', 'kg'],

  execute(context: CommandContext): CommandResult {
    try {
      const canToggle = typeof context.handlers.toggleKnowledgeGraph === 'function';
      const canSet = typeof context.handlers.setShowKnowledgeGraph === 'function';

      if (canSet) {
        (context.handlers.setShowKnowledgeGraph as (b: boolean) => void)(true);
      } else if (canToggle) {
        (context.handlers.toggleKnowledgeGraph as () => void)();
      } else {
        return {
          success: false,
          error: 'Knowledge graph controls are not available'
        };
      }

      return {
        success: true,
        message: 'Opened knowledge graph'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open knowledge graph'
      };
    }
  }
};
