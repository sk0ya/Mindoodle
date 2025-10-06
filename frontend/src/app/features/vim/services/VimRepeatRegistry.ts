/**
 * VimRepeatRegistry
 * Records the last repeatable operation for dot (.) command support
 */

import type { CommandContext } from '@commands/system/types';

/**
 * Represents a repeatable vim operation
 */
export interface RepeatableOperation {
  /** Command name/identifier (e.g., 'vim:delete-node') */
  commandName: string;
  /** Count that was used with the command */
  count: number;
  /** Partial context needed to repeat the operation */
  context: Partial<CommandContext>;
}

export class VimRepeatRegistry {
  private lastChange: RepeatableOperation | null = null;

  /**
   * Record a repeatable operation
   * @param operation - The operation to record
   */
  record(operation: RepeatableOperation): void {
    this.lastChange = operation;
  }

  /**
   * Get the last recorded repeatable operation
   * @returns The last operation, or null if none recorded
   */
  getLastChange(): RepeatableOperation | null {
    return this.lastChange;
  }

  /**
   * Clear the repeat registry
   */
  clear(): void {
    this.lastChange = null;
  }

  /**
   * Check if there is a recorded operation
   */
  hasChange(): boolean {
    return this.lastChange !== null;
  }
}
