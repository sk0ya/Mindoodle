/**
 * Command Index
 * Exports all available commands for registration
 */

import { centerCommand } from './center';
import { deleteCommand } from './delete';
import { toggleCommand } from './toggle';
import { editCommand } from './edit';
import { insertCommand, appendCommand, openCommand } from './insert';
import {
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand
} from './navigate';

// Export all commands
export const commands = [
  // Core vim commands
  centerCommand,
  deleteCommand,
  toggleCommand,
  editCommand,

  // Insert mode commands
  insertCommand,
  appendCommand,
  openCommand,

  // Navigation commands
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand,
];

// Export individual commands for direct access
export {
  centerCommand,
  deleteCommand,
  toggleCommand,
  editCommand,
  insertCommand,
  appendCommand,
  openCommand,
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand,
};

// Helper function to register all commands
export function registerAllCommands(registry: any) {
  for (const command of commands) {
    registry.register(command);
  }
}

// Command categories for organization
export const commandCategories = {
  navigation: [navigateCommand, upCommand, downCommand, leftCommand, rightCommand, centerCommand],
  editing: [deleteCommand, editCommand, insertCommand, appendCommand, openCommand],
  structure: [toggleCommand],
} as const;