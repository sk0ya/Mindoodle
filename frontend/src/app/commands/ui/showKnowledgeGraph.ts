import type { Command } from '../system/types';
import { uiCommand, success, failure } from '../utils/commandFunctional';

export const showKnowledgeGraphCommand: Command = uiCommand(
  'show-knowledge-graph',
  'Show workspace knowledge graph in 3D',
  (context) => {
    try {
      const canSet = typeof context.handlers.setShowKnowledgeGraph === 'function';
      const canToggle = typeof context.handlers.toggleKnowledgeGraph === 'function';

      if (canSet) {
        (context.handlers.setShowKnowledgeGraph as (b: boolean) => void)(true);
      } else if (canToggle) {
        (context.handlers.toggleKnowledgeGraph as () => void)();
      } else {
        return failure('Knowledge graph controls are not available');
      }

      return success('Opened knowledge graph');
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Failed to open knowledge graph');
    }
  },
  {
    aliases: ['knowledge-graph', 'kg', 'graph'],
    examples: ['show-knowledge-graph', 'knowledge-graph', 'kg']
  }
);
