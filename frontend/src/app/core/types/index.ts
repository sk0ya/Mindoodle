// Re-export command types from commands/system for backward compatibility
export type {
  CommandArgType,
  ArgPrimitive,
  ArgsMap,
  CommandArg,
  CommandContext,
  CommandResult,
  Command,
  CommandRegistry,
  Direction,
  InsertPosition,
  MarkdownNodeType,
  CommandCategory
} from '@commands/system/types';

export * from './storage.types';