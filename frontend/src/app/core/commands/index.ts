/**
 * Command System
 * Main entry point for the command-based operation system
 */

// Core types and interfaces
export type {
  Command,
  CommandContext,
  CommandResult,
  CommandArg,
  ParsedCommand,
  ParseResult,
  CommandRegistry,
  ExecuteOptions,
  CommandArgType
} from './types';

// Parser functions
export {
  parseCommand,
  validateCommand,
  generateSuggestions
} from './parser';

// Vim sequence parser
export {
  parseVimSequence,
  isValidVimKey,
  getVimKeys,
  canSequenceContinue
} from './vimSequenceParser';
export type { VimSequenceResult } from './vimSequenceParser';

// Registry implementation
export {
  CommandRegistryImpl,
  getCommandRegistry,
  resetCommandRegistry
} from './registry';

// All available commands
export {
  commands,
  registerAllCommands,
  commandCategories,
  // Individual commands
  centerCommand,
  deleteCommand,
  toggleCommand,
  editCommand,
  insertCommand,
  appendCommand,
  openCommand,
  addChildCommand,
  addSiblingCommand,
  convertNodeCommand,
  navigateCommand,
  upCommand,
  downCommand,
  leftCommand,
  rightCommand
} from './commands/index';

// Direct imports for internal usage
import { getCommandRegistry as getRegistry } from './registry';
import { registerAllCommands as registerAll } from './commands/index';

// React hooks
export {
  useCommands,
  useVimCommands
} from './useCommands';
export type { UseCommandsReturn } from './useCommands';

// Convenience functions for direct usage
export function createCommandSystem() {
  const registry = getRegistry();
  registerAll(registry);
  return registry;
}

// Version info
export const COMMAND_SYSTEM_VERSION = '1.0.0';