// Re-export all command groups
export * from './navigation';
export * from './editing';
export * from './structure';
export * from './application';
export * from './ui';

// Export system utilities
export { useCommands } from './system';
export type { UseCommandsReturn } from './system';

// Import needed commands for categorization
import {
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand,
  centerCommand,
} from './navigation';

import {
  deleteCommand,
  editCommand,
  insertCommand,
  appendCommand,
  openCommand,
} from './editing';

import {
  toggleCommand,
  addChildCommand,
  addSiblingCommand,
  convertNodeCommand,
} from './structure';

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
