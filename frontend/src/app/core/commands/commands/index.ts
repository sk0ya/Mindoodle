/**
 * Command Index
 * Exports all available commands for registration
 */

import { centerCommand } from './center';
import { deleteCommand } from './delete';
import { toggleCommand } from './toggle';
import { editCommand } from './edit';
import { insertCommand, appendCommand, openCommand, openAboveCommand } from './insert';
import { addChildCommand, addSiblingCommand, convertNodeCommand } from './structure';
import {
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand
} from './navigate';

// New command categories
import {
  undoCommand,
  redoCommand,
  saveCommand,
  copyCommand,
  pasteCommand,
  cutCommand
} from './application';

import {
  helpCommand,
  closePanelsCommand,
  startEditCommand,
  startEditEndCommand,
  markdownConvertCommand
} from './ui';

import {
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
  prevMapCommand
} from './navigation';

import {
  importMindmapCommand,
  exportMindmapCommand,
  newMindmapCommand,
  clearMindmapCommand,
  statsCommand,
  autoLayoutCommand,
  themeCommand
} from './mindmap';

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
  saveCommand,
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

  // Mindmap commands
  importMindmapCommand,
  exportMindmapCommand,
  newMindmapCommand,
  clearMindmapCommand,
  statsCommand,
  autoLayoutCommand,
  themeCommand,
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
  saveCommand,
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
  // Mindmap commands
  importMindmapCommand,
  exportMindmapCommand,
  newMindmapCommand,
  clearMindmapCommand,
  statsCommand,
  autoLayoutCommand,
  themeCommand,
};

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
