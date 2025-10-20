// Re-export from registerCommands to avoid circular dependency
export { allCommandModules, commandCategories, commands, registerAllCommands } from './registerCommands';

// Re-export useCommands hook
export { useCommands } from './system/useCommands';
export type { UseCommandsReturn } from './system/useCommands';
