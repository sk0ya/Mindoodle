/**
 * Command Index
 * Exports all available commands for registration
 */

// Import from organized categories
import {
  centerCommand,
  centerLeftCommand,
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand,
  arrowNavigateCommand,
  selectNodeCommand,
  findNodeCommand,
  zoomInCommand,
  zoomOutCommand,
  zoomResetCommand,
  selectRootNodeCommand,
  selectCenterNodeCommand,
  selectBottomNodeCommand,
  scrollUpCommand,
  scrollDownCommand,
  nextMapCommand,
  prevMapCommand,
  selectCurrentRootCommand
} from './navigation';

import {
  deleteCommand,
  editCommand,
  insertCommand as insertEditCommand,
  appendCommand as appendEditCommand,
  appendEndCommand,
  insertBeginningCommand,
  insertCommand,
  appendCommand,
  openCommand,
  openAboveCommand
} from './editing';

import {
  toggleCommand,
  expandCommand,
  collapseCommand,
  expandAllCommand,
  collapseAllCommand,
  addChildCommand,
  addSiblingCommand,
  convertNodeCommand
} from './structure';

import {
  undoCommand,
  redoCommand,
  copyCommand,
  pasteCommand,
  cutCommand,
  newMindmapCommand,
  clearMindmapCommand,
  statsCommand,
  autoLayoutCommand,
  themeCommand
} from './application';

import {
  helpCommand,
  closePanelsCommand,
  startEditCommand,
  startEditEndCommand,
  markdownConvertCommand
} from './ui';

// Export all commands
export const commands = [
  // Core vim commands
  centerCommand,
  centerLeftCommand,
  deleteCommand,
  toggleCommand,
  expandCommand,
  collapseCommand,
  expandAllCommand,
  collapseAllCommand,
  editCommand,

  // Vim editing commands
  insertEditCommand,
  appendEditCommand,
  appendEndCommand,
  insertBeginningCommand,

  // Insert mode commands
  insertCommand,
  appendCommand,
  openCommand,
  openAboveCommand,

  // Structure commands
  addChildCommand,
  addSiblingCommand,
  convertNodeCommand,

  // Navigation commands
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand,

  // Application commands
  undoCommand,
  redoCommand,
  copyCommand,
  pasteCommand,
  cutCommand,

  // UI commands
  helpCommand,
  closePanelsCommand,
  startEditCommand,
  startEditEndCommand,
  markdownConvertCommand,

  // Extended navigation commands
  arrowNavigateCommand,
  selectNodeCommand,
  findNodeCommand,
  zoomInCommand,
  zoomOutCommand,
  zoomResetCommand,
  selectRootNodeCommand,
  selectCenterNodeCommand,
  selectBottomNodeCommand,
  scrollUpCommand,
  scrollDownCommand,
  nextMapCommand,
  prevMapCommand,
  selectCurrentRootCommand,

  // Mindmap commands
  newMindmapCommand,
  clearMindmapCommand,
  statsCommand,
  autoLayoutCommand,
  themeCommand,
];

// Export individual commands for direct access
export {
  centerCommand,
  centerLeftCommand,
  deleteCommand,
  toggleCommand,
  expandCommand,
  collapseCommand,
  expandAllCommand,
  collapseAllCommand,
  editCommand,
  insertEditCommand,
  appendEditCommand,
  appendEndCommand,
  insertBeginningCommand,
  insertCommand,
  appendCommand,
  openCommand,
  openAboveCommand,
  addChildCommand,
  addSiblingCommand,
  convertNodeCommand,
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand,
  // Application commands
  undoCommand,
  redoCommand,
  copyCommand,
  pasteCommand,
  cutCommand,
  // UI commands
  helpCommand,
  closePanelsCommand,
  startEditCommand,
  startEditEndCommand,
  markdownConvertCommand,
  // Extended navigation commands
  arrowNavigateCommand,
  selectNodeCommand,
  findNodeCommand,
  zoomInCommand,
  zoomOutCommand,
  zoomResetCommand,
  selectRootNodeCommand,
  selectCenterNodeCommand,
  selectBottomNodeCommand,
  scrollUpCommand,
  scrollDownCommand,
  nextMapCommand,
  prevMapCommand,
  selectCurrentRootCommand,
  // Mindmap commands
  newMindmapCommand,
  clearMindmapCommand,
  statsCommand,
  autoLayoutCommand,
  themeCommand,
};

// Export system utilities
export { useCommands } from './system';
export type { UseCommandsReturn } from './system';

// Helper function to register all commands
export function registerAllCommands(registry: any) {
  for (const command of commands) {
    try {
      registry.register(command);
    } catch (error) {
      // Silently ignore registration conflicts
      // This allows the system to continue working even with alias conflicts
    }
  }
}

// Command categories for organization
export const commandCategories = {
  navigation: [navigateCommand, upCommand, downCommand, leftCommand, rightCommand, centerCommand],
  editing: [deleteCommand, editCommand, insertCommand, appendCommand, openCommand],
  structure: [toggleCommand, addChildCommand, addSiblingCommand, convertNodeCommand],
} as const;
