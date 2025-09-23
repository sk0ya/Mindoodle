// Re-export all command groups - direct imports since index.ts files removed
export * from './navigation/navigate';
export * from './navigation/navigation';
export * from './navigation/center';
export * from './editing/delete';
export { editCommand } from './editing/edit';
export { openCommand } from './editing/insert';
export * from './structure/structure';
export * from './structure/toggle';
export * from './application/application';
export * from './application/mindmap';
export * from './ui/ui';

// Export system utilities - direct imports since index.ts removed
export { useCommands } from './system/useCommands';
export type { UseCommandsReturn } from './system/useCommands';

// Import needed commands for categorization
import {
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand,
} from './navigation/navigate';
import { centerCommand } from './navigation/center';

import { deleteCommand } from './editing/delete';
import { editCommand, insertCommand, appendCommand } from './editing/edit';
import { openCommand } from './editing/insert';

import { toggleCommand } from './structure/toggle';
import {
  addChildCommand,
  addSiblingCommand,
  convertNodeCommand,
} from './structure/structure';

// Command categories for organization
export const commandCategories = {
  navigation: [navigateCommand, upCommand, downCommand, leftCommand, rightCommand, centerCommand],
  editing: [deleteCommand, editCommand, insertCommand, appendCommand, openCommand],
  structure: [toggleCommand, addChildCommand, addSiblingCommand, convertNodeCommand],
} as const;

// Flattened list of all commands
export const commands = Object.values(commandCategories).flat();

// Helper function to register all commands
export function registerAllCommands(registry: any) {
  for (const command of commands) {
    try {
      registry.register(command);
    } catch (error) {
      console.warn(`Failed to register command: ${command?.name ?? 'unknown'}`, error);
    }
  }
}
